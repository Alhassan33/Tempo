// components/ListModal.jsx
// nft prop: { tokenId, contract, name, image, attributes, collection }
import { useState } from "react";
import { X, Tag, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { useListNFT } from "@/hooks/useMarketplace";

// ─── Trait badge ──────────────────────────────────────────────────────────────
const TRAIT_COLORS = [
  { color: "#22d3ee", bg: "rgba(34,211,238,0.08)",  border: "rgba(34,211,238,0.2)"  },
  { color: "#a78bfa", bg: "rgba(167,139,250,0.08)", border: "rgba(167,139,250,0.2)" },
  { color: "#34d399", bg: "rgba(52,211,153,0.08)",  border: "rgba(52,211,153,0.2)"  },
  { color: "#fb923c", bg: "rgba(251,146,60,0.08)",  border: "rgba(251,146,60,0.2)"  },
  { color: "#f472b6", bg: "rgba(244,114,182,0.08)", border: "rgba(244,114,182,0.2)" },
  { color: "#facc15", bg: "rgba(250,204,21,0.08)",  border: "rgba(250,204,21,0.2)"  },
];

function TraitBadge({ trait, index }) {
  const c = TRAIT_COLORS[index % TRAIT_COLORS.length];
  return (
    <div className="rounded-xl p-2.5 flex flex-col gap-0.5"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="text-[9px] font-bold uppercase tracking-widest truncate"
        style={{ color: c.color }}>
        {trait.trait_type || "Property"}
      </span>
      <span className="text-xs font-bold truncate"
        style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
        {String(trait.value ?? "")}
      </span>
    </div>
  );
}

export default function ListModal({ nft, onClose }) {
  const { listNFT, step, error } = useListNFT();
  const [price,      setPrice]      = useState("");
  const [showTraits, setShowTraits] = useState(false);

  const traits    = nft?.attributes || [];
  const hasTaits  = traits.length > 0;
  const totalFee  = price ? (Number(price) * 0.025).toFixed(2) : "—";
  const youReceive = price ? (Number(price) * 0.975).toFixed(2) : "—";

  async function handleList() {
    if (!price || isNaN(price) || Number(price) <= 0) return;
    if (!nft?.contract) return;
    await listNFT(nft.contract, BigInt(nft.tokenId), price);
  }

  const isLoading = step === "approving" || step === "listing";
  const isDone    = step === "done";

  const btnLabel = step === "approving" ? "Approving..."
    : step === "listing"  ? "Listing..."
    : "List NFT";

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)", backdropFilter: "blur(12px)" }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.15)", maxHeight: "92vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 sticky top-0 z-10"
          style={{ background: "#121821", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-2">
            <Tag size={14} style={{ color: "#22d3ee" }} />
            <h2 className="text-base font-bold"
              style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>List for Sale</h2>
          </div>
          <button onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: "#9da7b3" }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* NFT Preview */}
          <div className="flex items-center gap-4 p-4 rounded-2xl"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.04)" }}>
            <div className="w-20 h-20 rounded-xl flex-shrink-0 overflow-hidden"
              style={{ background: "#161d28" }}>
              {nft?.image
                ? <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-2xl font-bold"
                    style={{ color: "#22d3ee" }}>
                    #{nft?.tokenId}
                  </div>
              }
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "#9da7b3" }}>{nft?.collection}</div>
              <div className="font-bold text-base truncate"
                style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
                {nft?.name || `#${nft?.tokenId}`}
              </div>
              <div className="text-xs mt-1 font-mono" style={{ color: "#9da7b3" }}>
                Token #{nft?.tokenId}
              </div>
            </div>
          </div>

          {/* Traits */}
          {hasTaits && (
            <div className="rounded-2xl overflow-hidden"
              style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
              <button
                onClick={() => setShowTraits(s => !s)}
                className="w-full flex items-center justify-between px-4 py-3"
                style={{ background: "#161d28", border: "none", cursor: "pointer" }}>
                <span className="text-xs font-bold uppercase tracking-widest"
                  style={{ color: "#9da7b3", fontFamily: "Syne, sans-serif" }}>
                  Traits · {traits.length}
                </span>
                {showTraits
                  ? <ChevronUp size={14} style={{ color: "#9da7b3" }} />
                  : <ChevronDown size={14} style={{ color: "#9da7b3" }} />
                }
              </button>
              {showTraits && (
                <div className="grid grid-cols-2 gap-2 p-4"
                  style={{ background: "#0b0f14" }}>
                  {traits.map((trait, i) => (
                    <TraitBadge key={i} trait={trait} index={i} />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Price Input */}
          {!isDone && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-2"
                  style={{ color: "#9da7b3" }}>
                  Listing Price (USD)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    placeholder="0.00"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    min="0"
                    step="0.01"
                    className="w-full h-12 rounded-xl px-4 pr-16 text-base outline-none"
                    style={{
                      background: "#161d28",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "#e6edf3",
                      fontFamily: "monospace",
                    }}
                    onFocus={e => e.target.style.borderColor = "#22d3ee"}
                    onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold"
                    style={{ color: "#9da7b3" }}>USD</span>
                </div>
              </div>

              {/* Fee breakdown */}
              <div className="rounded-xl p-3 space-y-2"
                style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}>
                {[
                  { label: "Listing Price",    value: price ? `${Number(price).toFixed(2)} USD` : "—" },
                  { label: "Marketplace Fee",  value: `${totalFee} USD (2.5%)` },
                  { label: "You Receive",      value: `${youReceive} USD` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between text-xs">
                    <span style={{ color: "#9da7b3" }}>{label}</span>
                    <span className="font-mono font-semibold" style={{ color: "#e6edf3" }}>{value}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444" }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Success */}
          {isDone ? (
            <div className="flex flex-col items-center py-4 text-center">
              <CheckCircle2 size={40} className="mb-3" style={{ color: "#22C55E" }} />
              <div className="font-bold text-lg mb-1"
                style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
                Listed Successfully!
              </div>
              <p className="text-sm mb-4" style={{ color: "#9da7b3" }}>
                {nft?.name || `#${nft?.tokenId}`} is now live on the marketplace.
              </p>
              <button onClick={onClose}
                className="w-full h-11 rounded-xl text-sm font-bold"
                style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                Done
              </button>
            </div>
          ) : (
            <button
              onClick={handleList}
              disabled={isLoading || !price || Number(price) <= 0 || !nft?.contract}
              className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{
                background: isLoading || !price ? "#161d28" : "#22d3ee",
                color:      isLoading || !price ? "#9da7b3" : "#0b0f14",
                border:     "none",
                cursor:     isLoading || !price ? "not-allowed" : "pointer",
                fontFamily: "Syne, sans-serif",
              }}>
              {isLoading && (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {btnLabel}
            </button>
          )}

          {/* Info note */}
          {!isDone && (
            <p className="text-[10px] text-center" style={{ color: "#9da7b3" }}>
              Listing requires 2 transactions: approve NFT transfer, then confirm listing.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
