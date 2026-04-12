// pages/PortfolioPage.jsx
import { useEffect, useState, useCallback, useMemo } from “react”;
import { useNavigate } from “react-router-dom”;
import { useAccount } from “wagmi”;
import {
Briefcase, Search, LayoutGrid, List, Square,
RefreshCw, Wallet, Tag, X, SlidersHorizontal,
ChevronDown, Check
} from “lucide-react”;
import { supabase } from “@/lib/supabase”;
import { fetchTokenMetadata } from “@/hooks/useNFTMetadata”;
import { CardSkeleton } from “@/components/Skeleton.jsx”;
import ListModal from “@/components/ListModal.jsx”;
import DelistModal from “@/components/DelistModal.jsx”;

const TABS        = [“All”, “Listed”, “Unlisted”];
const MARKETPLACE = “0x218ab916fe8d7a1ca87d7cd5dfb1d44684ab926b”;

const SORT_OPTIONS = [
{ id: “token_id_asc”,   label: “Token ID ↑”        },
{ id: “token_id_desc”,  label: “Token ID ↓”        },
{ id: “price_asc”,      label: “Price: Low → High”  },
{ id: “price_desc”,     label: “Price: High → Low”  },
{ id: “listed_first”,   label: “Listed First”       },
{ id: “unlisted_first”, label: “Unlisted First”     },
];

function fmtPrice(raw) {
if (!raw) return “0.00”;
return (Number(raw) / 1e6).toFixed(2);
}

// ─── Toolbar: Search + Sort + 3-in-1 View/Refresh pill ───────────────────────
function Toolbar({ view, onView, onRefresh, loading, search, onSearch, sort, onSort }) {
const [filterOpen, setFilterOpen] = useState(false);
const views = [
{ v: “single”, Icon: Square     },
{ v: “grid”,   Icon: LayoutGrid },
{ v: “list”,   Icon: List       },
];

return (
<div className="flex items-center gap-2 flex-wrap">

```
  {/* Search */}
  <div className="relative flex-1 min-w-[140px]">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" size={13} style={{ color: "#9da7b3" }} />
    <input
      type="text"
      placeholder="Search by name or ID..."
      value={search}
      onChange={e => onSearch(e.target.value)}
      className="h-10 w-full pl-8 pr-3 rounded-xl text-sm outline-none"
      style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
      onFocus={e => e.target.style.borderColor = "#22d3ee"}
      onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
    />
  </div>

  {/* Sort dropdown */}
  <div className="relative">
    <button
      onClick={() => setFilterOpen(o => !o)}
      className="h-10 px-3 rounded-xl flex items-center gap-1.5 text-xs font-semibold"
      style={{
        background: filterOpen ? "rgba(34,211,238,0.1)" : "#161d28",
        border: filterOpen ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.06)",
        color: filterOpen ? "#22d3ee" : "#9da7b3",
        cursor: "pointer",
      }}>
      <SlidersHorizontal size={13} />
      <span className="hidden sm:inline">Sort</span>
      <ChevronDown size={11} />
    </button>

    {filterOpen && (
      <div className="absolute right-0 top-12 z-50 rounded-2xl overflow-hidden shadow-2xl min-w-[180px]"
        style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.1)" }}>
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.id}
            onClick={() => { onSort(opt.id); setFilterOpen(false); }}
            className="w-full flex items-center justify-between px-4 py-2.5 text-xs font-medium text-left"
            style={{
              background: sort === opt.id ? "rgba(34,211,238,0.08)" : "transparent",
              color: sort === opt.id ? "#22d3ee" : "#9da7b3",
              border: "none", cursor: "pointer",
            }}>
            {opt.label}
            {sort === opt.id && <Check size={12} />}
          </button>
        ))}
      </div>
    )}
  </div>

  {/* 3-in-1 view toggle + refresh — single pill */}
  <div className="flex items-center rounded-xl overflow-hidden flex-shrink-0"
    style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
    {views.map(({ v, Icon }) => (
      <button
        key={v}
        onClick={() => onView(v)}
        className="flex items-center justify-center w-9 h-10 transition-all"
        style={{
          background: view === v ? "rgba(34,211,238,0.12)" : "transparent",
          color: view === v ? "#22d3ee" : "#9da7b3",
          border: "none",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          cursor: "pointer",
        }}>
        <Icon size={14} />
      </button>
    ))}
    <button
      onClick={onRefresh}
      disabled={loading}
      className="flex items-center justify-center w-9 h-10"
      style={{ background: "transparent", color: "#9da7b3", border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
      <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
    </button>
  </div>
</div>
```

);
}

