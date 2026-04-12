/**
 * hooks/useMint.js
 *
 * V2 Launchpad Hook
 *
 * Contracts:
 *   Launchpad factory: 0x0451929d3c5012978127A2e347d207Aa8b67f14d
 *   Fee recipient:     0x2b063f43217898383af4147952a2838e1d1971e3
 *   pathUSD:           0x20c0000000000000000000000000000000000000
 *
 * Price convention: all prices in raw 6-decimal pathUSD units
 *   e.g. $1.00 = 1_000_000  |  $0.05 flat fee = 50_000
 *
 * Phases (0-indexed on-chain):
 *   0 = OG           (merkle allowlist — optional)
 *   1 = Whitelist    (merkle allowlist — optional)
 *   2 = Public       (open, mandatory, empty merkle proof)
 *
 * Mint flow:
 *   1. quoteMintCost(phaseId, qty) → totalCost (includes perMintFlatFee * qty)
 *   2. ERC20.approve(nftContract, totalCost)
 *   3. mint(phaseId, qty, merkleProof)   ← proof = [] for public phase
 */

import { useState, useEffect, useCallback } from "react";
import { usePublicClient, useWriteContract, useAccount } from "wagmi";
import { parseUnits } from "viem";

// ─── Constants ────────────────────────────────────────────────────────────────
export const PATHUSD_ADDRESS    = "0x20c0000000000000000000000000000000000000";
export const FEE_RECIPIENT      = "0x2b063f43217898383af4147952a2838e1d1971e3";
export const PLATFORM_FEE_RAW   = 50_000n; // $0.05 per mint in raw 6-decimal units
export const USD_DECIMALS       = 6;

// Phase IDs
export const PHASE_OG        = 0;
export const PHASE_WHITELIST = 1;
export const PHASE_PUBLIC    = 2;

// Phase metadata (display only — actual config lives on-chain)
export const PHASE_META = {
  [PHASE_OG]:        { name: "OG",        label: "OG",        color: "#f59e0b", isAllowlist: true  },
  [PHASE_WHITELIST]: { name: "Whitelist",  label: "Whitelist", color: "#a78bfa", isAllowlist: true  },
  [PHASE_PUBLIC]:    { name: "Public",     label: "Public",    color: "#22d3ee", isAllowlist: false },
};

// ─── Minimal ABIs ─────────────────────────────────────────────────────────────
export const COLLECTION_ABI = [
  // Read
  { name: "totalMinted",      type: "function", stateMutability: "view",       inputs: [],                                                                     outputs: [{ name: "", type: "uint256" }] },
  { name: "maxSupply",        type: "function", stateMutability: "view",       inputs: [],                                                                     outputs: [{ name: "", type: "uint256" }] },
  { name: "totalPhases",      type: "function", stateMutability: "view",       inputs: [],                                                                     outputs: [{ name: "", type: "uint256" }] },
  { name: "activePhase",      type: "function", stateMutability: "view",       inputs: [],                                                                     outputs: [{ name: "", type: "int256"  }] },
  { name: "mintedPerWallet",  type: "function", stateMutability: "view",       inputs: [{ name: "", type: "address" }, { name: "", type: "uint256" }],          outputs: [{ name: "", type: "uint256" }] },
  { name: "quoteMintCost",    type: "function", stateMutability: "view",       inputs: [{ name: "phaseId", type: "uint256" }, { name: "quantity", type: "uint256" }], outputs: [{ name: "totalCost", type: "uint256" }] },
  {
    name: "getPhase", type: "function", stateMutability: "view",
    inputs: [{ name: "phaseId", type: "uint256" }],
    outputs: [{
      name: "", type: "tuple",
      components: [
        { name: "name",          type: "string"  },
        { name: "startTime",     type: "uint256" },
        { name: "endTime",       type: "uint256" },
        { name: "price",         type: "uint256" },
        { name: "maxSupply",     type: "uint256" },
        { name: "maxPerWallet",  type: "uint256" },
        { name: "merkleRoot",    type: "bytes32" },
        { name: "active",        type: "bool"    },
        { name: "minted",        type: "uint256" },
      ],
    }],
  },
  // Write
  { name: "mint", type: "function", stateMutability: "nonpayable",
    inputs: [
      { name: "phaseId",     type: "uint256"   },
      { name: "quantity",    type: "uint256"   },
      { name: "merkleProof", type: "bytes32[]" },
    ],
    outputs: [],
  },
];

