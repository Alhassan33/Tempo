// components/DelistModal.jsx
// Modal for canceling/delisting an NFT from the marketplace

import { useState } from "react";
import { X, AlertCircle, CheckCircle2, XCircle } from "lucide-react";
import { useWriteContract, usePublicClient } from "wagmi";
import { supabase } from "@/lib/supabase";
import NFTImage from "./NFTImage.jsx";

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

/**
 * Props:
 *   nft — object with:
 *     listingId or listing_id, tokenId, name, image, collection, price, displayPrice
 *   onClose — close handler
 */
export default function DelistModal({ nft, onClose }) {
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState(null); // null|success|error
  const [errMsg,  setErrMsg]  = useState("");

  if (!nft) return null;

  // Handle both snake_case and camelCase for listing ID
  const listingId = nft.listingId || nft.listing_id;
  
  // Price conversion: raw units -> USD display
  const displayPrice = nft.displayPrice || (Number(nft.price) / 1e6).toFixed(2);

  async function handleDelist() {
    setLoading(true);
    setStatus(null);
    setErrMsg("");
    
    try {
      const hash = await writeContractAsync({
        address: MARKETPLACE_ADDRESS,
        abi: CANCEL_ABI,
        functionName: "cancelListing",
        args: [BigInt(listingId)],
      });
      
      await publicClient.waitForTransactionReceipt({ hash });

      // Update Supabase
      await supabase
        .from("listings")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("listing_id", Number(listingId));

      setStatus("success");
    } catch (e) {
      setErrMsg(e?.shortMessage || e?.message || "Transaction failed");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div 
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={() => { if (!loading) onClose(); }}
    >
      <div 
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d1219", border: "1px solid rgba(239,68,68,0.15)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div 
          className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "#e6edf3" }}>
            Cancel Listing
          </span>
          <button 
            onClick={onClose} 
            disabled={loading}
            style={{ 
              background: "none", 
              border: "none", 
              cursor: loading ? "not-allowed" : "pointer", 
              color: loading ? "#5a6270" : "#9da7b3" 
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* NFT preview */}
          <div className="flex gap-4 p-4 rounded-2xl" style={{ background: "#161d28" }}>
            <div 
              className="w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden" 
              style={{ background: "#121821" }}
            >
              <NFTImage src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 py-1">
              <div 
                className="text-[10px] font-bold uppercase tracking-widest mb-1" 
                style={{ color: "#9da7b3" }}
              >
                {nft.collection}
              </div>
              <div className="font-bold text-lg truncate" style={{ color: "#e6edf3" }}>
                {nft.name || `#${nft.tokenId}`}
              </div>
              <div className="font-mono text-sm mt-1" style={{ color: "#9da7b3" }}>
                Listed at <span style={{ color: "#22d3ee" }}>{displayPrice} USD</span>
              </div>
            </div>
          </div>

          {/* Warning */}
          <div 
            className="rounded-xl p-4 flex items-start gap-3"
            style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}
          >
            <AlertCircle size={16} style={{ color: "#EF4444", flexShrink: 0, marginTop: 2 }} />
            <p className="text-xs" style={{ color: "#EF4444" }}>
              This will remove your NFT from the marketplace. You can re-list it at any time with a different price.
            </p>
          </div>

          {/* Error Message */}
          {status === "error" && (
            <div 
              className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ 
                background: "rgba(239,68,68,0.1)", 
                border: "1px solid rgba(239,68,68,0.3)", 
                color: "#EF4444" 
              }}
            >
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              {errMsg}
            </div>
          )}

          {/* Success State */}
          {status === "success" ? (
            <div className="flex flex-col items-center py-4">
              <CheckCircle2 size={40} className="mb-3" style={{ color: "#22C55E" }} />
              <div className="font-bold text-lg mb-1" style={{ color: "#e6edf3" }}>
                Listing Cancelled!
              </div>
              <p className="text-xs mb-5" style={{ color: "#9da7b3" }}>
                Your NFT has been removed from the marketplace.
              </p>
              <button 
                onClick={onClose} 
                className="w-full h-12 rounded-2xl text-sm font-bold"
                style={{ 
                  background: "rgba(34,211,238,0.1)", 
                  color: "#22d3ee", 
                  border: "1px solid rgba(34,211,238,0.3)", 
                  cursor: "pointer" 
                }}
              >
                Done
              </button>
            </div>
          ) : (
            /* Action Buttons */
            <div className="space-y-3">
              <button 
                onClick={handleDelist} 
                disabled={loading}
                className="w-full h-14 rounded-2xl text-base font-bold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: loading ? "#161d28" : "rgba(239,68,68,0.15)",
                  color:      loading ? "#9da7b3" : "#EF4444",
                  border:     `1px solid ${loading ? "rgba(255,255,255,0.06)" : "rgba(239,68,68,0.3)"}`,
                  cursor:     loading ? "not-allowed" : "pointer",
                  boxShadow:  loading ? "none" : "0 0 20px rgba(239,68,68,0.15)",
                }}
              >
                {loading && (
                  <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                )}
                {!loading && <XCircle size={18} />}
                {loading ? "Cancelling..." : "Cancel Listing"}
              </button>
              
              <button 
                onClick={onClose} 
                disabled={loading}
                className="w-full h-11 rounded-2xl text-sm font-bold"
                style={{
                  background: "transparent",
                  color:      loading ? "#5a6270" : "#9da7b3",
                  border:     "1px solid rgba(255,255,255,0.08)",
                  cursor:     loading ? "not-allowed" : "pointer",
                }}
              >
                Keep Listing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
