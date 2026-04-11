import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  CheckCircle2, ExternalLink, Twitter, Globe, 
  TrendingDown, TrendingUp, Grid3X3, LayoutGrid, List, Filter 
} from "lucide-react";
import { useCollection, useRealtimeListings, useCollectionStats } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";

const TABS = ["Items", "Activity"];
const EXPLORER_BASE = "https://explore.tempo.xyz";
const PAGE_SIZE = 50;

// View modes: 1 = single grid (1 col mobile, 2 sm, 3 md, 4 lg, 5 xl)
//             2 = double grid (2 col mobile, 3 sm, 4 md, 5 lg)
//             3 = list view
const VIEW_MODES = {
  GRID: 'grid',
  COMPACT: 'compact',
  LIST: 'list'
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div 
    className="rounded-2xl p-4" 
    style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}
  >
    <div 
      className="text-[10px] font-medium uppercase tracking-wider mb-1" 
      style={{ color: "#9CA3AF" }}
    >
      {label}
    </div>
    <div className="flex items-baseline gap-2">
      <div 
        className="font-mono-web3 text-lg font-bold" 
        style={{ color: "#EDEDED" }}
      >
        {value}
      </div>
      {subValue && (
        <div 
          className={`text-[11px] font-medium flex items-center gap-0.5 ${
            isTrend ? (subValue.includes('-') ? 'text-red-400' : 'text-green-400') : ''
          }`} 
          style={!isTrend ? { color: "#9CA3AF" } : {}}
        >
          {isTrend && (subValue.includes('-') ? <TrendingDown size={11} /> : <TrendingUp size={11} />)}
          {subValue}
        </div>
      )}
    </div>
  </div>
);

// ─── View Toggle Button ───────────────────────────────────────────────────────
const ViewToggle = ({ currentView, onChange }) => {
  const buttons = [
    { id: VIEW_MODES.GRID, icon: Grid3X3, label: "Grid" },
    { id: VIEW_MODES.COMPACT, icon: LayoutGrid, label: "Compact" },
    { id: VIEW_MODES.LIST, icon: List, label: "List" },
  ];

  return (
    <div 
      className="flex items-center gap-1 p-1 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      {buttons.map(({ id, icon: Icon, label }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: currentView === id ? "rgba(0, 230, 168, 0.15)" : "transparent",
            color: currentView === id ? "#00E6A8" : "#6B7280",
            border: currentView === id ? "1px solid rgba(0, 230, 168, 0.3)" : "1px solid transparent",
          }}
          title={label}
        >
          <Icon size={14} />
        <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
};

