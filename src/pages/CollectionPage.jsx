import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import {
  CheckCircle2, ExternalLink, Twitter, Globe,
  TrendingDown, TrendingUp, LayoutGrid, List as ListIcon,
  ShoppingCart, Tag
} from "lucide-react";
import { useCollection, useRealtimeListings } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import { useAccount } from "wagmi";
import { useMarketplace } from "@/hooks/useMarketplace";

const TABS       = ["Items", "Listings", "Activity", "Bids", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";
const PAGE_SIZE  = 50;

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4"
    style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="text-[10px] font-bold uppercase tracking-wider mb-1"
      style={{ color: "#9da7b3" }}>{label}</div>
    <div className="flex items-baseline gap-2">
      <div className="font-mono text-lg font-bold" style={{ color: "#e6edf3" }}>{value}</div>
      {subValue && (
        <div className={`text-[11px] font-bold flex items-center gap-0.5 ${
          isTrend ? (subValue.includes('-') ? 'text-red-400' : 'text-green-400') : ''
        }`} style={!isTrend ? { color: "#9da7b3" } : {}}>
          {isTrend && (subValue.includes('-')
            ? <TrendingDown size={11} />
            : <TrendingUp size={11} />)}
          {subValue}
        </div>
      )}
    </div>
  </div>
);

// ─── NFT Grid Item (Items tab) ────────────────────────────────────────────────
function NFTGridItem({ token, collectionName, slug, listing }) {
  return (
    <Link
      to={`/collection/${slug}/${token.tokenId}`}
      className="block rounded-2xl overflow-hidden card-hover p-2"
      style={{
        background: "#121821",
        border: listing
          ? "1px solid rgba(34,211,238,0.2)"
          : "1px solid rgba(255,255,255,0.05)",
      }}>
      <div className="relative">
        <NFTImage src={token.image}
          className="aspect-square rounded-xl object-cover mb-2 w-full" />
        {listing && (
          <div className="absolute top-2 left-2 text-[9px] font-bold px-2 py-0.5 rounded-lg"
            style={{ background: "rgba(11,15,20,0.85)", color: "#22d3ee",
              border: "1px solid rgba(34,211,238,0.4)", backdropFilter: "blur(4px)" }}>
            ● FOR SALE
          </div>
        )}
      </div>
      <div className="px-1 pb-1">
        <div className="text-[10px] font-bold uppercase tracking-tight mb-0.5 truncate"
          style={{ color: "#9da7b3" }}>{collectionName}</div>
        <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>
          {token.name}
        </div>
        {listing && (
          <div className="font-mono text-xs font-bold mt-0.5" style={{ color: "#22d3ee" }}>
            {Number(listing.price).toFixed(2)} USD
          </div>
        )}
      </div>
    </Link>
  );
}

