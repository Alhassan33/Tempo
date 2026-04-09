// pages/PortfolioPage.jsx
// Reads from the `nfts` table populated by the indexer.
// One fast Supabase query instead of 2000 on-chain calls.

import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  Briefcase, Search, LayoutGrid, List,
  RefreshCw, Wallet, Tag, ExternalLink
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useNFTMetadata } from "@/hooks/useNFTMetadata";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import NFTImage from "@/components/NFTImage.jsx";

// ─── Single NFT card ──────────────────────────────────────────────────────────
function NFTCard({ nft, view, onList }) {
  const navigate = useNavigate();
  // Uses collection's metadata_base_uri from the joined collections row
  const { metadata, loading } = useNFTMetadata(nft.token_id, nft.collections?.metadata_base_uri);

  function goToItem() {
    navigate(`/nft/${nft.token_id}?contract=${nft.contract_address}`);
  }

  if (view === "list") {
    return (
      <div
        onClick={goToItem}
        className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all"
        style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}
      >
        <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: "#161d28" }}>
          {loading
            ? <div className="w-full h-full animate-pulse" style={{ background: "#1a2232" }} />
            : <NFTImage src={metadata?.image} alt={metadata?.name} className="w-full h-full object-cover" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#22d3ee" }}>
            {nft.collections?.name || nft.contract_address.slice(0, 8)}
          </div>
          <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>
            {loading ? `#${nft.token_id}` : (metadata?.name || `#${nft.token_id}`)}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onList(nft, metadata); }}
          className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
          style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
          <Tag size={10} /> List
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={goToItem}
      className="group rounded-2xl overflow-hidden cursor-pointer transition-all"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}
    >
      <div className="aspect-square overflow-hidden relative" style={{ background: "#161d28" }}>
        {loading
          ? <div className="w-full h-full animate-pulse" style={{ background: "#1a2232" }} />
          : <NFTImage
              src={metadata?.image}
              alt={metadata?.name}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
        }
      </div>
      <div className="p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest mb-1 truncate" style={{ color: "#9da7b3" }}>
          {nft.collections?.name || nft.contract_address.slice(0, 10)}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>
            {loading ? `#${nft.token_id}` : (metadata?.name || `#${nft.token_id}`)}
          </div>
          <button
            onClick={e => { e.stopPropagation(); onList(nft, metadata); }}
            className="text-[10px] px-2 py-1 rounded-lg font-bold flex-shrink-0"
            style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.15)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
            List
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
  const { address, isConnected } = useAccount();
  const [ownedNFTs, setOwnedNFTs] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [view,      setView]      = useState("grid");
  const [search,    setSearch]    = useState("");
  const [listModal, setListModal] = useState(null);

  const fetchPortfolio = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      // Single fast query — indexer already did the hard work
      // Join collections so we get metadata_base_uri and name
      const { data, error: dbErr } = await supabase
        .from("nfts")
        .select(`
          token_id,
          contract_address,
          last_updated_block,
          collections (
            name,
            slug,
            metadata_base_uri,
            total_supply
          )
        `)
        .eq("owner_address", address.toLowerCase())
        .neq("owner_address", "0x0000000000000000000000000000000000000000")
        .order("token_id", { ascending: true });

      if (dbErr) throw dbErr;
      setOwnedNFTs(data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) fetchPortfolio();
  }, [address, isConnected, fetchPortfolio]);

  const filtered = ownedNFTs.filter(n => {
    if (!search) return true;
    const name = n.collections?.name?.toLowerCase() || "";
    return name.includes(search.toLowerCase()) || String(n.token_id).includes(search);
  });

  // ── Not connected ─────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 fade-up">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          <Wallet size={40} style={{ color: "#9da7b3" }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold mb-1"
            style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
            Connect Wallet
          </h1>
          <p className="text-sm" style={{ color: "#9da7b3" }}>
            Connect your wallet to view your NFTs on Tempo Chain.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto fade-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={14} style={{ color: "#22d3ee" }} />
            <span className="text-xs font-bold uppercase tracking-widest"
              style={{ color: "#22d3ee", fontFamily: "Syne, sans-serif" }}>
              Portfolio
            </span>
          </div>
          <h1 className="text-3xl font-extrabold uppercase"
            style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
            My NFTs
          </h1>
          <p className="mt-1 text-xs font-mono" style={{ color: "#9da7b3" }}>
            {address}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPortfolio}
            disabled={loading}
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3", cursor: "pointer" }}>
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" size={13}
              style={{ color: "#9da7b3" }} />
            <input
              type="text"
              placeholder="Search by name or ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 w-48 sm:w-56 pl-8 pr-3 rounded-xl text-sm outline-none"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
              onFocus={e => e.target.style.borderColor = "#22d3ee"}
              onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
            />
          </div>

          <div className="flex rounded-xl p-1"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[{ v: "grid", Icon: LayoutGrid }, { v: "list", Icon: List }].map(({ v, Icon }) => (
              <button key={v} onClick={() => setView(v)}
                className="p-2 rounded-lg"
                style={{
                  background: view === v ? "rgba(34,211,238,0.1)" : "none",
                  color: view === v ? "#22d3ee" : "#9da7b3",
                  border: "none", cursor: "pointer",
                }}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && ownedNFTs.length > 0 && (
        <div className="flex items-center gap-6 p-4 rounded-2xl mb-6"
          style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>
              Total NFTs
            </div>
            <div className="font-mono font-bold text-lg" style={{ color: "#e6edf3" }}>
              {ownedNFTs.length}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>
              Collections
            </div>
            <div className="font-mono font-bold text-lg" style={{ color: "#e6edf3" }}>
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
            <NFTCard
              key={`${nft.contract_address}-${nft.token_id}-${idx}`}
              nft={nft}
              view={view}
              onList={(nft, meta) => setListModal({
                tokenId:    nft.token_id,
                contract:   nft.contract_address,
                name:       meta?.name || `#${nft.token_id}`,
                image:      meta?.image,
                collection: nft.collections?.name,
              })}
            />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center rounded-3xl"
          style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
          <div className="text-5xl mb-4">🎨</div>
          <div className="font-bold text-lg mb-2"
            style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
            No NFTs found
          </div>
          <p className="text-sm mb-1" style={{ color: "#9da7b3" }}>
            Your wallet doesn't hold any NFTs from supported collections yet.
          </p>
          <p className="text-xs" style={{ color: "#9da7b3" }}>
            If you just minted or bought, wait for the indexer to sync (runs every minute).
          </p>
        </div>
      )}

      {listModal && (
        <ListModal nft={listModal} onClose={() => setListModal(null)} />
      )}
    </div>
  );
}
