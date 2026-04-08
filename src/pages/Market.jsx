import { useState, useEffect } from "react";
import { LayoutGrid, Grid3X3, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import NFTCard from "@/components/NFTCard";

export default function MarketplaceGrid({ collectionSlug }) {
  const [nfts, setNfts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cols, setCols] = useState(3); // State for 2 vs 3 columns
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 50; // Increased from 20 to 50

  const fetchNFTs = async (pageNum) => {
    setLoading(true);
    const from = pageNum * itemsPerPage;
    const to = from + itemsPerPage - 1;

    try {
      const { data, error } = await supabase
        .from("nfts")
        .select("*")
        .eq("collection_slug", collectionSlug)
        .range(from, to)
        .order("token_id", { ascending: true });

      if (error) throw error;

      if (data.length < itemsPerPage) setHasMore(false);
      
      setNfts(prev => pageNum === 0 ? data : [...prev, ...data]);
    } catch (err) {
      console.error("Fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNFTs(0);
  }, [collectionSlug]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchNFTs(nextPage);
  };

  return (
    <div className="px-6 py-8">
      {/* ─── Grid Switcher Controls ─── */}
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-xl font-black text-white uppercase italic">Market Items</h2>
        
        <div className="flex bg-[#121821] rounded-xl p-1 border border-white/5">
          <button 
            onClick={() => setCols(2)}
            className={`p-2 rounded-lg transition-all ${cols === 2 ? "bg-cyan-400 text-black" : "text-gray-500"}`}
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            onClick={() => setCols(3)}
            className={`p-2 rounded-lg transition-all ${cols === 3 ? "bg-cyan-400 text-black" : "text-gray-500"}`}
          >
            <Grid3X3 size={18} />
          </button>
        </div>
      </div>

      {/* ─── NFT Grid ─── */}
      <div className={`grid gap-4 transition-all duration-300 ${
        cols === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"
      }`}>
        {nfts.map((nft) => (
          <NFTCard 
            key={nft.id} 
            nft={nft} 
            compact={cols === 3} // Card can adjust its UI if 3 cols
          />
        ))}
      </div>

      {/* ─── Load More Button ─── */}
      {hasMore && (
        <div className="flex justify-center mt-12 pb-12">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="h-12 px-10 rounded-2xl border border-cyan-400/20 bg-[#121821] text-cyan-400 text-xs font-black uppercase italic tracking-widest hover:bg-cyan-400/10 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin" size={14} /> : null}
            {loading ? "Loading..." : "Load More Assets"}
          </button>
        </div>
      )}
    </div>
  );
}