// ─── Buy Confirm Modal ────────────────────────────────────────────────────────
function BuyModal({ listing, onConfirm, onClose, loading, txStatus }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.15)" }}
        onClick={e => e.stopPropagation()}>
        <div className="text-center mb-6">
          {listing.image && (
            <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto mb-4"
              style={{ background: "#161d28" }}>
              <img src={listing.image} alt="" className="w-full h-full object-cover" />
            </div>
          )}
          <div className="font-bold text-lg mb-1" style={{ color: "#e6edf3" }}>
            {listing.name || `#${listing.token_id}`}
          </div>
          <div className="font-mono text-3xl font-bold" style={{ color: "#22d3ee" }}>
            {Number(listing.price).toFixed(2)}
            <span className="text-lg ml-1" style={{ color: "#9da7b3" }}>USD</span>
          </div>
        </div>

        {txStatus && (
          <div className="rounded-xl px-3 py-2.5 mb-4 text-xs"
            style={{
              background: txStatus.type === "error"   ? "rgba(239,68,68,0.1)"
                        : txStatus.type === "success" ? "rgba(34,197,94,0.1)"
                        : "rgba(34,211,238,0.1)",
              border: `1px solid ${txStatus.type === "error" ? "rgba(239,68,68,0.3)" : txStatus.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(34,211,238,0.3)"}`,
              color:  txStatus.type === "error" ? "#EF4444" : txStatus.type === "success" ? "#22C55E" : "#22d3ee",
            }}>
            {txStatus.msg}
          </div>
        )}

        {txStatus?.type === "success" ? (
          <button onClick={onClose}
            className="w-full h-12 rounded-xl font-bold text-sm"
            style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee",
              border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer" }}>
            Done 🎉
          </button>
        ) : (
          <>
            <button onClick={onConfirm} disabled={loading}
              className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2 mb-3"
              style={{ background: loading ? "#161d28" : "#22d3ee",
                color: loading ? "#9da7b3" : "#0b0f14",
                border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
              {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {loading ? "Processing..." : "Confirm Purchase"}
            </button>
            <button onClick={onClose}
              className="w-full h-9 text-sm"
              style={{ background: "none", color: "#9da7b3", border: "none", cursor: "pointer" }}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Listings Tab ─────────────────────────────────────────────────────────────
function ListingsTab({ listings, isLoading, collectionName, slug }) {
  const { address } = useAccount();
  const { buyNFT, loading, txStatus, clearStatus } = useMarketplace();
  const [view,     setView]     = useState("grid");
  const [buying,   setBuying]   = useState(null);
  const [buyModal, setBuyModal] = useState(null);

  const sorted = (listings || [])
    .filter(l => l.active)
    .sort((a, b) => Number(a.price) - Number(b.price));

  function handleBuyClick(listing) {
    clearStatus();
    setBuyModal(listing);
  }

  async function confirmBuy() {
    if (!buyModal) return;
    setBuying(buyModal.listing_id);
    await buyNFT({
      listingId:  String(buyModal.listing_id),
      price:      String(Math.round(Number(buyModal.price) * 1e6)), // convert to raw units
      seller:     buyModal.seller,
      nftAddress: buyModal.nft_contract,
      tokenId:    String(buyModal.token_id),
    });
    setBuying(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: "#22d3ee" }} />
      </div>
    );
  }

  if (sorted.length === 0) {
    return (
      <div className="py-24 text-center rounded-3xl"
        style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
        <div className="text-4xl mb-3">🏷️</div>
        <div className="font-bold mb-1" style={{ color: "#e6edf3" }}>No active listings</div>
        <p className="text-sm" style={{ color: "#9da7b3" }}>
          Be the first to list an NFT from this collection.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="text-sm" style={{ color: "#9da7b3" }}>
          <span className="font-bold" style={{ color: "#e6edf3" }}>{sorted.length}</span>
          {" "}listing{sorted.length !== 1 ? "s" : ""} — cheapest first
        </div>
        <div className="flex rounded-xl p-1"
          style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
          {[{ v: "grid", Icon: LayoutGrid }, { v: "list", Icon: ListIcon }].map(({ v, Icon }) => (
            <button key={v} onClick={() => setView(v)} className="p-2 rounded-lg"
              style={{ background: view === v ? "rgba(34,211,238,0.1)" : "none",
                color: view === v ? "#22d3ee" : "#9da7b3", border: "none", cursor: "pointer" }}>
              <Icon size={15} />
            </button>
          ))}
        </div>
      </div>

      {/* Grid view */}
      {view === "grid" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sorted.map(listing => {
            const isOwner  = address?.toLowerCase() === listing.seller?.toLowerCase();
            const isBuying = buying === listing.listing_id;
            return (
              <div key={listing.listing_id}
                className="rounded-2xl overflow-hidden transition-all"
                style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.15)" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.4)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.15)"}>
                <Link to={`/collection/${slug}/${listing.token_id}`} className="block p-2 group">
                  <div className="aspect-square rounded-xl overflow-hidden"
                    style={{ background: "#161d28" }}>
                    {listing.image
                      ? <img src={listing.image} alt=""
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      : <div className="w-full h-full flex items-center justify-center font-mono text-xl font-bold"
                          style={{ color: "#9da7b3" }}>#{listing.token_id}</div>
                    }
                  </div>
                  <div className="pt-2 px-1 pb-1">
                    <div className="text-[9px] font-bold uppercase tracking-widest mb-0.5 truncate"
                      style={{ color: "#9da7b3" }}>{collectionName}</div>
                    <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>
                      {listing.name || `#${listing.token_id}`}
                    </div>
                    <div className="font-mono text-base font-bold mt-0.5" style={{ color: "#22d3ee" }}>
                      {Number(listing.price).toFixed(2)} USD
                    </div>
                    <div className="text-[10px] mt-0.5" style={{ color: "#9da7b3" }}>
                      {listing.seller?.slice(0,6)}…{listing.seller?.slice(-4)}
                    </div>
                  </div>
                </Link>
                <div className="px-2 pb-2">
                  {isOwner ? (
                    <div className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center"
                      style={{ background: "rgba(34,211,238,0.06)", color: "#22d3ee",
                        border: "1px solid rgba(34,211,238,0.2)" }}>
                      Your Listing
                    </div>
                  ) : (
                    <button onClick={() => handleBuyClick(listing)} disabled={isBuying}
                      className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                      style={{ background: isBuying ? "#161d28" : "#22d3ee",
                        color: isBuying ? "#9da7b3" : "#0b0f14",
                        border: "none", cursor: isBuying ? "not-allowed" : "pointer" }}>
                      {isBuying
                        ? <><span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" /> Processing...</>
                        : <><ShoppingCart size={12} /> Buy Now</>}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List view */}
      {view === "list" && (
        <div className="space-y-2">
          <div className="flex items-center gap-3 px-3 pb-2 text-[10px] font-bold uppercase tracking-widest"
            style={{ color: "#9da7b3", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <span className="w-6">#</span>
            <span className="w-12 flex-shrink-0">Item</span>
            <span className="flex-1">Name</span>
            <span>Price</span>
            <span className="w-20 text-right">Action</span>
          </div>
          {sorted.map((listing, idx) => {
            const isOwner  = address?.toLowerCase() === listing.seller?.toLowerCase();
            const isBuying = buying === listing.listing_id;
            return (
              <div key={listing.listing_id}
                className="flex items-center gap-3 p-3 rounded-2xl transition-all"
                style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
                onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)"}
                onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}>
                <span className="text-xs font-mono w-6 text-center flex-shrink-0"
                  style={{ color: "#9da7b3" }}>{idx + 1}</span>
                <Link to={`/collection/${slug}/${listing.token_id}`}
                  className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden"
                  style={{ background: "#161d28" }}>
                  {listing.image
                    ? <img src={listing.image} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-[10px] font-mono"
                        style={{ color: "#9da7b3" }}>#{listing.token_id}</div>
                  }
                </Link>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>
                    {listing.name || `#${listing.token_id}`}
                  </div>
                  <div className="text-[10px]" style={{ color: "#9da7b3" }}>
                    {listing.seller?.slice(0,6)}…{listing.seller?.slice(-4)}
                  </div>
                </div>
                <div className="font-mono font-bold text-sm flex-shrink-0" style={{ color: "#22d3ee" }}>
                  {Number(listing.price).toFixed(2)} USD
                </div>
                {isOwner ? (
                  <span className="text-[10px] px-2 py-1 rounded-lg flex-shrink-0"
                    style={{ background: "rgba(34,211,238,0.06)", color: "#22d3ee",
                      border: "1px solid rgba(34,211,238,0.2)" }}>
                    Yours
                  </span>
                ) : (
                  <button onClick={() => handleBuyClick(listing)} disabled={isBuying}
                    className="h-8 px-3 rounded-xl text-xs font-bold flex items-center gap-1 flex-shrink-0"
                    style={{ background: isBuying ? "#161d28" : "#22d3ee",
                      color: isBuying ? "#9da7b3" : "#0b0f14",
                      border: "none", cursor: isBuying ? "not-allowed" : "pointer" }}>
                    {isBuying
                      ? <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
                      : <ShoppingCart size={11} />}
                    Buy
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {buyModal && (
        <BuyModal
          listing={buyModal}
          onConfirm={confirmBuy}
          onClose={() => { setBuyModal(null); clearStatus(); setBuying(null); }}
          loading={!!buying}
          txStatus={txStatus}
        />
      )}
    </div>
  );
}

// ─── Main CollectionPage ──────────────────────────────────────────────────────
export default function CollectionPage() {
  const { id } = useParams();
  const { collection, isLoading: colLoading } = useCollection(id);
  const { listings, isLoading: listingsLoading } = useRealtimeListings(collection?.contract_address);

  // Build listing lookup: tokenId → listing
  const listingMap = useMemo(() => {
    const m = {};
    (listings || []).forEach(l => { if (l.active) m[Number(l.token_id)] = l; });
    return m;
  }, [listings]);

  const activeListings = useMemo(() =>
    (listings || []).filter(l => l.active),
  [listings]);

  const [tokens,        setTokens]        = useState([]);
  const [tokensLoading, setTokensLoading] = useState(false);
  const [page,          setPage]          = useState(1);
  const [hasMore,       setHasMore]       = useState(true);
  const [tab,           setTab]           = useState("Items");
  const loaderRef = useRef(null);

  // Stats derived from collection row + live listings
  const stats = useMemo(() => {
    const supply    = collection?.total_supply || 0;
    const floor     = collection?.floor_price  || 0;
    const owners    = collection?.owners        || 0;
    const listed    = collection?.listed_count  || activeListings.length;
    const royaltyBps = collection?.royalty_bps ?? 0;

    return {
      floor:     floor > 0 ? `${Number(floor).toFixed(2)} USD` : "—",
      topOffer:  collection?.top_offer ? `${Number(collection.top_offer).toFixed(2)} USD` : "—",
      vol24h:    collection?.volume_24h    ? `${Number(collection.volume_24h).toFixed(2)} USD`    : "0 USD",
      totalVol:  collection?.volume_total  ? `${Number(collection.volume_total).toFixed(2)} USD`  : "0 USD",
      mktCap:    floor && supply ? `${(Number(floor) * supply).toLocaleString()} USD` : "—",
      owners,
      ownerPct:  supply && owners ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed,
      listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply:    supply?.toLocaleString() || "0",
      royalties: royaltyBps ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
    };
  }, [collection, activeListings]);

  // Fetch token pages from IPFS
  const fetchPage = useCallback(async (pageNum) => {
    if (!collection?.metadata_base_uri) return;

    let base = collection.metadata_base_uri;
    if (base.startsWith("ipfs://"))
      base = base.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
    if (!base.endsWith("/")) base += "/";

    const supply = collection.total_supply || 2000;
    const start  = (pageNum - 1) * PAGE_SIZE + 1;
    const end    = Math.min(start + PAGE_SIZE - 1, supply);
    if (start > supply) { setHasMore(false); return; }

    setTokensLoading(true);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const results = await Promise.all(ids.map(async (tokenId) => {
      try {
        const res  = await fetch(`${base}${tokenId}.json`, { cache: "force-cache" });
        const json = await res.json();
        return { tokenId, name: json.name || `${collection.name} #${tokenId}`, image: extractImageUrl(json) };
      } catch {
        return { tokenId, name: `${collection.name} #${tokenId}`, image: "" };
      }
    }));

    setTokens(prev => pageNum === 1 ? results : [...prev, ...results]);
    setHasMore(end < supply);
    setTokensLoading(false);
  }, [collection]);

  useEffect(() => {
    if (collection?.metadata_base_uri) {
      setTokens([]); setPage(1); setHasMore(true);
      fetchPage(1);
    }
  }, [collection?.metadata_base_uri, fetchPage]);

  useEffect(() => { if (page > 1) fetchPage(page); }, [page, fetchPage]);

  // Infinite scroll
  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(
      entries => { if (entries[0].isIntersecting && hasMore && !tokensLoading) setPage(p => p + 1); },
      { rootMargin: "200px" }
    );
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, tokensLoading]);

  if (colLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "#22d3ee", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="fade-up min-h-screen pb-20" style={{ background: "#0b0f14" }}>

      {/* Banner */}
      <div className="relative h-56 w-full overflow-hidden">
        {collection?.banner_url
          ? <img src={collection.banner_url} className="w-full h-full object-cover opacity-60" alt="Banner" />
          : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} />
        }
        <div className="absolute inset-0"
          style={{ background: "linear-gradient(to bottom, transparent 40%, #0b0f14)" }} />
      </div>

      <div className="px-4 sm:px-6 max-w-7xl mx-auto -mt-16 relative z-10">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end gap-5 mb-8">
          <div className="w-28 h-28 rounded-3xl overflow-hidden flex-shrink-0"
            style={{ border: "6px solid #0b0f14", background: "#121821" }}>
            <NFTImage src={collection?.logo_url} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-3xl font-extrabold uppercase tracking-tight"
                style={{ color: "#e6edf3" }}>{collection?.name}</h1>
              {collection?.verified && <CheckCircle2 size={22} style={{ color: "#22d3ee" }} />}
            </div>
            <div className="flex items-center gap-4" style={{ color: "#9da7b3" }}>
              <span className="text-sm font-bold" style={{ color: "rgba(34,211,238,0.8)" }}>
                By {collection?.creator_name || "Tempo Creator"}
              </span>
              <div className="flex items-center gap-3">
                {collection?.twitter_url && (
                  <a href={collection.twitter_url} target="_blank" rel="noreferrer"
                    className="hover:text-white transition-colors"><Twitter size={16} /></a>
                )}
                {collection?.website_url && (
                  <a href={collection.website_url} target="_blank" rel="noreferrer"
                    className="hover:text-white transition-colors"><Globe size={16} /></a>
                )}
                <a href={`${EXPLORER_BASE}/address/${collection?.contract_address}`}
                  target="_blank" rel="noreferrer"
                  className="hover:text-white transition-colors"><ExternalLink size={16} /></a>
              </div>
            </div>
            {collection?.description && (
              <p className="text-sm mt-2 line-clamp-2" style={{ color: "#9da7b3" }}>
                {collection.description}
              </p>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatItem label="Floor Price" value={stats.floor} />
          <StatItem label="Top Offer"   value={stats.topOffer} />
          <StatItem label="24H VOL"     value={stats.vol24h} />
          <StatItem label="Total VOL"   value={stats.totalVol} />
          <StatItem label="Market Cap"  value={stats.mktCap} />
          <StatItem label="Owners"      value={stats.owners} subValue={stats.ownerPct} />
          <StatItem label="Listed"      value={stats.listed} subValue={stats.listedPct} />
          <StatItem label="Supply"      value={stats.supply} />
          <StatItem label="Royalties"   value={stats.royalties} />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b mb-6"
          style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="pb-4 text-sm font-bold uppercase tracking-widest transition-all relative"
              style={{
                background: "none", border: "none",
                borderBottom: tab === t ? "2px solid #22d3ee" : "2px solid transparent",
                color: tab === t ? "#22d3ee" : "#9da7b3",
                cursor: "pointer",
              }}>
              {t}
              {/* Badge on Listings tab */}
              {t === "Listings" && activeListings.length > 0 && (
                <span className="ml-1.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full align-middle"
                  style={{ background: "rgba(34,211,238,0.15)", color: "#22d3ee" }}>
                  {activeListings.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Items Tab */}
        {tab === "Items" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {tokens.map(token => (
                <NFTGridItem
                  key={token.tokenId}
                  token={token}
                  collectionName={collection?.name}
                  slug={id}
                  listing={listingMap[token.tokenId] || null}
                />
              ))}
              {tokensLoading && Array(10).fill(0).map((_, i) => <CardSkeleton key={`sk-${i}`} />)}
            </div>
            <div ref={loaderRef} className="h-10" />
            {!hasMore && tokens.length > 0 && (
              <div className="text-center py-8 text-sm" style={{ color: "#9da7b3" }}>
                All {tokens.length} items loaded
              </div>
            )}
          </>
        )}

        {/* Listings Tab */}
        {tab === "Listings" && (
          <ListingsTab
            listings={activeListings}
            isLoading={listingsLoading}
            collectionName={collection?.name}
            slug={id}
          />
        )}

        {/* Activity Tab */}
        {tab === "Activity" && (
          <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />
        )}

        {/* Other tabs */}
        {tab !== "Items" && tab !== "Listings" && tab !== "Activity" && (
          <div className="py-20 text-center text-sm" style={{ color: "#9da7b3" }}>
            {tab} coming soon — data is being indexed from Tempo chain.
          </div>
        )}
      </div>
    </div>
  );
}
