// components/Listings.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { LayoutGrid, List, ShoppingCart } from "lucide-react";
import { useAccount } from "wagmi";
import { useRealtimeListings } from "@/hooks/useSupabase";
import { useMarketplace } from "@/hooks/useMarketplace";
import NFTImage from "@/components/NFTImage.jsx";

function shortenAddr(a) {
  if (!a) return "—";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

// Price helper — useListings already divides by 1e6 into displayPrice
function fmt(listing) {
  return listing.displayPrice || Number(listing.price).toFixed(2);
}

// ─── Grid Card ────────────────────────────────────────────────────────────────
function ListingCard({ listing, collectionName, slug, onBuy, buying }) {
  const navigate = useNavigate();
  const { address } = useAccount();
  const isOwner = address?.toLowerCase() === listing.seller?.toLowerCase();
  const isBuying = buying === listing.listing_id;

  return (
    <div className="rounded-2xl overflow-hidden transition-all"
      style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.15)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)"}>

      <div onClick={() => navigate(`/collection/${slug}/${listing.token_id}`)}
        className="p-2 cursor-pointer group">
        <div className="aspect-square rounded-xl overflow-hidden relative" style={{ background: "#161d28" }}>
          {listing.image
            ? <img src={listing.image} alt={listing.name}
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
            : <div className="w-full h-full flex items-center justify-center font-mono text-xl font-bold"
                style={{ color: "#9da7b3" }}>#{listing.token_id}</div>
          }
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
            {listing.name || `#${listing.token_id}`}
          </div>
          <div className="font-mono text-base font-bold mt-0.5" style={{ color: "#22d3ee" }}>
            {fmt(listing)} USD
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "#9da7b3" }}>
            by {shortenAddr(listing.seller)}
          </div>
        </div>
      </div>

      <div className="px-2 pb-2">
        {isOwner ? (
          <div className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center"
            style={{ background: "rgba(34,211,238,0.06)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>
            Your Listing
          </div>
        ) : (
          <button onClick={() => onBuy(listing)} disabled={isBuying}
            className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: isBuying ? "#161d28" : "#22d3ee", color: isBuying ? "#9da7b3" : "#0b0f14", border: "none", cursor: isBuying ? "not-allowed" : "pointer" }}>
            {isBuying
              ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Processing...</>
              : <><ShoppingCart size={12} /> Buy Now</>}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── List Row ─────────────────────────────────────────────────────────────────
function ListingRow({ listing, collectionName, slug, rank, onBuy, buying }) {
  const navigate = useNavigate();
  const { address } = useAccount();
  const isOwner = address?.toLowerCase() === listing.seller?.toLowerCase();
  const isBuying = buying === listing.listing_id;

  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}
      onClick={() => navigate(`/collection/${slug}/${listing.token_id}`)}>

      <span className="text-xs font-mono w-5 text-center flex-shrink-0" style={{ color: "#9da7b3" }}>{rank}</span>

      <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: "#161d28" }}>
        {listing.image
          ? <img src={listing.image} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center text-[10px] font-mono" style={{ color: "#9da7b3" }}>#{listing.token_id}</div>
        }
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#9da7b3" }}>{collectionName}</div>
        <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>{listing.name || `#${listing.token_id}`}</div>
      </div>

      {listing.rarity_rank && (
        <span className="text-xs font-mono flex-shrink-0 hidden sm:block" style={{ color: "#facc15" }}>
          #{listing.rarity_rank}
        </span>
      )}

      <div className="text-right flex-shrink-0">
        <div className="font-mono font-bold text-sm" style={{ color: "#22d3ee" }}>{fmt(listing)} USD</div>
        <div className="text-[10px]" style={{ color: "#9da7b3" }}>{shortenAddr(listing.seller)}</div>
      </div>

      {isOwner ? (
        <span className="text-[10px] px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: "rgba(34,211,238,0.06)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>
          Yours
        </span>
      ) : (
        <button onClick={e => { e.stopPropagation(); onBuy(listing); }} disabled={isBuying}
          className="h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1 flex-shrink-0"
          style={{ background: isBuying ? "#161d28" : "#22d3ee", color: isBuying ? "#9da7b3" : "#0b0f14", border: "none", cursor: isBuying ? "not-allowed" : "pointer" }}>
          {isBuying ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> : <ShoppingCart size={11} />}
          Buy
        </button>
      )}
    </div>
  );
}

// ─── Buy Confirm Modal ────────────────────────────────────────────────────────
function BuyModal({ listing, onConfirm, onClose, loading, txStatus }) {
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
            {fmt(listing)}<span className="text-lg ml-1" style={{ color: "#9da7b3" }}>USD</span>
          </div>
        </div>

        {txStatus && (
          <div className="rounded-xl px-3 py-2.5 mb-4 text-xs"
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
              {loading ? "Processing..." : "Confirm Purchase"}
            </button>
            <button onClick={onClose} className="w-full h-9 text-sm"
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
  const [view,     setView]     = useState("grid");
  const [buying,   setBuying]   = useState(null);
  const [buyModal, setBuyModal] = useState(null);

  // Sort by price ascending — floor first
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
    // ✅ Correct shape for useMarketplace.buyNFT
    await buyNFT({
      listingId:  String(buyModal.listing_id),
      price:      String(buyModal.price), // raw price (not displayPrice)
      seller:     buyModal.seller,
      nftAddress: nftContract,
      tokenId:    String(buyModal.token_id),
    });
    setBuying(null);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="text-sm" style={{ color: "#9da7b3" }}>
          <span className="font-bold" style={{ color: "#e6edf3" }}>{listings.length}</span>
          {" "}listing{listings.length !== 1 ? "s" : ""} — cheapest first
        </div>
        <div className="flex rounded-xl p-1" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
          {[{ v: "grid", Icon: LayoutGrid }, { v: "list", Icon: List }].map(({ v, Icon }) => (
            <button key={v} onClick={() => setView(v)} className="p-2 rounded-lg"
              style={{ background: view === v ? "rgba(34,211,238,0.1)" : "none", color: view === v ? "#22d3ee" : "#9da7b3", border: "none", cursor: "pointer" }}>
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#22d3ee" }} />
        </div>
      )}

      {!isLoading && listings.length === 0 && (
        <div className="py-24 text-center rounded-3xl" style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
          <div className="text-4xl mb-3">🏷️</div>
          <div className="font-bold mb-1" style={{ color: "#e6edf3" }}>No active listings</div>
          <p className="text-sm" style={{ color: "#9da7b3" }}>Be the first to list an NFT from this collection.</p>
        </div>
      )}

      {!isLoading && listings.length > 0 && view === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {listings.map(l => (
            <ListingCard key={l.listing_id} listing={l} collectionName={collectionName}
              slug={slug} onBuy={handleBuyClick} buying={buying} />
          ))}
        </div>
      )}

      {!isLoading && listings.length > 0 && view === "list" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "#9da7b3", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="w-5">#</span>
            <span className="w-11 flex-shrink-0">Item</span>
            <span className="flex-1">Name</span>
            <span className="hidden sm:block">Rank</span>
            <span>Price</span>
            <span className="w-16 text-right">Buy</span>
          </div>
          {listings.map((l, idx) => (
            <ListingRow key={l.listing_id} listing={l} collectionName={collectionName}
              slug={slug} rank={idx + 1} onBuy={handleBuyClick} buying={buying} />
          ))}
        </div>
      )}

      {buyModal && (
        <BuyModal
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
