// components/BuyModal.jsx
import { useState, useEffect } from "react";
import { X, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";
import { useAccount, usePublicClient, useWriteContract, useChainId } from "wagmi";
import { parseUnits } from "viem";
import NFTImage from "./NFTImage.jsx";

const MARKETPLACE_ADDRESS = "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b";
const PATHUSD_ADDRESS     = "0x20c0000000000000000000000000000000000000";
const TEMPO_CHAIN_ID      = 4217;
const USD_DECIMALS        = 6;

const ERC20_ABI = [
  { name: "allowance", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }] },
  { name: "balanceOf", type: "function", stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }] },
];

const MARKETPLACE_ABI = [
  { name: "buyNFT", type: "function", stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [] },
];

function shortenAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

/**
 * listing shape: { listing_id, token_id, price (USD float), seller, image, name, nft_contract }
 */
export default function BuyModal({ listing, onClose, onSuccess }) {
  const { address, isConnected } = useAccount();
  const chainId       = useChainId();
  const publicClient  = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [step,    setStep]    = useState("idle"); // idle | checking | approving | buying | done | error
  const [msg,     setMsg]     = useState("");
  const [balance, setBalance] = useState(null);

  const wrongNetwork = chainId !== TEMPO_CHAIN_ID;

  // price in human-readable USD (e.g. 25.00)
  const displayPrice = listing?.displayPrice || Number(listing?.price || 0).toFixed(2);
  // raw units for contract (price stored as USD float → parse to 6 decimals)
  const priceRaw = parseUnits(String(Number(displayPrice).toFixed(6)), USD_DECIMALS);

  const isOwner = address?.toLowerCase() === listing?.seller?.toLowerCase();

  // Fetch pathUSD balance on open
  useEffect(() => {
    if (!address || !publicClient || !listing) return;
    publicClient.readContract({
      address: PATHUSD_ADDRESS,
      abi: ERC20_ABI,
      functionName: "balanceOf",
      args: [address],
    }).then(bal => setBalance(bal)).catch(() => {});
  }, [address, publicClient, listing]);

  const balanceUSD = balance != null ? Number(balance) / 10 ** USD_DECIMALS : null;
  const insufficientBalance = balanceUSD != null && balanceUSD < Number(displayPrice);

  async function handleBuy() {
    if (!isConnected || wrongNetwork || !address) return;
    setStep("checking");
    setMsg("Checking allowance...");

    try {
      // 1. Check existing allowance
      const allowance = await publicClient.readContract({
        address: PATHUSD_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address, MARKETPLACE_ADDRESS],
      });

      // 2. Approve if needed
      if (allowance < priceRaw) {
        setStep("approving");
        setMsg("Step 1/2 — Approving pathUSD...");
        const approveHash = await writeContractAsync({
          address: PATHUSD_ADDRESS,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [MARKETPLACE_ADDRESS, priceRaw],
        });
        setMsg("Waiting for approval confirmation...");
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 3. Buy
      setStep("buying");
      setMsg("Step 2/2 — Confirming purchase on Tempo...");
      const buyHash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: MARKETPLACE_ABI,
        functionName: "buyNFT",
        args: [BigInt(listing.listing_id)],
      });
      setMsg("Waiting for transaction confirmation...");
      await publicClient.waitForTransactionReceipt({ hash: buyHash });

      // 4. Instant-hide in Supabase
      try {
        const { supabase } = await import("@/lib/supabase");
        await supabase
          .from("listings")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("listing_id", Number(listing.listing_id));
      } catch {}

      setStep("done");
      setMsg("Purchase complete!");
      onSuccess?.();

    } catch (e) {
      setStep("error");
      setMsg(e?.shortMessage || e?.message || "Transaction failed");
    }
  }

  if (!listing) return null;

  return (
    // Bottom sheet on mobile, centered on desktop
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={() => { if (step !== "approving" && step !== "buying") onClose(); }}>

      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: "#0d1219", border: "1px solid rgba(34,211,238,0.12)", maxHeight: "92vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}>

        {/* Drag handle (mobile) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full" style={{ background: "rgba(255,255,255,0.12)" }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h3 className="text-base font-bold uppercase tracking-tight" style={{ color: "#e6edf3" }}>
            Complete Purchase
          </h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9da7b3" }}>
            <X size={20} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">

          {/* NFT Preview */}
          <div className="flex gap-4 p-4 rounded-2xl" style={{ background: "#161d28" }}>
            <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0" style={{ background: "#121821" }}>
              <NFTImage src={listing.image} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0 py-1">
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "#22d3ee" }}>
                {listing.collection_name || listing.name?.split(" #")[0] || "NFT"}
              </div>
              <div className="text-xl font-extrabold truncate" style={{ color: "#e6edf3" }}>
                {listing.name || `#${listing.token_id}`}
              </div>
              <div className="text-xs mt-1" style={{ color: "#9da7b3" }}>
                Seller: {shortenAddr(listing.seller)}
              </div>
            </div>
          </div>

          {/* Price breakdown */}
          <div className="rounded-2xl p-4 space-y-3"
            style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}>
            <div className="flex justify-between text-sm">
              <span style={{ color: "#9da7b3" }}>NFT Price</span>
              <span className="font-mono font-bold" style={{ color: "#e6edf3" }}>{displayPrice} USD</span>
            </div>
            <div className="flex justify-between text-sm">
              <span style={{ color: "#9da7b3" }}>Platform Fee</span>
              <span className="font-mono font-bold" style={{ color: "#9da7b3" }}>~2.5%</span>
            </div>
            <div className="pt-2 border-t flex justify-between items-center"
              style={{ borderColor: "rgba(255,255,255,0.06)" }}>
              <span className="font-bold" style={{ color: "#e6edf3" }}>Total</span>
              <div className="text-right">
                <div className="font-mono text-2xl font-bold" style={{ color: "#22d3ee" }}>
                  {displayPrice} USD
                </div>
                <div className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9da7b3" }}>
                  Paid in pathUSD
                </div>
              </div>
            </div>
          </div>

          {/* Balance warning */}
          {balanceUSD != null && (
            <div className="flex justify-between text-xs">
              <span style={{ color: "#9da7b3" }}>Your pathUSD balance</span>
              <span className={`font-mono font-bold ${insufficientBalance ? "text-red-400" : ""}`}
                style={!insufficientBalance ? { color: "#22d3ee" } : {}}>
                {balanceUSD.toFixed(2)} USD
              </span>
            </div>
          )}

          {/* Network / owner warnings */}
          {wrongNetwork && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}>
              <AlertCircle size={13} /> Switch to Tempo Mainnet to continue.
            </div>
          )}
          {isOwner && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}>
              <AlertCircle size={13} /> You cannot buy your own listing.
            </div>
          )}
          {insufficientBalance && !wrongNetwork && (
            <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}>
              <AlertCircle size={13} /> Insufficient pathUSD balance.
            </div>
          )}

          {/* Step indicator */}
          {(step === "approving" || step === "buying") && (
            <div className="flex items-center gap-3">
              {/* Step 1 */}
              <div className="flex items-center gap-2 flex-1 rounded-xl px-3 py-2"
                style={{ background: step === "approving" ? "rgba(34,211,238,0.08)" : "rgba(34,197,94,0.08)", border: `1px solid ${step === "approving" ? "rgba(34,211,238,0.2)" : "rgba(34,197,94,0.2)"}` }}>
                {step === "approving"
                  ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ color: "#22d3ee" }} />
                  : <CheckCircle2 size={13} style={{ color: "#22C55E" }} />}
                <span className="text-xs font-semibold" style={{ color: step === "approving" ? "#22d3ee" : "#22C55E" }}>
                  Approve
                </span>
              </div>
              <ArrowRight size={12} style={{ color: "#9da7b3", flexShrink: 0 }} />
              {/* Step 2 */}
              <div className="flex items-center gap-2 flex-1 rounded-xl px-3 py-2"
                style={{ background: step === "buying" ? "rgba(34,211,238,0.08)" : "rgba(255,255,255,0.04)", border: `1px solid ${step === "buying" ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                {step === "buying"
                  ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin flex-shrink-0" style={{ color: "#22d3ee" }} />
                  : <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: "rgba(157,167,179,0.3)" }} />}
                <span className="text-xs font-semibold" style={{ color: step === "buying" ? "#22d3ee" : "#9da7b3" }}>
                  Purchase
                </span>
              </div>
            </div>
          )}

          {/* Status message */}
          {msg && step !== "idle" && step !== "done" && (
            <div className="rounded-xl px-3 py-2.5 text-xs"
              style={{
                background: step === "error" ? "rgba(239,68,68,0.1)" : "rgba(34,211,238,0.06)",
                border: `1px solid ${step === "error" ? "rgba(239,68,68,0.2)" : "rgba(34,211,238,0.15)"}`,
                color: step === "error" ? "#EF4444" : "#22d3ee",
              }}>
              {msg}
            </div>
          )}

          {/* Done state */}
          {step === "done" ? (
            <div className="flex flex-col items-center py-4">
              <CheckCircle2 size={44} className="mb-3" style={{ color: "#22C55E" }} />
              <div className="font-extrabold text-xl mb-1" style={{ color: "#e6edf3" }}>Purchase Complete!</div>
              <p className="text-sm mb-5" style={{ color: "#9da7b3" }}>
                {listing.name || `#${listing.token_id}`} is now yours.
              </p>
              <button onClick={onClose} className="w-full h-12 rounded-2xl font-bold text-sm"
                style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer" }}>
                Done 🎉
              </button>
            </div>
          ) : (
            <button
              onClick={handleBuy}
              disabled={
                !isConnected || wrongNetwork || isOwner || insufficientBalance ||
                step === "checking" || step === "approving" || step === "buying"
              }
              className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2 transition-all"
              style={{
                background: (wrongNetwork || isOwner || insufficientBalance || step === "checking" || step === "approving" || step === "buying")
                  ? "#161d28"
                  : "#22d3ee",
                color: (wrongNetwork || isOwner || insufficientBalance || step === "checking" || step === "approving" || step === "buying")
                  ? "#9da7b3"
                  : "#0b0f14",
                border: "none",
                cursor: (wrongNetwork || isOwner || insufficientBalance || step === "checking" || step === "approving" || step === "buying")
                  ? "not-allowed"
                  : "pointer",
                boxShadow: (step === "idle" && !wrongNetwork && !isOwner && !insufficientBalance)
                  ? "0 0 20px rgba(34,211,238,0.25)"
                  : "none",
              }}>
              {(step === "checking" || step === "approving" || step === "buying") && (
                <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {step === "idle"     && "Confirm Purchase"}
              {step === "checking" && "Checking..."}
              {step === "approving"&& "Approving pathUSD..."}
              {step === "buying"   && "Confirming on Tempo..."}
              {step === "error"    && "Try Again"}
            </button>
          )}

          {step !== "done" && (
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "#9da7b3" }}>
              <ShieldCheck size={13} style={{ color: "#22d3ee" }} />
              Secured by Tempo Marketplace
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