export const ERC20_ABI = [
  { name: "allowance", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Raw 6-decimal → human USD string */
export function formatPrice(raw) {
  if (!raw && raw !== 0n) return "0.00";
  return (Number(raw) / 1_000_000).toFixed(2);
}

/** Phase 2 (Public) uses empty merkle proof */
export function getMerkleProof(phaseId, _address) {
  if (phaseId === PHASE_PUBLIC) return [];
  // For OG/Whitelist: proof should be passed in by parent component
  // Return empty for now — projects using allowlist must supply proofs
  return [];
}

/** Determine phase status from on-chain data */
export function phaseStatus(phase) {
  if (!phase) return "inactive";
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (!phase.active) return "inactive";
  if (now < phase.startTime) return "upcoming";
  if (phase.endTime > 0n && now > phase.endTime) return "ended";
  return "live";
}

/** Is this the public (open) phase? */
export function isPublicPhase(phase) {
  return !phase || phase.merkleRoot === "0x0000000000000000000000000000000000000000000000000000000000000000";
}

// ─── usePhases — load all phases + supply from contract ─────────────────────
export function usePhases(nftContract) {
  const publicClient = usePublicClient();
  const [phases,      setPhases]      = useState([]);
  const [totalMinted, setTotalMinted] = useState(0n);
  const [maxSupply,   setMaxSupply]   = useState(0n);
  const [activePhaseId, setActivePhaseId] = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState(null);

  const load = useCallback(async () => {
    if (!nftContract || !publicClient) return;
    setLoading(true);
    setError(null);
    try {
      const addr = nftContract;

      const [minted, max, totalP, activeP] = await Promise.all([
        publicClient.readContract({ address: addr, abi: COLLECTION_ABI, functionName: "totalMinted" }),
        publicClient.readContract({ address: addr, abi: COLLECTION_ABI, functionName: "maxSupply"   }),
        publicClient.readContract({ address: addr, abi: COLLECTION_ABI, functionName: "totalPhases" }),
        publicClient.readContract({ address: addr, abi: COLLECTION_ABI, functionName: "activePhase" }).catch(() => -1n),
      ]);

      setTotalMinted(minted);
      setMaxSupply(max);
      setActivePhaseId(activeP);

      const phaseCount = Number(totalP);
      if (phaseCount === 0) { setPhases([]); setLoading(false); return; }

      const fetched = await Promise.all(
        Array.from({ length: phaseCount }, (_, i) =>
          publicClient.readContract({ address: addr, abi: COLLECTION_ABI, functionName: "getPhase", args: [BigInt(i)] })
            .then(p => ({ id: i, ...p }))
            .catch(() => null)
        )
      );

      setPhases(fetched.filter(Boolean));
    } catch (e) {
      console.error("[usePhases]", e);
      setError(e.shortMessage || e.message || "Failed to load phases");
    } finally {
      setLoading(false);
    }
  }, [nftContract, publicClient]);

  useEffect(() => { load(); }, [load]);

  return { phases, totalMinted, maxSupply, activePhaseId, loading, error, reload: load };
}

// ─── useWalletMintState — how many has this wallet minted in a phase ─────────
export function useWalletMintState(nftContract, phaseId) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [mintedByWallet, setMintedByWallet] = useState(0n);

  useEffect(() => {
    if (!nftContract || !address || phaseId == null || !publicClient) return;
    publicClient.readContract({
      address: nftContract,
      abi: COLLECTION_ABI,
      functionName: "mintedPerWallet",
      args: [address, BigInt(phaseId)],
    }).then(setMintedByWallet).catch(() => {});
  }, [nftContract, address, phaseId, publicClient]);

  return { mintedByWallet };
}

// ─── useQuoteMintCost — live cost quote from contract ─────────────────────────
export function useQuoteMintCost(nftContract, phaseId, quantity) {
  const publicClient = usePublicClient();
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nftContract || phaseId == null || !quantity || !publicClient) { setQuote(null); return; }
    setLoading(true);
    publicClient.readContract({
      address: nftContract,
      abi: COLLECTION_ABI,
      functionName: "quoteMintCost",
      args: [BigInt(phaseId), BigInt(quantity)],
    }).then(cost => {
      setQuote(cost);
      setLoading(false);
    }).catch(() => { setQuote(null); setLoading(false); });
  }, [nftContract, phaseId, quantity, publicClient]);

  return { quote, loading };
}

