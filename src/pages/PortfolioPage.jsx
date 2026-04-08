import { useEffect, useState } from "react";
import { Briefcase, Search, LayoutGrid, List, RefreshCw, Wallet } from "lucide-react";
import { useAccount, usePublicClient } from "wagmi";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useNFTMetadata } from "@/hooks/useNFTMetadata";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import NFTImage from "@/components/NFTImage.jsx";

// ─── Minimal ERC-20 ABI for reading ownership ────────────────────────────────
  async function fetchPortfolio() {
    if (!address || !publicClient) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Get all approved collections from your Supabase setup
      const { data: collections, error: dbErr } = await supabase
        .from("collections")
        .select("contract_address, name, slug, metadata_base_uri");

      if (dbErr) throw dbErr;
      if (!collections?.length) { setOwnedNFTs([]); return; }

      const assets = [];

      // 2. Process each collection individually to prevent total failure
      await Promise.all(
        collections.map(async (col) => {
          if (!col.contract_address) return;
          try {
            const balance = await publicClient.readContract({
              address: col.contract_address,
              abi: ERC721_ABI,
              functionName: "balanceOf",
              args: [address],
            });

            const count = Number(balance);
            if (count === 0) return;

            // TRY PATH A: Enumerable (will fail on many modern contracts)
            try {
              const tokenIds = await Promise.all(
                Array.from({ length: count }, (_, i) =>
                  publicClient.readContract({
                    address: col.contract_address,
                    abi: ERC721_ABI,
                    functionName: "tokenOfOwnerByIndex",
                    args: [address, BigInt(i)],
                  })
                )
              );

              tokenIds.forEach((id) => {
                assets.push({
                  token_id: Number(id),
                  contract_address: col.contract_address,
                  collection_name: col.name,
                  collection_slug: col.slug,
                  metadata_base_uri: col.metadata_base_uri,
                });
              });
            } catch (enumerableErr) {
              // TRY PATH B: Fallback to Supabase tracking
              // Ensure you use .toLowerCase() for reliable DB matching
              const { data: manualAssets } = await supabase
                .from("sales") 
                .select("token_id")
                .eq("nft_contract", col.contract_address.toLowerCase())
                .eq("buyer", address.toLowerCase());

              if (manualAssets?.length) {
                manualAssets.forEach(item => {
                  assets.push({
                    token_id: item.token_id,
                    contract_address: col.contract_address,
                    collection_name: col.name,
                    collection_slug: col.slug,
                    metadata_base_uri: col.metadata_base_uri,
                  });
                });
              }
            }
          } catch (e) {
            console.error(`Skipping collection ${col.name}: Not found or error.`);
          }
        })
      );

      setOwnedNFTs(assets);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

// ─── Individual NFT card ──────────────────────────────────────────────────────
function PortfolioItem({ nft, view, onList }) {
  const navigate = useNavigate();
  const { metadata, loading } = useNFTMetadata(
    nft.contract_address,
    nft.token_id,
    nft.metadata_base_uri
  );

  function handleClick() {
    navigate(`/collection/${nft.collection_slug}/${nft.token_id}`);
  }

  if (view === "list") {
    return (
      <div onClick={handleClick}
        className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all card-hover"
        style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: "#161d28" }}>
          <NFTImage src={metadata?.image} className="w-full h-full object-cover" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#22d3ee" }}>
            {nft.collection_name}
          </div>
          <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>
            {metadata?.name || `#${nft.token_id}`}
          </div>
        </div>
        <button onClick={e => { e.stopPropagation(); onList(nft, metadata); }}
          className="px-4 py-1.5 rounded-xl text-xs font-bold transition-all"
          style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)", cursor: "pointer" }}>
          List
        </button>
      </div>
    );
  }

  return (
    <div onClick={handleClick}
      className="group relative rounded-2xl overflow-hidden cursor-pointer transition-all card-hover p-2"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="aspect-square rounded-xl overflow-hidden mb-3 relative" style={{ background: "#161d28" }}>
        <NFTImage src={metadata?.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" style={{ objectFit: "cover" }} />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}>
            <RefreshCw className="animate-spin" size={20} style={{ color: "#22d3ee" }} />
          </div>
        )}
      </div>
      <div className="px-2 pb-2">
        <div className="text-[9px] font-bold uppercase tracking-widest mb-1 truncate" style={{ color: "#9da7b3" }}>
          {nft.collection_name}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold truncate transition-colors" style={{ color: "#e6edf3" }}>
            {metadata?.name || `#${nft.token_id}`}
          </div>
          <button onClick={e => { e.stopPropagation(); onList(nft, metadata); }}
            className="text-[10px] px-2 py-1 rounded-lg font-bold transition-all flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.05)", color: "#9da7b3", border: "none", cursor: "pointer" }}>
            LIST
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Portfolio Page ──────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [ownedNFTs,  setOwnedNFTs]  = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [view,       setView]       = useState("grid");
  const [search,     setSearch]     = useState("");
  const [listModal,  setListModal]  = useState(null);
  const [error,      setError]      = useState(null);

  async function fetchPortfolio() {
    if (!address || !publicClient) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Get all approved collections from Supabase
      const { data: collections, error: dbErr } = await supabase
        .from("collections")
        .select("contract_address, name, slug, metadata_base_uri, total_supply");

      if (dbErr) throw dbErr;
      if (!collections?.length) { setOwnedNFTs([]); return; }

      const assets = [];

      // 2. For each collection, check how many NFTs this wallet owns
      await Promise.all(
        collections.map(async (col) => {
          if (!col.contract_address) return;
          try {
            // Check balance
            const balance = await publicClient.readContract({
              address: col.contract_address,
              abi: ERC721_ABI,
              functionName: "balanceOf",
              args: [address],
            });

            const count = Number(balance);
            if (count === 0) return;

            // Get each token ID owned by this wallet
            const tokenIds = await Promise.all(
              Array.from({ length: count }, (_, i) =>
                publicClient.readContract({
                  address: col.contract_address,
                  abi: ERC721_ABI,
                  functionName: "tokenOfOwnerByIndex",
                  args: [address, BigInt(i)],
                }).then(id => Number(id)).catch(() => null)
              )
            );

            tokenIds.filter(Boolean).forEach((tokenId) => {
              assets.push({
                token_id:          tokenId,
                contract_address:  col.contract_address,
                collection_name:   col.name,
                collection_slug:   col.slug,
                metadata_base_uri: col.metadata_base_uri,
              });
            });
          } catch (e) {
            // Contract may not support tokenOfOwnerByIndex (not enumerable)
            // Fall back to checking Transfer events from Supabase sales table
            try {
              const { data: purchases } = await supabase
                .from("sales")
                .select("token_id")
                .eq("nft_contract", col.contract_address.toLowerCase())
                .eq("buyer", address.toLowerCase());

              (purchases || []).forEach(({ token_id }) => {
                assets.push({
                  token_id,
                  contract_address:  col.contract_address,
                  collection_name:   col.name,
                  collection_slug:   col.slug,
                  metadata_base_uri: col.metadata_base_uri,
                });
              });
            } catch {}
          }
        })
      );

      setOwnedNFTs(assets);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isConnected && address) fetchPortfolio();
  }, [address, isConnected]);

  const filtered = ownedNFTs.filter(n =>
    n.collection_name?.toLowerCase().includes(search.toLowerCase()) ||
    n.token_id?.toString().includes(search)
  );

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 fade-up">
        <div className="w-20 h-20 rounded-full flex items-center justify-center" style={{ background: "rgba(255,255,255,0.04)" }}>
          <Wallet size={40} style={{ color: "#9da7b3" }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-black text-white uppercase" style={{ color: "#e6edf3" }}>Wallet Not Connected</h1>
          <p className="text-sm mt-1" style={{ color: "#9da7b3" }}>Connect your wallet to view your Tempo chain NFTs.</p>
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
            <Briefcase size={14} style={{ color: "#22d3ee" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Portfolio</span>
          </div>
          <h1 className="text-3xl font-black uppercase" style={{ color: "#e6edf3" }}>My NFTs</h1>
          <p className="mt-1 text-xs font-mono" style={{ color: "#9da7b3" }}>{address}</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Refresh */}
          <button onClick={fetchPortfolio} disabled={loading}
            className="h-11 w-11 rounded-xl flex items-center justify-center transition-colors"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3", cursor: "pointer" }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2" size={14} style={{ color: "#9da7b3" }} />
            <input type="text" placeholder="Search by name or ID..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="h-11 w-56 pl-9 pr-4 rounded-xl text-sm outline-none"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
              onFocus={e => e.target.style.borderColor = "#22d3ee"}
              onBlur={e => e.target.style.borderColor = "rgba(255,255,255,0.06)"} />
          </div>

          {/* View toggle */}
          <div className="flex rounded-xl p-1" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[{ v: "grid", Icon: LayoutGrid }, { v: "list", Icon: List }].map(({ v, Icon }) => (
              <button key={v} onClick={() => setView(v)}
                className="p-2 rounded-lg transition-colors"
                style={{ background: view === v ? "rgba(255,255,255,0.1)" : "none", color: view === v ? "#e6edf3" : "#9da7b3", border: "none", cursor: "pointer" }}>
                <Icon size={16} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && ownedNFTs.length > 0 && (
        <div className="flex items-center gap-6 mb-6 p-4 rounded-2xl"
          style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>Total NFTs</div>
            <div className="font-mono font-bold" style={{ color: "#e6edf3" }}>{ownedNFTs.length}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>Collections</div>
            <div className="font-mono font-bold" style={{ color: "#e6edf3" }}>
              {new Set(ownedNFTs.map(n => n.contract_address)).size}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {/* Grid / List */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className={view === "grid"
          ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4"
          : "space-y-2"}>
          {filtered.map((nft, idx) => (
            <PortfolioItem
              key={`${nft.contract_address}-${nft.token_id}-${idx}`}
              nft={nft}
              view={view}
              onList={(nft, meta) => setListModal({
                tokenId:    nft.token_id,
                contract:   nft.contract_address,
                name:       meta?.name || `#${nft.token_id}`,
                image:      meta?.image,
                collection: nft.collection_name,
              })}
            />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center rounded-3xl"
          style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
          <div className="text-4xl mb-3">🎨</div>
          <div className="font-bold mb-1" style={{ color: "#e6edf3" }}>No NFTs found</div>
          <p className="text-xs" style={{ color: "#9da7b3" }}>
            No NFTs from supported Tempo collections found in this wallet.
          </p>
        </div>
      )}

      {listModal && (
        <ListModal nft={listModal} onClose={() => setListModal(null)} />
      )}
    </div>
  );
}
