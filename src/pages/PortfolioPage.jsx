// pages/PortfolioPage.jsx
import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { Briefcase, Search, LayoutGrid, List, RefreshCw, Wallet, Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchTokenMetadata } from "@/hooks/useNFTMetadata";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import NFTImage from "@/components/NFTImage.jsx";

// ─── NFT Card ─────────────────────────────────────────────────────────────────
function NFTCard({ nft, view, onList }) {
  const navigate  = useNavigate();
  const imgSrc    = nft.metadata?.image || nft.image || null;
  const tokenName = nft.metadata?.name  || nft.name  || `#${nft.token_id}`;

  function goToItem() {
    navigate(`/nft/${nft.token_id}?contract=${nft.contract_address}`);
  }

  if (view === "list") {
    return (
      <div onClick={goToItem}
        className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all"
        style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
        onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)"}
        onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}>
        <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: "#161d28" }}>
          {imgSrc
            ? <img src={imgSrc} alt={tokenName} className="w-full h-full object-cover" />
            : <div className="w-full h-full animate-pulse" style={{ background: "#1a2232" }} />
          }
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-0.5" style={{ color: "#22d3ee" }}>
            {nft.collection_name}
          </div>
          <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>{tokenName}</div>
        </div>
        <button onClick={e => { e.stopPropagation(); onList(nft); }}
          className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
          style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
          <Tag size={10} /> List
        </button>
      </div>
    );
  }

  return (
    <div onClick={goToItem}
      className="group rounded-2xl overflow-hidden cursor-pointer transition-all"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}>
      <div className="aspect-square overflow-hidden" style={{ background: "#161d28" }}>
        {imgSrc
          ? <img src={imgSrc} alt={tokenName}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <div className="w-full h-full animate-pulse" style={{ background: "#1a2232" }} />
        }
      </div>
      <div className="p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest mb-1 truncate" style={{ color: "#9da7b3" }}>
          {nft.collection_name}
        </div>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>{tokenName}</div>
          <button onClick={e => { e.stopPropagation(); onList(nft); }}
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
  const [ownedNFTs,   setOwnedNFTs]   = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [metaLoading, setMetaLoading] = useState(false);
  const [error,       setError]       = useState(null);
  const [view,        setView]        = useState("grid");
  const [search,      setSearch]      = useState("");
  const [listModal,   setListModal]   = useState(null);

  const fetchPortfolio = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Get owned token rows
      const { data: nftRows, error: nftErr } = await supabase
        .from("nfts")
        .select("token_id, contract_address, name, image, metadata_url")
        .eq("owner_address", address.toLowerCase())
        .neq("owner_address", "0x0000000000000000000000000000000000000000")
        .order("token_id", { ascending: true });

      if (nftErr) throw nftErr;
      if (!nftRows?.length) { setOwnedNFTs([]); setLoading(false); return; }

      // 2. Get collection info for all unique contracts
      const contracts = [...new Set(nftRows.map(n => n.contract_address))];
      const { data: colRows } = await supabase
        .from("collections")
        .select("contract_address, name, slug, metadata_base_uri")
        .in("contract_address", contracts);

      const colMap = {};
      (colRows || []).forEach(c => { colMap[c.contract_address] = c; });

      // 3. Merge collection info into each NFT row
      const enriched = nftRows.map(nft => ({
        ...nft,
        collection_name:   colMap[nft.contract_address]?.name || nft.contract_address.slice(0, 8),
        collection_slug:   colMap[nft.contract_address]?.slug,
        metadata_base_uri: colMap[nft.contract_address]?.metadata_base_uri || null,
        metadata:          null, // will be filled below
      }));

      setOwnedNFTs(enriched);
      setLoading(false);

      // 4. Stream metadata in batches of 8 for NFTs that need it
      const needsMeta = enriched.filter(n => !n.image && n.metadata_base_uri);
      if (!needsMeta.length) return;

      setMetaLoading(true);
      const working = [...enriched];
      const BATCH   = 8;

      for (let i = 0; i < needsMeta.length; i += BATCH) {
        const chunk = needsMeta.slice(i, i + BATCH);
        await Promise.all(chunk.map(async (nft) => {
          try {
            const meta = await fetchTokenMetadata(nft.token_id, nft.metadata_base_uri);
            const idx  = working.findIndex(
              n => n.contract_address === nft.contract_address && n.token_id === nft.token_id
            );
            if (idx !== -1) working[idx] = { ...working[idx], metadata: meta };
          } catch {}
        }));
        setOwnedNFTs([...working]); // re-render after each batch
      }
      setMetaLoading(false);

    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (isConnected && address) fetchPortfolio();
  }, [address, isConnected, fetchPortfolio]);

  const filtered = ownedNFTs.filter(n => {
    if (!search) return true;
    const name = (n.metadata?.name || n.name || n.collection_name || "").toLowerCase();
    return name.includes(search.toLowerCase()) || String(n.token_id).includes(search);
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 fade-up">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          <Wallet size={40} style={{ color: "#9da7b3" }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold mb-1"
            style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>Connect Wallet</h1>
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
              style={{ color: "#22d3ee", fontFamily: "Syne, sans-serif" }}>Portfolio</span>
          </div>
          <h1 className="text-3xl font-extrabold uppercase"
            style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>My NFTs</h1>
          <p className="mt-1 text-xs font-mono" style={{ color: "#9da7b3" }}>{address}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchPortfolio} disabled={loading}
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3", cursor: "pointer" }}>
            <RefreshCw size={14} className={loading || metaLoading ? "animate-spin" : ""} />
          </button>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
              size={13} style={{ color: "#9da7b3" }} />
            <input type="text" placeholder="Search by name or ID..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="h-10 w-48 sm:w-56 pl-8 pr-3 rounded-xl text-sm outline-none"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
              onFocus={e => e.target.style.borderColor = "#22d3ee"}
              onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"} />
          </div>

          <div className="flex rounded-xl p-1"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
            {[{ v: "grid", Icon: LayoutGrid }, { v: "list", Icon: List }].map(({ v, Icon }) => (
              <button key={v} onClick={() => setView(v)} className="p-2 rounded-lg"
                style={{ background: view === v ? "rgba(34,211,238,0.1)" : "none", color: view === v ? "#22d3ee" : "#9da7b3", border: "none", cursor: "pointer" }}>
                <Icon size={15} />
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      {!loading && ownedNFTs.length > 0 && (
        <div className="flex items-center gap-6 p-4 rounded-2xl mb-6"
          style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>Total NFTs</div>
            <div className="font-mono font-bold text-lg" style={{ color: "#e6edf3" }}>{ownedNFTs.length}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>Collections</div>
            <div className="font-mono font-bold text-lg" style={{ color: "#e6edf3" }}>
              {new Set(ownedNFTs.map(n => n.contract_address)).size}
            </div>
          </div>
          {metaLoading && (
            <div className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: "#9da7b3" }}>
              <RefreshCw size={11} className="animate-spin" /> Loading images...
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className={view === "grid"
          ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
          : "space-y-2"}>
          {filtered.map((nft, idx) => (
            <NFTCard
              key={`${nft.contract_address}-${nft.token_id}-${idx}`}
              nft={nft} view={view}
              onList={(nft) => setListModal({
                tokenId:    nft.token_id,
                contract:   nft.contract_address,
                name:       nft.metadata?.name  || nft.name  || `#${nft.token_id}`,
                image:      nft.metadata?.image || nft.image || null,
                attributes: nft.metadata?.attributes || [],
                collection: nft.collection_name,
              })}
            />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center rounded-3xl"
          style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
          <div className="text-5xl mb-4">🎨</div>
          <div className="font-bold text-lg mb-2"
            style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>No NFTs found</div>
          <p className="text-sm" style={{ color: "#9da7b3" }}>
            No NFTs from supported collections found in this wallet.
          </p>
        </div>
      )}

      {listModal && <ListModal nft={listModal} onClose={() => setListModal(null)} />}
    </div>
  );
}
