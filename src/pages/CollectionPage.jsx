import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, Twitter, Globe } from "lucide-react";
import { useCollection, useRealtimeListings } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import Listings from "@/components/Listings.jsx";

const TABS = ["Items", "Listings", "Activity", "Bids", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";
const PAGE_SIZE = 50;

const StatItem = ({ label, value, sub }) => (
  <div className="rounded-2xl p-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#9da7b3" }}>{label}</div>
    <div className="font-mono text-lg font-bold" style={{ color: "#e6edf3" }}>{value}</div>
    {sub && <div className="text-[10px] mt-0.5" style={{ color: "#9da7b3" }}>{sub}</div>}
  </div>
);

function NFTGridItem({ token, collectionName, slug, listing }) {
  return (
    <Link to={`/collection/${slug}/${token.tokenId}`}
      className="block rounded-2xl overflow-hidden p-2 transition-all card-hover"
      style={{ background: "#121821", border: listing ? "1px solid rgba(34,211,238,0.2)" : "1px solid rgba(255,255,255,0.05)" }}>
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

  const activeListings = useMemo(() =>
    (listings || []).filter(l => l.active), [listings]);

  // Build lookup: tokenId (string) → listing
  const listingMap = useMemo(() => {
    const m = {};
    activeListings.forEach(l => { m[String(l.token_id)] = l; });
    return m;
  }, [activeListings]);

  const [tokens, setTokens]               = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [page, setPage]                   = useState(1);
  const [hasMore, setHasMore]             = useState(true);
  const [tab, setTab]                     = useState("Items");
  const loaderRef                         = useRef(null);

  // Stats — all from Supabase collection row + live listings count
  const stats = useMemo(() => {
    const supply      = collection?.total_supply || 0;
    const floor       = collection?.floor_price  || 0;
    const owners      = collection?.owners       || 0;
    const listed      = activeListings.length;
    const royaltyBps  = collection?.royalty_bps  || 0;
    return {
      floor:     floor > 0 ? `${Number(floor).toFixed(2)} USD` : "—",
      topOffer:  collection?.top_offer ? `${Number(collection.top_offer).toFixed(2)} USD` : "—",
      vol24h:    `${Number(collection?.volume_24h   || 0).toFixed(2)} USD`,
      totalVol:  `${Number(collection?.volume_total || 0).toFixed(2)} USD`,
      mktCap:    floor && supply ? `${(Number(floor) * supply).toLocaleString()} USD` : "—",
      owners,
      ownerPct:  supply ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed,
      listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply:    supply ? supply.toLocaleString() : "0",
      royalties: royaltyBps ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
      sales:     collection?.total_sales || 0,
    };
  }, [collection, activeListings]);

  const fetchPage = useCallback(async (pageNum) => {
    if (!collection?.metadata_base_uri) return;

    let base = collection.metadata_base_uri;
    if (base.startsWith("ipfs://")) base = base.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
    if (!base.endsWith("/")) base += "/";

    const supply = collection.total_supply || 2000;
    const start  = (pageNum - 1) * PAGE_SIZE + 1;
    const end    = Math.min(start + PAGE_SIZE - 1, supply);

    if (start > supply) { setHasMore(false); return; }

    setTokensLoading(true);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const results = await Promise.all(ids.map(async (tokenId) => {
      try {
        const res  = await fetch(`${base}${tokenId}.json`, { cache: "force-cache" });
        const json = await res.json();
        return { tokenId: String(tokenId), name: json.name || `${collection.name} #${tokenId}`, image: extractImageUrl(json) };
      } catch {
        return { tokenId: String(tokenId), name: `${collection.name} #${tokenId}`, image: "" };
      }
    }));

    setTokens(prev => pageNum === 1 ? results : [...prev, ...results]);
    setHasMore(end < supply);
    setTokensLoading(false);
  }, [collection]);

  useEffect(() => {
    if (collection?.metadata_base_uri) {
      setTokens([]);
      setPage(1);
      setHasMore(true);
      fetchPage(1);
    }
  }, [collection?.metadata_base_uri]);

  useEffect(() => { if (page > 1) fetchPage(page); }, [page]);

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !tokensLoading && tab === "Items") {
        setPage(p => p + 1);
      }
    }, { rootMargin: "200px" });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
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
          ? <img src={collection.banner_url} className="w-full h-full object-cover opacity-60" alt="" />
          : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} />}
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
            <div className="flex items-center gap-4">
              <span className="text-sm font-bold" style={{ color: "rgba(34,211,238,0.8)" }}>
                By {collection?.creator_name || "Tempo Creator"}
              </span>
              <div className="flex items-center gap-3" style={{ color: "#9da7b3" }}>
                {collection?.twitter_url && (
                  <a href={collection.twitter_url} target="_blank" rel="noreferrer"
                    className="hover:text-white transition-colors"><Twitter size={16} /></a>
                )}
                {collection?.website_url && (
                  <a href={collection.website_url} target="_blank" rel="noreferrer"
                    className="hover:text-white transition-colors"><Globe size={16} /></a>
                )}
                <a href={`${EXPLORER_BASE}/address/${collection?.contract_address}`}
                  target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                  <ExternalLink size={16} />
                </a>
              </div>
            </div>
            {collection?.description && (
              <p className="text-sm mt-2 line-clamp-2" style={{ color: "#9da7b3" }}>{collection.description}</p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatItem label="Floor Price"  value={stats.floor} />
          <StatItem label="Top Offer"    value={stats.topOffer} />
          <StatItem label="24H Vol"      value={stats.vol24h} />
          <StatItem label="Total Vol"    value={stats.totalVol} />
          <StatItem label="Market Cap"   value={stats.mktCap} />
          <StatItem label="Owners"       value={stats.owners} sub={stats.ownerPct} />
          <StatItem label="Listed"       value={stats.listed} sub={stats.listedPct} />
          <StatItem label="Supply"       value={stats.supply} />
          <StatItem label="Royalties"    value={stats.royalties} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto border-b mb-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="pb-4 px-3 text-sm font-bold uppercase tracking-widest whitespace-nowrap transition-all"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: tab === t ? "#22d3ee" : "#9da7b3",
                borderBottom: tab === t ? "2px solid #22d3ee" : "2px solid transparent",
              }}>
              {t}
              {t === "Listings" && activeListings.length > 0 && (
                <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full font-mono"
                  style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee" }}>
                  {activeListings.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Items */}
        {tab === "Items" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {tokens.map(token => (
                <NFTGridItem
                  key={token.tokenId}
                  token={token}
                  collectionName={collection?.name}
                  slug={id}
                  listing={listingMap[token.tokenId] || null}
                />
              ))}
              {tokensLoading && Array(10).fill(0).map((_, i) => <CardSkeleton key={`sk-${i}`} />)}
            </div>
            <div ref={loaderRef} className="h-10" />
            {!hasMore && tokens.length > 0 && (
              <div className="text-center py-6 text-xs" style={{ color: "#9da7b3" }}>
                All {tokens.length} items loaded
              </div>
            )}
          </>
        )}

        {/* Listings tab — sorted by price, grid/list toggle, buy button */}
        {tab === "Listings" && (
          <Listings
            nftContract={collection?.contract_address}
            collectionName={collection?.name}
            slug={id}
          />
        )}

        {tab === "Activity" && (
          <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />
        )}

        {(tab === "Bids" || tab === "Analytics") && (
          <div className="py-20 text-center text-sm" style={{ color: "#9da7b3" }}>
            {tab} coming soon.
          </div>
        )}
      </div>
    </div>
  );
}
