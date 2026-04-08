import { useState, useEffect, useMemo } from "react";
import { useParams, Link } from "react-router-dom"; // Added Link
import { 
  CheckCircle2, 
  ExternalLink, 
  Twitter, 
  Globe, 
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { useCollection, useRealtimeListings } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";

const TABS = ["Items", "Activity", "Bids", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";

// ─── Stats Component ──────────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4 bg-[#121821] border border-white/5 shadow-sm">
    <div className="text-[10px] font-display text-gray-500 mb-1 uppercase tracking-wider">{label}</div>
    <div className="flex items-baseline gap-2">
      <div className="font-mono text-lg font-bold text-white uppercase">{value}</div>
      {subValue && (
        <div className={`text-[11px] font-bold flex items-center ${isTrend ? (subValue.includes('-') ? 'text-red-400' : 'text-green-400') : 'text-gray-500'}`}>
          {isTrend && (subValue.includes('-') ? <TrendingDown size={12} className="mr-0.5"/> : <TrendingUp size={12} className="mr-0.5"/>)}
          {subValue}
        </div>
      )}
    </div>
  </div>
);

export default function CollectionPage() {
  const { id } = useParams(); // This is the 'slug' from the URL
  const { collection, loading: colLoading } = useCollection(id);
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tab, setTab] = useState("Items");

  // Format dynamic stats from Supabase
  const stats = useMemo(() => ({
    floor: collection?.floor_price ? `${collection.floor_price} USD` : "—",
    floorChange: collection?.floor_24h_pct ? `${collection.floor_24h_pct}%` : null,
    totalVol: collection?.total_volume ? `${collection.total_volume} USD` : "0 USD",
    vol24h: collection?.volume_24h ? `${collection.volume_24h} USD` : "0 USD",
    sales24h: collection?.sales_24h || 0,
    owners: collection?.owners || 0, 
    ownerPct: collection?.total_supply && collection?.owners 
      ? `${((collection.owners / collection.total_supply) * 100).toFixed(1)}%` 
      : "0%",
    supply: collection?.total_supply?.toLocaleString() || "0",
    listed: collection?.listed_count || 0,
    mktCap: collection?.market_cap 
      ? `${Number(collection.market_cap).toLocaleString()} USD` 
      : "—",
    topOffer: collection?.top_offer ? `${collection.top_offer} USD` : "—",
    royalties: collection?.royalties ? `${(collection.royalties * 100).toFixed(1)}%` : "0%"
  }), [collection]);

  // ─── Token Fetcher Logic ──────────────────────────────────────────────────
  useEffect(() => {
    if (!collection?.metadata_base_uri) return;
    setTokensLoading(true);
    
    // Resolve IPFS if the URI is using ipfs:// protocol
    let base = collection.metadata_base_uri;
    if (base.startsWith("ipfs://")) {
      base = base.replace("ipfs://", "https://ipfs.io/ipfs/");
    }
    // Ensure trailing slash
    if (!base.endsWith("/")) base += "/";

    // Fetch first 20 tokens as a preview for the gallery
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    
    Promise.all(ids.map(async (tokenId) => {
        try {
            const res = await fetch(`${base}${tokenId}.json`);
            const json = await res.json();
            return { 
                tokenId, 
                name: json.name || `${collection.name} #${tokenId}`, 
                image: extractImageUrl(json) 
            };
        } catch (err) {
            console.error(`Error fetching metadata for ${tokenId}:`, err);
            return { tokenId, name: `#${tokenId}`, image: "" };
        }
    })).then(results => {
      setTokens(results);
      setTokensLoading(false);
    });
  }, [collection]);

  if (colLoading) return <div className="p-20 text-center font-display text-cyan-400 animate-pulse">Loading Collection Data...</div>;

  return (
    <div className="fade-up min-h-screen pb-20 bg-[#0b0f14]">
      {/* Banner */}
      <div className="relative h-64 w-full overflow-hidden">
        {collection?.banner_url && (
            <img src={collection.banner_url} className="w-full h-full object-cover opacity-50" alt="Banner" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f14] via-transparent" />
      </div>

      <div className="px-6 max-w-7xl mx-auto -mt-12 relative z-10">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end gap-6 mb-10">
          <div className="w-32 h-32 rounded-3xl overflow-hidden border-8 border-[#0b0f14] bg-[#121821] shadow-2xl">
            <NFTImage src={collection?.logo_url} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-display text-white tracking-tighter uppercase">{collection?.name}</h1>
              {collection?.verified && <CheckCircle2 size={24} className="fill-cyan-400 text-[#0b0f14]" />}
            </div>
            <div className="flex items-center gap-4 text-gray-400">
               <span className="text-sm font-bold text-cyan-400/80">By {collection?.creator_name || "Tempo Creator"}</span>
               <div className="flex gap-4">
                 {collection?.twitter && <a href={collection.twitter} className="hover:text-cyan-400 transition-colors"><Twitter size={18} /></a>}
                 {collection?.website && <a href={collection.website} className="hover:text-cyan-400 transition-colors"><Globe size={18} /></a>}
                 <a href={`${EXPLORER_BASE}/address/${collection?.contract_address}`} className="hover:text-cyan-400 transition-colors"><ExternalLink size={18} /></a>
               </div>
            </div>
          </div>
        </div>

        {/* Dynamic Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-10">
            <StatItem label="Floor Price" value={stats.floor} subValue={stats.floorChange} isTrend />
            <StatItem label="Top Offer" value={stats.topOffer} />
            <StatItem label="24h Vol" value={stats.vol24h} />
            <StatItem label="Total Vol" value={stats.totalVol} />
            <StatItem label="Market Cap" value={stats.mktCap} />
            <StatItem label="Owners" value={stats.owners} subValue={stats.ownerPct} />
            <StatItem label="Listed" value={stats.listed} subValue={`${((stats.listed/collection?.total_supply)*100).toFixed(1)}% listed`} />
            <StatItem label="Supply" value={stats.supply} />
            <StatItem label="Royalties" value={stats.royalties} />
        </div>

        {/* Content Tabs */}
        <div className="flex gap-8 border-b border-white/5 mb-8">
            {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} 
                  className={`pb-4 text-sm font-display tracking-widest border-b-2 transition-all ${
                    tab === t ? 'text-cyan-400 border-cyan-400' : 'text-gray-500 border-transparent'
                  }`}>
                    {t}
                </button>
            ))}
        </div>

        {/* Tab Content */}
        {tab === "Items" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {tokensLoading ? Array(10).fill(0).map((_, i) => <CardSkeleton key={i} />) : 
                 tokens.map(token => (
                    <Link 
                      key={token.tokenId} 
                      to={`/collection/${id}/${token.tokenId}`}
                      className="bg-[#121821] border border-white/5 rounded-2xl overflow-hidden card-hover p-2 block transition-all hover:border-cyan-400/30"
                    >
                        <NFTImage src={token.image} className="aspect-square rounded-xl object-cover mb-2" />
                        <div className="px-2 pb-2">
                            <div className="text-[10px] font-display text-gray-500 mb-1 uppercase tracking-tight">{collection?.name}</div>
                            <div className="text-sm font-bold text-white truncate font-display tracking-tight">{token.name}</div>
                        </div>
                    </Link>
                 ))
                }
            </div>
        )}

        {/* Placeholder for other tabs */}
        {tab !== "Items" && (
            <div className="py-20 text-center text-gray-500 font-mono text-xs">
                {tab} data is being indexed from the Tempo blockchain...
            </div>
        )}
      </div>
    </div>
  );
}
