import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { 
  CheckCircle2, 
  ExternalLink, 
  Twitter, 
  Globe, 
  TrendingDown, 
  TrendingUp, 
  Search, 
  Filter, 
  ArrowUpDown 
} from "lucide-react";
import { useCollection, useRealtimeListings } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ActivityFeed from "@/components/ActivityFeed.jsx";

const TABS = ["Items", "Activity", "Bids", "Analytics"];

// ─── Local Component: ListingCard (Since you don't have NFTGridItem) ─────────
const ListingCard = ({ item, collectionName, slug, isListed }) => (
  <Link 
    to={`/collection/${slug}/${item.token_id || item.tokenId}`}
    className="group rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-1"
    style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.05)" }}
  >
    <div className="aspect-square overflow-hidden relative">
      <NFTImage 
        src={item.image_url || item.image} 
        alt={item.name}
        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
      />
      {isListed && (
        <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-[#22d3ee] text-black text-[10px] font-bold tracking-tighter">
          LISTED
        </div>
      )}
    </div>
    <div className="p-3 space-y-2">
      <div className="flex justify-between items-start">
        <div className="text-[10px] font-bold text-[#9da7b3] uppercase tracking-wider truncate">
          {collectionName}
        </div>
        <div className="text-[10px] font-mono text-[#22d3ee]">#{item.token_id || item.tokenId}</div>
      </div>
      <div className="text-sm font-bold text-[#e6edf3] truncate">
        {item.name || `${collectionName} #${item.token_id || item.tokenId}`}
      </div>
      {isListed && item.displayPrice && (
        <div className="pt-2 border-t border-white/5 flex justify-between items-center">
          <span className="text-[10px] text-[#9da7b3]">PRICE</span>
          <span className="text-xs font-bold text-[#e6edf3]">{item.displayPrice} USD</span>
        </div>
      )}
    </div>
  </Link>
);

const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#9da7b3" }}>{label}</div>
    <div className="flex items-baseline gap-2">
      <div className="font-mono text-lg font-bold" style={{ color: "#e6edf3" }}>{value}</div>
      {subValue && (
        <div className={`text-[11px] font-bold flex items-center gap-0.5 ${
          isTrend ? (subValue.includes("-") ? "text-red-400" : "text-green-400") : "text-[#9da7b3]"
        }`}>
          {isTrend && (subValue.includes("-") ? <TrendingDown size={12} /> : <TrendingUp size={12} />)}
          {subValue}
        </div>
      )}
    </div>
  </div>
);

export default function PortfolioPage() {
  const { id } = useParams();
  const { address } = useAccount();
  const [tab, setTab] = useState("Items");
  const [searchQuery, setSearchQuery] = useState("");
  const loaderRef = useRef(null);

  const { collection, loading: collectionLoading } = useCollection(id);
  const { listings: rawListings, isLoading: listingsLoading } = useRealtimeListings(id);

  // In your real setup, replace this [] with your hook that fetches wallet tokens
  const [tokens, setTokens] = useState([]); 
  const [tokensLoading, setTokensLoading] = useState(false);

  // Logic to filter your specific NFTs
  const activeListings = useMemo(() => {
    if (!rawListings || !address) return [];
    return rawListings.filter(l => 
      l.active && l.seller?.toLowerCase() === address.toLowerCase()
    );
  }, [rawListings, address]);

  const unlistedTokens = useMemo(() => {
    if (!tokens || !address) return [];
    const listedIds = new Set(activeListings.map(l => String(l.token_id)));
    return tokens.filter(t => !listedIds.has(String(t.tokenId)));
  }, [tokens, activeListings, address]);

  return (
    <div className="min-h-screen text-[#e6edf3] p-4 md:p-8" style={{ background: "#0b0f14" }}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight uppercase italic">{collection?.name || "PORTFOLIO"}</h1>
              <CheckCircle2 size={20} className="text-[#22d3ee]" fill="rgba(34,211,238,0.1)" />
            </div>
            <div className="flex items-center gap-4 text-[#9da7b3]">
              <span className="text-sm">By <span className="text-[#22d3ee] font-medium">Tempo Creator</span></span>
              <div className="flex items-center gap-3 ml-2">
                <Twitter size={16} className="hover:text-white cursor-pointer transition-all" />
                <Globe size={16} className="hover:text-white cursor-pointer transition-all" />
                <ExternalLink size={16} className="hover:text-white cursor-pointer transition-all" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatItem label="FLOOR PRICE" value="25.00 USD" subValue="+12.5%" isTrend={true} />
          <StatItem label="ITEMS OWNED" value={activeListings.length + unlistedTokens.length} subValue="Tokens" />
          <StatItem label="LISTED" value={activeListings.length} subValue="Active" />
          <StatItem label="EST. VALUE" value={`${((activeListings.length + unlistedTokens.length) * 25).toFixed(2)} USD`} />
        </div>

        {/* Navigation */}
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between border-b border-white/5">
            <div className="flex gap-8">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`pb-4 text-[11px] font-bold uppercase tracking-widest transition-all relative ${
                    tab === t ? "text-[#22d3ee]" : "text-[#9da7b3] hover:text-white"
                  }`}>
                  {t}
                  {tab === t && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#22d3ee] shadow-[0_0_10px_#22d3ee]" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {tab === "Items" && (
            <div className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9da7b3]" size={16} />
                <input 
                  type="text" 
                  placeholder="Search your items..." 
                  className="w-full bg-[#121821] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[#22d3ee]/50 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Items Grid */}
        <div className="min-h-[400px]">
          {tab === "Items" && (
            <>
              {!address ? (
                <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
                  <p className="text-[#9da7b3] font-medium">Connect wallet to view portfolio</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {activeListings.map(listing => (
                    <ListingCard 
                      key={`listed-${listing.token_id}`} 
                      item={listing} 
                      collectionName={collection?.name} 
                      slug={id} 
                      isListed={true} 
                    />
                  ))}
                  {unlistedTokens.map(token => (
                    <ListingCard 
                      key={`unlisted-${token.tokenId}`} 
                      item={token} 
                      collectionName={collection?.name} 
                      slug={id} 
                      isListed={false} 
                    />
                  ))}
                  {(listingsLoading || tokensLoading) && 
                    Array(5).fill(0).map((_, i) => <CardSkeleton key={i} />)
                  }
                </div>
              )}
              {address && activeListings.length === 0 && unlistedTokens.length === 0 && !listingsLoading && (
                <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
                  <p className="text-[#9da7b3]">No items found in your wallet for this collection.</p>
                </div>
              )}
            </>
          )}

          {tab === "Activity" && <ActivityFeed collectionId={id} nftContract={collection?.contract_address} />}
          {tab === "Analytics" && <div className="py-20 text-center text-[#9da7b3]">Charts Loading...</div>}
        </div>
      </div>
    </div>
  );
}
