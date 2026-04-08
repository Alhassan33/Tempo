import { useEffect, useState, useMemo } from "react";
import { Briefcase, Search, LayoutGrid, List, RefreshCw, Wallet } from "lucide-react";
import { useAccount } from "wagmi";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useNFTMetadata } from "@/hooks/useNFTMetadata";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import NFTImage from "@/components/NFTImage.jsx";

// ─── Individual NFT Item Component ───────────────────────────────────────────
// This component handles the metadata fetch for each specific token found
function PortfolioItem({ nft, view, onList }) {
  const navigate = useNavigate();
  
  // Uses the same dynamic metadata logic we fixed for the Item Page
  const { metadata, loading } = useNFTMetadata(
    nft.contract_address,
    nft.token_id,
    nft.metadata_base_uri
  );

  const handleClick = () => {
    navigate(`/collection/${nft.collection_slug}/${nft.token_id}`);
  };

  if (view === "list") {
    return (
      <div 
        onClick={handleClick}
        className="flex items-center gap-4 p-3 rounded-2xl bg-[#121821] border border-white/5 hover:border-cyan-400/30 cursor-pointer transition-all"
      >
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[#161d28]">
          <NFTImage src={metadata?.image} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold text-cyan-400 uppercase tracking-widest">{nft.collection_name}</div>
          <div className="text-sm font-bold text-white truncate">{metadata?.name || `#${nft.token_id}`}</div>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); onList(nft, metadata); }}
          className="px-4 py-1.5 rounded-xl text-xs font-bold bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 hover:bg-cyan-400/20"
        >
          List
        </button>
      </div>
    );
  }

  return (
    <div 
      onClick={handleClick}
      className="group relative bg-[#121821] border border-white/5 rounded-2xl overflow-hidden hover:border-cyan-400/30 transition-all cursor-pointer p-2"
    >
      <div className="aspect-square rounded-xl overflow-hidden mb-3 relative bg-[#161d28]">
        <NFTImage src={metadata?.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm">
            <RefreshCw className="animate-spin text-cyan-400" size={20} />
          </div>
        )}
      </div>
      <div className="px-2 pb-2">
        <div className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1 truncate">
          {nft.collection_name}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold text-white truncate group-hover:text-cyan-400 transition-colors">
            {metadata?.name || `#${nft.token_id}`}
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); onList(nft, metadata); }}
            className="text-[10px] px-2 py-1 rounded-lg font-bold bg-white/5 text-gray-400 hover:bg-cyan-400 hover:text-black transition-all"
          >
            LIST
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Portfolio Page ─────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("grid");
  const [search, setSearch] = useState("");
  const [listModal, setListModal] = useState(null);

  useEffect(() => {
    if (!address) return;

    async function fetchTempoPortfolio() {
      setLoading(true);
      try {
        // 1. Fetch supported collections from Supabase
        const { data: collections } = await supabase.from("collections").select("*");
        
        if (!collections) return;

        // 2. LOGIC FOR TEMPO CHAIN:
        // Ideally, you would query an indexer here. 
        // For now, we simulate finding tokens for this address within those collections.
        const foundAssets = [];
        
        for (const col of collections) {
          // This is a placeholder. In production, you'd use a multicall 
          // to check balanceOf(address) and find specific Token IDs.
          // For demo, we are showing the first few tokens of each collection.
          foundAssets.push({
            token_id: 1, // Simulated ID
            contract_address: col.contract_address,
            collection_name: col.name,
            collection_slug: col.slug,
            metadata_base_uri: col.metadata_base_uri
          });
        }
        
        setOwnedNFTs(foundAssets);
      } catch (err) {
        console.error("Portfolio fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchPortfolio(); // Call your context or local fetch
    fetchTempoPortfolio();
  }, [address]);

  const filtered = ownedNFTs.filter(n => 
    n.collection_name.toLowerCase().includes(search.toLowerCase()) ||
    n.token_id.toString().includes(search)
  );

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 fade-up">
        <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center">
          <Wallet size={40} className="text-gray-600" />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black text-white uppercase italic">Wallet Disconnected</h1>
          <p className="text-gray-500 text-sm mt-1">Connect to view your Tempochain assets.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-7xl mx-auto fade-up">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Briefcase size={14} className="text-cyan-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">Tempo Portfolio</span>
          </div>
          <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter">My Collection</h1>
          <p className="mt-1 text-sm text-gray-500 font-mono">{address}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={14} />
            <input 
              type="text" 
              placeholder="Search IDs or names..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-64 pl-10 pr-4 rounded-xl bg-[#121821] border border-white/5 text-sm text-white outline-none focus:border-cyan-400/50"
            />
          </div>
          <div className="flex bg-[#121821] rounded-xl p-1 border border-white/5">
            <button onClick={() => setView("grid")} className={`p-2 rounded-lg ${view === "grid" ? "bg-white/10 text-white" : "text-gray-500"}`}>
              <LayoutGrid size={18} />
            </button>
            <button onClick={() => setView("list")} className={`p-2 rounded-lg ${view === "list" ? "bg-white/10 text-white" : "text-gray-500"}`}>
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className={view === "grid" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4" : "space-y-2"}>
          {filtered.map((nft, idx) => (
            <PortfolioItem 
              key={`${nft.contract_address}-${nft.token_id}-${idx}`} 
              nft={nft} 
              view={view}
              onList={(nft, meta) => setListModal({
                tokenId: nft.token_id,
                contract: nft.contract_address,
                name: meta?.name || `#${nft.token_id}`,
                image: meta?.image
              })}
            />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center border border-dashed border-white/5 rounded-3xl">
          <p className="text-gray-600 font-bold uppercase tracking-widest text-xs">No assets found on Tempo chain</p>
        </div>
      )}

      {listModal && (
        <ListModal 
          nft={listModal} 
          onClose={() => setListModal(null)} 
        />
      )}
    </div>
  );
}
