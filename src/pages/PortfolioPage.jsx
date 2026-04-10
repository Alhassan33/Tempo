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
  LayoutGrid, 
  List, 
  Search, 
  Filter, 
  ArrowUpDown 
} from "lucide-react";
import { useCollection, useRealtimeListings } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import NFTGridItem from "@/components/NFTGridItem.jsx";

const TABS = ["Items", "Activity", "Bids", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";
const PAGE_SIZE = 50;

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4 transition-all hover:bg-white/[0.02]" 
       style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.05)" }}>
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
  const [sortBy, setSortBy] = useState("rarity_asc");
  const loaderRef = useRef(null);

  // ─── Data Fetching ──────────────────────────────────────────────────────────
  const { collection, loading: collectionLoading } = useCollection(id);
  
  // Passing 'id' as string to match your updated useListings(nftContract: string)
  const { listings: rawListings, isLoading: listingsLoading } = useRealtimeListings(id);

  // Note: Ensure your hook for fetching wallet tokens is integrated here
  const [tokens, setTokens] = useState([]); 
  const [tokensLoading, setTokensLoading] = useState(false);
  const [page, setPage] = useState(1);

  // ─── Portfolio Logic ────────────────────────────────────────────────────────
  
  // 1. Filter listings belonging to the connected user
  const activeListings = useMemo(() => {
    if (!rawListings || !address) return [];
    return rawListings.filter(l => 
      l.active && l.seller?.toLowerCase() === address.toLowerCase()
    );
  }, [rawListings, address]);

  // 2. Filter wallet tokens that are NOT currently listed
  const unlistedTokens = useMemo(() => {
    if (!tokens || !address) return [];
    const listedIds = new Set(activeListings.map(l => String(l.token_id)));
    return tokens.filter(t => !listedIds.has(String(t.tokenId)));
  }, [tokens, activeListings, address]);

  // 3. Search & Sort logic
  const filteredItems = useMemo(() => {
    let combined = [
      ...activeListings.map(l => ({ ...l, isListed: true })),
      ...unlistedTokens.map(t => ({ ...t, isListed: false }))
    ];

    if (searchQuery) {
      combined = combined.filter(item => 
        (item.token_id || item.tokenId).toString().includes(searchQuery)
      );
    }

    return combined;
  }, [activeListings, unlistedTokens, searchQuery]);

  // ─── Infinite Scroll ────────────────────────────────────────────────────────
  const handleObserver = useCallback((entries) => {
    const target = entries[0];
    if (target.isIntersecting && !tokensLoading) {
      setPage(prev => prev + 1);
    }
  }, [tokensLoading]);

  useEffect(() => {
    const option = { threshold: 0.1 };
    const observer = new IntersectionObserver(handleObserver, option);
    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div className="min-h-screen text-[#e6edf3] p-4 md:p-8" style={{ background: "#0b0f14" }}>
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight uppercase italic">
                {collection?.name || "MY PORTFOLIO"}
              </h1>
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

        {/* Stats Dashboard */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatItem label="FLOOR PRICE" value="25.00 USD" subValue="+12.5%" isTrend={true} />
          <StatItem label="ITEMS OWNED" value={activeListings.length + unlistedTokens.length} subValue="Tokens" />
          <StatItem label="LISTED" value={activeListings.length} subValue="Active" />
          <StatItem label="EST. VALUE" value={`${((activeListings.length + unlistedTokens.length) * 25).toFixed(2)} USD`} />
        </div>

        {/* Navigation & Controls */}
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
                  placeholder="Search by ID..." 
                  className="w-full bg-[#121821] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:border-[#22d3ee]/50 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-[#121821] border border-white/5 rounded-xl text-sm font-medium hover:bg-white/5 transition-all">
                <Filter size={16} /> Filters
              </button>
              <button className="flex items-center gap-2 px-4 py-2.5 bg-[#121821] border border-white/5 rounded-xl text-sm font-medium hover:bg-white/5 transition-all">
                <ArrowUpDown size={16} /> Sort
              </button>
            </div>
          )}
        </div>

        {/* Tab Content Display */}
        <div className="min-h-[400px]">
          {tab === "Items" && (
            <>
              {!address ? (
                <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
                  <p className="text-[#9da7b3] font-medium">Connect your wallet to see your items</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                  {/* Listed Items */}
                  {activeListings.map(listing => (
                    <NFTGridItem 
                      key={`listed-${listing.token_id}`} 
                      token={{ 
                        tokenId: listing.token_id, 
                        name: `${collection?.name} #${listing.token_id}`, 
                        image: listing.image_url || "" 
                      }} 
                      collectionName={collection?.name} 
                      slug={id} 
                      listing={listing} 
                    />
                  ))}

                  {/* Unlisted Items */}
                  {unlistedTokens.map(token => (
                    <NFTGridItem 
                      key={`unlisted-${token.tokenId}`} 
                      token={token} 
                      collectionName={collection?.name} 
                      slug={id} 
                      listing={null} 
                    />
                  ))}

                  {(listingsLoading || tokensLoading) && 
                    Array(5).fill(0).map((_, i) => <CardSkeleton key={i} />)
                  }
                </div>
              )}
              
              {address && activeListings.length === 0 && unlistedTokens.length === 0 && !listingsLoading && (
                <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-white/[0.01]">
                  <p className="text-[#9da7b3]">No NFTs from this collection found in your wallet.</p>
                </div>
              )}
              <div ref={loaderRef} className="h-10" />
            </>
          )}

          {tab === "Activity" && (
            <ActivityFeed collectionId={id} nftContract={collection?.contract_address} />
          )}

          {tab === "Analytics" && (
            <div className="py-20 text-center text-[#9da7b3]">Analytics module coming soon...</div>
          )}
        </div>
      </div>
    </div>
  );
}