// ─── NFT Grid Card ────────────────────────────────────────────────────────────
function NFTGridCard({ token, collectionName, slug, listing, viewMode }) {
  const navigate = useNavigate();
  const isListed = !!listing;
  const price = listing ? (Number(listing.price) / 1e6).toFixed(2) : null;

  // List view layout
  if (viewMode === VIEW_MODES.LIST) {
    return (
      <div
        onClick={() => navigate(`/collection/${slug}/${token.tokenId || token.token_id}`)}
        className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all"
        style={{
          background: "#11161D",
          border: isListed ? "1px solid rgba(0, 230, 168, 0.2)" : "1px solid rgba(255,255,255,0.05)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = isListed ? "rgba(0, 230, 168, 0.4)" : "rgba(255,255,255,0.1)";
          e.currentTarget.style.background = "rgba(255,255,255,0.02)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = isListed ? "rgba(0, 230, 168, 0.2)" : "rgba(255,255,255,0.05)";
          e.currentTarget.style.background = "#11161D";
        }}
      >
        {/* Thumbnail */}
        <div 
          className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0"
          style={{ background: "#161d28" }}
        >
          <img
            src={token.image || listing?.image || listing?.image_url || ""}
            alt={token.name || listing?.name}
            className="w-full h-full object-cover"
            onError={(e) => { e.target.style.display = "none"; }}
          />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div 
            className="text-[10px] font-medium uppercase tracking-wider mb-0.5"
            style={{ color: "#9CA3AF" }}
          >
            {collectionName}
          </div>
          <div 
            className="text-sm font-bold truncate"
            style={{ color: "#EDEDED" }}
          >
            {token.name || listing?.name || `${collectionName} #${token.tokenId || token.token_id}`}
          </div>
        </div>

        {/* Price / Status */}
        <div className="text-right">
          {isListed ? (
            <>
              <div 
                className="text-[10px] uppercase tracking-wide mb-0.5"
                style={{ color: "#9CA3AF" }}
              >
                Price
              </div>
              <div 
                className="font-mono-web3 text-sm font-bold"
                style={{ color: "#00E6A8" }}
              >
                {price} USD
              </div>
            </>
          ) : (
            <span className="text-xs" style={{ color: "#6B7280" }}>Not listed</span>
          )}
        </div>

        {/* Token ID */}
        <div 
          className="text-xs font-mono-web3 px-3 py-1 rounded-lg"
          style={{ background: "rgba(255,255,255,0.03)", color: "#6B7280" }}
        >
          #{token.tokenId || token.token_id}
        </div>
      </div>
    );
  }

  // Grid view layout
  return (
    <div
      onClick={() => navigate(`/collection/${slug}/${token.tokenId || token.token_id}`)}
      className="group rounded-2xl overflow-hidden cursor-pointer relative"
      style={{
        background: "#11161D",
        border: isListed ? "1px solid rgba(0, 230, 168, 0.2)" : "1px solid rgba(255,255,255,0.05)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={(e) => { 
        e.currentTarget.style.borderColor = isListed ? "rgba(0, 230, 168, 0.5)" : "rgba(255,255,255,0.12)"; 
        e.currentTarget.style.transform = "translateY(-4px)"; 
        e.currentTarget.style.boxShadow = isListed 
          ? "0 12px 32px rgba(0, 230, 168, 0.12)" 
          : "0 8px 24px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={(e) => { 
        e.currentTarget.style.borderColor = isListed ? "rgba(0, 230, 168, 0.2)" : "rgba(255,255,255,0.05)"; 
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
          onError={(e) => { e.target.style.display = "none"; }}
        />

        {/* FOR SALE badge */}
        {isListed && (
          <div 
            className="absolute top-2 left-2 text-[9px] font-bold px-2 py-1 rounded-lg"
            style={{ 
              background: "rgba(10, 15, 20, 0.9)", 
              color: "#00E6A8",
              border: "1px solid rgba(0, 230, 168, 0.4)", 
              backdropFilter: "blur(4px)" 
            }}
          >
            ● FOR SALE
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="p-3">
        <div 
          className="text-[9px] font-medium uppercase tracking-widest mb-0.5 truncate"
          style={{ color: "#9CA3AF" }}
        >
          {collectionName}
        </div>
        
        <div 
          className="text-sm font-bold truncate mb-2"
          style={{ color: "#EDEDED" }}
        >
          {token.name || listing?.name || `${collectionName} #${token.tokenId || token.token_id}`}
        </div>

        {/* Price row */}
        {isListed ? (
          <div className="flex items-center justify-between">
            <div>
              <div 
                className="text-[9px] uppercase tracking-wide mb-0.5"
                style={{ color: "#9CA3AF" }}
              >
                Price
              </div>
              <div 
                className="font-mono-web3 text-sm font-bold"
                style={{ color: "#00E6A8" }}
              >
                {price} USD
              </div>
            </div>
            <div 
              className="text-[10px] font-mono-web3 px-2 py-1 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", color: "#6B7280" }}
            >
              #{token.tokenId || token.token_id}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: "#6B7280" }}>Not listed</span>
            <div 
              className="text-[10px] font-mono-web3 px-2 py-1 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", color: "#6B7280" }}
            >
              #{token.tokenId || token.token_id}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sticky Action Bar ────────────────────────────────────────────────────────
function StickyActionBar({ activeListings, collectionName, visible }) {
  const navigate = useNavigate();
  const { id } = useParams();
  
  if (!visible || activeListings.length === 0) return null;
  
  const floorPrice = (Number(activeListings[0].price) / 1e6).toFixed(2);
  const listedCount = activeListings.length;

  return (
    <div 
      className={`sticky-action-bar ${visible ? '' : 'hidden'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Floor Info */}
        <div className="flex items-center gap-4">
          <div>
            <div 
              className="text-[10px] uppercase tracking-wider mb-0.5"
              style={{ color: "#9CA3AF" }}
            >
              Floor Price
            </div>
            <div 
              className="font-mono-web3 text-lg font-bold"
              style={{ color: "#00E6A8" }}
            >
              {floorPrice} <span className="text-sm">USD</span>
            </div>
          </div>
          <div 
            className="h-8 w-px"
            style={{ background: "rgba(255,255,255,0.1)" }}
          />
          <div>
            <div 
              className="text-[10px] uppercase tracking-wider mb-0.5"
              style={{ color: "#9CA3AF" }}
            >
              Listed
            </div>
            <div 
              className="font-mono-web3 text-lg font-bold"
              style={{ color: "#EDEDED" }}
            >
              {listedCount}
            </div>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => navigate(`/collection/${id}/${activeListings[0].token_id}`)}
          className="px-6 py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: "#00E6A8",
            color: "#0A0F14",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#00FFC6";
            e.currentTarget.style.boxShadow = "0 0 24px rgba(0, 230, 168, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#00E6A8";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          View Floor
        </button>
      </div>
    </div>
  );
}

// ─── Main CollectionPage ──────────────────────────────────────────────────────
export default function CollectionPage() {
  const { id } = useParams();
  const [viewMode, setViewMode] = useState(VIEW_MODES.GRID);
  const [showStickyBar, setShowStickyBar] = useState(true);
  const lastScrollY = useRef(0);

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
  const [tokensLoading, setTokensLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState("Items");
  const loaderRef = useRef(null);

  // Scroll handler for sticky bar hide/show
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // Hide when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY.current && currentScrollY > 200) {
        setShowStickyBar(false);
      } else {
        setShowStickyBar(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Stats calculation with proper price conversion
  const stats = useMemo(() => {
    const supply = rpcStats.totalSupply || collection?.total_supply || 0;
    const floorPrice = rpcStats.floorPrice || collection?.floor_price || 0;
    const owners = rpcStats.uniqueOwners || collection?.owners || 0;
    const listed = rpcStats.listedCount || activeListings.length;
    const royaltyBps = collection?.royalty_bps ?? 0;

    return {
      floor: floorPrice > 0 ? `${(Number(floorPrice) / 1e6).toFixed(2)} USD` : "—",
      topOffer: collection?.top_offer ? `${(Number(collection.top_offer) / 1e6).toFixed(2)} USD` : "—",
      vol24h: collection?.volume_24h ? `${(Number(collection.volume_24h) / 1e6).toFixed(2)} USD` : "0 USD",
      totalVol: collection?.volume_total ? `${(Number(collection.volume_total) / 1e6).toFixed(2)} USD` : "0 USD",
      mktCap: floorPrice && supply ? `${((Number(floorPrice) / 1e6) * supply).toLocaleString()} USD` : "—",
      owners,
      ownerPct: supply && owners ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed,
      listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply: supply?.toLocaleString() || "0",
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
    const start = (pageNum - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, supply);
    if (start > supply) { setHasMore(false); return; }
    setTokensLoading(true);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);
    const results = await Promise.all(ids.map(async (tokenId) => {
      const idStr = String(tokenId);
      if (listedIds.has(idStr)) return null;
      try {
        const res = await fetch(`${base}${tokenId}.json`, { cache: "force-cache" });
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

  // Get grid classes based on view mode
  const getGridClasses = () => {
    switch (viewMode) {
      case VIEW_MODES.COMPACT:
        return "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6";
      case VIEW_MODES.LIST:
        return "flex flex-col gap-3";
      case VIEW_MODES.GRID:
      default:
        return "grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
    }
  };

  if (colLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div 
        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} 
      />
    </div>
  );

  return (
    <div 
      className="fade-up min-h-screen pb-24" 
      style={{ background: "#0A0F14" }}
    >
      {/* Banner */}
      <div className="relative h-56 w-full overflow-hidden">
        {collection?.banner_url ? (
          <img 
            src={collection.banner_url} 
            className="w-full h-full object-cover opacity-60" 
            alt="Banner" 
          />
        ) : (
          <div 
            className="w-full h-full"
            style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} 
          />
        )}
        <div 
          className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 40%, #0A0F14)" }} 
        />
      </div>

      <div className="px-4 sm:px-6 max-w-7xl mx-auto -mt-16 relative z-10">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end gap-5 mb-8">
          <div 
            className="w-28 h-28 rounded-3xl overflow-hidden flex-shrink-0"
            style={{ border: "4px solid #0A0F14", background: "#11161D" }}
          >
            <NFTImage src={collection?.logo_url} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 
                className="text-3xl font-bold tracking-tight"
                style={{ color: "#EDEDED" }}
              >
                {collection?.name}
              </h1>
              {collection?.verified && (
                <CheckCircle2 size={22} style={{ color: "#00E6A8" }} />
              )}
            </div>
            <div className="flex items-center gap-4" style={{ color: "#9CA3AF" }}>
              <span className="text-sm font-medium" style={{ color: "#00E6A8" }}>
                By {collection?.creator_name || "Tempo Creator"}
              </span>
              <div className="flex items-center gap-3">
                {collection?.twitter_url && (
                  <a 
                    href={collection.twitter_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    <Twitter size={16} />
                  </a>
                )}
                {collection?.website_url && (
                  <a 
                    href={collection.website_url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="hover:text-white transition-colors"
                  >
                    <Globe size={16} />
                  </a>
                )}
                <a 
                  href={`${EXPLORER_BASE}/address/${collection?.contract_address}`}
                  target="_blank" 
                  rel="noreferrer"
                  className="hover:text-white transition-colors"
                >
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
            {collection?.description && (
              <p className="text-sm mt-2 line-clamp-2" style={{ color: "#9CA3AF" }}>
                {collection.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatItem label="Floor Price" value={stats.floor} subValue={null} />
          <StatItem label="Top Offer" value={stats.topOffer} />
          <StatItem label="24H VOL" value={stats.vol24h} />
          <StatItem label="Total VOL" value={stats.totalVol} />
          <StatItem label="Market Cap" value={stats.mktCap} />
          <StatItem label="Owners" value={stats.owners} subValue={stats.ownerPct} />
          <StatItem label="Listed" value={stats.listed} subValue={stats.listedPct} />
          <StatItem label="Supply" value={stats.supply} />
          <StatItem label="Royalties" value={stats.royalties} />
        </div>

        {/* Tabs + View Toggle */}
        <div 
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b mb-6"
          style={{ borderColor: "rgba(255,255,255,0.05)" }}
        >
          <div className="flex gap-6">
            {TABS.map(t => (
              <button 
                key={t} 
                onClick={() => setTab(t)}
                className="pb-4 text-sm font-medium uppercase tracking-widest transition-all"
                style={{
                  background: "none",
                  border: "none",
                  borderBottom: tab === t ? "2px solid #00E6A8" : "2px solid transparent",
                  color: tab === t ? "#00E6A8" : "#9CA3AF",
                  cursor: "pointer",
                }}
              >
                {t}
              </button>
            ))}
          </div>
          
          {/* View Toggle - only show on Items tab */}
          {tab === "Items" && (
            <div className="pb-3 sm:pb-0">
              <ViewToggle currentView={viewMode} onChange={setViewMode} />
            </div>
          )}
        </div>

        {/* Items Tab */}
        {tab === "Items" && (
          <>
            <div className={`grid gap-4 ${getGridClasses()}`}>
              {/* Listed NFTs - hoisted to top */}
              {activeListings.map((listing) => (
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
                  viewMode={viewMode}
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
                  viewMode={viewMode}
                />
              ))}

              {tokensLoading && Array(10).fill(0).map((_, i) => <CardSkeleton key={`sk-${i}`} />)}
            </div>

            <div ref={loaderRef} className="h-10" />
            {!hasMore && (unlistedTokens.length + activeListings.length) > 0 && (
              <div className="text-center py-8 text-sm" style={{ color: "#9CA3AF" }}>
                All {unlistedTokens.length + activeListings.length} items loaded
              </div>
            )}
          </>
        )}

        {tab === "Activity" && (
          <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />
        )}
      </div>

      {/* Sticky Action Bar */}
      <StickyActionBar 
        activeListings={activeListings} 
        collectionName={collection?.name}
        visible={showStickyBar && tab === "Items"}
      />
    </div>
  );
}
