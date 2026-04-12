import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  CheckCircle2, ExternalLink, Twitter, Globe, MessageCircle,
  TrendingDown, TrendingUp, Square, Grid2X2, List as ListIcon,
  BarChart2, ChevronDown, ChevronUp, SlidersHorizontal, X, Users
} from "lucide-react";
import { useCollection, useRealtimeListings, useCollectionStats } from "@/hooks/useSupabase";
import { supabase } from "@/lib/supabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import BuyModal from "@/components/BuyModal.jsx";

const TABS       = ["Items", "Listings", "Activity", "Analytics", "Owners"];
const EXPLORER   = "https://explore.tempo.xyz";
const PAGE_SIZE  = 50;
const VIEW       = { SINGLE: "single", GRID: "grid", LIST: "list" };
const CYCLE      = [VIEW.SINGLE, VIEW.GRID, VIEW.LIST];
const VIEW_LABEL = { [VIEW.SINGLE]: "Single", [VIEW.GRID]: "Grid", [VIEW.LIST]: "List" };
const VIEW_ICON  = {
  [VIEW.SINGLE]: Square,
  [VIEW.GRID]:   Grid2X2,
  [VIEW.LIST]:   ListIcon,
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4"
    style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}>
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

// ─── Single cycle toggle button ───────────────────────────────────────────────
function ViewToggle({ current, onChange }) {
  const Icon = VIEW_ICON[current];
  function cycle() {
    const idx  = CYCLE.indexOf(current);
    const next = CYCLE[(idx + 1) % CYCLE.length];
    onChange(next);
  }
  return (
    <button onClick={cycle} title={`View: ${VIEW_LABEL[current]}`}
      className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold transition-all"
      style={{ background: "rgba(0,230,168,0.08)", color: "#00E6A8", border: "1px solid rgba(0,230,168,0.2)", cursor: "pointer" }}>
      <Icon size={14} />
      {VIEW_LABEL[current]}
    </button>
  );
}

