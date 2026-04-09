// components/ListModal.jsx
import { useState } from "react";
import { X, Tag, CheckCircle2, AlertCircle } from "lucide-react";
import { useMarketplace } from "@/hooks/useMarketplace";

// Trait accent colors
const TRAIT_COLORS = [
  { color: "#22d3ee", bg: "rgba(34,211,238,0.08)",  border: "rgba(34,211,238,0.2)"  },
  { color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
  { color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.2)"  },
  { color: "#f472b6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.2)" },
  { color: "#facc15", bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.2)"  },
];

function traitColor(i) { return TRAIT_COLORS[i % TRAIT_COLORS.length]; }

/**
 * nft prop shape:
 * { tokenId, contract, name, image, attributes, collection, slug }
 */
export default function ListModal({ nft, onClose }) {
  const { listNFT, loading, txStatus, clearStatus } = useMarketplace();
  const [price, setPrice] = useState("");

  if (!nft) return null;

  const traits = Array.isArray(nft.attributes) ? nft.attributes : [];
  const rarityTrait = traits.find(t =>
    t.trait_type?.toLowerCase().includes("rarity") ||
    t.trait_type?.toLowerCase().includes("rank")
  );

  async function handleList() {
    if (!price || isNaN(price) || Number(price) <= 0) return;
    if (!nft.contract) return;
    clearStatus();
    await listNFT({
      nftContract: nft.contract,
      tokenId:     nft.tokenId,
      price:       price,
    });
  }

  const isDone = txStatus?.type === "success";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d1219", border: "1px solid rgba(34,211,238,0.12)", maxHeight: "92vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: "#0d1219", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <Tag size={14} style={{ color: "#22d3ee" }} />
            <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>List for Sale</span>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9da7b3" }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* NFT Preview */}
          <div className="flex gap-4">
            <div className="w-24 h-24 rounded-2xl flex-shrink-0 overflow-hidden" style={{ background: "#161d28" }}>
              {nft.image && (
                <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
              )}
            </div>
            <div className="flex-1 min-w-0 py-1">
              <div className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#22d3ee" }}>
                {nft.collection}
              </div>
              <div className="text-xl font-extrabold truncate mb-1" style={{ color: "#e6edf3" }}>
                {nft.name || `#${nft.tokenId}`}
              </div>
              {rarityTrait && (
                <div className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-lg"
                  style={{ background: "rgba(250,204,21,0.08)", border: "1px solid rgba(250,204,21,0.2)", color: "#facc15" }}>
                  ★ {rarityTrait.trait_type}: {rarityTrait.value}
                </div>
              )}
            </div>
          </div>

          {/* Traits */}
          {traits.length > 0 && (
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: "#9da7b3" }}>
                Traits · {traits.length}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {traits.slice(0, 9).map((trait, i) => {
                  const c = traitColor(i);
                  return (
                    <div key={i} className="rounded-xl p-2.5"
                      style={{ background: c.bg, border: `1px solid ${c.border}` }}>
                      <div className="text-[9px] font-bold uppercase truncate mb-0.5" style={{ color: c.color }}>
                        {trait.trait_type}
                      </div>
                      <div className="text-xs font-bold truncate" style={{ color: "#e6edf3" }}>
                        {String(trait.value)}
                      </div>
                    </div>
                  );
                })}
              </div>
              {traits.length > 9 && (
                <div className="text-xs mt-2" style={{ color: "#9da7b3" }}>
                  +{traits.length - 9} more traits
                </div>
              )}
            </div>
          )}

          {/* Price input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#9da7b3" }}>
              Listing Price (USD)
            </label>
            <div className="relative">
              <input
                type="number"
                placeholder="Enter price..."
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="w-full h-14 rounded-2xl px-4 pr-20 text-xl font-mono outline-none"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
                onFocus={e => e.target.style.borderColor = "#22d3ee"}
                onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                autoFocus
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-sm"
                style={{ color: "#9da7b3" }}>USD</span>
            </div>
          </div>

          {/* Fee breakdown */}
          {price && Number(price) > 0 && (
            <div className="rounded-2xl p-4 space-y-2"
              style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}>
              {[
                { label: "Listing Price",    value: `${Number(price).toFixed(2)} USD` },
                { label: "Marketplace Fee",  value: `${(Number(price) * 0.025).toFixed(2)} USD (2.5%)` },
                { label: "You Receive",      value: `${(Number(price) * 0.975).toFixed(2)} USD`, highlight: true },
              ].map(({ label, value, highlight }) => (
                <div key={label} className="flex justify-between text-xs">
                  <span style={{ color: "#9da7b3" }}>{label}</span>
                  <span className="font-mono font-bold" style={{ color: highlight ? "#22d3ee" : "#e6edf3" }}>{value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Status message */}
          {txStatus && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-3 text-xs"
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
            <div className="flex flex-col items-center py-4">
              <CheckCircle2 size={40} className="mb-3" style={{ color: "#22C55E" }} />
              <div className="font-bold text-lg mb-1" style={{ color: "#e6edf3" }}>Listed Successfully!</div>
              <p className="text-xs mb-5" style={{ color: "#9da7b3" }}>
                Your NFT is now live on the marketplace.
              </p>
              <button onClick={onClose} className="w-full h-12 rounded-2xl text-sm font-bold"
                style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer" }}>
                Done
              </button>
            </div>
          ) : (
            <button
              onClick={handleList}
              disabled={loading || !price || Number(price) <= 0 || !nft.contract}
              className="w-full h-14 rounded-2xl text-base font-bold flex items-center justify-center gap-2"
              style={{
                background: loading || !price || Number(price) <= 0 ? "#161d28" : "#22d3ee",
                color:      loading || !price || Number(price) <= 0 ? "#9da7b3" : "#0b0f14",
                border: "none",
                cursor: loading || !price || Number(price) <= 0 ? "not-allowed" : "pointer",
              }}>
              {loading && (
                <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? txStatus?.msg || "Confirming..." : `List for ${price ? `${Number(price).toFixed(2)} USD` : "..."}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
