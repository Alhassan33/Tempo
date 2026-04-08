import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  CheckCircle2, 
  ExternalLink, 
  Twitter, 
  Globe, 
  MessageCircle,
  TrendingDown,
  TrendingUp
} from "lucide-react";
import { useAccount } from "wagmi";
import { useCollection, useRealtimeListings } from "@/hooks/useSupabase";
import { useMarketplace } from "@/hooks/useMarketplace"; 
import NFTImage from "@/components/NFTImage.jsx";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import CollectionBids from "@/components/CollectionBids.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";

const TABS = ["Items", "Activity", "Bids", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";

// ─── Stats Component ──────────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4 bg-[#121821] border border-white/5 shadow-sm">
    <div className="text-[10px] font-display text-gray-500 mb-1">{label}</div>
    <div className="flex items-baseline gap-2">
      <div className="font-mono-web3 text-lg font-bold text-white uppercase">{value}</div>
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
  const { id } = useParams();
  const navigate = useNavigate();
  const { address } = useAccount();

  const { collection, loading: colLoading } = useCollection(id);
  const { listings: supabaseListings } = useRealtimeListings(collection?.contract_address);
  
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
    // FIX: Changed from owners_count to owners
    owners: collection?.owners || 0, 
    // FIX: Changed from owners_count to owners
    ownerPct: collection?.total_supply && collection?.owners 
      ? `${((collection.owners / collection.total_supply) * 100).toFixed(1)}%` 
      : "0%",
    supply: collection?.total_supply?.toLocaleString() || "0",
    listed: collection?.listed_count || 0,
    // FIX: Market Cap logic to show real values instead of just Millions
    mktCap: collection?.market_cap 
      ? `${Number(collection.market_cap).toLocaleString()} USD` 
      : "—",
    topOffer: collection?.top_offer ? `${collection.top_offer} USD` : "—",
    // FIX: Changed from royalties_bps to royalties and handled decimal to pct
    royalties: collection?.royalties ? `${collection.royalties * 100}%` : "0%"
  }), [collection]);

  // Fetch Logic (Generic for any collection)
  useEffect(() => {
    if (!collection?.metadata_base_uri) return;
    setTokensLoading(true);
    
    // Fetch first 20 tokens as a preview
    const ids = Array.from({ length: 20 }, (_, i) => i + 1);
    Promise.all(ids.map(async (tokenId) => {
        try {
            const res = await fetch(`${collection.metadata_base_uri}${tokenId}.json`);
            const json = await res.json();
            return { tokenId, name: json.name, image: extractImageUrl(json) };
        } catch {
            return { tokenId, name: `#${tokenId}`, image: "" };
        }
    })).then(results => {
      setTokens(results);
      setTokensLoading(false);
    });
  }, [collection]);

  if (colLoading) return <div className="p-20 text-center font-display">Loading Collection...</div>;

  return (
    <div className="fade-up min-h-screen pb-20">
      {/* Banner */}
      <div className="relative h-64 w-full overflow-hidden bg-[#0b0f14]">
        {collection?.banner_url && <img src={collection.banner_url} className="w-full h-full object-cover opacity-60" />}
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
              <h1 className="text-4xl font-display text-white tracking-tighter">{collection?.name}</h1>
              {collection?.verified && <CheckCircle2 size={24} className="fill-cyan-400 text-[#0b0f14]" />}
            </div>
            <div className="flex items-center gap-4 text-gray-400">
               <span className="text-sm font-bold">By {collection?.creator_name || "Unknown"}</span>
               <div className="flex gap-3">
                 {collection?.twitter && <a href={collection.twitter}><Twitter size={18} /></a>}
                 {collection?.website && <a href={collection.website}><Globe size={18} /></a>}
                 <a href={`${EXPLORER_BASE}/address/${collection?.contract_address}`}><ExternalLink size={18} /></a>
               </div>
            </div>
          </div>
        </div>

        {/* Dynamic Stats Grid - Magic Eden Style */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3 mb-10">
            <StatItem label="Floor Price" value={stats.floor} subValue={stats.floorChange} isTrend />
            <StatItem label="Top Offer" value={stats.topOffer} />
            <StatItem label="24h Volume" value={stats.vol24h} />
            <StatItem label="24h Sales" value={stats.sales24h} />
            <StatItem label="Total Volume" value={stats.totalVol} />
            <StatItem label="Market Cap" value={stats.mktCap} />
            <StatItem label="Listed / Supply" value={`${stats.listed} / ${stats.supply}`} subValue={`${((stats.listed/collection?.total_supply)*100).toFixed(1)}%`} />
            <StatItem label="Owners" value={stats.owners} subValue={stats.ownerPct} />
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

        {tab === "Items" && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {tokensLoading ? Array(10).fill(0).map((_, i) => <CardSkeleton key={i} />) : 
                 tokens.map(token => (
                    <div key={token.tokenId} className="bg-[#121821] border border-white/5 rounded-2xl overflow-hidden card-hover p-2">
                        <NFTImage src={token.image} className="aspect-square rounded-xl object-cover mb-2" />
                        <div className="px-2 pb-2">
                            <div className="text-xs font-display text-gray-400 mb-1">{collection?.name}</div>
                            <div className="text-sm font-bold text-white truncate">{token.name}</div>
                        </div>
                    </div>
                 ))
                }
            </div>
        )}
      </div>
    </div>
  );
}