// ─── NFT Card ─────────────────────────────────────────────────────────────────
function NFTCard({ nft, view, onList, onDelist }) {
const navigate     = useNavigate();
const imgSrc       = nft.metadata?.image || nft.image || null;
const tokenName    = nft.metadata?.name  || nft.name  || `#${nft.token_id}`;
const isListed     = !!nft.listing;
const priceDisplay = isListed ? fmtPrice(nft.listing.price) : null;

function goToItem() {
if (nft.collection_slug) navigate(`/collection/${nft.collection_slug}/${nft.token_id}`);
}

if (view === “list”) {
return (
<div onClick={goToItem}
className=“flex items-center gap-4 p-3 rounded-2xl cursor-pointer transition-all”
style={{ background: “#121821”, border: isListed ? “1px solid rgba(34,211,238,0.25)” : “1px solid rgba(255,255,255,0.06)” }}
onMouseEnter={e => e.currentTarget.style.borderColor = “rgba(34,211,238,0.4)”}
onMouseLeave={e => e.currentTarget.style.borderColor = isListed ? “rgba(34,211,238,0.25)” : “rgba(255,255,255,0.06)”}>
<div className=“w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden” style={{ background: “#161d28” }}>
{imgSrc
? <img src={imgSrc} alt={tokenName} className="w-full h-full object-cover" />
: <div className=“w-full h-full animate-pulse” style={{ background: “#1a2232” }} />}
</div>
<div className="flex-1 min-w-0">
<div className="flex items-center gap-2 mb-0.5">
<div className=“text-[10px] font-bold uppercase tracking-widest” style={{ color: “#22d3ee” }}>{nft.collection_name}</div>
{isListed && (
<span className=“text-[9px] font-bold px-1.5 py-0.5 rounded”
style={{ background: “rgba(34,211,238,0.12)”, color: “#22d3ee”, border: “1px solid rgba(34,211,238,0.3)” }}>
LISTED
</span>
)}
</div>
<div className=“text-sm font-bold truncate” style={{ color: “#e6edf3” }}>{tokenName}</div>
{isListed && <div className=“text-xs font-mono mt-0.5” style={{ color: “#22d3ee” }}>{priceDisplay} USD</div>}
</div>
{isListed ? (
<button onClick={e => { e.stopPropagation(); onDelist(nft); }}
className=“px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 flex-shrink-0”
style={{ background: “rgba(239,68,68,0.08)”, color: “#EF4444”, border: “1px solid rgba(239,68,68,0.2)”, cursor: “pointer” }}>
<X size={10} /> Delist
</button>
) : (
<button onClick={e => { e.stopPropagation(); onList(nft); }}
className=“px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 flex-shrink-0”
style={{ background: “rgba(34,211,238,0.08)”, color: “#22d3ee”, border: “1px solid rgba(34,211,238,0.2)”, cursor: “pointer” }}>
<Tag size={10} /> List
</button>
)}
</div>
);
}

const isSingle = view === “single”;
return (
<div onClick={goToItem}
className=“group rounded-2xl overflow-hidden cursor-pointer transition-all relative”
style={{ background: “#121821”, border: isListed ? “1px solid rgba(34,211,238,0.25)” : “1px solid rgba(255,255,255,0.06)” }}
onMouseEnter={e => e.currentTarget.style.borderColor = “rgba(34,211,238,0.4)”}
onMouseLeave={e => e.currentTarget.style.borderColor = isListed ? “rgba(34,211,238,0.25)” : “rgba(255,255,255,0.06)”}>
{isListed && (
<div className=“absolute top-2 left-2 z-10 px-2 py-0.5 rounded-lg text-[9px] font-bold”
style={{ background: “rgba(11,15,20,0.85)”, color: “#22d3ee”, border: “1px solid rgba(34,211,238,0.4)”, backdropFilter: “blur(4px)” }}>
● LISTED
</div>
)}
<div className=“aspect-square overflow-hidden” style={{ background: “#161d28” }}>
{imgSrc
? <img src={imgSrc} alt={tokenName} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
: <div className=“w-full h-full animate-pulse” style={{ background: “#1a2232” }} />}
</div>
<div className="p-3">
<div className=“text-[9px] font-bold uppercase tracking-widest mb-1 truncate” style={{ color: “#9da7b3” }}>{nft.collection_name}</div>
<div className={`font-bold truncate mb-1 ${isSingle ? "text-base" : "text-sm"}`} style={{ color: “#e6edf3” }}>{tokenName}</div>
{isListed ? (
<div className="flex items-center justify-between">
<span className=“font-mono text-sm font-bold” style={{ color: “#22d3ee” }}>{priceDisplay} USD</span>
<button onClick={e => { e.stopPropagation(); onDelist(nft); }}
className=“text-[10px] px-2 py-1 rounded-lg font-bold”
style={{ background: “rgba(239,68,68,0.08)”, color: “#EF4444”, border: “1px solid rgba(239,68,68,0.2)”, cursor: “pointer” }}>
Delist
</button>
</div>
) : (
<div className="flex items-center justify-between">
<span className=“text-xs” style={{ color: “#9da7b3” }}>Not listed</span>
<button onClick={e => { e.stopPropagation(); onList(nft); }}
className=“text-[10px] px-2 py-1 rounded-lg font-bold”
style={{ background: “rgba(34,211,238,0.08)”, color: “#22d3ee”, border: “1px solid rgba(34,211,238,0.15)”, cursor: “pointer” }}>
List
</button>
</div>
)}
</div>
</div>
);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function PortfolioPage() {
const { address, isConnected } = useAccount();
const [ownedNFTs,   setOwnedNFTs]   = useState([]);
const [loading,     setLoading]     = useState(false);
const [metaLoading, setMetaLoading] = useState(false);
const [error,       setError]       = useState(null);
const [view,        setView]        = useState(“grid”);
const [search,      setSearch]      = useState(””);
const [sort,        setSort]        = useState(“token_id_asc”);
const [tab,         setTab]         = useState(“All”);
const [listModal,   setListModal]   = useState(null);
const [delistModal, setDelistModal] = useState(null);
const [liveFlash,   setLiveFlash]   = useState(false);

const fetchPortfolio = useCallback(async () => {
if (!address) return;
setLoading(true);
setError(null);

```
try {
  // 1. NFTs in wallet
  const { data: nftRows, error: nftErr } = await supabase
    .from("nfts")
    .select("token_id, contract_address, name, image, metadata_url")
    .ilike("owner_address", address)
    .neq("owner_address", "0x0000000000000000000000000000000000000000")
    .order("token_id", { ascending: true });
  if (nftErr) throw nftErr;

  // 2. Collection info
  const { data: colRows } = await supabase
    .from("collections")
    .select("contract_address, name, slug, metadata_base_uri");
  const colMap = {};
  (colRows || []).forEach(c => { colMap[c.contract_address?.toLowerCase()] = c; });

  // 3. Active listings by this seller
  const { data: listingRows, error: listErr } = await supabase
    .from("listings")
    .select("token_id, nft_contract, listing_id, price, active, seller")
    .ilike("seller", address)
    .eq("active", true);
  if (listErr) console.warn("Listings fetch error:", listErr);

  const listingMap = {};
  (listingRows || [])
    .sort((a, b) => Number(b.listing_id) - Number(a.listing_id))
    .forEach(l => {
      const key = `${l.nft_contract?.toLowerCase()}:${Number(l.token_id)}`;
      if (!listingMap[key]) listingMap[key] = l;
    });

  // 4. ✅ NFTs held by marketplace (ownership transfers on listing)
  const { data: listedNftRows } = await supabase
    .from("nfts")
    .select("token_id, contract_address, name, image, metadata_url")
    .ilike("owner_address", MARKETPLACE)
    .neq("owner_address", "0x0000000000000000000000000000000000000000");

  const marketplaceNfts = (listedNftRows || []).filter(n => {
    const key = `${n.contract_address?.toLowerCase()}:${Number(n.token_id)}`;
    return !!listingMap[key];
  });

  // 5. Merge + deduplicate
  const allNftRows = [...(nftRows || [])];
  marketplaceNfts.forEach(mn => {
    const exists = allNftRows.some(n =>
      n.contract_address?.toLowerCase() === mn.contract_address?.toLowerCase() &&
      Number(n.token_id) === Number(mn.token_id)
    );
    if (!exists) allNftRows.push(mn);
  });

  if (!allNftRows.length) { setOwnedNFTs([]); setLoading(false); return; }

  // 6. Enrich
  const enriched = allNftRows.map(nft => {
    const contractLower = nft.contract_address?.toLowerCase();
    const col = colMap[contractLower];
    const key = `${contractLower}:${Number(nft.token_id)}`;
    return {
      ...nft,
      collection_name:   col?.name || contractLower?.slice(0, 8),
      collection_slug:   col?.slug || null,
      metadata_base_uri: col?.metadata_base_uri || null,
      listing:           listingMap[key] || null,
      metadata:          null,
    };
  });

  setOwnedNFTs(enriched);
  setLoading(false);

  // 7. Stream metadata
  const needsMeta = enriched.filter(n => !n.image && n.metadata_base_uri);
  if (!needsMeta.length) return;
  setMetaLoading(true);
  const working = [...enriched];
  for (let i = 0; i < needsMeta.length; i += 8) {
    await Promise.all(needsMeta.slice(i, i + 8).map(async nft => {
      try {
        const meta = await fetchTokenMetadata(nft.token_id, nft.metadata_base_uri);
        const idx  = working.findIndex(n =>
          n.contract_address?.toLowerCase() === nft.contract_address?.toLowerCase() &&
          Number(n.token_id) === Number(nft.token_id)
        );
        if (idx !== -1) working[idx] = { ...working[idx], metadata: meta };
      } catch {}
    }));
    setOwnedNFTs([...working]);
  }
  setMetaLoading(false);

} catch (e) {
  console.error("fetchPortfolio:", e);
  setError(e.message);
  setLoading(false);
  setMetaLoading(false);
}
```

}, [address]);

useEffect(() => {
if (isConnected && address) fetchPortfolio();
}, [address, isConnected, fetchPortfolio]);

// ✅ Realtime with live flash indicator
useEffect(() => {
if (!address) return;
const channel = supabase
.channel(`portfolio:${address.toLowerCase()}`)
.on(“postgres_changes”, { event: “*”, schema: “public”, table: “listings” }, (payload) => {
const row = payload.new || payload.old;
if (!row?.seller) { fetchPortfolio(); return; }
if (row.seller?.toLowerCase() === address?.toLowerCase()) {
setLiveFlash(true);
setTimeout(() => setLiveFlash(false), 1500);
fetchPortfolio();
}
})
.subscribe();
return () => { supabase.removeChannel(channel); };
}, [address, fetchPortfolio]);

const filtered = useMemo(() => {
let list = […ownedNFTs];
if (tab === “Listed”)   list = list.filter(n => !!n.listing);
if (tab === “Unlisted”) list = list.filter(n => !n.listing);
if (search) {
const q = search.toLowerCase();
list = list.filter(n =>
(n.metadata?.name || n.name || n.collection_name || “”).toLowerCase().includes(q) ||
String(n.token_id).includes(q)
);
}
switch (sort) {
case “token_id_desc”:  list.sort((a, b) => Number(b.token_id) - Number(a.token_id)); break;
case “price_asc”:      list.sort((a, b) => Number(a.listing?.price || 0) - Number(b.listing?.price || 0)); break;
case “price_desc”:     list.sort((a, b) => Number(b.listing?.price || 0) - Number(a.listing?.price || 0)); break;
case “listed_first”:   list.sort((a, b) => (b.listing ? 1 : 0) - (a.listing ? 1 : 0)); break;
case “unlisted_first”: list.sort((a, b) => (a.listing ? 1 : 0) - (b.listing ? 1 : 0)); break;
default:               list.sort((a, b) => Number(a.token_id) - Number(b.token_id)); break;
}
return list;
}, [ownedNFTs, tab, search, sort]);

const listedCount   = ownedNFTs.filter(n => !!n.listing).length;
const unlistedCount = ownedNFTs.filter(n => !n.listing).length;

const gridClass = useMemo(() => {
if (view === “list”)   return “space-y-2”;
if (view === “single”) return “grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-sm”;
return “grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4”;
}, [view]);

if (!isConnected) {
return (
<div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 fade-up">
<div className=“w-20 h-20 rounded-full flex items-center justify-center”
style={{ background: “rgba(255,255,255,0.04)” }}>
<Wallet size={40} style={{ color: “#9da7b3” }} />
</div>
<div className="text-center">
<h1 className=“text-2xl font-extrabold mb-1” style={{ color: “#e6edf3” }}>Connect Wallet</h1>
<p className=“text-sm” style={{ color: “#9da7b3” }}>Connect to view your NFTs on Tempo Chain.</p>
</div>
</div>
);
}

return (
<div className="px-4 sm:px-6 py-8 max-w-7xl mx-auto fade-up">

```
  {/* Header */}
  <div className="flex flex-col gap-4 mb-6">
    <div className="flex items-end justify-between">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Briefcase size={14} style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Portfolio</span>
        </div>
        <h1 className="text-3xl font-extrabold uppercase" style={{ color: "#e6edf3" }}>My NFTs</h1>
        <p className="mt-1 text-xs font-mono truncate max-w-xs" style={{ color: "#9da7b3" }}>{address}</p>
      </div>
      {/* Live indicator */}
      <div className="flex items-center gap-1.5 self-start mt-2">
        <div className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: liveFlash ? "#22C55E" : "#22d3ee",
            boxShadow: liveFlash ? "0 0 8px #22C55E" : "none",
            transition: "all 0.3s" }} />
        <span className="text-[10px]" style={{ color: "#9da7b3" }}>Live</span>
      </div>
    </div>

    <Toolbar
      view={view} onView={setView}
      onRefresh={fetchPortfolio} loading={loading || metaLoading}
      search={search} onSearch={setSearch}
      sort={sort} onSort={setSort}
    />
  </div>

  {/* Stats */}
  {!loading && ownedNFTs.length > 0 && (
    <div className="grid grid-cols-3 gap-3 mb-5">
      {[
        { label: "Total NFTs", value: ownedNFTs.length },
        { label: "Listed",     value: listedCount,  color: "#22d3ee" },
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
    <div className="flex items-center gap-1.5 mb-5 flex-wrap">
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
        <span className="ml-2 flex items-center gap-1.5 text-xs" style={{ color: "#9da7b3" }}>
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
    <div className={gridClass}>
      {filtered.map((nft, idx) => (
        <NFTCard
          key={`${nft.contract_address}-${nft.token_id}-${idx}`}
          nft={nft} view={view}
          onList={nft => setListModal({
            tokenId:    nft.token_id,
            contract:   nft.contract_address,
            name:       nft.metadata?.name  || nft.name  || `#${nft.token_id}`,
            image:      nft.metadata?.image || nft.image || null,
            attributes: nft.metadata?.attributes || [],
            collection: nft.collection_name,
            slug:       nft.collection_slug,
          })}
          onDelist={nft => setDelistModal({
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
```

);
}
