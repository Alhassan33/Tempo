import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle2, ExternalLink, Twitter, Globe, TrendingDown, TrendingUp, ShoppingCart, Zap } from "lucide-react";
import { useCollection, useRealtimeListings, useCollectionStats } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import BuyModal from "@/components/BuyModal.jsx";

const TABS        = ["Items", "Activity", "Bids", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";
const PAGE_SIZE   = 50;

// ─── Stat Card ────────────────────────────────────────────────────────────────
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

// ─── NFT Grid Card ────────────────────────────────────────────────────────────
// OpenSea-style: Clean card with item number, price, no buy button on card
// Clicking navigates to item page where buy action happens
function NFTGridCard({ token, collectionName, slug, listing, rank }) {
  const navigate = useNavigate();

  const isListed = !!listing;
  const price = listing ? (Number(listing.price) / 1e6).toFixed(2) : null;

  return (
    <div
      onClick={() => navigate(`/collection/${slug}/${token.tokenId || token.token_id}`)}
      className="group rounded-2xl overflow-hidden cursor-pointer relative"
      style={{
        background: "#121821",
        border: isListed ? "1px solid rgba(34,211,238,0.2)" : "1px solid rgba(255,255,255,0.05)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={e => { 
        e.currentTarget.style.borderColor = isListed ? "rgba(34,211,238,0.5)" : "rgba(255,255,255,0.12)"; 
        e.currentTarget.style.transform = "translateY(-4px)"; 
        e.currentTarget.style.boxShadow = isListed ? "0 12px 32px rgba(34,211,238,0.12)" : "0 8px 24px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={e => { 
        e.currentTarget.style.borderColor = isListed ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.05)"; 
        e.currentTarget.style.transform = "translateY(0)"; 
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Image Container */}
      <div className="relative aspect-square overflow-hidden" style={{ background: "#161d28" }}>
        <img
          src={token.image || listing?.image || listing?.image_url || ""}
          alt={token.name || listing?.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={e => { e.target.style.display = "none"; }}
        />

        {/* FOR SALE badge - top left */}
        {isListed && (
          <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-1 rounded-lg"
            style={{ 
              background: "rgba(11,15,20,0.9)", 
              color: "#22d3ee",
              border: "1px solid rgba(34,211,238,0.4)", 
              backdropFilter: "blur(4px)" 
            }}>
            ● FOR SALE
          </div>
        )}

        {/* Rank badge - top right (if available) */}
        {rank && (
          <div className="absolute top-2 right-2 text-[9px] font-bold px-2 py-1 rounded-lg"
            style={{ 
              background: "rgba(11,15,20,0.9)", 
              color: "#a78bfa",
              border: "1px solid rgba(167,139,250,0.4)", 
              backdropFilter: "blur(4px)" 
            }}>
            Rank #{rank}
          </div>
        )}
      </div>

      {/* Card Info - Clean OpenSea Style */}
      <div className="p-3">
        {/* Collection name */}
        <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5 truncate" style={{ color: "#9da7b3" }}>
          {collectionName}
        </div>
        
        {/* Token name / number */}
        <div className="text-sm font-bold truncate mb-2" style={{ color: "#e6edf3" }}>
          {token.name || listing?.name || `${collectionName} #${token.tokenId || token.token_id}`}
        </div>

        {/* Price row - only if listed */}
        {isListed ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>Price</div>
              <div className="font-mono text-sm font-bold" style={{ color: "#22d3ee" }}>
                {price} USD
              </div>
            </div>
            {/* Item number badge */}
            <div 
              className="text-[10px] font-mono px-2 py-1 rounded-lg"
              style={{ 
                background: "rgba(255,255,255,0.05)", 
                color: "#9da7b3" 
              }}
            >
              #{token.tokenId || token.token_id}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="text-[10px]" style={{ color: "rgba(157,167,179,0.4)" }}>
              Not listed
            </div>
            {/* Item number badge */}
            <div 
              className="text-[10px] font-mono px-2 py-1 rounded-lg"
              style={{ 
                background: "rgba(255,255,255,0.05)", 
                color: "#9da7b3" 
              }}
            >
              #{token.tokenId || token.token_id}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sweep Button Component ───────────────────────────────────────────────────
function SweepButton({ listings, onSweep }) {
  const floorPrice = listings.length > 0 ? (Number(listings[0].price) / 1e6).toFixed(2) : null;
  const listedCount = listings.length;

  if (listedCount === 0) return null;

  return (
    <button
      onClick={onSweep}
      className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all"
      style={{
        background: "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(34,211,238,0.05))",
        color: "#22d3ee",
        border: "1px solid rgba(34,211,238,0.3)",
        cursor: "pointer",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = "linear-gradient(135deg, rgba(34,211,238,0.25), rgba(34,211,238,0.1))";
        e.currentTarget.style.borderColor = "rgba(34,211,238,0.5)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = "linear-gradient(135deg, rgba(34,211,238,0.15), rgba(34,211,238,0.05))";
        e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)";
      }}
    >
      <Zap size={14} />
      <span>Sweep Floor</span>
      <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "rgba(34,211,238,0.2)" }}>
        {listedCount}
      </span>
    </button>
  );
}

// ─── Main CollectionPage ──────────────────────────────────────────────────────
export default function CollectionPage() {
  const { id } = useParams();

  // Stats hooks
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
  const [buyModal,       setBuyModal]       = useState(null);
  const [sweepModal,     setSweepModal]     = useState(false);
  const loaderRef = useRef(null);

  // Stats calculation
  const stats = useMemo(() => {
    const supply     = rpcStats.totalSupply  || collection?.total_supply || 0;
    const floorPrice = rpcStats.floorPrice   || collection?.floor_price  || 0;
    const owners     = rpcStats.uniqueOwners || collection?.owners       || 0;
    const listed     = rpcStats.listedCount  || activeListings.length;
    const royaltyBps = collection?.royalty_bps ?? 0;

    return {
      floor:     floorPrice > 0 ? `${(Number(floorPrice) / 1e6).toFixed(2)} USD` : "—",
      topOffer:  collection?.top_offer ? `${(Number(collection.top_offer) / 1e6).toFixed(2)} USD` : "—",
      vol24h:    collection?.volume_24h    ? `${(Number(collection.volume_24h) / 1e6).toFixed(2)} USD`    : "0 USD",
      totalVol:  collection?.volume_total  ? `${(Number(collection.volume_total) / 1e6).toFixed(2)} USD`  : "0 USD",
      mktCap:    floorPrice && supply ? `${((Number(floorPrice) / 1e6) * supply).toLocaleString()} USD` : "—",
      owners,
      ownerPct:  supply && owners ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed,
      listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply:    supply?.toLocaleString() || "0",
      royalties: royaltyBps ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
    };
  }, [collection, activeListings, rpcStats]);

  // Fetch unlisted tokens
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

  // Handle sweep action
  const handleSweep = () => {
    // For now, just buy the floor item
    // In future: implement multi-select and batch purchase
    if (activeListings.length > 0) {
      setBuyModal(activeListings[0]);
    }
  };

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

        {/* Stats Grid */}
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

        {/* Tabs + Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b mb-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <div className="flex gap-6">
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
          
          {/* Sweep Button - only show on Items tab with listings */}
          {tab === "Items" && activeListings.length > 0 && (
            <div className="pb-3 sm:pb-0">
              <SweepButton listings={activeListings} onSweep={handleSweep} />
            </div>
          )}
        </div>

        {/* Items Tab */}
        {tab === "Items" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Listed NFTs - hoisted to top, sorted by price (cheapest first) */}
              {activeListings.map((listing, index) => (
                <NFTGridCard
                  key={`listed-${listing.token_id}`}
                  token={{
                    tokenId: listing.token_id,
                    token_id: listing.token_id,
                    name: listing.name,
                    image: listing.image || listing.image_url
                  }}
                  collectionName={collection?.name}
                  slug={id}
                  listing={listing}
                  rank={index < 3 ? index + 1 : null} // Top 3 get rank badges
                />
              ))}

              {/* Unlisted tokens */}
              {unlistedTokens.map(token => (
                <NFTGridCard
                  key={`unlisted-${token.tokenId}`}
                  token={token}
                  collectionName={collection?.name}
                  slug={id}
                  listing={null}
                  rank={null}
                />
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

      {/* Buy Modal */}
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
