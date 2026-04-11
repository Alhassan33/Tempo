import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2, ExternalLink, Twitter, Globe,
  TrendingDown, TrendingUp, Grid3X3, LayoutGrid, List,
  ShoppingCart, BarChart2
} from "lucide-react";
import { useCollection, useRealtimeListings, useCollectionStats } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import BuyModal from "@/components/BuyModal.jsx";

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS        = ["Items", "Activity", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";
const PAGE_SIZE   = 50;

const VIEW = { GRID: "grid", COMPACT: "compact", LIST: "list" };

// ─── Stat Card — UNTOUCHED ────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4"
    style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="text-[10px] font-medium uppercase tracking-wider mb-1"
      style={{ color: "#9CA3AF" }}>{label}</div>
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

// ─── View Toggle — all three in one pill ─────────────────────────────────────
function ViewToggle({ current, onChange }) {
  const opts = [
    { id: VIEW.GRID,    Icon: Grid3X3,    label: "Grid"    },
    { id: VIEW.COMPACT, Icon: LayoutGrid, label: "Compact" },
    { id: VIEW.LIST,    Icon: List,       label: "List"    },
  ];
  return (
    <div className="flex items-center p-1 rounded-xl"
      style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}>
      {opts.map(({ id, Icon, label }) => (
        <button key={id} onClick={() => onChange(id)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: current === id ? "rgba(0,230,168,0.15)" : "transparent",
            color:      current === id ? "#00E6A8" : "#6B7280",
            border:     current === id ? "1px solid rgba(0,230,168,0.3)" : "1px solid transparent",
            cursor: "pointer",
          }}>
          <Icon size={14} />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ─── NFT Card ─────────────────────────────────────────────────────────────────
function NFTCard({ token, collectionName, slug, listing, viewMode, onBuy }) {
  const navigate = useNavigate();
  const isListed = !!listing;
  // price is raw 6-decimal units in DB — always ÷1e6 for display
  const displayPrice = listing ? (Number(listing.price) / 1e6).toFixed(2) : null;
  const tokenId = token.tokenId || token.token_id;

  function goToItem(e) {
    navigate(`/collection/${slug}/${tokenId}`);
  }

  // ── List row ──
  if (viewMode === VIEW.LIST) {
    return (
      <div onClick={goToItem}
        className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all"
        style={{ background: "#11161D", border: isListed ? "1px solid rgba(0,230,168,0.2)" : "1px solid rgba(255,255,255,0.05)" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = isListed ? "rgba(0,230,168,0.4)" : "rgba(255,255,255,0.1)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = isListed ? "rgba(0,230,168,0.2)" : "rgba(255,255,255,0.05)"; }}>
        <div className="w-14 h-14 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "#161d28" }}>
          <img src={token.image || listing?.image || ""} alt={token.name}
            className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wider mb-0.5" style={{ color: "#9CA3AF" }}>
            {collectionName}
          </div>
          <div className="text-sm font-bold truncate" style={{ color: "#EDEDED" }}>
            {token.name || listing?.name || `${collectionName} #${tokenId}`}
          </div>
        </div>
        <div className="text-right flex-shrink-0">
          {isListed ? (
            <>
              <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9CA3AF" }}>Price</div>
              <div className="font-mono text-sm font-bold" style={{ color: "#00E6A8" }}>{displayPrice} USD</div>
            </>
          ) : (
            <span className="text-xs" style={{ color: "#6B7280" }}>Not listed</span>
          )}
        </div>
        <div className="text-xs font-mono px-3 py-1 rounded-lg flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.03)", color: "#6B7280" }}>
          #{tokenId}
        </div>
      </div>
    );
  }

  // ── Grid card (both GRID and COMPACT) ──
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
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = isListed ? "0 12px 32px rgba(0,230,168,0.1)" : "0 8px 24px rgba(0,0,0,0.3)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = isListed ? "rgba(0,230,168,0.2)" : "rgba(255,255,255,0.05)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
      onClick={goToItem}
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden" style={{ background: "#161d28" }}>
        <img src={token.image || listing?.image || listing?.image_url || ""}
          alt={token.name || listing?.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          onError={e => { e.target.style.display = "none"; }} />

        {isListed && (
          <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-1 rounded-lg"
            style={{ background: "rgba(10,15,20,0.9)", color: "#00E6A8",
              border: "1px solid rgba(0,230,168,0.4)", backdropFilter: "blur(4px)" }}>
            ● FOR SALE
          </div>
        )}

        {/* Animated Buy Now — slides up on hover, only on listed */}
        {isListed && (
          <button
            className="buy-slide absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-3 font-bold text-xs"
            style={{
              background: "linear-gradient(to top, rgba(0,230,168,0.97), rgba(0,230,168,0.88))",
              color: "#0A0F14",
              transform: "translateY(100%)",
              transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)",
              border: "none", cursor: "pointer",
              fontFamily: "Syne, sans-serif",
            }}
            onClick={e => { e.stopPropagation(); onBuy(listing); }}>
            <ShoppingCart size={13} /> Buy Now
          </button>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="text-[9px] font-medium uppercase tracking-widest mb-0.5 truncate"
          style={{ color: "#9CA3AF" }}>{collectionName}</div>
        <div className="text-sm font-bold truncate mb-1.5" style={{ color: "#EDEDED" }}>
          {token.name || listing?.name || `${collectionName} #${tokenId}`}
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

// ─── Fixed Sticky Floor Bar ───────────────────────────────────────────────────
// Uses `fixed` not `sticky` — stays at bottom of screen regardless of scroll
function FloorBar({ activeListings, visible, onBuyFloor }) {
  if (!visible || !activeListings.length) return null;

  const floor = activeListings[0]; // already sorted cheapest first
  const floorDisplay = (Number(floor.price) / 1e6).toFixed(2);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 transition-transform duration-300"
      style={{
        background: "rgba(10,15,20,0.95)",
        backdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(0,230,168,0.15)",
        paddingBottom: "env(safe-area-inset-bottom)",
        transform: visible ? "translateY(0)" : "translateY(100%)",
      }}>
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Floor info */}
        <div className="flex items-center gap-5">
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "#9CA3AF" }}>
              Floor Price
            </div>
            <div className="font-mono text-lg font-bold" style={{ color: "#00E6A8" }}>
              {floorDisplay} <span className="text-sm">USD</span>
            </div>
          </div>
          <div className="w-px h-8" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div>
            <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "#9CA3AF" }}>
              Listed
            </div>
            <div className="font-mono text-lg font-bold" style={{ color: "#EDEDED" }}>
              {activeListings.length}
            </div>
          </div>
        </div>

        {/* Cart Floor button */}
        <button
          onClick={() => onBuyFloor(floor)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all"
          style={{ background: "#00E6A8", color: "#0A0F14",
            border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
          onMouseEnter={e => { e.currentTarget.style.background = "#00FFC6"; e.currentTarget.style.boxShadow = "0 0 24px rgba(0,230,168,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.background = "#00E6A8"; e.currentTarget.style.boxShadow = "none"; }}>
          <ShoppingCart size={15} />
          Cart Floor
        </button>
      </div>
    </div>
  );
}

// ─── Main CollectionPage ──────────────────────────────────────────────────────
export default function CollectionPage() {
  const { id } = useParams();
  const [viewMode,    setViewMode]    = useState(VIEW.GRID);
  const [tab,         setTab]         = useState("Items");
  const [buyModal,    setBuyModal]    = useState(null);
  const [showFloorBar, setShowFloorBar] = useState(true);
  const lastScrollY = useRef(0);

  // Stats hooks — UNTOUCHED
  const { collection, isLoading: colLoading } = useCollection(id);
  const { stats: rpcStats } = useCollectionStats(collection?.contract_address || "");

  // ✅ FIX: lowercase contract address for Supabase query
  const contractAddr = collection?.contract_address?.toLowerCase();
  const { listings } = useRealtimeListings(contractAddr);

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
  const loaderRef = useRef(null);

  // Hide/show floor bar on scroll direction
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

  // ✅ Stats — price values from DB are raw 6-decimal → ÷1e6 for display
  const stats = useMemo(() => {
    const supply     = rpcStats.totalSupply  || collection?.total_supply || 0;
    const floorRaw   = rpcStats.floorPrice   || collection?.floor_price  || 0;
    const owners     = rpcStats.uniqueOwners || collection?.owners       || 0;
    const listed     = rpcStats.listedCount  || activeListings.length;
    const royaltyBps = collection?.royalty_bps ?? 0;

    // floor_price stored as raw units in DB
    const floorDisplay = floorRaw > 0 ? (Number(floorRaw) / 1e6).toFixed(2) : null;

    return {
      floor:     floorDisplay ? `${floorDisplay} USD` : "—",
      topOffer:  collection?.top_offer ? `${(Number(collection.top_offer) / 1e6).toFixed(2)} USD` : "—",
      vol24h:    collection?.volume_24h    ? `${(Number(collection.volume_24h)    / 1e6).toFixed(2)} USD` : "0 USD",
      totalVol:  collection?.volume_total  ? `${(Number(collection.volume_total)  / 1e6).toFixed(2)} USD` : "0 USD",
      mktCap:    floorDisplay && supply ? `${((Number(floorRaw) / 1e6) * supply).toLocaleString()} USD` : "—",
      owners,
      ownerPct:  supply && owners ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed,
      listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply:    supply?.toLocaleString() || "0",
      royalties: royaltyBps ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
    };
  }, [collection, activeListings, rpcStats]);

  // Fetch unlisted tokens from IPFS
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
    setUnlistedTokens(prev => pageNum === 1 ? results.filter(Boolean) : [...prev, ...results.filter(Boolean)]);
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
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !tokensLoading && tab === "Items") setPage(p => p + 1);
    }, { rootMargin: "200px" });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, tokensLoading, tab]);

  // Grid class based on view mode
  const gridClass = useMemo(() => {
    if (viewMode === VIEW.LIST)    return "flex flex-col gap-2";
    if (viewMode === VIEW.COMPACT) return "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3";
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
      {/* CSS for animated Buy Now slide-up */}
      <style>{`
        .nft-card:hover .buy-slide { transform: translateY(0) !important; }
      `}</style>

      <div className="fade-up min-h-screen pb-28" style={{ background: "#0A0F14" }}>

        {/* Banner */}
        <div className="relative h-56 w-full overflow-hidden">
          {collection?.banner_url
            ? <img src={collection.banner_url} className="w-full h-full object-cover opacity-60" alt="Banner" />
            : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} />
          }
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #0A0F14)" }} />
        </div>

        <div className="px-4 sm:px-6 max-w-7xl mx-auto -mt-16 relative z-10">

          {/* Header */}
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
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium" style={{ color: "#00E6A8" }}>
                  By {collection?.creator_name || "Tempo Creator"}
                </span>
                <div className="flex items-center gap-3" style={{ color: "#9CA3AF" }}>
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
                <p className="text-sm mt-2 line-clamp-2" style={{ color: "#9CA3AF" }}>
                  {collection.description}
                </p>
              )}
            </div>
          </div>

          {/* Stats Grid — UNTOUCHED */}
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

          {/* Tabs + View Toggle in one row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b mb-6"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex gap-1">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className="px-4 pb-4 text-sm font-medium uppercase tracking-widest transition-all"
                  style={{
                    background: "none", border: "none",
                    borderBottom: tab === t ? "2px solid #00E6A8" : "2px solid transparent",
                    color: tab === t ? "#00E6A8" : "#9CA3AF",
                    cursor: "pointer",
                  }}>
                  {t === "Analytics" ? <span className="flex items-center gap-1.5"><BarChart2 size={13} />{t}</span> : t}
                </button>
              ))}
            </div>
            {/* View toggle only on Items tab */}
            {tab === "Items" && (
              <div className="pb-3 sm:pb-1">
                <ViewToggle current={viewMode} onChange={setViewMode} />
              </div>
            )}
          </div>

          {/* Items Tab */}
          {tab === "Items" && (
            <>
              <div className={viewMode !== VIEW.LIST ? `${gridClass}` : gridClass}>
                {/* Listed NFTs hoisted to top */}
                {activeListings.map(listing => (
                  <NFTCard
                    key={`listed-${listing.token_id}`}
                    token={{
                      tokenId:  listing.token_id,
                      token_id: listing.token_id,
                      name:     listing.name,
                      image:    listing.image || listing.image_url || "",
                    }}
                    collectionName={collection?.name}
                    slug={id}
                    listing={listing}
                    viewMode={viewMode}
                    onBuy={setBuyModal}
                  />
                ))}

                {/* Unlisted tokens */}
                {unlistedTokens.map(token => (
                  <NFTCard
                    key={`unlisted-${token.tokenId}`}
                    token={token}
                    collectionName={collection?.name}
                    slug={id}
                    listing={null}
                    viewMode={viewMode}
                    onBuy={setBuyModal}
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

          {/* Activity Tab */}
          {tab === "Activity" && (
            <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />
          )}

          {/* Analytics Tab */}
          {tab === "Analytics" && (
            <div className="space-y-6">
              <PriceChart nftContract={contractAddr} />
            </div>
          )}
        </div>
      </div>

      {/* ✅ Fixed sticky floor bar — uses `fixed` not `sticky` */}
      <FloorBar
        activeListings={activeListings}
        visible={showFloorBar && tab === "Items"}
        onBuyFloor={setBuyModal}
      />

      {/* Buy Modal */}
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
