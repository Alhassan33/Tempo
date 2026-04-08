import { useState } from "react";
import { X, Tag, CheckCircle2, AlertCircle } from "lucide-react";
import { useMarketplace } from "@/hooks/useMarketplace";

// 1. Add 'contractAddress' to the props
export default function ListModal({ nft, contractAddress, onClose }) {
  const { listNFT, loading, txStatus, clearStatus } = useMarketplace();
  const [price, setPrice] = useState("");

  // 2. Remove the hardcoded NFT_CONTRACT line that was here

  async function handleList() {
    if (!price || isNaN(price) || Number(price) <= 0) return;
    clearStatus();
    
    // 3. Use the prop instead of the hardcoded variable
    await listNFT({
      nftContract: contractAddress,
      tokenId: nft.tokenId,
      price: price,
    });
  }

  const isDone = txStatus?.type === "success";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }}
      onClick={onClose}>
      
      {/* ... keep the rest of your UI code exactly as it is ... */}

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <Tag size={14} style={{ color: "#22d3ee" }} />
            <h2 className="text-base font-bold" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
              List for Sale
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9da7b3" }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* NFT preview */}
          {nft && (
            <div className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.04)" }}>
              <div className="w-14 h-14 rounded-xl flex-shrink-0 overflow-hidden"
                style={{ background: "#161d28" }}>
                {nft.image && <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />}
              </div>
              <div>
                <div className="text-xs mb-0.5" style={{ color: "#9da7b3" }}>{nft.collection ?? "TEMPONYAW"}</div>
                <div className="font-bold text-sm" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
                  {nft.name ?? `#${nft.tokenId}`}
                </div>
              </div>
            </div>
          )}

          {/* Price input */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
              style={{ color: "#9da7b3" }}>
              Price (USD)
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="0.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full h-12 rounded-xl px-4 pr-16 text-base outline-none"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", fontFamily: "Space Mono, monospace" }}
                onFocus={(e) => e.target.style.borderColor = "#22d3ee"}
                onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold"
                style={{ color: "#9da7b3" }}>USD</span>
            </div>
          </div>

          {/* Fee info */}
          <div className="rounded-xl p-3 space-y-2"
            style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}>
            {[
              { label: "Marketplace Fee", value: "2.5%" },
              { label: "You Receive", value: price ? `${(Number(price) * 0.975).toFixed(2)} USD` : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-xs">
                <span style={{ color: "#9da7b3" }}>{label}</span>
                <span className="font-mono font-semibold" style={{ color: "#e6edf3" }}>{value}</span>
              </div>
            ))}
          </div>

          {/* Status */}
          {txStatus && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{
                background: txStatus.type === "error" ? "rgba(239,68,68,0.1)" : txStatus.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(34,211,238,0.1)",
                border: `1px solid ${txStatus.type === "error" ? "rgba(239,68,68,0.3)" : txStatus.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(34,211,238,0.3)"}`,
                color: txStatus.type === "error" ? "#EF4444" : txStatus.type === "success" ? "#22C55E" : "#22d3ee",
              }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
              {txStatus.msg}
            </div>
          )}

          {/* CTA */}
          {isDone ? (
            <div className="flex flex-col items-center py-2">
              <CheckCircle2 size={32} className="mb-2" style={{ color: "#22C55E" }} />
              <div className="font-bold mb-3" style={{ color: "#e6edf3" }}>Listed Successfully!</div>
              <button onClick={onClose} className="w-full h-10 rounded-xl text-sm font-bold"
                style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                Done
              </button>
            </div>
          ) : (
            <button onClick={handleList} disabled={loading || !price || Number(price) <= 0}
              className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{
                background: loading || !price ? "#161d28" : "#22d3ee",
                color: loading || !price ? "#9da7b3" : "#0b0f14",
                border: "none",
                cursor: loading || !price ? "not-allowed" : "pointer",
                fontFamily: "Syne, sans-serif",
              }}>
              {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {loading ? "Confirming..." : "List NFT"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
