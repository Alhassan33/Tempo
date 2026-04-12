import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2, ExternalLink, Twitter, Globe, MessageCircle,
  TrendingDown, TrendingUp, Square, Grid2X2, List,
  ShoppingCart, BarChart2, RefreshCw
} from "lucide-react";
import { useCollection, useRealtimeListings, useCollectionStats } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import BuyModal from "@/components/BuyModal.jsx";

const TABS = ["Items", "Activity", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";
const PAGE_SIZE = 50;
const VIEW = { SINGLE: "single", GRID: "grid", LIST: "list" };

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4"
    style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>{label}</div>
    <div className="flex items-baseline gap-2">
      <div className="font-mono text-lg font-bold" style={{ color: "#EDEDED" }}>{value}</div>
      {subValue && (
        <div className={`text-[11px] font-medium flex items-center gap-0.5 ${
          isTrend ? (subValue.includes('-') ? 'text-red-400' : 'text-green-400') : ''
        }`} style={!isTrend ? { color: "#9CA3AF" } : {}}>
          {isTrend && (subValue.includes('-') ? <TrendingDown size={11} /> : <TrendingUp size={11} />)}
          {subValue}
        </div>
      )}
    </div>
  </div>
);

// ─── View Toggle + Refresh — all in ONE pill ──────────────────────────────────
// Single (1 col) | Grid (2 col) | List | | Refresh
function ViewControls({ current, onChange, onRefresh, refreshing }) {
  const views = [
    { id: VIEW.SINGLE, Icon: Square,   title: "Single view" },
    { id: VIEW.GRID,   Icon: Grid2X2,  title: "Grid view"   },
    { id: VIEW.LIST,   Icon: List,     title: "List view"   },
  ];

  return (
    <div className="flex items-center rounded-xl overflow-hidden"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>

      {/* View mode buttons */}
      {views.map(({ id, Icon, title }, i) => (
        <button key={id} onClick={() => onChange(id)} title={title}
          className="flex items-center justify-center w-9 h-9 transition-all"
          style={{
            background:  current === id ? "rgba(0,230,168,0.15)" : "transparent",
            color:       current === id ? "#00E6A8" : "#6B7280",
            border: "none",
            borderRight: "1px solid rgba(255,255,255,0.06)",
            cursor: "pointer",
          }}>
          <Icon size={15} />
        </button>
      ))}

      {/* Divider then Refresh */}
      <button onClick={onRefresh} title="Refresh listings"
        className="flex items-center justify-center w-9 h-9 transition-all"
        style={{ background: "transparent", color: "#6B7280", border: "none", cursor: "pointer" }}
        onMouseEnter={e => { e.currentTarget.style.color = "#00E6A8"; }}
        onMouseLeave={e => { e.currentTarget.style.color = "#6B7280"; }}>
        <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
      </button>
    </div>
  );
}

