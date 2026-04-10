import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, Twitter, Globe, TrendingDown, TrendingUp } from "lucide-react";
import { useCollection, useRealtimeListings } from "@/hooks/useSupabase";
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
      style={{ 
        background: "#121821", 
        border: listing ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.05)",
        boxShadow: listing ? "0 0 15px rgba(34,211,238,0.05)" : "none"
      }}>
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
            {Number(listing.price).toFixed(2)} USD
          </div>
        )}
      </div>
    </Link>
  );
}

export default function CollectionPage() {
  const { id } = useParams();
  const { collection, isLoading: colLoading } = useCollection(id);
  const { listings } = useRealtimeListings(collection?.contract_address);

  // ✅ HOISTING LOGIC: Extract active listings and create a Set for fast exclusion
  const activeListings = useMemo(() => {
    return (listings || []).filter(l => l.active).sort((a, b) => a.price - b.price);
  }, [listings]);

  const listedIds = useMemo(() => new Set(activeListings.map(l => String(l.token_id))), [activeListings]);

  const [unlistedTokens, setUnlistedTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [tab, setTab] = useState("Items");
  const loaderRef = useRef(null);

  const stats = useMemo(() => {
    const supply = collection?.total_supply || 0;
    const listed = activeListings.length;
    const royaltyBps = collection?.royalty_bps ?? 0;
    return {
      floor: collection?.floor_price ? `${Number(collection.floor_price).toFixed(2)} USD` : "—",
      topOffer: collection?.top_offer ? `${Number(collection.top_offer).toFixed(2)} USD` : "—",
      vol24h: collection?.volume_24h ? `${Number(collection.volume_24h).toFixed(2)} USD` : "0 USD",
      totalVol: collection?.volume_total ? `${Number(collection.volume_total).toFixed(2)} USD` : "0 USD",
      mktCap: collection?.floor_price && supply ? `${(Number(collection.floor_price) * supply).toLocaleString()} USD` : "—",
      owners: collection?.owners || 0,
      ownerPct: supply ? `${((collection.owners / supply) * 100).toFixed(1)}%` : "0%",
      listed,
      listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply: supply.toLocaleString(),
      royalties: royaltyBps ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
    };
  }, [collection, activeListings]);

  const fetchPage = useCallback(async (pageNum) => {
    if (!collection?.metadata_base_uri) return;
    let base = collection.metadata_base_uri;
    if (base.startsWith("ipfs://")) base = base.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
    if (!base.endsWith("/")) base += "/";

    const supply = collection.total_supply || 2000;
    const start = (pageNum - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, supply);

    if (start > supply) { setHasMore(false); return; }

    setTokensLoading(true);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const results = await Promise.all(ids.map(async (tokenId) => {
      const idStr = String(tokenId);
      // Skip if already showing in the hoisted "For Sale" section
      if (listedIds.has(idStr)) return null;

      try {
        const res = await fetch(`${base}${tokenId}.json`, { cache: "force-cache" });
        const json = await res.json();
        return { tokenId: idStr, name: json.name || `${collection.name} #${tokenId}`, image: extractImageUrl(json) };
      } catch {
        return { tokenId: idStr, name: `${collection.name} #${tokenId}`, image: "" };
      }
    }));

    const valid = results.filter(t => t !== null);
    setUnlistedTokens(prev => pageNum === 1 ? valid : [...prev, ...valid]);
    setHasMore(end < supply);
    setTokensLoading(false);
  }, [collection, listedIds]);

  useEffect(() => {
    if (collection?.metadata_base_uri) {
      setUnlistedTokens([]);
      setPage(1);
      setHasMore(true);
      fetchPage(1);
    }
  }, [collection?.metadata_base_uri, fetchPage]);

  useEffect(() => { if (page > 1) fetchPage(page); }, [page, fetchPage]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !tokensLoading) setPage(p => p + 1);
    }, { rootMargin: "200px" });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, tokensLoading]);

  if (colLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#22d3ee" }} />
    </div>
  );

  return (
    <div className="fade-up min-h-screen pb-20" style={{ background: "#0b0f14" }}>
      <div className="relative h-56 w-full overflow-hidden">
        {collection?.banner_url ? <img src={collection.banner_url} className="w-full h-full object-cover opacity-60" /> : <div className="w-full h-full bg-slate-900" />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#0b0f14]" />
      </div>

      <div className="px-4 sm:px-6 max-w-7xl mx-auto -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row md:items-end gap-5 mb-8">
          <div className="w-28 h-28 rounded-3xl overflow-hidden border-[6px] border-[#0b0f14] bg-[#121821]">
            <NFTImage src={collection?.logo_url} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-extrabold uppercase tracking-tight text-[#e6edf3]">{collection?.name}</h1>
              {collection?.verified && <CheckCircle2 size={22} className="text-[#22d3ee]" />}
            </div>
            <p className="text-sm text-[#9da7b3] font-bold">By {collection?.creator_name || "Tempo Creator"}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatItem label="Floor" value={stats.floor} />
          <StatItem label="Top Offer" value={stats.topOffer} />
          <StatItem label="24H Vol" value={stats.vol24h} />
          <StatItem label="Total Vol" value={stats.totalVol} />
          <StatItem label="Listed" value={stats.listed} subValue={stats.listedPct} />
          <StatItem label="Owners" value={stats.owners} subValue={stats.ownerPct} />
          <StatItem label="Supply" value={stats.supply} />
          <StatItem label="Royalties" value={stats.royalties} />
        </div>

        <div className="flex gap-6 border-b border-white/10 mb-6">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-all ${tab === t ? "border-[#22d3ee] text-[#22d3ee]" : "border-transparent text-[#9da7b3]"}`}>
              {t}
            </button>
          ))}
        </div>

        {tab === "Items" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* 1. Show Listened NFTs First */}
              {activeListings.map(listing => (
                <NFTGridItem 
                  key={`listed-${listing.token_id}`} 
                  token={{ tokenId: listing.token_id, name: `${collection?.name} #${listing.token_id}`, image: listing.image_url || "" }} 
                  collectionName={collection?.name} 
                  slug={id} 
                  listing={listing} 
                />
              ))}

              {/* 2. Show the rest of the collection */}
              {unlistedTokens.map(token => (
                <NFTGridItem 
                  key={`unlisted-${token.tokenId}`} 
                  token={token} 
                  collectionName={collection?.name} 
                  slug={id} 
                  listing={null} 
                />
              ))}
              {tokensLoading && Array(10).fill(0).map((_, i) => <CardSkeleton key={i} />)}
            </div>
            <div ref={loaderRef} className="h-10" />
          </>
        )}

        {tab === "Activity" && <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />}
      </div>
    </div>
  );
}