// ─── usePathUSDBalance — user's pathUSD balance ───────────────────────────────
export function usePathUSDBalance() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [balance, setBalance] = useState(null);

  useEffect(() => {
    if (!address || !publicClient) return;
    publicClient.readContract({
      address: PATHUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    }).then(setBalance).catch(() => {});
  }, [address, publicClient]);

  return balance;
}

// ─── useMint — execute a mint transaction ────────────────────────────────────
export function useMint(nftContract) {
  const publicClient             = usePublicClient();
  const { writeContractAsync }   = useWriteContract();
  const { address }              = useAccount();

  const [step,   setStep]   = useState("idle"); // idle | approving | minting | done | error
  const [error,  setError]  = useState(null);
  const [txHash, setTxHash] = useState(null);

  function reset() {
    setStep("idle");
    setError(null);
    setTxHash(null);
  }

  async function mint({ phaseId, quantity, merkleProof = [], quotedCost }) {
    if (!nftContract || !address) return;
    setStep("approving");
    setError(null);
    setTxHash(null);

    try {
      // Use quoted cost from contract — includes $0.05 flat fee per mint
      let totalCost = quotedCost;
      if (!totalCost) {
        totalCost = await publicClient.readContract({
          address: nftContract,
          abi: COLLECTION_ABI,
          functionName: "quoteMintCost",
          args: [BigInt(phaseId), BigInt(quantity)],
        });
      }

      // 1. Check & approve pathUSD if needed
      const allowance = await publicClient.readContract({
        address: PATHUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, nftContract],
      });

      if (BigInt(allowance) < BigInt(totalCost)) {
        const approveHash = await writeContractAsync({
          address: PATHUSD_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [nftContract, BigInt(totalCost)],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 2. Mint — proof is [] for public phase
      setStep("minting");
      const mintHash = await writeContractAsync({
        address: nftContract,
        abi: COLLECTION_ABI,
        functionName: "mint",
        args: [BigInt(phaseId), BigInt(quantity), merkleProof],
      });
      await publicClient.waitForTransactionReceipt({ hash: mintHash });

      setTxHash(mintHash);
      setStep("done");
      return mintHash;

    } catch (e) {
      const msg = e?.shortMessage || e?.message || "Transaction failed";
      setError(
        msg.includes("InsufficientBalance") ? "Insufficient pathUSD balance" :
        msg.includes("NotInPhase")          ? "Not eligible for this phase (allowlist)" :
        msg.includes("PhaseNotActive")      ? "Phase is not active" :
        msg.includes("ExceedsMaxPerWallet") ? "Exceeds max per wallet for this phase" :
        msg.includes("SoldOut")             ? "Sold out!" :
        msg.includes("user rejected")       ? "Transaction cancelled" :
        msg.slice(0, 100)
      );
      setStep("error");
    }
  }

  return { mint, step, error, txHash, reset };
}
