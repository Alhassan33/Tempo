import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2, ExternalLink, Twitter, Globe, MessageCircle,
  TrendingDown, TrendingUp, Square, Grid2X2, List as ListIcon,
  BarChart2, ChevronDown, ChevronUp, SlidersHorizontal, X, Users, Search,
  AlertCircle
} from "lucide-react";
import { useCollection, useRealtimeListings, useCollectionStats } from "@/hooks/useSupabase";
import { supabase } from "@/lib/supabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import BuyModal from "@/components/BuyModal.jsx";

const TABS      = ["Items", "Listings", "Activity", "Analytics", "Owners"];
const EXPLORER  = "https://explore.tempo.xyz";
const PAGE_SIZE = 50;
const VIEW      = { SINGLE: "single", GRID: "grid", LIST: "list" };
const CYCLE     = [VIEW.GRID, VIEW.LIST, VIEW.SINGLE];
const VIEW_LABEL = { [VIEW.SINGLE]: "Single", [VIEW.GRID]: "Grid", [VIEW.LIST]: "List" };
const VIEW_ICON  = { [VIEW.SINGLE]: Square, [VIEW.GRID]: Grid2X2, [VIEW.LIST]: ListIcon };
const MARKETPLACE_LOWER = "0x218ab916fe8d7a1ca87d7cd5dfb1d44684ab926b";
const ZERO_ADDR         = "0x0000000000000000000000000000000000000000";

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4" style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="text-[10px] font-medium uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>{label}</div>
    <div className="flex items-baseline gap-2">
      <div className="font-mono text-lg font-bold" style={{ color: "#EDEDED" }}>{value}</div>
      {subValue && (
        <div className={`text-[11px] font-medium flex items-center gap-0.5 ${isTrend ? (subValue.includes('-') ? 'text-red-400' : 'text-green-400') : ''}`}
          style={!isTrend ? { color: "#9CA3AF" } : {}}>
          {isTrend && (subValue.includes('-') ? <TrendingDown size={11} /> : <TrendingUp size={11} />)}
          {subValue}
        </div>
      )}
    </div>
  </div>
);

// ─── View toggle ──────────────────────────────────────────────────────────────
function ViewToggle({ current, onChange }) {
  const Icon = VIEW_ICON[current] || Grid2X2;
  return (
    <button onClick={() => { const idx = CYCLE.indexOf(current); onChange(CYCLE[(idx + 1) % CYCLE.length]); }}
      className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold"
      style={{ background: "rgba(0,230,168,0.08)", color: "#00E6A8", border: "1px solid rgba(0,230,168,0.2)", cursor: "pointer" }}>
      <Icon size={14} /> {VIEW_LABEL[current]}
    </button>
  );
}

