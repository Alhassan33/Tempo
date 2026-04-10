// components/DelistModal.jsx
import { useState } from "react";
import { X, AlertCircle, CheckCircle2 } from "lucide-react";
import { useWriteContract, usePublicClient } from "wagmi";
import { supabase } from "@/lib/supabase";

const MARKETPLACE_ADDRESS = "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b";
const CANCEL_ABI = [
  {
    name: "cancelListing",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [],
  },
];

export default function DelistModal({ nft, onClose }) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState(null);
  const [errMsg,  setErrMsg]  = useState("");

  if (!nft) return null;

  async function handleDelist() {
    setLoading(true);
    setStatus(null);
    try {
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: CANCEL_ABI,
        functionName: "cancelListing",
        args: [BigInt(nft.listingId)],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      await supabase
        .from("listings")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("listing_id", Number(nft.listingId));

      setStatus("success");
    } catch (e) {
      setErrMsg(e?.shortMessage || e?.message || "Transaction failed");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={onClose}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d1219", border: "1px solid rgba(239,68,68,0.15)" }}
        onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>Cancel Listing</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9da7b3" }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* NFT preview */}
          <div className="flex gap-4 p-4 rounded-2xl" style={{ background: "#161d28" }}>
            <div className="w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: "#121821" }}>
              {nft.image && <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />}
            </div>
            <div className="flex-1 py-1">
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#22d3ee" }}>
                {nft.collection}
              </div>
              <div className="font-bold text-lg truncate" style={{ color: "#e6edf3" }}>
                {nft.name || `#${nft.tokenId}`}
              </div>
              <div className="font-mono text-sm mt-1" style={{ color: "#9da7b3" }}>
                Listed at <span style={{ color: "#22d3ee" }}>{Number(nft.price).toFixed(2)} USD</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl p-3" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
            <p className="text-xs" style={{ color: "#EF4444" }}>
              This will remove your NFT from the marketplace. You can re-list it at any time.
            </p>
          </div>

          {status === "error" && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444" }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{errMsg}
            </div>
          )}

          {status === "success" ? (
            <div className="flex flex-col items-center py-4">
              <CheckCircle2 size={40} className="mb-3" style={{ color: "#22C55E" }} />
              <div className="font-bold text-lg mb-1" style={{ color: "#e6edf3" }}>Listing Cancelled!</div>
              <p className="text-xs mb-5" style={{ color: "#9da7b3" }}>Your NFT has been removed from the marketplace.</p>
              <button onClick={onClose} className="w-full h-12 rounded-2xl text-sm font-bold"
                style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer" }}>
                Done
              </button>
            </div>
          ) : (
            <button onClick={handleDelist} disabled={loading}
              className="w-full h-14 rounded-2xl text-base font-bold flex items-center justify-center gap-2"
              style={{
                background: loading ? "#161d28" : "rgba(239,68,68,0.15)",
                color:      loading ? "#9da7b3" : "#EF4444",
                border: `1px solid ${loading ? "rgba(255,255,255,0.06)" : "rgba(239,68,68,0.3)"}`,
                cursor: loading ? "not-allowed" : "pointer",
              }}>
              {loading && <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {loading ? "Cancelling..." : "Cancel Listing"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
