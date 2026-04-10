import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAccount } from "wagmi"; // Essential for Portfolio
import { CheckCircle2, ExternalLink, Twitter, Globe, TrendingDown, TrendingUp } from "lucide-react";
import { useCollection, useRealtimeListings } from "@../../hooks/useSupabase";
import NFTImage from "@../../components/NFTImage.jsx";
import { CardSkeleton } from "@../../components/Skeleton.jsx";
import { extractImageUrl } from "@../../utils/nftImageUtils.js";
import ActivityFeed from "@../../components/ActivityFeed.jsx";
import NFTGridItem from "@../../components/NFTGridItem.jsx"; // Ensure this path is correct

const TABS = ["Items", "Activity", "Bids", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";

// ─── Stat Card ────────────────────────────────────────────────────────────────
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
  const { collection, loading: collectionLoading } = useCollection(id);
  
  // FIX: Pass 'id' directly as a string to match useListings(nftContract: string)
  const { listings: rawListings, isLoading: listingsLoading } = useRealtimeListings(id);

  // Placeholder for user's wallet tokens - typically from a hook like useUserTokens(id, address)
  const [tokens, setTokens] = useState([]); 
  const [tokensLoading, setTokensLoading] = useState(false);

  // ─── Logic: Separate Listed vs Unlisted ─────────────────────────────────────
  
  // 1. NFTs in your wallet that are currently listed for sale
  const activeListings = useMemo(() => {
    if (!rawListings || !address) return [];
    return rawListings.filter(l => 
      l.active && l.seller?.toLowerCase() === address.toLowerCase()
    );
  }, [rawListings, address]);

  // 2. NFTs in your wallet that ARE NOT listed
  const unlistedTokens = useMemo(() => {
    if (!tokens || !address) return [];
    const listedIds = new Set(activeListings.map(l => String(l.token_id)));
    return tokens.filter(t => !listedIds.has(String(t.tokenId)));
  }, [tokens, activeListings, address]);

  return (
    <div className="min-h-screen text-[#e6edf3] p-4 md:p-8" style={{ background: "#0b0f14" }}>
      {/* Header & Branding */}
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight uppercase italic">{collection?.name || "Collection"}</h1>
              <CheckCircle2 size={20} className="text-[#22d3ee]" fill="rgba(34,211,238,0.1)" />
            </div>
            <div className="flex items-center gap-4 text-[#9da7b3]">
              <span className="text-sm">By <span className="text-[#22d3ee] font-medium">Tempo Creator</span></span>
              <div className="flex items-center gap-3 ml-2">
                <Twitter size={16} className="hover:text-white cursor-pointer transition-colors" />
                <Globe size={16} className="hover:text-white cursor-pointer transition-colors" />
                <ExternalLink size={16} className="hover:text-white cursor-pointer transition-colors" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatItem label="FLOOR PRICE" value="25.00 USD" subValue="+12.5%" isTrend={true} />
          <StatItem label="ITEMS OWNED" value={activeListings.length + unlistedTokens.length} subValue="Portfolio Share" />
          <StatItem label="LISTED" value={activeListings.length} subValue={`${((activeListings.length / 2000) * 100).toFixed(1)}% of total`} />
          <StatItem label="EST. VALUE" value={`${((activeListings.length + unlistedTokens.length) * 25).toFixed(2)} USD`} />
        </div>

        {/* Tabs */}
        <div className="flex gap-8 border-b border-white/5">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`pb-4 text-[11px] font-bold uppercase tracking-widest border-b-2 transition-all ${
                tab === t ? "border-[#22d3ee] text-[#22d3ee]" : "border-transparent text-[#9da7b3]"
              }`}>
              {t}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {tab === "Items" && (
          <div className="py-6">
            {!address ? (
              <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02]">
                <p className="text-[#9da7b3]">Please connect your wallet to view your portfolio.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {/* Render Listed Items */}
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

                {/* Render Unlisted Items */}
                {unlistedTokens.map(token => (
                  <NFTGridItem 
                    key={`unlisted-${token.tokenId}`} 
                    token={token} 
                    collectionName={collection?.name} 
                    slug={id} 
                    listing={null} 
                  />
                ))}

                {(listingsLoading || tokensLoading) && Array(5).fill(0).map((_, i) => <CardSkeleton key={i} />)}
              </div>
            )}
            
            {address && activeListings.length === 0 && unlistedTokens.length === 0 && !listingsLoading && (
              <div className="py-20 text-center rounded-3xl border border-dashed border-white/10 bg-white/[0.02]">
                <p className="text-[#9da7b3]">No NFTs found in this collection for your address.</p>
              </div>
            )}
          </div>
        )}

        {tab === "Activity" && <ActivityFeed collectionId={id} nftContract={collection?.contract_address} />}
      </div>
    </div>
  );
}