// ─── Trait Filter ─────────────────────────────────────────────────────────────
function TraitFilter({ traits, selected, onChange, onClear }) {
  const [open, setOpen] = useState({});
  const keys = useMemo(() => Object.keys(traits || {}), [traits]);
  const safeSelected = selected || {};
  const totalSelected = Object.values(safeSelected).flat().length;

  if (!keys.length) return (
    <div className="w-52 flex-shrink-0 rounded-2xl p-4 text-center"
      style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}>
      <p className="text-xs" style={{ color: "#6B7280" }}>Traits load as items are browsed</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-2 w-52 flex-shrink-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#9CA3AF" }}>Traits</span>
        {totalSelected > 0 && (
          <button onClick={onClear} className="flex items-center gap-1 text-xs"
            style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer" }}>
            <X size={11} /> Clear
          </button>
        )}
      </div>
      {keys.map(trait => {
        const isOpen       = open[trait] ?? false;
        const values       = traits[trait] ?? [];
        const selectedVals = safeSelected[trait] ?? [];
        return (
          <div key={trait} className="rounded-xl overflow-hidden"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
            <button className="w-full flex items-center justify-between px-3 py-2.5 text-xs font-semibold"
              style={{ color: "#e6edf3", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => setOpen(p => ({ ...p, [trait]: !p[trait] }))}>
              <span className="truncate mr-2">{trait}</span>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {selectedVals.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                    style={{ background: "rgba(0,230,168,0.12)", color: "#00E6A8" }}>
                    {selectedVals.length}
                  </span>
                )}
                {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </div>
            </button>
            {isOpen && (
              <div className="px-3 pb-3 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                {values.map(({ value, count }) => {
                  const checked = selectedVals.includes(value);
                  return (
                    <label key={value} className="flex items-center gap-2 cursor-pointer text-xs">
                      <input type="checkbox" checked={checked}
                        onChange={() => {
                          const next = checked ? selectedVals.filter(v => v !== value) : [...selectedVals, value];
                          onChange({ ...safeSelected, [trait]: next });
                        }}
                        style={{ accentColor: "#00E6A8" }} />
                      <span className="flex-1 truncate" style={{ color: "#e6edf3" }}>{value}</span>
                      <span className="flex-shrink-0 text-[10px]" style={{ color: "#9CA3AF" }}>{count}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Item Card (unlisted only — no buy button) ────────────────────────────────
function ItemCard({ token, slug, viewMode }) {
  const navigate = useNavigate();
  const tokenId  = token.tokenId || token.token_id;
  const name     = token.name || `#${tokenId}`;
  const imgSrc   = token.image || "";

  if (viewMode === VIEW.LIST) {
    return (
      <div onClick={() => navigate(`/collection/${slug}/${tokenId}`)}
        className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all"
        style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,230,168,0.2)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}>
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "#161d28" }}>
          {imgSrc ? <img src={imgSrc} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />
            : <div className="w-full h-full animate-pulse" style={{ background: "#1a2232" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: "#EDEDED" }}>{name}</div>
          <div className="text-[10px]" style={{ color: "#6B7280" }}>#{tokenId} · Not listed</div>
        </div>
      </div>
    );
  }

  return (
    <div onClick={() => navigate(`/collection/${slug}/${tokenId}`)}
      className="group rounded-2xl overflow-hidden cursor-pointer"
      style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)", transition: "all 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      <div className="aspect-square overflow-hidden" style={{ background: "#161d28" }}>
        {imgSrc
          ? <img src={imgSrc} alt={name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={e => { e.target.style.display = "none"; }} />
          : <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} />
            </div>}
      </div>
      <div className="p-3">
        <div className="text-sm font-bold truncate mb-1" style={{ color: "#EDEDED" }}>{name}</div>
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "#6B7280" }}>Not listed</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#6B7280" }}>#{tokenId}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Listing Card (with buy button) ──────────────────────────────────────────
function ListingCard({ listing, slug, viewMode, onBuy }) {
  const navigate     = useNavigate();
  const displayPrice = (Number(listing.price) / 1e6).toFixed(2);
  const tokenId      = listing.token_id;
  const name         = listing.name || `#${tokenId}`;
  const imgSrc       = listing.image || "";

  if (viewMode === VIEW.LIST) {
    return (
      <div className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all"
        style={{ background: "#11161D", border: "1px solid rgba(0,230,168,0.2)" }}
        onClick={() => navigate(`/collection/${slug}/${tokenId}`)}>
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "#161d28" }}>
          {imgSrc ? <img src={imgSrc} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full animate-pulse" style={{ background: "#1a2232" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold truncate" style={{ color: "#EDEDED" }}>{name}</div>
          <div className="text-[10px]" style={{ color: "#6B7280" }}>#{tokenId}</div>
        </div>
        <div className="font-mono text-sm font-bold flex-shrink-0" style={{ color: "#00E6A8" }}>{displayPrice} USD</div>
        <button onClick={e => { e.stopPropagation(); onBuy(listing); }}
          className="px-4 py-2 rounded-xl text-xs font-bold flex-shrink-0"
          style={{ background: "#00E6A8", color: "#0A0F14", border: "none", cursor: "pointer" }}>
          Buy
        </button>
      </div>
    );
  }

  return (
    <div className="nft-card group rounded-2xl overflow-hidden cursor-pointer relative"
      style={{ background: "#11161D", border: "1px solid rgba(0,230,168,0.2)", transition: "all 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,230,168,0.5)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(0,230,168,0.2)"; e.currentTarget.style.transform = "translateY(0)"; }}
      onClick={() => navigate(`/collection/${slug}/${tokenId}`)}>
      <div className="relative aspect-square overflow-hidden" style={{ background: "#161d28" }}>
        {imgSrc
          ? <img src={imgSrc} alt={name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={e => { e.target.style.display = "none"; }} />
          : <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} />
            </div>}
        <button
          className="buy-slide absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-3 font-bold text-sm"
          style={{ background: "linear-gradient(to top, rgba(0,230,168,0.97), rgba(0,230,168,0.85))", color: "#0A0F14", transform: "translateY(100%)", transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)", border: "none", cursor: "pointer" }}
          onClick={e => { e.stopPropagation(); onBuy(listing); }}>
          Buy — {displayPrice} USD
        </button>
      </div>
      <div className="p-3">
        <div className="text-sm font-bold truncate mb-1" style={{ color: "#EDEDED" }}>{name}</div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-bold" style={{ color: "#00E6A8" }}>{displayPrice} USD</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#6B7280" }}>#{tokenId}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Owners Tab — reads directly from nfts table ──────────────────────────────
function OwnersTab({ contractAddress, totalSupply }) {
  const [owners,    setOwners]    = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState(null);
  const [sortAsc,   setSortAsc]   = useState(false);
  const [search,    setSearch]    = useState("");

  useEffect(() => {
    if (!contractAddress) return;
    setLoading(true);
    setError(null);

    async function load() {
      try {
        // Paginate through ALL nft rows for this contract (Supabase default limit is 1000)
        let allRows = [];
        let from = 0;
        const batchSize = 1000;

        while (true) {
          const { data, error: dbErr } = await supabase
            .from("nfts")
            .select("owner_address, token_id")
            .eq("contract_address", contractAddress.toLowerCase())
            .range(from, from + batchSize - 1);

          if (dbErr) throw dbErr;
          if (!data || data.length === 0) break;
          allRows = [...allRows, ...data];
          if (data.length < batchSize) break;
          from += batchSize;
        }

        // Count per owner — exclude burn + marketplace addresses
        const map = {};
        allRows.forEach(n => {
          const addr = n.owner_address?.toLowerCase();
          if (!addr) return;
          if (addr === ZERO_ADDR) return;
          if (addr === MARKETPLACE_LOWER) return;
          map[addr] = (map[addr] || 0) + 1;
        });

        const result = Object.entries(map)
          .map(([address, count]) => ({ address, count }))
          .sort((a, b) => b.count - a.count);

        setOwners(result);
      } catch (e) {
        console.error("[OwnersTab]", e);
        setError(e.message || "Failed to load owners");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [contractAddress]);

  const filteredSorted = useMemo(() => {
    let list = sortAsc ? [...owners].sort((a, b) => a.count - b.count) : owners;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(o => o.address.toLowerCase().includes(q));
    }
    return list;
  }, [owners, sortAsc, search]);

  const topHolder    = owners[0]?.count || 0;
  const totalIndexed = owners.reduce((s, o) => s + o.count, 0);

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-7 h-7 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} />
      <span className="text-sm" style={{ color: "#9CA3AF" }}>Loading owners from Supabase...</span>
    </div>
  );

  if (error) return (
    <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
      style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
      <AlertCircle size={14} /> {error}
    </div>
  );

  if (!owners.length) return (
    <div className="py-24 text-center rounded-3xl" style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
      <Users size={32} className="mx-auto mb-3" style={{ color: "rgba(0,230,168,0.3)" }} />
      <div className="font-bold mb-1" style={{ color: "#EDEDED" }}>No ownership data yet</div>
      <p className="text-sm" style={{ color: "#9CA3AF" }}>
        The indexer hasn't synced NFT ownership for this collection yet.
      </p>
    </div>
  );

  return (
    <div>
      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: "Unique Owners",  value: owners.length.toLocaleString() },
          { label: "NFTs Indexed",   value: totalIndexed.toLocaleString() },
          { label: "Top Holder",     value: `${topHolder} NFTs` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl p-3 text-center"
            style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "#9CA3AF" }}>{label}</div>
            <div className="font-mono font-bold text-base" style={{ color: "#EDEDED" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" size={12} style={{ color: "#9CA3AF" }} />
          <input type="text" placeholder="Search address..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="h-9 w-full pl-8 pr-3 rounded-xl text-xs outline-none"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
            onFocus={e => e.target.style.borderColor = "#00E6A8"}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
        </div>
        <button onClick={() => setSortAsc(s => !s)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.04)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
          Holdings {sortAsc ? "↑ Asc" : "↓ Desc"}
        </button>
        <span className="text-xs ml-auto" style={{ color: "#6B7280" }}>
          {filteredSorted.length} of {owners.length} owners
        </span>
      </div>

      {/* Owner list */}
      <div className="space-y-2">
        {filteredSorted.map((owner, i) => {
          const pct = topHolder > 0 ? (owner.count / topHolder) * 100 : 0;
          const supplyPct = totalSupply > 0 ? ((owner.count / totalSupply) * 100).toFixed(2) : null;
          return (
            <div key={owner.address} className="flex items-center gap-3 p-3 rounded-xl group"
              style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.05)"; }}>
              {/* Rank */}
              <span className="text-xs font-mono w-7 text-center flex-shrink-0 font-bold"
                style={{ color: i === 0 ? "#f59e0b" : i === 1 ? "#9CA3AF" : i === 2 ? "#cd7f32" : "#6B7280" }}>
                {i + 1}
              </span>
              {/* Address */}
              <a href={`${EXPLORER}/address/${owner.address}`} target="_blank" rel="noreferrer"
                className="flex-1 font-mono text-sm truncate"
                style={{ color: "#22d3ee" }}
                onClick={e => e.stopPropagation()}>
                {owner.address.slice(0, 6)}…{owner.address.slice(-6)}
              </a>
              {/* Supply % */}
              {supplyPct && (
                <span className="text-[10px] flex-shrink-0" style={{ color: "#9CA3AF" }}>
                  {supplyPct}%
                </span>
              )}
              {/* Count */}
              <span className="font-mono text-sm font-bold flex-shrink-0" style={{ color: "#EDEDED" }}>
                {owner.count}
                <span className="text-[10px] font-normal ml-1" style={{ color: "#9CA3AF" }}>NFTs</span>
              </span>
              {/* Bar */}
              <div className="w-20 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: i === 0 ? "#f59e0b" : "#00E6A8" }} />
              </div>
            </div>
          );
        })}
      </div>

      {totalSupply > 0 && totalIndexed < totalSupply && (
        <p className="text-xs mt-4 text-center" style={{ color: "#6B7280" }}>
          {totalIndexed.toLocaleString()} of {totalSupply.toLocaleString()} NFTs indexed · sync runs every minute
        </p>
      )}
    </div>
  );
}
// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CollectionPage() {
  const { id } = useParams();
  const [viewMode,         setViewMode]         = useState(VIEW.GRID);
  const [tab,              setTab]              = useState("Items");
  const [buyModal,         setBuyModal]         = useState(null);
  const [liveFlash,        setLiveFlash]        = useState(false);
  const [traitSelected,    setTraitSelected]    = useState({});
  const [showFilter,       setShowFilter]       = useState(false);
  const [search,           setSearch]           = useState("");
  const [priceSort,        setPriceSort]        = useState("asc");
  const [collectionTraits, setCollectionTraits] = useState({});
  const traitAccumRef = useRef({});

  const { collection, isLoading: colLoading } = useCollection(id);
  const { stats: rpcStats } = useCollectionStats(collection?.contract_address || "");
  const contractAddr = collection?.contract_address?.toLowerCase();
  const { listings, isLoading: listingsLoading } = useRealtimeListings(contractAddr);

  const activeListings = useMemo(() =>
    (listings || []).filter(l => l.active).sort((a, b) =>
      priceSort === "asc" ? Number(a.price) - Number(b.price) : Number(b.price) - Number(a.price)
    ),
  [listings, priceSort]);

  // ✅ Listed token IDs — used to EXCLUDE from Items tab
  const listedIds = useMemo(() => new Set(activeListings.map(l => String(l.token_id))), [activeListings]);

  const [listedTokensWithImages, setListedTokensWithImages] = useState([]);
  const [unlistedTokens,  setUnlistedTokens]  = useState([]);
  const [tokensLoading,   setTokensLoading]   = useState(false);
  const [page,            setPage]            = useState(1);
  const [hasMore,         setHasMore]         = useState(true);
  const loaderRef = useRef(null);

  // Realtime flash
  useEffect(() => {
    if (!contractAddr) return;
    const ch = supabase
      .channel(`col-live:${contractAddr}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "listings", filter: `nft_contract=eq.${contractAddr}` },
        () => { setLiveFlash(true); setTimeout(() => setLiveFlash(false), 1500); })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [contractAddr]);

  const stats = useMemo(() => {
    const supply     = rpcStats.totalSupply  || collection?.total_supply || 0;
    const floorRaw   = rpcStats.floorPrice   || collection?.floor_price  || 0;
    const owners     = rpcStats.uniqueOwners || collection?.owners       || 0;
    const listed     = rpcStats.listedCount  || activeListings.length;
    const royaltyBps = collection?.royalty_bps ?? 0;
    const floorDisplay = floorRaw > 0 ? (Number(floorRaw) / 1e6).toFixed(2) : null;
    return {
      floor:     floorDisplay ? `${floorDisplay} USD` : "—",
      topOffer:  collection?.top_offer    ? `${(Number(collection.top_offer)    / 1e6).toFixed(2)} USD` : "—",
      vol24h:    collection?.volume_24h   ? `${(Number(collection.volume_24h)   / 1e6).toFixed(2)} USD` : "0 USD",
      totalVol:  collection?.volume_total ? `${(Number(collection.volume_total) / 1e6).toFixed(2)} USD` : "0 USD",
      mktCap:    floorDisplay && supply   ? `${((Number(floorRaw) / 1e6) * supply).toLocaleString()} USD` : "—",
      owners, ownerPct: supply && owners  ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed, listedPct: supply           ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply: supply?.toLocaleString()    || "0",
      royalties: royaltyBps               ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
      totalSupplyRaw: supply,
    };
  }, [collection, activeListings, rpcStats]);

  const ipfsBase = useMemo(() => {
    if (!collection?.metadata_base_uri) return null;
    let base = collection.metadata_base_uri;
    if (base.startsWith("ipfs://")) base = base.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
    if (!base.endsWith("/")) base += "/";
    return base;
  }, [collection?.metadata_base_uri]);

  // Fetch listed tokens from IPFS — authoritative name + image
  useEffect(() => {
    if (!ipfsBase || !activeListings.length) { setListedTokensWithImages([]); return; }
    let cancelled = false;
    Promise.all(activeListings.map(async listing => {
      try {
        const res  = await fetch(`${ipfsBase}${listing.token_id}.json`, { cache: "force-cache" });
        const json = await res.json();
        return { ...listing, tokenId: String(listing.token_id), name: json.name || `#${listing.token_id}`, image: extractImageUrl(json) || "" };
      } catch {
        return { ...listing, tokenId: String(listing.token_id), name: listing.name || `#${listing.token_id}`, image: listing.image || "" };
      }
    })).then(r => { if (!cancelled) setListedTokensWithImages(r); });
    return () => { cancelled = true; };
  }, [activeListings, ipfsBase]);

  // Fetch unlisted tokens — skip any that are in listedIds
  const fetchPage = useCallback(async (pageNum) => {
    if (!ipfsBase) return;
    const supply = rpcStats.totalSupply || collection?.total_supply || 2000;
    const start  = (pageNum - 1) * PAGE_SIZE + 1;
    const end    = Math.min(start + PAGE_SIZE - 1, supply);
    if (start > supply) { setHasMore(false); return; }
    setTokensLoading(true);

    const results = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, i) => start + i).map(async tokenId => {
        // ✅ Skip listed tokens — they show in Listings tab only
        if (listedIds.has(String(tokenId))) return null;
        try {
          const res  = await fetch(`${ipfsBase}${tokenId}.json`, { cache: "force-cache" });
          const json = await res.json();
          const image = extractImageUrl(json);
          const attrs = json.attributes || [];

          attrs.forEach(a => {
            if (!a.trait_type || a.value === undefined) return;
            const t = a.trait_type;
            const v = String(a.value);
            if (!traitAccumRef.current[t]) traitAccumRef.current[t] = {};
            traitAccumRef.current[t][v] = (traitAccumRef.current[t][v] || 0) + 1;
          });

          return { tokenId: String(tokenId), token_id: tokenId, name: json.name || `#${tokenId}`, image, attributes: attrs };
        } catch {
          return { tokenId: String(tokenId), token_id: tokenId, name: `#${tokenId}`, image: "", attributes: [] };
        }
      })
    );

    const traitArr = {};
    Object.entries(traitAccumRef.current).forEach(([trait, vals]) => {
      traitArr[trait] = Object.entries(vals).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
    });
    setCollectionTraits(traitArr);

    setUnlistedTokens(prev => pageNum === 1 ? results.filter(Boolean) : [...prev, ...results.filter(Boolean)]);
    setHasMore(end < supply);
    setTokensLoading(false);
  }, [ipfsBase, collection, listedIds, rpcStats.totalSupply]);

  useEffect(() => {
    if (ipfsBase) { setUnlistedTokens([]); setPage(1); setHasMore(true); traitAccumRef.current = {}; setCollectionTraits({}); fetchPage(1); }
  }, [ipfsBase, fetchPage]);

  const listedCount = listedIds.size;
  useEffect(() => {
    if (ipfsBase && listedCount >= 0) { setUnlistedTokens([]); setPage(1); setHasMore(true); fetchPage(1); }
  }, [listedCount]);

  useEffect(() => { if (page > 1) fetchPage(page); }, [page, fetchPage]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const obs = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !tokensLoading && tab === "Items") setPage(p => p + 1);
    }, { rootMargin: "200px" });
    obs.observe(loaderRef.current);
    return () => obs.disconnect();
  }, [hasMore, tokensLoading, tab]);

  // ✅ Items tab = UNLISTED only, filtered by search + traits
  const filteredItems = useMemo(() => {
    const safeSelected = traitSelected || {};
    const hasFilter = Object.values(safeSelected).some(v => v?.length > 0);
    const hasSearch = search.trim().length > 0;
    if (!hasFilter && !hasSearch) return unlistedTokens;
    return unlistedTokens.filter(token => {
      if (hasSearch) {
        const q = search.toLowerCase();
        if (!(token.name || "").toLowerCase().includes(q) && !String(token.token_id).includes(q)) return false;
      }
      if (hasFilter) {
        return Object.entries(safeSelected).every(([trait, vals]) => {
          if (!vals?.length) return true;
          return (token.attributes || []).some(a => a.trait_type === trait && vals.includes(String(a.value)));
        });
      }
      return true;
    });
  }, [unlistedTokens, traitSelected, search]);

  // ✅ Listings tab = active listings only, filtered by search
  const filteredListings = useMemo(() => {
    if (!search.trim()) return listedTokensWithImages;
    const q = search.toLowerCase();
    return listedTokensWithImages.filter(t => (t.name || "").toLowerCase().includes(q) || String(t.token_id).includes(q));
  }, [listedTokensWithImages, search]);

  const gridClass = useMemo(() => {
    if (viewMode === VIEW.LIST)   return "flex flex-col gap-2";
    if (viewMode === VIEW.SINGLE) return "grid grid-cols-1 gap-4 max-w-xs mx-auto";
    return "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4";
  }, [viewMode]);

  if (colLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} />
    </div>
  );

  const showSidebar = tab === "Items" && showFilter;

  return (
    <>
      <style>{`.nft-card:hover .buy-slide { transform: translateY(0) !important; }`}</style>
      <div className="fade-up min-h-screen pb-20" style={{ background: "#0A0F14" }}>

        {/* Banner */}
        <div className="relative h-56 w-full overflow-hidden">
          {collection?.banner_url
            ? <img src={collection.banner_url} className="w-full h-full object-cover opacity-60" alt="Banner" />
            : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} />}
          <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #0A0F14)" }} />
        </div>

        <div className="px-4 sm:px-6 max-w-7xl mx-auto -mt-16 relative z-10">

          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end gap-5 mb-8">
            <div className="w-28 h-28 rounded-3xl overflow-hidden flex-shrink-0"
              style={{ border: "4px solid #0A0F14", background: "#11161D" }}>
              <NFTImage src={collection?.logo_url} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-3xl font-bold tracking-tight" style={{ color: "#EDEDED" }}>{collection?.name}</h1>
                {collection?.verified && <CheckCircle2 size={22} style={{ color: "#00E6A8" }} />}
              </div>
              <div className="flex items-center flex-wrap gap-x-4 gap-y-1 mb-2">
                <span className="text-sm font-medium" style={{ color: "#00E6A8" }}>By {collection?.creator_name || "Tempo Creator"}</span>
                <div className="flex items-center gap-3" style={{ color: "#9CA3AF" }}>
                  {collection?.twitter_url && <a href={collection.twitter_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs hover:text-white"><Twitter size={15} /><span className="hidden sm:inline">X</span></a>}
                  {collection?.discord_url && <a href={collection.discord_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs hover:text-white"><MessageCircle size={15} /><span className="hidden sm:inline">Discord</span></a>}
                  {collection?.website_url && <a href={collection.website_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs hover:text-white"><Globe size={15} /><span className="hidden sm:inline">Website</span></a>}
                  <a href={`${EXPLORER}/address/${collection?.contract_address}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs hover:text-white"><ExternalLink size={15} /><span className="hidden sm:inline">Explorer</span></a>
                </div>
              </div>
              {collection?.description && <p className="text-sm line-clamp-2" style={{ color: "#9CA3AF" }}>{collection.description}</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
            <StatItem label="Floor Price"  value={stats.floor} />
            <StatItem label="Top Offer"    value={stats.topOffer} />
            <StatItem label="24H Volume"   value={stats.vol24h} />
            <StatItem label="Total Volume" value={stats.totalVol} />
            <StatItem label="Market Cap"   value={stats.mktCap} />
            <StatItem label="Owners"       value={stats.owners}  subValue={stats.ownerPct} />
            <StatItem label="Listed"       value={stats.listed}  subValue={stats.listedPct} />
            <StatItem label="Supply"       value={stats.supply} />
            <StatItem label="Royalties"    value={stats.royalties} />
          </div>

          {/* ── TABS row only ── */}
          <div className="border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex gap-0 overflow-x-auto">
              {TABS.map(t => (
                <button key={t} onClick={() => { setTab(t); setSearch(""); }}
                  className="flex items-center gap-1.5 px-4 pb-4 text-sm font-medium uppercase tracking-widest whitespace-nowrap"
                  style={{ background: "none", border: "none", borderBottom: tab === t ? "2px solid #00E6A8" : "2px solid transparent", color: tab === t ? "#00E6A8" : "#9CA3AF", cursor: "pointer" }}>
                  {t === "Analytics" && <BarChart2 size={13} />}
                  {t === "Owners"    && <Users size={13} />}
                  {t}
                  {t === "Listings" && activeListings.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md ml-0.5"
                      style={{ background: "rgba(0,230,168,0.12)", color: "#00E6A8" }}>
                      {activeListings.length}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* ── TOOLBAR row — separate from tabs ── */}
          {(tab === "Items" || tab === "Listings") && (
            <div className="flex items-center gap-2 py-4 flex-wrap">
              {/* Live dot */}
              <div className="flex items-center gap-1.5 mr-1 flex-shrink-0">
                <div className="w-2 h-2 rounded-full animate-pulse"
                  style={{ background: liveFlash ? "#22C55E" : "#00E6A8", boxShadow: liveFlash ? "0 0 6px #22C55E" : "none", transition: "all 0.3s" }} />
                <span className="text-[10px] font-medium" style={{ color: "#9CA3AF" }}>Live</span>
              </div>

              {/* Search */}
              <div className="relative flex-1 min-w-[160px] max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" size={13} style={{ color: "#9CA3AF" }} />
                <input type="text" placeholder={tab === "Listings" ? "Search listings..." : "Search items..."}
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="h-9 w-full pl-8 pr-3 rounded-xl text-xs outline-none"
                  style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
                  onFocus={e => e.target.style.borderColor = "#00E6A8"}
                  onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
              </div>

              {/* Trait filter toggle — Items only */}
              {tab === "Items" && (
                <button onClick={() => setShowFilter(f => !f)}
                  className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold flex-shrink-0"
                  style={{ background: showFilter ? "rgba(0,230,168,0.1)" : "#161d28", color: showFilter ? "#00E6A8" : "#9CA3AF", border: showFilter ? "1px solid rgba(0,230,168,0.3)" : "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                  <SlidersHorizontal size={13} />
                  Filter
                  {Object.values(traitSelected || {}).flat().length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md ml-1"
                      style={{ background: "#00E6A8", color: "#0A0F14" }}>
                      {Object.values(traitSelected).flat().length}
                    </span>
                  )}
                </button>
              )}

              {/* Price sort — Listings only */}
              {tab === "Listings" && (
                <button onClick={() => setPriceSort(s => s === "asc" ? "desc" : "asc")}
                  className="flex items-center gap-1 px-3 h-9 rounded-xl text-xs font-semibold flex-shrink-0"
                  style={{ background: "#161d28", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                  Price {priceSort === "asc" ? "↑" : "↓"}
                </button>
              )}

              {/* View toggle — far right */}
              <div className="ml-auto flex-shrink-0">
                <ViewToggle current={viewMode} onChange={setViewMode} />
              </div>
            </div>
          )}

          {/* ── Content ── */}
          <div className={showSidebar ? "flex gap-6" : ""}>

            {showSidebar && (
              <TraitFilter
                traits={collectionTraits}
                selected={traitSelected}
                onChange={setTraitSelected}
                onClear={() => setTraitSelected({})}
              />
            )}

            <div className="flex-1 min-w-0">

              {/* Items — unlisted only */}
              {tab === "Items" && (
                <>
                  {filteredItems.length === 0 && !tokensLoading ? (
                    <div className="py-16 text-center" style={{ color: "#9CA3AF" }}>
                      {search ? "No items match your search." : "All items in this collection are listed for sale."}
                    </div>
                  ) : (
                    <div className={gridClass}>
                      {filteredItems.map(token => (
                        <ItemCard key={`item-${token.tokenId}`} token={token} slug={id} viewMode={viewMode} />
                      ))}
                      {tokensLoading && Array(8).fill(0).map((_, i) => <CardSkeleton key={`sk-${i}`} />)}
                    </div>
                  )}
                  <div ref={loaderRef} className="h-10" />
                  {!hasMore && filteredItems.length > 0 && (
                    <div className="text-center py-8 text-sm" style={{ color: "#9CA3AF" }}>
                      {filteredItems.length} unlisted items
                    </div>
                  )}
                </>
              )}

              {/* Listings — active listed only */}
              {tab === "Listings" && (
                <>
                  {listingsLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} />
                    </div>
                  ) : filteredListings.length === 0 ? (
                    <div className="py-24 text-center rounded-3xl" style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
                      <div className="text-4xl mb-3">🏷️</div>
                      <div className="font-bold mb-1" style={{ color: "#EDEDED" }}>No active listings</div>
                      <p className="text-sm" style={{ color: "#9CA3AF" }}>Be the first to list an NFT from this collection.</p>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm mb-4" style={{ color: "#9CA3AF" }}>
                        <span className="font-bold" style={{ color: "#EDEDED" }}>{filteredListings.length}</span> listing{filteredListings.length !== 1 ? "s" : ""} · {priceSort === "asc" ? "cheapest first" : "most expensive first"}
                      </p>
                      <div className={gridClass}>
                        {filteredListings.map(listing => (
                          <ListingCard key={listing.listing_id} listing={listing} slug={id} viewMode={viewMode} onBuy={setBuyModal} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {tab === "Activity"  && <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />}
              {tab === "Analytics" && <div className="space-y-6"><PriceChart nftContract={contractAddr} /></div>}
              {tab === "Owners"    && <OwnersTab contractAddress={contractAddr} totalSupply={stats.totalSupplyRaw} />}
            </div>
          </div>
        </div>
      </div>

      {buyModal && (
        <BuyModal
          listing={buyModal}
          onClose={() => setBuyModal(null)}
          onSuccess={() => {
            setListedTokensWithImages(prev => prev.filter(t => t.listing_id !== buyModal.listing_id));
            setBuyModal(null);
          }}
        />
      )}
    </>
  );
}
