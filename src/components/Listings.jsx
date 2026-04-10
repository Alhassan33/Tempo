// components/Listings.jsx
import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, List, RefreshCw, ShoppingCart, ExternalLink } from "lucide-react";
import { useAccount } from "wagmi";
import { useRealtimeListings } from "@/hooks/useSupabase";
import { useMarketplace } from "@/hooks/useMarketplace";
import NFTImage from "@/components/NFTImage.jsx";
import { fetchTokenMetadata } from "@/hooks/useNFTMetadata";
import { useState as useLocalState, useEffect } from "react";

const EXPLORER_BASE = "https://explore.tempo.xyz";

function shortenAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// ─── Single listing card (grid view) ─────────────────────────────────────────
function ListingCard({ listing, collectionName, slug, onBuy, buying }) {
  const navigate = useNavigate();
  const [meta, setMeta] = useLocalState(null);
  const { address } = useAccount();
  const isOwner = address?.toLowerCase() === listing.seller?.toLowerCase();

  useEffect(() => {
    // Try to get image from listing directly first, else skip
    if (listing.image) {
      setMeta({ image: listing.image, name: listing.name });
    }
  }, [listing]);

  function goToItem() {
    navigate(`/collection/${slug}/${listing.token_id}`);
  }

  return (
    <div
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all"
      style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.15)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.35)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)"}
    >
      <div onClick={goToItem} className="p-2">
        <div className="aspect-square rounded-xl overflow-hidden relative" style={{ background: "#161d28" }}>
          {meta?.image
            ? <img src={meta.image} alt={meta?.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            : <div className="w-full h-full flex items-center justify-center font-mono text-2xl font-bold" style={{ color: "#9da7b3" }}>#{listing.token_id}</div>
          }
          {/* Rank badge if available */}
          {listing.rarity_rank && (
            <div className="absolute top-2 right-2 text-[9px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: "rgba(11,15,20,0.85)", color: "#facc15", border: "1px solid rgba(250,204,21,0.3)", backdropFilter: "blur(4px)" }}>
              #{listing.rarity_rank}
            </div>
          )}
        </div>

        <div className="pt-2 px-1 pb-1">
          <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5 truncate" style={{ color: "#9da7b3" }}>
            {collectionName}
          </div>
          <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>
            {meta?.name || listing.name || `#${listing.token_id}`}
          </div>
          <div className="font-mono text-base font-bold mt-0.5" style={{ color: "#22d3ee" }}>
            {Number(listing.price).toFixed(2)} USD
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "#9da7b3" }}>
            by {shortenAddr(listing.seller)}
          </div>
        </div>
      </div>

      {/* Buy button */}
      {!isOwner && (
        <div className="px-2 pb-2">
          <button
            onClick={() => onBuy(listing)}
            disabled={buying === listing.listing_id}
            className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            style={{
              background: buying === listing.listing_id ? "#161d28" : "#22d3ee",
              color: buying === listing.listing_id ? "#9da7b3" : "#0b0f14",
              border: "none",
              cursor: buying === listing.listing_id ? "not-allowed" : "pointer",
            }}>
            {buying === listing.listing_id
              ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Processing...</>
              : <><ShoppingCart size={12} /> Buy Now</>
            }
          </button>
        </div>
      )}
      {isOwner && (
        <div className="px-2 pb-2">
          <div className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center"
            style={{ background: "rgba(34,211,238,0.06)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>
            Your Listing
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Single listing row (list view) ──────────────────────────────────────────
function ListingRow({ listing, collectionName, slug, rank, onBuy, buying }) {
  const navigate = useNavigate();
  const { address } = useAccount();
  const isOwner = address?.toLowerCase() === listing.seller?.toLowerCase();

  return (
    <div
      className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}
      onClick={() => navigate(`/collection/${slug}/${listing.token_id}`)}
    >
      {/* Rank */}
      <span className="text-xs font-mono w-6 text-center flex-shrink-0" style={{ color: "#9da7b3" }}>{rank}</span>

      {/* Image */}
      <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: "#161d28" }}>
        {listing.image
          ? <img src={listing.image} alt={listing.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-xs font-mono" style={{ color: "#9da7b3" }}>#{listing.token_id}</div>
        }
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="text-[10px] uppercase tracking-widest font-bold mb-0.5" style={{ color: "#9da7b3" }}>{collectionName}</div>
        <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>
          {listing.name || `#${listing.token_id}`}
        </div>
      </div>

      {/* Rarity */}
      {listing.rarity_rank && (
        <span className="text-xs font-mono flex-shrink-0 hidden sm:block" style={{ color: "#facc15" }}>
          Rank #{listing.rarity_rank}
        </span>
      )}

      {/* Price */}
      <div className="text-right flex-shrink-0">
        <div className="font-mono font-bold" style={{ color: "#22d3ee" }}>
          {Number(listing.price).toFixed(2)} USD
        </div>
        <div className="text-[10px]" style={{ color: "#9da7b3" }}>{shortenAddr(listing.seller)}</div>
      </div>

      {/* Action */}
      {!isOwner ? (
        <button
          onClick={e => { e.stopPropagation(); onBuy(listing); }}
          disabled={buying === listing.listing_id}
          className="h-9 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
          style={{
            background: buying === listing.listing_id ? "#161d28" : "#22d3ee",
            color: buying === listing.listing_id ? "#9da7b3" : "#0b0f14",
            border: "none",
            cursor: buying === listing.listing_id ? "not-allowed" : "pointer",
          }}>
          {buying === listing.listing_id
            ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
            : <ShoppingCart size={12} />}
          Buy
        </button>
      ) : (
        <span className="text-[10px] px-3 py-1.5 rounded-xl flex-shrink-0"
          style={{ background: "rgba(34,211,238,0.06)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>
          Yours
        </span>
      )}
    </div>
  );
}

// ─── Buy Modal ────────────────────────────────────────────────────────────────
function BuyConfirmModal({ listing, onConfirm, onClose, loading, txStatus }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.15)" }}
        onClick={e => e.stopPropagation()}>

        <div className="text-center mb-6">
          {listing.image && (
            <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto mb-4" style={{ background: "#161d28" }}>
              <img src={listing.image} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="font-bold text-lg mb-1" style={{ color: "#e6edf3" }}>
            {listing.name || `#${listing.token_id}`}
          </div>
          <div className="font-mono text-3xl font-bold" style={{ color: "#22d3ee" }}>
            {Number(listing.price).toFixed(2)}
            <span className="text-lg ml-1" style={{ color: "#9da7b3" }}>USD</span>
          </div>
        </div>

        {txStatus && (
          <div className="rounded-xl px-3 py-2.5 mb-4 text-xs flex items-center gap-2"
            style={{
              background: txStatus.type === "error" ? "rgba(239,68,68,0.1)" : txStatus.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(34,211,238,0.1)",
              border: `1px solid ${txStatus.type === "error" ? "rgba(239,68,68,0.3)" : txStatus.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(34,211,238,0.3)"}`,
              color: txStatus.type === "error" ? "#EF4444" : txStatus.type === "success" ? "#22C55E" : "#22d3ee",
            }}>
            {txStatus.msg}
          </div>
        )}

        {txStatus?.type === "success" ? (
          <button onClick={onClose} className="w-full h-12 rounded-xl font-bold text-sm"
            style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer" }}>
            Done 🎉
          </button>
        ) : (
          <>
            <button onClick={onConfirm} disabled={loading}
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-3"
              style={{ background: loading ? "#161d28" : "#22d3ee", color: loading ? "#9da7b3" : "#0b0f14", border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {loading ? "Processing..." : `Confirm Purchase`}
            </button>
            <button onClick={onClose} className="w-full h-9 rounded-xl text-sm"
              style={{ background: "none", color: "#9da7b3", border: "none", cursor: "pointer" }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Listings Component ──────────────────────────────────────────────────
export default function Listings({ nftContract, collectionName, slug }) {
  const { listings: rawListings, isLoading } = useRealtimeListings(nftContract);
  const { buyNFT, loading, txStatus, clearStatus } = useMarketplace();
  const [view,    setView]    = useState("grid");
  const [buying,  setBuying]  = useState(null);
  const [buyModal, setBuyModal] = useState(null);

  // Sort active listings by price ascending (floor first)
  const listings = (rawListings || [])
    .filter(l => l.active)
    .sort((a, b) => Number(a.price) - Number(b.price));

  function handleBuyClick(listing) {
    clearStatus();
    setBuyModal(listing);
  }

  async function confirmBuy() {
    if (!buyModal) return;
    setBuying(buyModal.listing_id);
    await buyNFT({
      listingId: String(buyModal.listing_id),
      price:     String(buyModal.price),
      seller:    buyModal.seller,
      nftAddress: nftContract,
      tokenId:   String(buyModal.token_id),
    });
    setBuying(null);
  }

  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-bold" style={{ color: "#e6edf3" }}>
          {listings.length} listing{listings.length !== 1 ? "s" : ""} — sorted by price
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-xl p-1" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[{ v: "grid", Icon: LayoutGrid }, { v: "list", Icon: List }].map(({ v, Icon }) => (
              <button key={v} onClick={() => setView(v)} className="p-2 rounded-lg"
                style={{ background: view === v ? "rgba(34,211,238,0.1)" : "none", color: view === v ? "#22d3ee" : "#9da7b3", border: "none", cursor: "pointer" }}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#22d3ee" }} />
        </div>
      )}

      {/* Empty */}
      {!isLoading && listings.length === 0 && (
        <div className="py-24 text-center rounded-3xl" style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
          <div className="text-4xl mb-3">🏷️</div>
          <div className="font-bold mb-1" style={{ color: "#e6edf3" }}>No active listings</div>
          <p className="text-sm" style={{ color: "#9da7b3" }}>
            Be the first to list an NFT from this collection.
          </p>
        </div>
      )}

      {/* Grid view */}
      {!isLoading && listings.length > 0 && view === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {listings.map(listing => (
            <ListingCard
              key={listing.listing_id}
              listing={listing}
              collectionName={collectionName}
              slug={slug}
              onBuy={handleBuyClick}
              buying={buying}
            />
          ))}
        </div>
      )}

      {/* List view */}
      {!isLoading && listings.length > 0 && view === "list" && (
        <div className="space-y-2">
          {/* Table header */}
          <div className="flex items-center gap-4 px-3 pb-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "#9da7b3", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="w-6 text-center">#</span>
            <span className="w-12 flex-shrink-0">Item</span>
            <span className="flex-1">Name</span>
            <span className="hidden sm:block">Rarity</span>
            <span>Price</span>
            <span className="w-16 text-right">Action</span>
          </div>
          {listings.map((listing, idx) => (
            <ListingRow
              key={listing.listing_id}
              listing={listing}
              collectionName={collectionName}
              slug={slug}
              rank={idx + 1}
              onBuy={handleBuyClick}
              buying={buying}
            />
          ))}
        </div>
      )}

      {/* Buy confirm modal */}
      {buyModal && (
        <BuyConfirmModal
          listing={buyModal}
          onConfirm={confirmBuy}
          onClose={() => { setBuyModal(null); clearStatus(); setBuying(null); }}
          loading={!!buying}
          txStatus={txStatus}
        />
      )}
    </div>
  );
}
