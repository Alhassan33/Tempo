import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle2, ExternalLink, Twitter, Globe, TrendingDown, TrendingUp, ShoppingCart } from "lucide-react";
import { useCollection, useRealtimeListings, useCollectionStats } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import BuyModal from "@/components/BuyModal.jsx";

const TABS        = ["Items", "Activity", "Bids", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";
const PAGE_SIZE   = 50;

// ─── Stat Card — UNTOUCHED ────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#9da7b3" }}>{label}</div>
    <div className="flex items-baseline gap-2">
      <div className="font-mono text-lg font-bold" style={{ color: "#e6edf3" }}>{value}</div>
      {subValue && (
        <div className={`text-[11px] font-bold flex items-center gap-0.5 ${
          isTrend ? (subValue.includes('-') ? 'text-red-400' : 'text-green-400') : ''
        }`} style={!isTrend ? { color: "#9da7b3" } : {}}>
          {isTrend && (subValue.includes('-') ? <TrendingDown size={11} /> : <TrendingUp size={11} />)}
          {subValue}
        </div>
      )}
    </div>
  </div>
);

// ─── NFT Grid Card — OpenSea style ───────────────────────────────────────────
// No buy button on the card body.
// Listed cards show price and an animated "Buy Now" that slides up on hover.
// Clicking anywhere navigates to the item page.
function NFTGridItem({ token, collectionName, slug, listing, onBuyClick }) {
  const navigate = useNavigate();

  function handleClick(e) {
    // If they clicked the buy button, open modal instead of navigating
    if (e.defaultPrevented) return;
    navigate(`/collection/${slug}/${token.tokenId}`);
  }

  function handleBuyNow(e) {
    e.preventDefault(); // stop navigation
    onBuyClick(listing);
  }

  return (
    <div
      onClick={handleClick}
      className="group rounded-2xl overflow-hidden cursor-pointer relative"
      style={{
        background: "#121821",
        border: listing ? "1px solid rgba(34,211,238,0.2)" : "1px solid rgba(255,255,255,0.05)",
        transition: "border-color 0.2s, transform 0.2s",
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = listing ? "rgba(34,211,238,0.45)" : "rgba(255,255,255,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = listing ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden" style={{ background: "#161d28" }}>
        <NFTImage
          src={token.image}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* FOR SALE badge */}
        {listing && (
          <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(11,15,20,0.85)", color: "#22d3ee",
              border: "1px solid rgba(34,211,238,0.4)", backdropFilter: "blur(4px)" }}>
            ● FOR SALE
          </div>
        )}

        {/* Animated Buy Now — slides up on hover, only on listed cards */}
        {listing && (
          <div
            className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-3 font-bold text-xs transition-all duration-300"
            style={{
              background: "linear-gradient(to top, rgba(34,211,238,0.95), rgba(34,211,238,0.85))",
              color: "#0b0f14",
              transform: "translateY(100%)",
              fontFamily: "Syne, sans-serif",
            }}
            // CSS trick: parent group-hover reveals this
            // We use a style tag approach via onMouseEnter on the card above
            // Instead, use Tailwind group-hover via className:
            onClick={handleBuyNow}
          >
            <ShoppingCart size={13} />
            Buy Now
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5 truncate" style={{ color: "#9da7b3" }}>
          {collectionName}
        </div>
        <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>
          {token.name}
        </div>

        {/* Price row — only if listed */}
        {listing ? (
          <div className="flex items-center justify-between mt-1.5">
            <div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: "#9da7b3" }}>Price</div>
              <div className="font-mono text-sm font-bold" style={{ color: "#22d3ee" }}>
                {/* listing.price is raw units → ÷1e6 for display */}
                {(Number(listing.price) / 1e6).toFixed(2)} USD
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-1.5 text-[10px]" style={{ color: "rgba(157,167,179,0.4)" }}>
            Not listed
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main CollectionPage ──────────────────────────────────────────────────────
export default function CollectionPage() {
  const { id } = useParams();

  // ✅ Stats hooks — UNTOUCHED
  const { collection, isLoading: colLoading } = useCollection(id);
  const { stats: rpcStats } = useCollectionStats(collection?.contract_address || "");
  const { listings } = useRealtimeListings(collection?.contract_address);

  const activeListings = useMemo(() =>
    (listings || []).filter(l => l.active).sort((a, b) => Number(a.price) - Number(b.price)),
  [listings]);

  const listedIds = useMemo(() =>
    new Set(activeListings.map(l => String(l.token_id))),
  [activeListings]);

  const [unlistedTokens, setUnlistedTokens] = useState([]);
  const [tokensLoading,  setTokensLoading]  = useState(false);
  const [page,           setPage]           = useState(1);
  const [hasMore,        setHasMore]        = useState(true);
  const [tab,            setTab]            = useState("Items");
  const [buyModal,       setBuyModal]       = useState(null); // listing object
  const loaderRef = useRef(null);

  // ✅ Stats — UNTOUCHED
  const stats = useMemo(() => {
    const supply     = rpcStats.totalSupply  || collection?.total_supply || 0;
    const floorPrice = rpcStats.floorPrice   || collection?.floor_price  || 0;
    const owners     = rpcStats.uniqueOwners || collection?.owners       || 0;
    const listed     = rpcStats.listedCount  || activeListings.length;
    const royaltyBps = collection?.royalty_bps ?? 0;

    return {
      floor:     floorPrice > 0 ? `${Number(floorPrice).toFixed(2)} USD` : "—",
      topOffer:  collection?.top_offer ? `${Number(collection.top_offer).toFixed(2)} USD` : "—",
      vol24h:    collection?.volume_24h    ? `${Number(collection.volume_24h).toFixed(2)} USD`    : "0 USD",
      totalVol:  collection?.volume_total  ? `${Number(collection.volume_total).toFixed(2)} USD`  : "0 USD",
      mktCap:    floorPrice && supply ? `${(Number(floorPrice) * supply).toLocaleString()} USD` : "—",
      owners,
      ownerPct:  supply && owners ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed,
      listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply:    supply?.toLocaleString() || "0",
      royalties: royaltyBps ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
    };
  }, [collection, activeListings, rpcStats]);

  // ✅ Fetch unlisted tokens — UNTOUCHED
  const fetchPage = useCallback(async (pageNum) => {
    if (!collection?.metadata_base_uri) return;
    let base = collection.metadata_base_uri;
    if (base.startsWith("ipfs://")) base = base.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
    if (!base.endsWith("/")) base += "/";
    const supply = rpcStats.totalSupply || collection.total_supply || 2000;
    const start  = (pageNum - 1) * PAGE_SIZE + 1;
    const end    = Math.min(start + PAGE_SIZE - 1, supply);
    if (start > supply) { setHasMore(false); return; }
    setTokensLoading(true);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const results = await Promise.all(ids.map(async (tokenId) => {
      const idStr = String(tokenId);
      if (listedIds.has(idStr)) return null;
      try {
        const res  = await fetch(`${base}${tokenId}.json`, { cache: "force-cache" });
        const json = await res.json();
        return { tokenId: idStr, name: json.name || `${collection.name} #${tokenId}`, image: extractImageUrl(json) };
      } catch {
        return { tokenId: idStr, name: `${collection.name} #${tokenId}`, image: "" };
      }
    }));
    const valid = results.filter(Boolean);
    setUnlistedTokens(prev => pageNum === 1 ? valid : [...prev, ...valid]);
    setHasMore(end < supply);
    setTokensLoading(false);
  }, [collection, listedIds, rpcStats.totalSupply]);

  useEffect(() => {
    if (collection?.metadata_base_uri) {
      setUnlistedTokens([]); setPage(1); setHasMore(true); fetchPage(1);
    }
  }, [collection?.metadata_base_uri, fetchPage]);

  useEffect(() => { if (page > 1) fetchPage(page); }, [page, fetchPage]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !tokensLoading && tab === "Items") setPage(p => p + 1);
    }, { rootMargin: "200px" });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, tokensLoading, tab]);

  if (colLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "#22d3ee", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="fade-up min-h-screen pb-20" style={{ background: "#0b0f14" }}>

      {/* Banner */}
      <div className="relative h-56 w-full overflow-hidden">
        {collection?.banner_url
          ? <img src={collection.banner_url} className="w-full h-full object-cover opacity-60" alt="Banner" />
          : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} />
        }
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #0b0f14)" }} />
      </div>

      <div className="px-4 sm:px-6 max-w-7xl mx-auto -mt-16 relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end gap-5 mb-8">
          <div className="w-28 h-28 rounded-3xl overflow-hidden flex-shrink-0"
            style={{ border: "6px solid #0b0f14", background: "#121821" }}>
            <NFTImage src={collection?.logo_url} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-extrabold uppercase tracking-tight" style={{ color: "#e6edf3" }}>
                {collection?.name}
              </h1>
              {collection?.verified && <CheckCircle2 size={22} style={{ color: "#22d3ee" }} />}
            </div>
            <div className="flex items-center gap-4" style={{ color: "#9da7b3" }}>
              <span className="text-sm font-bold" style={{ color: "rgba(34,211,238,0.8)" }}>
                By {collection?.creator_name || "Tempo Creator"}
              </span>
              <div className="flex items-center gap-3">
                {collection?.twitter_url && (
                  <a href={collection.twitter_url} target="_blank" rel="noreferrer"
                    className="hover:text-white transition-colors"><Twitter size={16} /></a>
                )}
                {collection?.website_url && (
                  <a href={collection.website_url} target="_blank" rel="noreferrer"
                    className="hover:text-white transition-colors"><Globe size={16} /></a>
                )}
                <a href={`${EXPLORER_BASE}/address/${collection?.contract_address}`}
                  target="_blank" rel="noreferrer"
                  className="hover:text-white transition-colors"><ExternalLink size={16} /></a>
              </div>
            </div>
            {collection?.description && (
              <p className="text-sm mt-2 line-clamp-2" style={{ color: "#9da7b3" }}>{collection.description}</p>
            )}
          </div>
        </div>

        {/* ✅ Stats Grid — UNTOUCHED */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatItem label="Floor Price" value={stats.floor}    subValue={null} />
          <StatItem label="Top Offer"   value={stats.topOffer} />
          <StatItem label="24H VOL"     value={stats.vol24h}   />
          <StatItem label="Total VOL"   value={stats.totalVol} />
          <StatItem label="Market Cap"  value={stats.mktCap}   />
          <StatItem label="Owners"      value={stats.owners}   subValue={stats.ownerPct} />
          <StatItem label="Listed"      value={stats.listed}   subValue={stats.listedPct} />
          <StatItem label="Supply"      value={stats.supply}   />
          <StatItem label="Royalties"   value={stats.royalties} />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b mb-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="pb-4 text-sm font-bold uppercase tracking-widest transition-all"
              style={{
                background: "none", border: "none",
                borderBottom: tab === t ? "2px solid #22d3ee" : "2px solid transparent",
                color: tab === t ? "#22d3ee" : "#9da7b3",
                cursor: "pointer",
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* Items Tab */}
        {tab === "Items" && (
          <>
            {/* CSS for group-hover animated buy button */}
            <style>{`
              .nft-card:hover .buy-slide {
                transform: translateY(0) !important;
              }
            `}</style>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Listed NFTs — hoisted to top */}
              {activeListings.map(listing => (
                <div
                  key={`listed-${listing.token_id}`}
                  className="nft-card group rounded-2xl overflow-hidden cursor-pointer relative"
                  style={{
                    background: "#121821",
                    border: "1px solid rgba(34,211,238,0.2)",
                    transition: "border-color 0.2s, transform 0.2s, box-shadow 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.5)"; e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(34,211,238,0.08)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
                  onClick={() => window.location.href = `/collection/${id}/${listing.token_id}`}
                >
                  <div className="relative aspect-square overflow-hidden" style={{ background: "#161d28" }}>
                    <img
                      src={listing.image || listing.image_url || ""}
                      alt={listing.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={e => { e.target.style.display = "none"; }}
                    />
                    <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-lg"
                      style={{ background: "rgba(11,15,20,0.85)", color: "#22d3ee",
                        border: "1px solid rgba(34,211,238,0.4)", backdropFilter: "blur(4px)" }}>
                      ● FOR SALE
                    </div>
                    {/* Animated Buy Now slide-up */}
                    <button
                      className="buy-slide absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-3 font-bold text-xs"
                      style={{
                        background: "linear-gradient(to top, rgba(34,211,238,0.97), rgba(34,211,238,0.88))",
                        color: "#0b0f14",
                        transform: "translateY(100%)",
                        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
                        border: "none", cursor: "pointer",
                        fontFamily: "Syne, sans-serif",
                      }}
                      onClick={e => { e.stopPropagation(); setBuyModal(listing); }}
                    >
                      <ShoppingCart size={13} /> Buy Now
                    </button>
                  </div>
                  <div className="p-3">
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5 truncate"
                      style={{ color: "#9da7b3" }}>{collection?.name}</div>
                    <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>
                      {listing.name || `${collection?.name} #${listing.token_id}`}
                    </div>
                    <div className="mt-1.5">
                      <div className="text-[9px] uppercase tracking-wide" style={{ color: "#9da7b3" }}>Price</div>
                      <div className="font-mono text-sm font-bold" style={{ color: "#22d3ee" }}>
                        {(Number(listing.price) / 1e6).toFixed(2)} USD
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Unlisted tokens */}
              {unlistedTokens.map(token => (
                <div
                  key={`unlisted-${token.tokenId}`}
                  className="group rounded-2xl overflow-hidden cursor-pointer"
                  style={{
                    background: "#121821",
                    border: "1px solid rgba(255,255,255,0.05)",
                    transition: "border-color 0.2s, transform 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
                  onClick={() => window.location.href = `/collection/${id}/${token.tokenId}`}
                >
                  <div className="aspect-square overflow-hidden" style={{ background: "#161d28" }}>
                    <img
                      src={token.image || ""}
                      alt={token.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={e => { e.target.style.display = "none"; }}
                    />
                  </div>
                  <div className="p-3">
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5 truncate"
                      style={{ color: "#9da7b3" }}>{collection?.name}</div>
                    <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>{token.name}</div>
                    <div className="mt-1.5 text-[10px]" style={{ color: "rgba(157,167,179,0.35)" }}>
                      Not listed
                    </div>
                  </div>
                </div>
              ))}

              {tokensLoading && Array(10).fill(0).map((_, i) => <CardSkeleton key={`sk-${i}`} />)}
            </div>

            <div ref={loaderRef} className="h-10" />
            {!hasMore && (unlistedTokens.length + activeListings.length) > 0 && (
              <div className="text-center py-8 text-sm" style={{ color: "#9da7b3" }}>
                All {unlistedTokens.length + activeListings.length} items loaded
              </div>
            )}
          </>
        )}

        {tab === "Activity" && (
          <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />
        )}

        {tab !== "Items" && tab !== "Activity" && (
          <div className="py-20 text-center text-sm" style={{ color: "#9da7b3" }}>
            {tab} coming soon — data is being indexed from Tempo chain.
          </div>
        )}
      </div>

      {/* Buy Modal — uses the standalone BuyModal component */}
      {buyModal && (
        <BuyModal
          listing={buyModal}
          onClose={() => setBuyModal(null)}
          onSuccess={() => { setBuyModal(null); }}
        />
      )}
    </div>
  );
}
