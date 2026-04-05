import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi";
import { parseUnits, formatUnits, maxUint256 } from "viem";
import { useState, useCallback } from "react";
import {
  MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  ERC20_ABI,
  ERC721_ABI,
} from "./contracts";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Listing {
  listingId: bigint;
  seller: `0x${string}`;
  nftContract: `0x${string}`;
  tokenId: bigint;
  price: bigint;
  active: boolean;
  // UI helpers (formatted)
  priceFormatted: string;
}

// ─── 1. useMarketplaceInfo ────────────────────────────────────────────────────
// Reads pathUSD token address + fee from the contract
export function useMarketplaceInfo() {
  const { data: pathUSD } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "pathUSD",
  });

  const { data: feeBasisPoints } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "feeBasisPoints",
  });

  const { data: paused } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "paused",
  });

  const feePercent = feeBasisPoints ? Number(feeBasisPoints) / 100 : 0;

  return { pathUSD, feeBasisPoints, feePercent, paused };
}

// ─── 2. useTotalListings ──────────────────────────────────────────────────────
export function useTotalListings() {
  return useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "totalListings",
  });
}

// ─── 3. useListing ───────────────────────────────────────────────────────────
// Fetch a single listing by ID
export function useListing(listingId: bigint | undefined) {
  const { data, isLoading, error, refetch } = useReadContract({
    address: MARKETPLACE_ADDRESS,
    abi: MARKETPLACE_ABI,
    functionName: "getListing",
    args: listingId !== undefined ? [listingId] : undefined,
    query: { enabled: listingId !== undefined },
  });

  const listing: Listing | undefined = data
    ? {
        listingId: listingId!,
        seller:      data.seller,
        nftContract: data.nftContract,
        tokenId:     data.tokenId,
        price:       data.price,
        active:      data.active,
        priceFormatted: formatUnits(data.price, 6), // pathUSD = 6 decimals (USDC-like)
      }
    : undefined;

  return { listing, isLoading, error, refetch };
}

// ─── 4. useBuyNFT ─────────────────────────────────────────────────────────────
// Full buy flow: approve pathUSD → buyNFT
// Returns a single `buy(listingId, price)` function that handles both steps
export function useBuyNFT(pathUSDAddress: `0x${string}` | undefined) {
  const { address } = useAccount();
  const [step, setStep] = useState<"idle" | "approving" | "buying" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync: approveAsync } = useWriteContract();
  const { writeContractAsync: buyAsync }     = useWriteContract();

  const buy = useCallback(
    async (listingId: bigint, price: bigint) => {
      if (!address || !pathUSDAddress) return;
      setError(null);

      try {
        // Step 1 — Approve marketplace to spend pathUSD
        setStep("approving");
        const approveTx = await approveAsync({
          address: pathUSDAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [MARKETPLACE_ADDRESS, price], // approve exact price (or maxUint256 for UX)
        });
        // Wait for approve to confirm before buying
        await waitForTx(approveTx);

        // Step 2 — Buy the NFT
        setStep("buying");
        const buyTx = await buyAsync({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: "buyNFT",
          args: [listingId],
        });
        await waitForTx(buyTx);

        setStep("done");
      } catch (e: any) {
        setError(e?.shortMessage || e?.message || "Transaction failed");
        setStep("error");
      }
    },
    [address, pathUSDAddress, approveAsync, buyAsync]
  );

  return { buy, step, error, isLoading: step === "approving" || step === "buying" };
}

// ─── 5. useListNFT ───────────────────────────────────────────────────────────
// Full list flow: setApprovalForAll (ERC-721) → listNFT
export function useListNFT() {
  const { address } = useAccount();
  const [step, setStep] = useState<"idle" | "approving" | "listing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const { writeContractAsync: approveAsync } = useWriteContract();
  const { writeContractAsync: listAsync }    = useWriteContract();

  const listNFT = useCallback(
    async (
      nftContract: `0x${string}`,
      tokenId: bigint,
      priceUSD: string // human-readable, e.g. "10.5"
    ) => {
      if (!address) return;
      setError(null);

      try {
        const price = parseUnits(priceUSD, 6); // 6 decimals for pathUSD

        // Step 1 — Approve marketplace to transfer this NFT
        setStep("approving");
        const approveTx = await approveAsync({
          address: nftContract,
          abi: ERC721_ABI,
          functionName: "setApprovalForAll",
          args: [MARKETPLACE_ADDRESS, true],
        });
        await waitForTx(approveTx);

        // Step 2 — List the NFT
        setStep("listing");
        const listTx = await listAsync({
          address: MARKETPLACE_ADDRESS,
          abi: MARKETPLACE_ABI,
          functionName: "listNFT",
          args: [nftContract, tokenId, price],
        });
        await waitForTx(listTx);

        setStep("done");
      } catch (e: any) {
        setError(e?.shortMessage || e?.message || "Transaction failed");
        setStep("error");
      }
    },
    [address, approveAsync, listAsync]
  );

  return { listNFT, step, error, isLoading: step === "approving" || step === "listing" };
}

// ─── 6. useCancelListing ─────────────────────────────────────────────────────
export function useCancelListing() {
  const { writeContract, isPending, isSuccess, error, data: hash } = useWriteContract();

  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const cancel = (listingId: bigint) => {
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: "cancelListing",
      args: [listingId],
    });
  };

  return {
    cancel,
    isLoading: isPending || isConfirming,
    isSuccess,
    error: error?.message,
  };
}

// ─── 7. useUpdatePrice ───────────────────────────────────────────────────────
export function useUpdatePrice() {
  const { writeContract, isPending, isSuccess, error, data: hash } = useWriteContract();
  const { isLoading: isConfirming } = useWaitForTransactionReceipt({ hash });

  const updatePrice = (listingId: bigint, newPriceUSD: string) => {
    const price = parseUnits(newPriceUSD, 6);
    writeContract({
      address: MARKETPLACE_ADDRESS,
      abi: MARKETPLACE_ABI,
      functionName: "updatePrice",
      args: [listingId, price],
    });
  };

  return {
    updatePrice,
    isLoading: isPending || isConfirming,
    isSuccess,
    error: error?.message,
  };
}

// ─── 8. usePathUSDBalance ────────────────────────────────────────────────────
// Check buyer's pathUSD balance before purchase
export function usePathUSDBalance(
  pathUSDAddress: `0x${string}` | undefined,
  userAddress: `0x${string}` | undefined
) {
  const { data: raw } = useReadContract({
    address: pathUSDAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!pathUSDAddress && !!userAddress },
  });

  return {
    raw,
    formatted: raw ? formatUnits(raw, 6) : "0",
  };
}

// ─── Helper: wait for tx confirmation via RPC ─────────────────────────────────
// Simple polling helper used inside multi-step flows
async function waitForTx(hash: `0x${string}`) {
  // wagmi's useWaitForTransactionReceipt is hook-based so can't be used inside
  // callbacks. We use a simple fetch-based poll against the Tempo RPC instead.
  const rpc = "https://rpc.moderato.tempo.xyz";
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const res = await fetch(rpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [hash],
        id: 1,
      }),
    });
    const { result } = await res.json();
    if (result?.status === "0x1") return result;
    if (result?.status === "0x0") throw new Error("Transaction reverted");
  }
  throw new Error("Transaction timed out");
}
