// pages/PortfolioPage.jsx
import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { Briefcase, Search, LayoutGrid, List, RefreshCw, Wallet, Tag } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchTokenMetadata } from "@/hooks/useNFTMetadata";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import DelistModal from "@/components/DelistModal.jsx";

const TABS = ["All", "Listed", "Unlisted"];

// ─── NFT Card ─────────────────────────────────────────────────────────────────
function NFTCard({ nft, view, onList, onDelist }) {
  const navigate  = useNavigate();
  const imgSrc    = nft.metadata?.image || nft.image || null;
  const tokenName = nft.metadata?.name  || nft.name  || `#${nft.token_id}`;
  const isListed  = !!nft.listing;

  // ✅ Fixed: use collection_slug for correct routing
  function goToItem() {
    if (nft.collection_slug) {
      navigate(`/collection/${nft.collection_slug}/${nft.token_id}`);
    }
  }

  if (view === "list") {
    return (
      <div onClick={goToItem}
        className="flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all card-hover"
        style={{ background: "#121821", border: isListed ? "1px solid rgba(34,211,238,0.25)" : "1px solid rgba(255,255,255,0.06)" }}>
        <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: "#161d28" }}>
          {imgSrc
            ? <img src={imgSrc} alt={tokenName} className="w-full h-full object-cover" />
            : <div className="w-full h-full animate-pulse" style={{ background: "#1a2232" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>
              {nft.collection_name}
            </div>
            {isListed && (
              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)" }}>
                LISTED
              </span>
            )}
          </div>
          <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>{tokenName}</div>
          {isListed && (
            <div className="text-xs font-mono mt-0.5" style={{ color: "#22d3ee" }}>
              {Number(nft.listing.price).toFixed(2)} USD
            </div>
          )}
        </div>
        {isListed ? (
          <button onClick={e => { e.stopPropagation(); onDelist(nft); }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
            Delist
          </button>
        ) : (
          <button onClick={e => { e.stopPropagation(); onList(nft); }}
            className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 flex-shrink-0"
            style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)", cursor: "pointer" }}>
            <Tag size={10} /> List
          </button>
        )}
      </div>
    );
  }

  return (
    <div onClick={goToItem}
      className="group rounded-2xl overflow-hidden cursor-pointer transition-all relative card-hover"
      style={{ background: "#121821", border: isListed ? "1px solid rgba(34,211,238,0.25)" : "1px solid rgba(255,255,255,0.06)" }}>
      {isListed && (
        <div className="absolute top-2 left-2 z-10 px-2 py-0.5 rounded-lg text-[9px] font-bold"
          style={{ background: "rgba(11,15,20,0.85)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.4)", backdropFilter: "blur(4px)" }}>
          ● LISTED
        </div>
      )}
      <div className="aspect-square overflow-hidden" style={{ background: "#161d28" }}>
        {imgSrc
          ? <img src={imgSrc} alt={tokenName}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          : <div className="w-full h-full animate-pulse" style={{ background: "#1a2232" }} />}
      </div>
      <div className="p-3">
        <div className="text-[9px] font-bold uppercase tracking-widest mb-1 truncate" style={{ color: "#9da7b3" }}>
          {nft.collection_name}
        </div>
        <div className="font-bold text-sm truncate mb-1" style={{ color: "#e6edf3" }}>{tokenName}</div>
        {isListed ? (
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm font-bold" style={{ color: "#22d3ee" }}>
              {Number(nft.listing.price).toFixed(2)} USD
            </span>
            <button onClick={e => { e.stopPropagation(); onDelist(nft); }}
              className="text-[10px] px-2 py-1 rounded-lg font-bold"
              style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
              Delist
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "#9da7b3" }}>Not listed</span>
            <button onClick={e => { e.stopPropagation(); onList(nft); }}
              className="text-[10px] px-2 py-1 rounded-lg font-bold"
              style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.15)", cursor: "pointer" }}>
              List
            </button>
          </div>
        )}
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
  const [tab,         setTab]         = useState("All");
  const [listModal,   setListModal]   = useState(null);
  const [delistModal, setDelistModal] = useState(null);

  const fetchPortfolio = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);

    try {
      // ✅ Fixed: ilike for case-insensitive address matching
      const { data: nftRows, error: nftErr } = await supabase
        .from("nfts")
        .select("token_id, contract_address, name, image, metadata_url")
        .ilike("owner_address", address)
        .neq("owner_address", "0x0000000000000000000000000000000000000000")
        .order("token_id", { ascending: true });

      if (nftErr) throw nftErr;
      if (!nftRows?.length) { setOwnedNFTs([]); setLoading(false); return; }

      const contracts = [...new Set(nftRows.map(n => n.contract_address))];
      const { data: colRows } = await supabase
        .from("collections")
        .select("contract_address, name, slug, metadata_base_uri")
        .in("contract_address", contracts);

      const colMap = {};
      (colRows || []).forEach(c => { colMap[c.contract_address?.toLowerCase()] = c; });

      // Get active listings for this wallet
      const { data: listingRows } = await supabase
        .from("listings")
        .select("token_id, nft_contract, listing_id, price")
        .ilike("seller", address)
        .eq("active", true);

      const listingMap = {};
      (listingRows || []).forEach(l => {
        listingMap[`${l.nft_contract?.toLowerCase()}:${l.token_id}`] = l;
      });

      const enriched = nftRows.map(nft => {
        const col = colMap[nft.contract_address?.toLowerCase()];
        const listingKey = `${nft.contract_address?.toLowerCase()}:${nft.token_id}`;
        return {
          ...nft,
          collection_name:   col?.name || nft.contract_address?.slice(0, 8),
          collection_slug:   col?.slug,
          metadata_base_uri: col?.metadata_base_uri || null,
          listing:           listingMap[listingKey] || null,
          metadata:          null,
        };
      });

      setOwnedNFTs(enriched);
      setLoading(false);

      // Stream metadata for NFTs without images
      const needsMeta = enriched.filter(n => !n.image && n.metadata_base_uri);
      if (!needsMeta.length) return;

      setMetaLoading(true);
      const working = [...enriched];
      const BATCH = 8;

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
        setOwnedNFTs([...working]);
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

  const filtered = useMemo(() => {
    let list = ownedNFTs;
    if (tab === "Listed")   list = list.filter(n => !!n.listing);
    if (tab === "Unlisted") list = list.filter(n => !n.listing);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(n =>
        (n.metadata?.name || n.name || n.collection_name || "").toLowerCase().includes(q) ||
        String(n.token_id).includes(q)
      );
    }
    return list;
  }, [ownedNFTs, tab, search]);

  const listedCount   = ownedNFTs.filter(n => !!n.listing).length;
  const unlistedCount = ownedNFTs.filter(n => !n.listing).length;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 fade-up">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(255,255,255,0.04)" }}>
          <Wallet size={40} style={{ color: "#9da7b3" }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold mb-1" style={{ color: "#e6edf3" }}>Connect Wallet</h1>
          <p className="text-sm" style={{ color: "#9da7b3" }}>Connect to view your NFTs on Tempo Chain.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto fade-up">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Briefcase size={14} style={{ color: "#22d3ee" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Portfolio</span>
          </div>
          <h1 className="text-3xl font-extrabold uppercase" style={{ color: "#e6edf3" }}>My NFTs</h1>
          <p className="mt-1 text-xs font-mono" style={{ color: "#9da7b3" }}>{address}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={fetchPortfolio} disabled={loading}
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
            <RefreshCw size={14} className={loading || metaLoading ? "animate-spin" : ""} style={{ color: "#9da7b3" }} />
          </button>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" size={13} style={{ color: "#9da7b3" }} />
            <input type="text" placeholder="Search by name or ID..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="h-10 w-44 sm:w-52 pl-8 pr-3 rounded-xl text-sm outline-none"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
              onFocus={e => e.target.style.borderColor = "#22d3ee"}
              onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"} />
          </div>
          <div className="flex rounded-xl p-1" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
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
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { label: "Total NFTs", value: ownedNFTs.length },
            { label: "Listed",     value: listedCount,   color: "#22d3ee" },
            { label: "Unlisted",   value: unlistedCount },
          ].map(({ label, value, color }) => (
            <div key={label} className="rounded-2xl p-3"
              style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>{label}</div>
              <div className="font-mono font-bold text-lg" style={{ color: color || "#e6edf3" }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      {!loading && ownedNFTs.length > 0 && (
        <div className="flex items-center gap-1.5 mb-5">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="h-8 px-4 rounded-full text-xs font-semibold"
              style={{
                background: tab === t ? "rgba(34,211,238,0.12)" : "#121821",
                color:      tab === t ? "#22d3ee" : "#9da7b3",
                border:     tab === t ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer",
              }}>
              {t}
              {t === "Listed"   && listedCount   > 0 && ` (${listedCount})`}
              {t === "Unlisted" && unlistedCount  > 0 && ` (${unlistedCount})`}
            </button>
          ))}
          {metaLoading && (
            <span className="ml-auto flex items-center gap-1.5 text-xs" style={{ color: "#9da7b3" }}>
              <RefreshCw size={11} className="animate-spin" /> Loading images...
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-xl px-4 py-3 mb-5 text-sm"
          style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : filtered.length > 0 ? (
        <div className={view === "grid" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" : "space-y-2"}>
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
                slug:       nft.collection_slug,
              })}
              onDelist={(nft) => setDelistModal({
                tokenId:    nft.token_id,
                contract:   nft.contract_address,
                listingId:  nft.listing.listing_id,
                name:       nft.metadata?.name  || nft.name  || `#${nft.token_id}`,
                image:      nft.metadata?.image || nft.image || null,
                price:      nft.listing.price,
                collection: nft.collection_name,
              })}
            />
          ))}
        </div>
      ) : (
        <div className="py-24 text-center rounded-3xl" style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
          <div className="text-5xl mb-4">🎨</div>
          <div className="font-bold text-lg mb-2" style={{ color: "#e6edf3" }}>
            {tab === "Listed" ? "No listed NFTs" : tab === "Unlisted" ? "All NFTs are listed!" : "No NFTs found"}
          </div>
          <p className="text-sm" style={{ color: "#9da7b3" }}>
            {tab === "All" ? "No NFTs from supported collections found in this wallet." : ""}
          </p>
        </div>
      )}

      {listModal && (
        <ListModal nft={listModal} onClose={() => { setListModal(null); fetchPortfolio(); }} />
      )}
      {delistModal && (
        <DelistModal nft={delistModal} onClose={() => { setDelistModal(null); fetchPortfolio(); }} />
      )}
    </div>
  );
}
