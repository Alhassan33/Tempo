import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, Twitter, Globe, TrendingDown, TrendingUp } from "lucide-react";
// ✅ Hooks integrated: useCollectionStats for live RPC data
import { useCollection, useRealtimeListings, useCollectionStats } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";

const TABS = ["Items", "Activity", "Bids", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";
const PAGE_SIZE = 50;

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

// ─── NFT Grid Item ────────────────────────────────────────────────────────────
function NFTGridItem({ token, collectionName, slug, listing }) {
  return (
    <Link
      to={`/collection/${slug}/${token.tokenId}`}
      className="block rounded-2xl overflow-hidden card-hover p-2"
      style={{ background: "#121821", border: listing ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.05)" }}>
      <div className="relative">
        <NFTImage src={token.image} className="aspect-square rounded-xl object-cover mb-2 w-full" />
        {listing && (
          <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(11,15,20,0.85)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.4)", backdropFilter: "blur(4px)" }}>
            ● FOR SALE
          </div>
        )}
      </div>
      <div className="px-1 pb-1">
        <div className="text-[10px] font-bold uppercase tracking-tight mb-0.5 truncate" style={{ color: "#9da7b3" }}>
          {collectionName}
        </div>
        <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>{token.name}</div>
        {listing && (
          <div className="font-mono text-xs font-bold mt-0.5" style={{ color: "#22d3ee" }}>
            {Number(listing.displayPrice || listing.price / 1e6).toFixed(2)} USD
          </div>
        )}
      </div>
    </Link>
  );
}

export default function CollectionPage() {
  const { id } = useParams();
  const { collection, isLoading: colLoading } = useCollection(id);
  
  // ✅ 1. Get Live Stats from RPC (Supply, Owners, Floor, Listed Count)
  const { stats: rpcStats } = useCollectionStats(collection?.contract_address || "");

  // ✅ 2. Get Live Listings for the Grid badges
  const { listings } = useRealtimeListings(collection?.contract_address);

  // ✅ 3. FIXED: Build lookup map using STRINGS to prevent type mismatch with IPFS IDs
  const listingMap = useMemo(() => {
    const m = {};
    (listings || []).forEach(l => { 
      if (l.active) m[String(l.token_id)] = l; 
    });
    return m;
  }, [listings]);

  const [tokens, setTokens]           = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [page, setPage]               = useState(1);
  const [hasMore, setHasMore]         = useState(true);
  const [tab, setTab]                 = useState("Items");
  const loaderRef                     = useRef(null);

  // ✅ 4. FIXED: Properly map all Supabase fields including Volume and Royalties
  const stats = useMemo(() => {
    const supply = rpcStats.totalSupply || collection?.total_supply || 0;
    const floor  = rpcStats.floorPrice  || collection?.floor_price || 0;
    const owners = rpcStats.uniqueOwners || collection?.owners || 0;
    const listed = rpcStats.listedCount || (listings || []).filter(l => l.active).length;
    const royaltyBps = collection?.royalty_bps || 0;

    return {
      floor:     floor > 0 ? `${Number(floor).toFixed(2)} USD` : "—",
      topOffer:  collection?.top_offer ? `${Number(collection.top_offer).toFixed(2)} USD` : "—",
      vol24h:    collection?.volume_24h ? `${Number(collection.volume_24h).toFixed(2)} USD` : "0 USD",
      totalVol:  collection?.volume_total ? `${Number(collection.volume_total).toFixed(2)} USD` : "0 USD",
      mktCap:    floor && supply ? `${(Number(floor) * supply).toLocaleString()} USD` : "—",
      owners:    owners,
      ownerPct:  supply ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed,
      listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply:    supply.toLocaleString(),
      royalties: royaltyBps > 0 ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
    };
  }, [collection, listings, rpcStats]);

  const fetchPage = useCallback(async (pageNum) => {
    if (!collection?.metadata_base_uri) return;

    let base = collection.metadata_base_uri;
    if (base.startsWith("ipfs://")) base = base.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
    if (!base.endsWith("/")) base += "/";

    const supply = rpcStats.totalSupply || collection.total_supply || 2000;
    const start = (pageNum - 1) * PAGE_SIZE + 1;
    const end   = Math.min(start + PAGE_SIZE - 1, supply);

    if (start > supply) { setHasMore(false); return; }

    setTokensLoading(true);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const results = await Promise.all(ids.map(async (tokenId) => {
      try {
        const res  = await fetch(`${base}${tokenId}.json`, { cache: "force-cache" });
        const json = await res.json();
        return { tokenId, name: json.name || `${collection.name} #${tokenId}`, image: extractImageUrl(json) };
      } catch {
        return { tokenId, name: `${collection.name} #${tokenId}`, image: "" };
      }
    }));

    setTokens(prev => pageNum === 1 ? results : [...prev, ...results]);
    setHasMore(end < supply);
    setTokensLoading(false);
  }, [collection, rpcStats.totalSupply]);

  useEffect(() => {
    if (collection?.metadata_base_uri) {
      setTokens([]);
      setPage(1);
      setHasMore(true);
      fetchPage(1);
    }
  }, [collection?.metadata_base_uri, fetchPage]);

  useEffect(() => {
    if (page > 1) fetchPage(page);
  }, [page, fetchPage]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !tokensLoading) {
          setPage(p => p + 1);
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, tokensLoading]);

  if (colLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "#22d3ee", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="fade-up min-h-screen pb-20" style={{ background: "#0b0f14" }}>
      <div className="relative h-56 w-full overflow-hidden">
        {collection?.banner_url
          ? <img src={collection.banner_url} className="w-full h-full object-cover opacity-60" alt="Banner" />
          : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} />
        }
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #0b0f14)" }} />
      </div>

      <div className="px-4 sm:px-6 max-w-7xl mx-auto -mt-16 relative z-10">
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
                {collection?.twitter_url && <a href={collection.twitter_url} target="_blank" rel="noreferrer"><Twitter size={16} /></a>}
                {collection?.website_url && <a href={collection.website_url} target="_blank" rel="noreferrer"><Globe size={16} /></a>}
                <a href={`${EXPLORER_BASE}/address/${collection?.contract_address}`} target="_blank" rel="noreferrer"><ExternalLink size={16} /></a>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatItem label="Floor Price"  value={stats.floor} />
          <StatItem label="Top Offer"    value={stats.topOffer} />
          <StatItem label="24H VOL"      value={stats.vol24h}   />
          <StatItem label="Total VOL"    value={stats.totalVol} />
          <StatItem label="Market Cap"   value={stats.mktCap}   />
          <StatItem label="Owners"       value={stats.owners}   subValue={stats.ownerPct} />
          <StatItem label="Listed"       value={stats.listed}   subValue={stats.listedPct} />
          <StatItem label="Supply"       value={stats.supply}   />
          <StatItem label="Royalties"    value={stats.royalties} />
        </div>

        <div className="flex gap-6 border-b mb-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-all"
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

        {tab === "Items" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {tokens.map(token => (
                <NFTGridItem
                  key={token.tokenId}
                  token={token}
                  collectionName={collection?.name}
                  slug={id}
                  // ✅ FIXED: Force String lookup to match IPFS ID correctly
                  listing={listingMap[String(token.tokenId)] || null}
                />
              ))}
              {tokensLoading && Array(10).fill(0).map((_, i) => <CardSkeleton key={`sk-${i}`} />)}
            </div>
            <div ref={loaderRef} className="h-10" />
            {!hasMore && tokens.length > 0 && (
              <div className="text-center py-8 text-sm" style={{ color: "#9da7b3" }}>
                All {tokens.length} items loaded
              </div>
            )}
          </>
        )}

        {tab === "Activity" && (
          <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />
        )}
      </div>
    </div>
  );
}