// ─── Trait Filter sidebar/panel ───────────────────────────────────────────────
function TraitFilter({ traits, selected, onChange, onClear }) {
  const [open, setOpen] = useState({});
  const keys = Object.keys(traits || {});
  if (!keys.length) return null;

  const totalSelected = Object.values(selected).flat().length;

  return (
    <div className="flex flex-col gap-2 w-56 flex-shrink-0">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "#9CA3AF" }}>Filters</span>
        {totalSelected > 0 && (
          <button onClick={onClear}
            className="flex items-center gap-1 text-xs"
            style={{ color: "#EF4444", background: "none", border: "none", cursor: "pointer" }}>
            <X size={11} /> Clear
          </button>
        )}
      </div>
      {keys.map(trait => {
        const isOpen      = open[trait] ?? false;
        const values      = traits[trait] ?? [];
        const selectedVals = selected[trait] ?? [];
        return (
          <div key={trait} className="rounded-xl overflow-hidden"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
            <button className="w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold"
              style={{ color: "#e6edf3", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => setOpen(p => ({ ...p, [trait]: !p[trait] }))}>
              <span>{trait}</span>
              <div className="flex items-center gap-1.5">
                {selectedVals.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-md"
                    style={{ background: "rgba(0,230,168,0.12)", color: "#00E6A8" }}>
                    {selectedVals.length}
                  </span>
                )}
                {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
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
                          const next = checked
                            ? selectedVals.filter(v => v !== value)
                            : [...selectedVals, value];
                          onChange({ ...selected, [trait]: next });
                        }}
                        style={{ accentColor: "#00E6A8" }} />
                      <span style={{ color: "#e6edf3" }}>{value}</span>
                      <span className="ml-auto" style={{ color: "#9CA3AF" }}>{count}</span>
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

// ─── NFT Card (no buy button — click to open item page) ───────────────────────
function NFTCard({ token, collectionName, slug, listing, viewMode, onBuy }) {
  const navigate     = useNavigate();
  const isListed     = !!listing;
  const displayPrice = listing ? (Number(listing.price) / 1e6).toFixed(2) : null;
  const tokenId      = token.tokenId || token.token_id;
  const imgSrc       = token.image || listing?.image || "";

  function goToItem(e) {
    e.stopPropagation();
    navigate(`/collection/${slug}/${tokenId}`);
  }

  if (viewMode === VIEW.LIST) {
    return (
      <div onClick={goToItem}
        className="flex items-center gap-4 p-3 rounded-xl cursor-pointer transition-all"
        style={{ background: "#11161D", border: isListed ? "1px solid rgba(0,230,168,0.2)" : "1px solid rgba(255,255,255,0.05)" }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,230,168,0.35)"; }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = isListed ? "rgba(0,230,168,0.2)" : "rgba(255,255,255,0.05)"; }}>
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "#161d28" }}>
          {imgSrc
            ? <img src={imgSrc} alt="" className="w-full h-full object-cover" onError={e => { e.target.style.display = "none"; }} />
            : <div className="w-full h-full animate-pulse" style={{ background: "#1a2232" }} />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "#9CA3AF" }}>{collectionName}</div>
          <div className="text-sm font-bold truncate" style={{ color: "#EDEDED" }}>{token.name || `#${tokenId}`}</div>
        </div>
        <div className="text-right flex-shrink-0">
          {isListed
            ? <div className="font-mono text-sm font-bold" style={{ color: "#00E6A8" }}>{displayPrice} USD</div>
            : <span className="text-xs" style={{ color: "#6B7280" }}>Not listed</span>}
        </div>
        <div className="text-xs font-mono px-2 py-1 rounded-lg flex-shrink-0"
          style={{ background: "rgba(255,255,255,0.04)", color: "#6B7280" }}>#{tokenId}</div>
      </div>
    );
  }

  return (
    <div onClick={goToItem}
      className="nft-card group rounded-2xl overflow-hidden cursor-pointer relative"
      style={{ background: "#11161D", border: isListed ? "1px solid rgba(0,230,168,0.2)" : "1px solid rgba(255,255,255,0.05)", transition: "all 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(0,230,168,0.5)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isListed ? "rgba(0,230,168,0.2)" : "rgba(255,255,255,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}>
      <div className="relative aspect-square overflow-hidden" style={{ background: "#161d28" }}>
        {imgSrc
          ? <img src={imgSrc} alt={token.name || `#${tokenId}`}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={e => { e.target.style.display = "none"; }} />
          : <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} />
            </div>}
        {isListed && (
          <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(10,15,20,0.9)", color: "#00E6A8", border: "1px solid rgba(0,230,168,0.4)", backdropFilter: "blur(4px)" }}>
            ● Listed
          </div>
        )}
      </div>
      <div className="p-3">
        <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>{collectionName}</div>
        <div className="text-sm font-bold truncate mb-1" style={{ color: "#EDEDED" }}>{token.name || `#${tokenId}`}</div>
        <div className="flex items-center justify-between">
          {isListed
            ? <span className="font-mono text-sm font-bold" style={{ color: "#00E6A8" }}>{displayPrice} USD</span>
            : <span className="text-xs" style={{ color: "#6B7280" }}>Not listed</span>}
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#6B7280" }}>#{tokenId}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Listings tab card (with buy button) ─────────────────────────────────────
function ListingCard({ listing, collectionName, slug, viewMode, onBuy }) {
  const navigate     = useNavigate();
  const displayPrice = (Number(listing.price) / 1e6).toFixed(2);
  const tokenId      = listing.token_id;
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
          <div className="text-sm font-bold truncate" style={{ color: "#EDEDED" }}>{listing.name || `#${tokenId}`}</div>
          <div className="text-xs" style={{ color: "#9CA3AF" }}>#{tokenId}</div>
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
          ? <img src={imgSrc} alt={listing.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" onError={e => { e.target.style.display = "none"; }} />
          : <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} />
            </div>}
        {/* Buy button slides up on hover */}
        <button
          className="buy-slide absolute bottom-0 left-0 right-0 flex items-center justify-center gap-1.5 py-3 font-bold text-sm"
          style={{ background: "linear-gradient(to top, rgba(0,230,168,0.97), rgba(0,230,168,0.85))", color: "#0A0F14", transform: "translateY(100%)", transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1)", border: "none", cursor: "pointer" }}
          onClick={e => { e.stopPropagation(); onBuy(listing); }}>
          Buy Now — {displayPrice} USD
        </button>
      </div>
      <div className="p-3">
        <div className="text-[9px] uppercase tracking-widest mb-0.5" style={{ color: "#9CA3AF" }}>{collectionName}</div>
        <div className="text-sm font-bold truncate mb-1" style={{ color: "#EDEDED" }}>{listing.name || `#${tokenId}`}</div>
        <div className="flex items-center justify-between">
          <span className="font-mono text-sm font-bold" style={{ color: "#00E6A8" }}>{displayPrice} USD</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.04)", color: "#6B7280" }}>#{tokenId}</span>
        </div>
      </div>
    </div>
  );
}

// ─── Owners Tab ───────────────────────────────────────────────────────────────
function OwnersTab({ contractAddress }) {
  const [owners,  setOwners]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortAsc, setSortAsc] = useState(false);

  useEffect(() => {
    if (!contractAddress) return;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("nfts")
        .select("owner_address, token_id")
        .eq("contract_address", contractAddress.toLowerCase())
        .neq("owner_address", "0x0000000000000000000000000000000000000000")
        .neq("owner_address", "0x218ab916fe8d7a1ca87d7cd5dfb1d44684ab926b");

      // Count per owner
      const map = {};
      (data || []).forEach(n => {
        const addr = n.owner_address?.toLowerCase();
        if (addr) map[addr] = (map[addr] || 0) + 1;
      });

      const sorted = Object.entries(map)
        .map(([address, count]) => ({ address, count }))
        .sort((a, b) => b.count - a.count);

      setOwners(sorted);
      setLoading(false);
    }
    load();
  }, [contractAddress]);

  const sorted = sortAsc ? [...owners].sort((a, b) => a.count - b.count) : owners;

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm" style={{ color: "#9CA3AF" }}>
          <span className="font-bold" style={{ color: "#EDEDED" }}>{owners.length}</span> unique owners
        </span>
        <button onClick={() => setSortAsc(s => !s)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
          style={{ background: "rgba(255,255,255,0.04)", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
          Count {sortAsc ? "↑" : "↓"}
        </button>
      </div>
      <div className="space-y-2">
        {sorted.map((owner, i) => (
          <div key={owner.address} className="flex items-center gap-3 p-3 rounded-xl"
            style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span className="text-xs font-mono w-6 text-center flex-shrink-0" style={{ color: "#6B7280" }}>{sortAsc ? sorted.length - i : i + 1}</span>
            <a href={`${EXPLORER}/address/${owner.address}`} target="_blank" rel="noreferrer"
              className="flex-1 font-mono text-sm truncate hover:underline"
              style={{ color: "#22d3ee" }}>
              {owner.address}
            </a>
            <span className="font-mono text-sm font-bold flex-shrink-0" style={{ color: "#EDEDED" }}>
              {owner.count} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>NFTs</span>
            </span>
            <div className="w-16 h-1.5 rounded-full overflow-hidden flex-shrink-0" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full" style={{ width: `${(owner.count / (sorted[0]?.count || 1)) * 100}%`, background: "#00E6A8" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CollectionPage() {
  const { id } = useParams();
  const [viewMode,      setViewMode]      = useState(VIEW.GRID);
  const [tab,           setTab]           = useState("Items");
  const [buyModal,      setBuyModal]      = useState(null);
  const [liveFlash,     setLiveFlash]     = useState(false);
  const [traitSelected, setTraitSelected] = useState({});
  const [showFilter,    setShowFilter]    = useState(false);
  const [search,        setSearch]        = useState("");
  const [priceSort,     setPriceSort]     = useState("asc"); // asc | desc

  const { collection, isLoading: colLoading } = useCollection(id);
  const { stats: rpcStats }  = useCollectionStats(collection?.contract_address || "");
  const contractAddr = collection?.contract_address?.toLowerCase();
  const { listings, isLoading: listingsLoading } = useRealtimeListings(contractAddr);

  const activeListings = useMemo(() =>
    (listings || []).filter(l => l.active).sort((a, b) =>
      priceSort === "asc" ? Number(a.price) - Number(b.price) : Number(b.price) - Number(a.price)
    ),
  [listings, priceSort]);

  const listedIds = useMemo(() => new Set(activeListings.map(l => String(l.token_id))), [activeListings]);

  const [listedTokensWithImages, setListedTokensWithImages] = useState([]);
  const [unlistedTokens,  setUnlistedTokens]  = useState([]);
  const [tokensLoading,   setTokensLoading]   = useState(false);
  const [page,            setPage]            = useState(1);
  const [hasMore,         setHasMore]         = useState(true);
  const [collectionTraits, setCollectionTraits] = useState({});
  const loaderRef = useRef(null);

  // ✅ Realtime — flash live dot on any listing change
  useEffect(() => {
    if (!contractAddr) return;
    const channel = supabase
      .channel(`col-live:${contractAddr}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "listings",
        filter: `nft_contract=eq.${contractAddr}` }, () => {
        setLiveFlash(true);
        setTimeout(() => setLiveFlash(false), 1500);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
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
      owners, ownerPct: supply && owners ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed, listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply: supply?.toLocaleString() || "0",
      royalties: royaltyBps ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
    };
  }, [collection, activeListings, rpcStats]);

  const ipfsBase = useMemo(() => {
    if (!collection?.metadata_base_uri) return null;
    let base = collection.metadata_base_uri;
    if (base.startsWith("ipfs://")) base = base.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
    if (!base.endsWith("/")) base += "/";
    return base;
  }, [collection?.metadata_base_uri]);

  // Fetch listed tokens with images
  useEffect(() => {
    if (!ipfsBase || !activeListings.length) { setListedTokensWithImages([]); return; }
    let cancelled = false;
    Promise.all(activeListings.map(async listing => {
      if (listing.image || listing.image_url) {
        return { ...listing, tokenId: String(listing.token_id), name: listing.name || `${collection?.name} #${listing.token_id}`, image: listing.image || listing.image_url };
      }
      try {
        const res  = await fetch(`${ipfsBase}${listing.token_id}.json`, { cache: "force-cache" });
        const json = await res.json();
        return { ...listing, tokenId: String(listing.token_id), name: json.name || `${collection?.name} #${listing.token_id}`, image: extractImageUrl(json) };
      } catch {
        return { ...listing, tokenId: String(listing.token_id), name: listing.name || `${collection?.name} #${listing.token_id}`, image: "" };
      }
    })).then(results => { if (!cancelled) setListedTokensWithImages(results); });
    return () => { cancelled = true; };
  }, [activeListings, ipfsBase, collection?.name]);

  const fetchPage = useCallback(async (pageNum) => {
    if (!ipfsBase) return;
    const supply = rpcStats.totalSupply || collection?.total_supply || 2000;
    const start  = (pageNum - 1) * PAGE_SIZE + 1;
    const end    = Math.min(start + PAGE_SIZE - 1, supply);
    if (start > supply) { setHasMore(false); return; }
    setTokensLoading(true);

    const results = await Promise.all(
      Array.from({ length: end - start + 1 }, (_, i) => start + i).map(async tokenId => {
        if (listedIds.has(String(tokenId))) return null;
        try {
          const res  = await fetch(`${ipfsBase}${tokenId}.json`, { cache: "force-cache" });
          const json = await res.json();
          const image = extractImageUrl(json);
          const attrs = json.attributes || [];

          // Build trait map for filter
          attrs.forEach(a => {
            if (!a.trait_type || !a.value) return;
            if (!collectionTraits[a.trait_type]) collectionTraits[a.trait_type] = {};
            const v = String(a.value);
            collectionTraits[a.trait_type][v] = (collectionTraits[a.trait_type][v] || 0) + 1;
          });

          return { tokenId: String(tokenId), token_id: tokenId, name: json.name || `${collection?.name} #${tokenId}`, image, attributes: attrs };
        } catch {
          return { tokenId: String(tokenId), token_id: tokenId, name: `${collection?.name} #${tokenId}`, image: "", attributes: [] };
        }
      })
    );

    // Convert trait map to array format for TraitFilter
    const traitArr = {};
    Object.entries(collectionTraits).forEach(([trait, vals]) => {
      traitArr[trait] = Object.entries(vals).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
    });
    setCollectionTraits(traitArr);

    setUnlistedTokens(prev => pageNum === 1 ? results.filter(Boolean) : [...prev, ...results.filter(Boolean)]);
    setHasMore(end < supply);
    setTokensLoading(false);
  }, [ipfsBase, collection, listedIds, rpcStats.totalSupply]);

  useEffect(() => {
    if (ipfsBase) { setUnlistedTokens([]); setPage(1); setHasMore(true); fetchPage(1); }
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

  // Trait filter for Items tab
  const filteredUnlisted = useMemo(() => {
    const hasFilter = Object.values(traitSelected).some(v => v.length > 0);
    const hasSearch = search.trim().length > 0;
    if (!hasFilter && !hasSearch) return unlistedTokens;
    return unlistedTokens.filter(token => {
      if (hasSearch) {
        const q = search.toLowerCase();
        if (!(token.name || "").toLowerCase().includes(q) && !String(token.token_id).includes(q)) return false;
      }
      if (hasFilter) {
        return Object.entries(traitSelected).every(([trait, vals]) => {
          if (!vals.length) return true;
          return (token.attributes || []).some(a => a.trait_type === trait && vals.includes(String(a.value)));
        });
      }
      return true;
    });
  }, [unlistedTokens, traitSelected, search]);

  const filteredListings = useMemo(() => {
    const hasFilter = Object.values(traitSelected).some(v => v.length > 0);
    const hasSearch = search.trim().length > 0;
    if (!hasFilter && !hasSearch) return listedTokensWithImages;
    return listedTokensWithImages.filter(token => {
      if (hasSearch) {
        const q = search.toLowerCase();
        if (!(token.name || "").toLowerCase().includes(q) && !String(token.token_id).includes(q)) return false;
      }
      return true;
    });
  }, [listedTokensWithImages, traitSelected, search]);

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

  const showSidebar = (tab === "Items" || tab === "Listings") && showFilter;

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
            <StatItem label="Floor Price" value={stats.floor} />
            <StatItem label="Top Offer"   value={stats.topOffer} />
            <StatItem label="24H Volume"  value={stats.vol24h} />
            <StatItem label="Total Volume" value={stats.totalVol} />
            <StatItem label="Market Cap"  value={stats.mktCap} />
            <StatItem label="Owners"      value={stats.owners}  subValue={stats.ownerPct} />
            <StatItem label="Listed"      value={stats.listed}  subValue={stats.listedPct} />
            <StatItem label="Supply"      value={stats.supply} />
            <StatItem label="Royalties"   value={stats.royalties} />
          </div>

          {/* Tabs + toolbar */}
          <div className="border-b mb-6" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
            <div className="flex items-center justify-between">
              {/* Tabs */}
              <div className="flex gap-0 overflow-x-auto">
                {TABS.map(t => (
                  <button key={t} onClick={() => setTab(t)}
                    className="flex items-center gap-1.5 px-4 pb-4 text-sm font-medium uppercase tracking-widest whitespace-nowrap transition-all"
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

              {/* Toolbar — Items + Listings tabs only */}
              {(tab === "Items" || tab === "Listings") && (
                <div className="flex items-center gap-2 pb-3">
                  {/* Live dot */}
                  <div className="flex items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse"
                      style={{ background: liveFlash ? "#22C55E" : "#00E6A8", boxShadow: liveFlash ? "0 0 6px #22C55E" : "none", transition: "all 0.3s" }} />
                    <span className="text-[10px]" style={{ color: "#9CA3AF" }}>Live</span>
                  </div>

                  {/* Search */}
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="h-9 w-32 sm:w-44 px-3 rounded-xl text-xs outline-none"
                    style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
                    onFocus={e => e.target.style.borderColor = "#00E6A8"}
                    onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                  />

                  {/* Filter toggle */}
                  <button onClick={() => setShowFilter(f => !f)}
                    className="flex items-center gap-1.5 px-3 h-9 rounded-xl text-xs font-semibold"
                    style={{ background: showFilter ? "rgba(0,230,168,0.1)" : "#161d28", color: showFilter ? "#00E6A8" : "#9CA3AF", border: showFilter ? "1px solid rgba(0,230,168,0.3)" : "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                    <SlidersHorizontal size={13} />
                    <span className="hidden sm:inline">Filter</span>
                    {Object.values(traitSelected).flat().length > 0 && (
                      <span className="text-[10px] px-1 rounded" style={{ background: "#00E6A8", color: "#0A0F14" }}>
                        {Object.values(traitSelected).flat().length}
                      </span>
                    )}
                  </button>

                  {/* Price sort — Listings tab only */}
                  {tab === "Listings" && (
                    <button onClick={() => setPriceSort(s => s === "asc" ? "desc" : "asc")}
                      className="flex items-center gap-1 px-3 h-9 rounded-xl text-xs font-semibold"
                      style={{ background: "#161d28", color: "#9CA3AF", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                      Price {priceSort === "asc" ? "↑" : "↓"}
                    </button>
                  )}

                  {/* Single cycle view toggle */}
                  <ViewToggle current={viewMode} onChange={setViewMode} />
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className={showSidebar ? "flex gap-6" : ""}>

            {/* Sidebar filter */}
            {showSidebar && (
              <TraitFilter
                traits={collectionTraits}
                selected={traitSelected}
                onChange={setTraitSelected}
                onClear={() => setTraitSelected({})}
              />
            )}

            <div className="flex-1 min-w-0">

              {/* ── Items Tab ── */}
              {tab === "Items" && (
                <>
                  <div className={gridClass}>
                    {filteredListings.map((token, i) => (
                      <NFTCard key={`listed-${token.token_id}`} token={token} collectionName={collection?.name}
                        slug={id} listing={activeListings[i]} viewMode={viewMode} onBuy={setBuyModal} />
                    ))}
                    {filteredUnlisted.map(token => (
                      <NFTCard key={`unlisted-${token.tokenId}`} token={token} collectionName={collection?.name}
                        slug={id} listing={null} viewMode={viewMode} onBuy={null} />
                    ))}
                    {tokensLoading && Array(8).fill(0).map((_, i) => <CardSkeleton key={`sk-${i}`} />)}
                  </div>
                  <div ref={loaderRef} className="h-10" />
                  {!hasMore && (filteredUnlisted.length + filteredListings.length) > 0 && (
                    <div className="text-center py-8 text-sm" style={{ color: "#9CA3AF" }}>
                      All {filteredUnlisted.length + filteredListings.length} items loaded
                    </div>
                  )}
                </>
              )}

              {/* ── Listings Tab ── */}
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
                    <div className={gridClass}>
                      {filteredListings.map(listing => (
                        <ListingCard key={listing.listing_id} listing={listing}
                          collectionName={collection?.name} slug={id}
                          viewMode={viewMode} onBuy={setBuyModal} />
                      ))}
                    </div>
                  )}
                </>
              )}

              {tab === "Activity" && (
                <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />
              )}

              {tab === "Analytics" && (
                <div className="space-y-6">
                  <PriceChart nftContract={contractAddr} />
                </div>
              )}

              {tab === "Owners" && (
                <OwnersTab contractAddress={contractAddr} />
              )}
            </div>
          </div>
        </div>
      </div>

      {buyModal && (
        <BuyModal
          listing={buyModal}
          onClose={() => setBuyModal(null)}
          onSuccess={() => {
            setBuyModal(null);
            // ✅ Immediately remove bought listing from UI
            setListedTokensWithImages(prev => prev.filter(t => t.listing_id !== buyModal.listing_id));
          }}
        />
      )}
    </>
  );
}
