// pages/NFTItemPage.jsx
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  ArrowLeft, ExternalLink, Tag, ShoppingCart,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Layers
} from "lucide-react";

import { useCollection, useListings } from "@/hooks/useSupabase";
import { useBuyNFT, useMarketplaceInfo } from "@/hooks/useMarketplace";
import { useNFTMetadata, formatTraits, traitColor } from "@/hooks/useNFTMetadata";
import ListModal from "@/components/ListModal.jsx";

const NFT_CONTRACT = "0x1Ee82CC5946EdBD88eaf90D6d3c2B5baA4f9966C";
const COLLECTION_SLUG = "temponyaw";

// ─── Trait Badge ──────────────────────────────────────────────────────────────
function TraitBadge({ trait, index }) {
  const c = traitColor(index);
  return (
    <div
      className="rounded-xl p-3 flex flex-col gap-0.5"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <span
        className="text-[9px] font-bold uppercase tracking-widest truncate"
        style={{ color: c.color }}
      >
        {trait.type}
      </span>
      <span
        className="text-sm font-bold truncate"
        style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}
      >
        {trait.value}
      </span>
    </div>
  );
}

// ─── Buy Modal ────────────────────────────────────────────────────────────────
function BuyModal({ listing, metadata, onClose, pathUSD }) {
  const { buy, step, error } = useBuyNFT(pathUSD);

  const label = {
    idle:      "Buy Now",
    approving: "Approving USD...",
    buying:    "Buying NFT...",
    done:      "Done! 🎉",
    error:     "Try Again",
  }[step];

  async function handleBuy() {
    await buy(
      BigInt(listing.listing_id),
      BigInt(Math.round(listing.price * 1e6))
    );
    if (step === "done") setTimeout(onClose, 1500);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image */}
        <div className="aspect-square rounded-xl overflow-hidden mb-4"
          style={{ background: "#161d28" }}>
          {metadata?.image && (
            <img
              src={metadata.image}
              alt={metadata.name}
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <div className="font-bold text-lg mb-0.5" style={{ color: "#e6edf3" }}>
          {metadata?.name}
        </div>
        <div className="font-mono text-2xl mb-6" style={{ color: "#22d3ee" }}>
          {listing.price.toFixed(2)} <span className="text-base" style={{ color: "#9da7b3" }}>USD</span>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2 mb-4 text-xs"
            style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" }}>
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {error}
          </div>
        )}

        {step === "done" ? (
          <div className="flex items-center justify-center gap-2 py-2" style={{ color: "#22d3ee" }}>
            <CheckCircle2 size={18} /> Purchased!
          </div>
        ) : (
          <button
            onClick={handleBuy}
            disabled={step === "approving" || step === "buying"}
            className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
            style={{
              background: step === "approving" || step === "buying" ? "#161d28" : "#22d3ee",
              color:      step === "approving" || step === "buying" ? "#9da7b3" : "#0b0f14",
              border:     "none", cursor: "pointer", fontFamily: "Syne, sans-serif",
            }}
          >
            {(step === "approving" || step === "buying") && (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {label}
          </button>
        )}

        <button
          onClick={onClose}
          className="w-full mt-3 h-9 rounded-xl text-sm"
          style={{ background: "transparent", color: "#9da7b3", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} style={{ color: "#22d3ee" }} />}
          <span className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "#9da7b3", fontFamily: "Syne, sans-serif" }}>{title}</span>
        </div>
        {open
          ? <ChevronUp size={14} style={{ color: "#9da7b3" }} />
          : <ChevronDown size={14} style={{ color: "#9da7b3" }} />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NFTItemPage() {
  const { tokenId }  = useParams();             // route: /nft/:tokenId
  const navigate     = useNavigate();
  const { address }  = useAccount();

  // Data
  const { metadata, loading: metaLoading } = useNFTMetadata(tokenId);
  const { collection }  = useCollection(COLLECTION_SLUG);
  const { listings }    = useListings(NFT_CONTRACT);
  const { data: marketInfo } = useMarketplaceInfo?.() ?? {};

  // Find listing for this specific token
  const listing = listings.find(
    (l) => Number(l.token_id) === Number(tokenId) && l.active
  );

  const isOwner =
    address && listing?.seller?.toLowerCase() === address?.toLowerCase();

  const [showBuy,  setShowBuy]  = useState(false);
  const [showList, setShowList] = useState(false);

  const traits    = metadata ? formatTraits(metadata.attributes) : [];
  const pathUSD   = marketInfo?.pathUSD;
  const explorerBase = "https://explorer.moderato.tempo.xyz";

  return (
    <div className="fade-up px-4 sm:px-6 max-w-5xl mx-auto py-8">

      {/* Back */}
      <button
        onClick={() => navigate(`/collection/${COLLECTION_SLUG}`)}
        className="flex items-center gap-2 text-sm mb-6 hover:opacity-80 transition-opacity"
        style={{ color: "#9da7b3", background: "none", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
      >
        <ArrowLeft size={14} /> {collection?.name ?? "Collection"}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Left: Image ── */}
        <div>
          <div
            className="aspect-square rounded-2xl overflow-hidden"
            style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
          >
            {metaLoading ? (
              <div className="w-full h-full animate-pulse" style={{ background: "#161d28" }} />
            ) : metadata?.image ? (
              <img
                src={metadata.image}
                alt={metadata.name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center"
                style={{ color: "#9da7b3" }}>No Image</div>
            )}
          </div>

          {/* Explorer links */}
          <div className="flex items-center gap-2 mt-3">
            <a
              href={`${explorerBase}/address/${NFT_CONTRACT}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "#9da7b3" }}
            >
              <ExternalLink size={11} /> Contract
            </a>
            <span style={{ color: "#9da7b3" }}>·</span>
            <a
              href={`${explorerBase}/token/${NFT_CONTRACT}/instance/${tokenId}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs"
              style={{ color: "#9da7b3" }}
            >
              <ExternalLink size={11} /> Token #{tokenId}
            </a>
          </div>
        </div>

        {/* ── Right: Info + Actions ── */}
        <div className="space-y-4">

          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold" style={{ color: "#22d3ee" }}>
                {collection?.name ?? "TEMPONYAW"}
              </span>
              {collection?.verified && <CheckCircle2 size={12} color="#22d3ee" />}
            </div>
            {metaLoading ? (
              <div className="h-8 w-2/3 rounded-lg animate-pulse" style={{ background: "#161d28" }} />
            ) : (
              <h1 className="text-2xl font-extrabold" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
                {metadata?.name ?? `TEMPONYAW #${tokenId}`}
              </h1>
            )}
            {metadata?.description && (
              <p className="text-sm mt-2" style={{ color: "#9da7b3" }}>{metadata.description}</p>
            )}
          </div>

          {/* Listing / Price box */}
          <div className="rounded-2xl p-5"
            style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
            {listing ? (
              <>
                <div className="text-xs mb-1" style={{ color: "#9da7b3" }}>Listed price</div>
                <div className="font-mono text-3xl font-bold mb-4" style={{ color: "#22d3ee" }}>
                  {listing.price.toFixed(2)}
                  <span className="text-lg ml-1.5" style={{ color: "#9da7b3" }}>USD</span>
                </div>
                <div className="text-xs mb-4" style={{ color: "#9da7b3" }}>
                  Seller: <span className="font-mono" style={{ color: "#e6edf3" }}>
                    {listing.seller.slice(0, 6)}…{listing.seller.slice(-4)}
                  </span>
                </div>

                {isOwner ? (
                  // Owner sees Cancel / Manage
                  <button
                    onClick={() => setShowList(true)}
                    className="w-full h-11 rounded-xl text-sm font-bold"
                    style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
                  >
                    Manage Listing
                  </button>
                ) : (
                  <button
                    onClick={() => setShowBuy(true)}
                    className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
                  >
                    <ShoppingCart size={15} /> Buy Now
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="text-sm mb-4" style={{ color: "#9da7b3" }}>Not listed for sale</div>
                {address && (
                  <button
                    onClick={() => setShowList(true)}
                    className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
                  >
                    <Tag size={14} /> List for Sale
                  </button>
                )}
              </>
            )}
          </div>

          {/* Token details */}
          <Section title="Details" icon={Layers}>
            <div className="space-y-2">
              {[
                { label: "Token ID",    value: `#${tokenId}` },
                { label: "Contract",    value: `${NFT_CONTRACT.slice(0, 8)}…${NFT_CONTRACT.slice(-6)}` },
                { label: "Standard",   value: "ERC-721" },
                { label: "Blockchain", value: "Tempo Chain" },
                { label: "Total Supply", value: collection?.total_supply?.toLocaleString() ?? "2,000" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-xs py-1.5"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <span style={{ color: "#9da7b3" }}>{label}</span>
                  <span className="font-mono font-semibold" style={{ color: "#e6edf3" }}>{value}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {/* Traits — full width below */}
      {!metaLoading && traits.length > 0 && (
        <div className="mt-6">
          <Section title={`Traits · ${traits.length}`} icon={Tag} defaultOpen={true}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {traits.map((trait, i) => (
                <TraitBadge key={`${trait.type}-${i}`} trait={trait} index={i} />
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Modals */}
      {showBuy && listing && (
        <BuyModal
          listing={listing}
          metadata={metadata}
          pathUSD={pathUSD}
          onClose={() => setShowBuy(false)}
        />
      )}
      {showList && (
        <ListModal
          nft={{ tokenId: Number(tokenId), ...metadata }}
          onClose={() => setShowList(false)}
        />
      )}
    </div>
  );
}
