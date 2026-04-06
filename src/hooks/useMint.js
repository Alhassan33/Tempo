// hooks/useMint.js
import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, formatUnits } from "viem";

// ─── Minimal ABIs ─────────────────────────────────────────────────────────────
const MINT_ABI = [
  {
    name: "activePhase",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "int256" }],
  },
  {
    name: "totalPhases",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "phases",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint256" }],
    outputs: [
      { name: "name",         type: "string"  },
      { name: "startTime",    type: "uint256" },
      { name: "endTime",      type: "uint256" },
      { name: "price",        type: "uint256" },
      { name: "maxSupply",    type: "uint256" },
      { name: "maxPerWallet", type: "uint256" },
      { name: "merkleRoot",   type: "bytes32" },
      { name: "active",       type: "bool"    },
      { name: "minted",       type: "uint256" },
    ],
  },
  {
    name: "totalMinted",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "maxSupply",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "mintedPerWallet",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "", type: "address" },
      { name: "", type: "uint256" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "pathUSD",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "mint",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "phaseId",     type: "uint256"   },
      { name: "quantity",    type: "uint256"   },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [],
  },
];

const ERC20_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner",   type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "approve",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount",  type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "decimals",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
  },
];

// USD token uses 6 decimals (USDC-style)
const USD_DECIMALS = 6;

// ─── usePhases — read all phases from the contract ───────────────────────────
export function usePhases(nftContract) {
  const publicClient = usePublicClient();
  const [phases, setPhases]           = useState([]);
  const [activePhaseId, setActiveId]  = useState(null);
  const [totalMinted, setTotalMinted] = useState(0n);
  const [maxSupply, setMaxSupply]     = useState(0n);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

  const reload = useCallback(async () => {
    if (!nftContract || !publicClient) return;
    setLoading(true);
    setError(null);
    try {
      const [activeRaw, totalPhasesRaw, totalMintedRaw, maxSupplyRaw] =
        await Promise.all([
          publicClient.readContract({ address: nftContract, abi: MINT_ABI, functionName: "activePhase" }),
          publicClient.readContract({ address: nftContract, abi: MINT_ABI, functionName: "totalPhases" }),
          publicClient.readContract({ address: nftContract, abi: MINT_ABI, functionName: "totalMinted" }),
          publicClient.readContract({ address: nftContract, abi: MINT_ABI, functionName: "maxSupply" }),
        ]);

      setActiveId(activeRaw); // int256, -1 = none
      setTotalMinted(totalMintedRaw);
      setMaxSupply(maxSupplyRaw);

      const count = Number(totalPhasesRaw);
      const phaseData = await Promise.all(
        Array.from({ length: count }, (_, i) =>
          publicClient.readContract({
            address: nftContract,
            abi: MINT_ABI,
            functionName: "phases",
            args: [BigInt(i)],
          }).then((p) => ({
            id:           i,
            name:         p[0],
            startTime:    p[1],
            endTime:      p[2],
            price:        p[3],        // in USD_DECIMALS
            maxSupply:    p[4],
            maxPerWallet: p[5],
            merkleRoot:   p[6],
            active:       p[7],
            minted:       p[8],
            isAllowlist:  p[6] !== "0x0000000000000000000000000000000000000000000000000000000000000000",
          }))
        )
      );
      setPhases(phaseData);
    } catch (e) {
      setError(e.shortMessage ?? e.message);
    } finally {
      setLoading(false);
    }
  }, [nftContract, publicClient]);

  useEffect(() => { reload(); }, [reload]);

  return { phases, activePhaseId, totalMinted, maxSupply, loading, error, reload };
}

// ─── useWalletMintState — per-wallet minted count for active phase ─────────
export function useWalletMintState(nftContract, phaseId) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [mintedByWallet, setMinted] = useState(0n);

  useEffect(() => {
    if (!nftContract || !address || phaseId == null || phaseId < 0) return;
    publicClient.readContract({
      address: nftContract,
      abi: MINT_ABI,
      functionName: "mintedPerWallet",
      args: [address, BigInt(phaseId)],
    }).then(setMinted).catch(() => {});
  }, [nftContract, address, phaseId, publicClient]);

  return { mintedByWallet };
}

// ─── useMint — approve ERC-20 then call mint() ───────────────────────────────
export function useMint(nftContract) {
  const { address }          = useAccount();
  const publicClient         = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [step, setStep]   = useState("idle"); // idle | approving | minting | done | error
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  // step: idle → approving → minting → done
  const mint = useCallback(async ({
    phaseId,
    quantity,
    pricePerToken,    // bigint, in USD_DECIMALS units (from contract)
    merkleProof = [], // [] for public phases
  }) => {
    if (!address || !walletClient || !nftContract) return;
    setStep("idle");
    setError(null);
    setTxHash(null);

    try {
      const totalCost = pricePerToken * BigInt(quantity);

      // 1. Get pathUSD address from contract
      const pathUSDAddress = await publicClient.readContract({
        address: nftContract,
        abi: MINT_ABI,
        functionName: "pathUSD",
      });

      // 2. Check existing allowance
      const allowance = await publicClient.readContract({
        address: pathUSDAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, nftContract],
      });

      // 3. Approve if needed
      if (allowance < totalCost) {
        setStep("approving");
        const approveTx = await walletClient.writeContract({
          address: pathUSDAddress,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [nftContract, totalCost],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
      }

      // 4. Mint
      setStep("minting");
      const mintTx = await walletClient.writeContract({
        address: nftContract,
        abi: MINT_ABI,
        functionName: "mint",
        args: [BigInt(phaseId), BigInt(quantity), merkleProof],
      });
      await publicClient.waitForTransactionReceipt({ hash: mintTx });
      setTxHash(mintTx);
      setStep("done");
    } catch (e) {
      setError(e.shortMessage ?? e.message ?? "Transaction failed");
      setStep("error");
    }
  }, [address, walletClient, publicClient, nftContract]);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(null);
  }, []);

  return { mint, step, error, txHash, reset };
}

// ─── Helpers (exported for MintPage) ─────────────────────────────────────────
export function formatPrice(priceBigInt) {
  return formatUnits(priceBigInt, USD_DECIMALS);
}

export function isPublicPhase(phase) {
  return phase.merkleRoot === "0x0000000000000000000000000000000000000000000000000000000000000000";
}