// ─── NFT Card ─────────────────────────────────────────────────────────────────
function NFTCard({ token, collectionName, slug, listing, viewMode, onBuy }) {
  const navigate     = useNavigate();
  const isListed     = !!listing;
  const displayPrice = listing ? (Number(listing.price) / 1e6).toFixed(2) : null;
  const tokenId      = token.tokenId || token.token_id;
  const imgSrc       = token.image || listing?.image || listing?.image_url || "";

  function goToItem() { navigate(`/collection/${slug}/${tokenId}`); }

  // ── List row ──────────────────────────────────────────────────────────────
  if (viewMode === VIEW.LIST) {
    return (
      <div onClick={goToItem}
        className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all"
        style={{ background: "#11161D", border: isListed ? "1px solid rgba(0,230,168,0.2)" : "1px solid rgba(255,255,255,0.05)" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = isListed ? "rgba(0,230,168,0.4)" : "rgba(255,255,255,0.1)"; e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = isListed ? "rgba(0,230,168,0.2)" : "rgba(255,255,255,0.05)"; e.currentTarget.style.background = "#11161D"; }}>
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "#161d28" }}>
          {imgSrc
            ? <img src={imgSrc} alt={token.name} className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />
            : <div className="w-full h-full animate-pulse" style={{ background: "#1a2232" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: "#9CA3AF" }}>{collectionName}</div>
          <div className="text-sm font-bold truncate" style={{ color: "#EDEDED" }}>
            {token.name || `${collectionName} #${tokenId}`}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {isListed
            ? <><div className="text-[10px] uppercase mb-0.5" style={{ color: "#9CA3AF" }}>Price</div>
                <div className="font-mono text-sm font-bold" style={{ color: "#00E6A8" }}>{displayPrice} USD</div></>
            : <span className="text-xs" style={{ color: "#6B7280" }}>Not listed</span>}
        </div>
        <div className="text-xs font-mono px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.04)", color: "#6B7280" }}>#{tokenId}</div>
      </div>
    );
  }

  // ── Grid card (SINGLE = 1 col, GRID = 2 col) ──────────────────────────────
  return (
    <div
      className="nft-card group rounded-2xl overflow-hidden cursor-pointer relative"
      style={{
        background: "#11161D",
        border: isListed ? "1px solid rgba(0,230,168,0.2)" : "1px solid rgba(255,255,255,0.05)",
        transition: "all 0.2s ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = isListed ? "rgba(0,230,168,0.5)" : "rgba(255,255,255,0.12)";
        e.currentTarget.style.transform   = "translateY(-3px)";
        e.currentTarget.style.boxShadow   = isListed ? "0 12px 32px rgba(0,230,168,0.1)" : "0 8px 24px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isListed ? "rgba(0,230,168,0.2)" : "rgba(255,255,255,0.05)";
        e.currentTarget.style.transform   = "translateY(0)";
        e.currentTarget.style.boxShadow   = "none";
      }}
      onClick={goToItem}>

      <div className="relative aspect-square overflow-hidden" style={{ background: "#161d28" }}>
        {imgSrc
          ? <img src={imgSrc} alt={token.name || `#${tokenId}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={e => { e.target.style.display = "none"; }} />
          : <div className="w-full h-full flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} />
            </div>}

        {isListed && (
          <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-1 rounded-lg"
            style={{ background: "rgba(10,15,20,0.9)", color: "#00E6A8",
              border: "1px solid rgba(0,230,168,0.4)", backdropFilter: "blur(4px)" }}>
            ● FOR SALE
          </div>
        )}

        {/* Animated Buy Now slides up on hover */}
        {isListed && onBuy && (
          <button
            className="buy-slide absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-3 font-bold text-xs"
            style={{
              background: "linear-gradient(to top, rgba(0,230,168,0.97), rgba(0,230,168,0.88))",
              color: "#0A0F14", transform: "translateY(100%)",
              transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
              border: "none", cursor: "pointer",
            }}
            onClick={e => { e.stopPropagation(); onBuy(listing); }}>
            <ShoppingCart size={13} /> Buy Now
          </button>
        )}
      </div>

      <div className="p-3">
        <div className="text-[9px] font-medium uppercase tracking-widest mb-0.5 truncate" style={{ color: "#9CA3AF" }}>
          {collectionName}
        </div>
        <div className="text-sm font-bold truncate mb-1.5" style={{ color: "#EDEDED" }}>
          {token.name || `${collectionName} #${tokenId}`}
        </div>
        {isListed ? (
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] uppercase tracking-wide" style={{ color: "#9CA3AF" }}>Price</div>
              <div className="font-mono text-sm font-bold" style={{ color: "#00E6A8" }}>{displayPrice} USD</div>
            </div>
            <div className="text-[10px] font-mono px-2 py-1 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", color: "#6B7280" }}>#{tokenId}</div>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-[10px]" style={{ color: "#6B7280" }}>Not listed</span>
            <div className="text-[10px] font-mono px-2 py-1 rounded-lg"
              style={{ background: "rgba(255,255,255,0.03)", color: "#6B7280" }}>#{tokenId}</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Floor Bar ────────────────────────────────────────────────────────────────
function FloorBar({ activeListings, visible, onBuyFloor }) {
  if (!visible || !activeListings.length) return null;
  const floor = activeListings[0];
  const floorDisplay = (Number(floor.price) / 1e6).toFixed(2);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300"
      style={{
        background: "rgba(10,15,20,0.95)", backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(0,230,168,0.15)",
        paddingBottom: "env(safe-area-inset-bottom)",
        transform: visible ? "translateY(0)" : "translateY(100%)",
      }}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-5">
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "#9CA3AF" }}>Floor Price</div>
            <div className="font-mono text-lg font-bold" style={{ color: "#00E6A8" }}>
              {floorDisplay} <span className="text-sm">USD</span>
            </div>
          </div>
          <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "#9CA3AF" }}>Listed</div>
            <div className="font-mono text-lg font-bold" style={{ color: "#EDEDED" }}>{activeListings.length}</div>
          </div>
        </div>
        <button onClick={() => onBuyFloor(floor)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold"
          style={{ background: "#00E6A8", color: "#0A0F14", border: "none", cursor: "pointer" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#00FFC6"; e.currentTarget.style.boxShadow = "0 0 24px rgba(0,230,168,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#00E6A8"; e.currentTarget.style.boxShadow = "none"; }}>
          <ShoppingCart size={15} /> Cart Floor
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CollectionPage() {
  const { id } = useParams();
  const [viewMode,     setViewMode]     = useState(VIEW.GRID);
  const [tab,          setTab]          = useState("Items");
  const [buyModal,     setBuyModal]     = useState(null);
  const [showFloorBar, setShowFloorBar] = useState(true);
  const [refreshing,   setRefreshing]   = useState(false);
  const lastScrollY = useRef(0);

  const { collection, isLoading: colLoading } = useCollection(id);
  const { stats: rpcStats } = useCollectionStats(collection?.contract_address || "");
  const contractAddr = collection?.contract_address?.toLowerCase();
  const { listings, isLoading: listingsLoading } = useRealtimeListings(contractAddr);

  const activeListings = useMemo(() =>
    (listings || []).filter(l => l.active).sort((a, b) => Number(a.price) - Number(b.price)),
  [listings]);

  const listedIds = useMemo(() =>
    new Set(activeListings.map(l => String(l.token_id))),
  [activeListings]);

  const [listedTokensWithImages, setListedTokensWithImages] = useState([]);
  const [unlistedTokens, setUnlistedTokens] = useState([]);
  const [tokensLoading,  setTokensLoading]  = useState(false);
  const [page,           setPage]           = useState(1);
  const [hasMore,        setHasMore]        = useState(true);
  const loaderRef = useRef(null);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      if (y > lastScrollY.current && y > 150) setShowFloorBar(false);
      else setShowFloorBar(true);
      lastScrollY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const stats = useMemo(() => {
    const supply     = rpcStats.totalSupply  || collection?.total_supply || 0;
    const floorRaw   = rpcStats.floorPrice   || collection?.floor_price  || 0;
    const owners     = rpcStats.uniqueOwners || collection?.owners       || 0;
    const listed     = rpcStats.listedCount  || activeListings.length;
    const royaltyBps = collection?.royalty_bps ?? 0;
    const floorDisplay = floorRaw > 0 ? (Number(floorRaw) / 1e6).toFixed(2) : null;
    return {
      floor:     floorDisplay ? `${floorDisplay} USD` : "—",
      topOffer:  collection?.top_offer    ? `${(Number(collection.top_offer)    / 1e6).toFixed(2)} USD` : "—",
      vol24h:    collection?.volume_24h   ? `${(Number(collection.volume_24h)   / 1e6).toFixed(2)} USD` : "0 USD",
      totalVol:  collection?.volume_total ? `${(Number(collection.volume_total) / 1e6).toFixed(2)} USD` : "0 USD",
      mktCap:    floorDisplay && supply   ? `${((Number(floorRaw) / 1e6) * supply).toLocaleString()} USD` : "—",
      owners, ownerPct: supply && owners ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed, listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply: supply?.toLocaleString() || "0",
      royalties: royaltyBps ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
    };
  }, [collection, activeListings, rpcStats]);

  const ipfsBase = useMemo(() => {
    if (!collection?.metadata_base_uri) return null;
    let base = collection.metadata_base_uri;
    if (base.startsWith("ipfs://")) base = base.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
    if (!base.endsWith("/")) base += "/";
    return base;
  }, [collection?.metadata_base_uri]);

  // ✅ Fetch IPFS images for listed tokens so they show in the grid
  useEffect(() => {
    if (!ipfsBase || !activeListings.length) { setListedTokensWithImages([]); return; }
    let cancelled = false;

    Promise.all(activeListings.map(async listing => {
      if (listing.image || listing.image_url) {
        return { tokenId: String(listing.token_id), token_id: listing.token_id,
          name: listing.name || `${collection?.name} #${listing.token_id}`,
          image: listing.image || listing.image_url };
      }
      try {
        const res  = await fetch(`${ipfsBase}${listing.token_id}.json`, { cache: "force-cache" });
        const json = await res.json();
        return { tokenId: String(listing.token_id), token_id: listing.token_id,
          name: json.name || `${collection?.name} #${listing.token_id}`,
          image: extractImageUrl(json) };
      } catch {
        return { tokenId: String(listing.token_id), token_id: listing.token_id,
          name: listing.name || `${collection?.name} #${listing.token_id}`, image: "" };
      }
    })).then(results => { if (!cancelled) setListedTokensWithImages(results); });

    return () => { cancelled = true; };
  }, [activeListings, ipfsBase, collection?.name]);

  const fetchPage = useCallback(async (pageNum) => {
    if (!ipfsBase) return;
    const supply = rpcStats.totalSupply || collection?.total_supply || 2000;
    const start  = (pageNum - 1) * PAGE_SIZE + 1;
    const end    = Math.min(start + PAGE_SIZE - 1, supply);
    if (start > supply) { setHasMore(false); return; }
    setTokensLoading(true);
    const results = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, i) => start + i).map(async tokenId => {
        if (listedIds.has(String(tokenId))) return null;
        try {
          const res  = await fetch(`${ipfsBase}${tokenId}.json`, { cache: "force-cache" });
          const json = await res.json();
          return { tokenId: String(tokenId), name: json.name || `${collection?.name} #${tokenId}`, image: extractImageUrl(json) };
        } catch {
          return { tokenId: String(tokenId), name: `${collection?.name} #${tokenId}`, image: "" };
        }
      })
    );
    setUnlistedTokens(prev => pageNum === 1 ? results.filter(Boolean) : [...prev, ...results.filter(Boolean)]);
    setHasMore(end < supply);
    setTokensLoading(false);
  }, [ipfsBase, collection, listedIds, rpcStats.totalSupply]);

  useEffect(() => {
    if (ipfsBase) { setUnlistedTokens([]); setPage(1); setHasMore(true); fetchPage(1); }
  }, [ipfsBase, fetchPage]);

  // Re-fetch when listing count changes (new listing appeared)
  const listedCount = listedIds.size;
  useEffect(() => {
    if (ipfsBase && listedCount >= 0) { setUnlistedTokens([]); setPage(1); setHasMore(true); fetchPage(1); }
  }, [listedCount]);

  useEffect(() => { if (page > 1) fetchPage(page); }, [page, fetchPage]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !tokensLoading && tab === "Items") setPage(p => p + 1);
    }, { rootMargin: "200px" });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, tokensLoading, tab]);

  // Manual refresh
  async function handleRefresh() {
    setRefreshing(true);
    setUnlistedTokens([]);
    setListedTokensWithImages([]);
    setPage(1);
    setHasMore(true);
    await fetchPage(1);
    setRefreshing(false);
  }

  // Grid layout based on view mode
  const gridClass = useMemo(() => {
    if (viewMode === VIEW.LIST)   return "flex flex-col gap-2";
    if (viewMode === VIEW.SINGLE) return "grid grid-cols-1 sm:grid-cols-1 gap-4 max-w-sm mx-auto";
    return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";
  }, [viewMode]);

  if (colLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <>
      <style>{`.nft-card:hover .buy-slide { transform: translateY(0) !important; }`}</style>

      <div className="fade-up min-h-screen pb-28" style={{ background: "#0A0F14" }}>

        {/* Banner */}
        <div className="relative h-56 w-full overflow-hidden">
          {collection?.banner_url
            ? <img src={collection.banner_url} className="w-full h-full object-cover opacity-60" alt="Banner" />
            : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} />}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #0A0F14)" }} />
        </div>

        <div className="px-4 sm:px-6 max-w-7xl mx-auto -mt-16 relative z-10">

          {/* ─── Collection Header ─────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row md:items-end gap-5 mb-8">
            <div className="w-28 h-28 rounded-3xl overflow-hidden flex-shrink-0"
              style={{ border: "4px solid #0A0F14", background: "#11161D" }}>
              <NFTImage src={collection?.logo_url} className="w-full h-full object-cover" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#EDEDED" }}>
                  {collection?.name}
                </h1>
                {collection?.verified && <CheckCircle2 size={22} style={{ color: "#00E6A8" }} />}
              </div>

              {/* ✅ Creator + all socials from Supabase */}
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-2">
                <span className="text-sm font-medium" style={{ color: "#00E6A8" }}>
                  By {collection?.creator_name || "Tempo Creator"}
                </span>

                <div className="flex items-center gap-3" style={{ color: "#9CA3AF" }}>
                  {/* X / Twitter */}
                  {collection?.twitter_url && (
                    <a href={collection.twitter_url} target="_blank" rel="noreferrer"
                      title="X (Twitter)"
                      className="flex items-center gap-1 text-xs hover:text-white transition-colors">
                      <Twitter size={15} />
                      <span className="hidden sm:inline">X</span>
                    </a>
                  )}
                  {/* Discord */}
                  {collection?.discord_url && (
                    <a href={collection.discord_url} target="_blank" rel="noreferrer"
                      title="Discord"
                      className="flex items-center gap-1 text-xs hover:text-white transition-colors">
                      <MessageCircle size={15} />
                      <span className="hidden sm:inline">Discord</span>
                    </a>
                  )}
                  {/* Website */}
                  {collection?.website_url && (
                    <a href={collection.website_url} target="_blank" rel="noreferrer"
                      title="Website"
                      className="flex items-center gap-1 text-xs hover:text-white transition-colors">
                      <Globe size={15} />
                      <span className="hidden sm:inline">Website</span>
                    </a>
                  )}
                  {/* Tempo Explorer */}
                  <a href={`${EXPLORER_BASE}/address/${collection?.contract_address}`}
                    target="_blank" rel="noreferrer"
                    title="View on Tempo Explorer"
                    className="flex items-center gap-1 text-xs hover:text-white transition-colors">
                    <ExternalLink size={15} />
                    <span className="hidden sm:inline">Tempo Scan</span>
                  </a>
                </div>
              </div>

              {collection?.description && (
                <p className="text-sm line-clamp-2" style={{ color: "#9CA3AF" }}>
                  {collection.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            <StatItem label="Floor Price" value={stats.floor} />
            <StatItem label="Top Offer"   value={stats.topOffer} />
            <StatItem label="24H VOL"     value={stats.vol24h} />
            <StatItem label="Total VOL"   value={stats.totalVol} />
            <StatItem label="Market Cap"  value={stats.mktCap} />
            <StatItem label="Owners"      value={stats.owners} subValue={stats.ownerPct} />
            <StatItem label="Listed"      value={stats.listed} subValue={stats.listedPct} />
            <StatItem label="Supply"      value={stats.supply} />
            <StatItem label="Royalties"   value={stats.royalties} />
          </div>

          {/* ─── Tabs + Unified View Controls ─────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b mb-6"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex gap-1">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="px-4 pb-4 text-sm font-medium uppercase tracking-widest transition-all"
                  style={{
                    background: "none", border: "none",
                    borderBottom: tab === t ? "2px solid #00E6A8" : "2px solid transparent",
                    color: tab === t ? "#00E6A8" : "#9CA3AF", cursor: "pointer",
                  }}>
                  {t === "Analytics"
                    ? <span className="flex items-center gap-1.5"><BarChart2 size={13} />{t}</span>
                    : t}
                </button>
              ))}
            </div>

            {/* ✅ Single pill: [Single | Grid | List | Refresh] */}
            {tab === "Items" && (
              <div className="pb-3 sm:pb-1">
                <ViewControls
                  current={viewMode}
                  onChange={setViewMode}
                  onRefresh={handleRefresh}
                  refreshing={refreshing}
                />
              </div>
            )}
          </div>

          {/* Items */}
          {tab === "Items" && (
            <>
              <div className={gridClass}>
                {listedTokensWithImages.map((token, i) => (
                  <NFTCard
                    key={`listed-${token.token_id}`}
                    token={token}
                    collectionName={collection?.name}
                    slug={id}
                    listing={activeListings[i]}
                    viewMode={viewMode}
                    onBuy={setBuyModal}
                  />
                ))}
                {unlistedTokens.map(token => (
                  <NFTCard
                    key={`unlisted-${token.tokenId}`}
                    token={token}
                    collectionName={collection?.name}
                    slug={id}
                    listing={null}
                    viewMode={viewMode}
                    onBuy={null}
                  />
                ))}
                {(tokensLoading || refreshing) && Array(10).fill(0).map((_, i) => <CardSkeleton key={`sk-${i}`} />)}
              </div>
              <div ref={loaderRef} className="h-10" />
              {!hasMore && (unlistedTokens.length + listedTokensWithImages.length) > 0 && (
                <div className="text-center py-8 text-sm" style={{ color: "#9CA3AF" }}>
                  All {unlistedTokens.length + listedTokensWithImages.length} items loaded
                </div>
              )}
            </>
          )}

          {tab === "Activity" && (
            <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />
          )}

          {tab === "Analytics" && (
            <div className="space-y-6">
              <PriceChart nftContract={contractAddr} />
            </div>
          )}
        </div>
      </div>

      <FloorBar
        activeListings={activeListings}
        visible={showFloorBar && tab === "Items"}
        onBuyFloor={setBuyModal}
      />

      {buyModal && (
        <BuyModal
          listing={buyModal}
          onClose={() => setBuyModal(null)}
          onSuccess={() => setBuyModal(null)}
        />
      )}
    </>
  );
}
