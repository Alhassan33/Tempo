import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, Twitter, Globe, TrendingDown, TrendingUp, ShoppingCart, AlertCircle } from "lucide-react";
import { useCollection, useRealtimeListings, useCollectionStats } from "@/hooks/useSupabase";
import NFTImage from "@/components/NFTImage.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import { useAccount } from "wagmi";
import { useMarketplace } from "@/hooks/useMarketplace";

const TABS        = ["Items", "Activity", "Bids", "Analytics"];
const EXPLORER_BASE = "https://explore.tempo.xyz";
const PAGE_SIZE   = 50;

// ─── Stat Card — UNTOUCHED ────────────────────────────────────────────────────
const StatItem = ({ label, value, subValue, isTrend }) => (
  <div className="rounded-2xl p-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.05)" }}>
    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: "#9da7b3" }}>{label}</div>
    <div className="flex items-baseline gap-2">
      <div className="font-mono text-lg font-bold" style={{ color: "#e6edf3" }}>{value}</div>
      {subValue && (
        <div className={`text-[11px] font-bold flex items-center gap-0.5 ${
          isTrend ? (subValue.includes('-') ? 'text-red-400' : 'text-green-400') : ''
        }`} style={!isTrend ? { color: "#9da7b3" } : {}}>
          {isTrend && (subValue.includes('-') ? <TrendingDown size={11} /> : <TrendingUp size={11} />)}
          {subValue}
        </div>
      )}
    </div>
  </div>
);

// ─── Buy Modal ────────────────────────────────────────────────────────────────
function BuyModal({ listing, onConfirm, onClose, loading, txStatus }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.15)" }}
        onClick={e => e.stopPropagation()}>

        {/* NFT preview */}
        <div className="text-center mb-6">
          {listing.image && (
            <div className="w-24 h-24 rounded-2xl overflow-hidden mx-auto mb-4" style={{ background: "#161d28" }}>
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
          <div className="text-xs mt-1" style={{ color: "#9da7b3" }}>
            Seller: {listing.seller?.slice(0,6)}…{listing.seller?.slice(-4)}
          </div>
        </div>

        {/* Status */}
        {txStatus && (
          <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 mb-4 text-xs"
            style={{
              background: txStatus.type === "error"   ? "rgba(239,68,68,0.1)"
                        : txStatus.type === "success" ? "rgba(34,197,94,0.1)"
                        : "rgba(34,211,238,0.08)",
              border: `1px solid ${txStatus.type === "error" ? "rgba(239,68,68,0.3)" : txStatus.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(34,211,238,0.25)"}`,
              color: txStatus.type === "error" ? "#EF4444" : txStatus.type === "success" ? "#22C55E" : "#22d3ee",
            }}>
            {txStatus.type === "error" && <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />}
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
                border: "none", cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "Syne, sans-serif" }}>
              {loading
                ? <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Processing...</>
                : <><ShoppingCart size={15} /> Confirm Purchase</>}
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

// ─── NFT Grid Item ────────────────────────────────────────────────────────────
function NFTGridItem({ token, collectionName, slug, listing, onBuy }) {
  const { address } = useAccount();
  const isOwner = listing && address?.toLowerCase() === listing.seller?.toLowerCase();

  return (
    <div className="rounded-2xl overflow-hidden card-hover"
      style={{
        background: "#121821",
        border: listing ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.05)",
        boxShadow: listing ? "0 0 15px rgba(34,211,238,0.05)" : "none",
      }}>
      <Link to={`/collection/${slug}/${token.tokenId}`} className="block p-2">
        <div className="relative">
          <NFTImage src={token.image} className="aspect-square rounded-xl object-cover mb-2 w-full" />
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
          <div className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>{token.name}</div>
          {listing && (
            <div className="font-mono text-xs font-bold mt-0.5" style={{ color: "#22d3ee" }}>
              {Number(listing.price).toFixed(2)} USD
            </div>
          )}
        </div>
      </Link>

      {/* Buy button on listed cards */}
      {listing && !isOwner && (
        <div className="px-2 pb-2">
          <button
            onClick={() => onBuy(listing)}
            className="w-full h-8 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: "#22d3ee", color: "#0b0f14", border: "none",
              cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
            <ShoppingCart size={11} /> Buy Now
          </button>
        </div>
      )}
      {listing && isOwner && (
        <div className="px-2 pb-2">
          <div className="w-full h-8 rounded-xl text-xs font-bold flex items-center justify-center"
            style={{ background: "rgba(34,211,238,0.06)", color: "#22d3ee",
              border: "1px solid rgba(34,211,238,0.2)" }}>
            Your Listing
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main CollectionPage ──────────────────────────────────────────────────────
export default function CollectionPage() {
  const { id } = useParams();

  // ✅ Stats hooks — UNTOUCHED from your working version
  const { collection, isLoading: colLoading } = useCollection(id);
  const { stats: rpcStats } = useCollectionStats(collection?.contract_address || "");
  const { listings } = useRealtimeListings(collection?.contract_address);
  const { buyNFT, loading: buyLoading, txStatus, clearStatus } = useMarketplace();

  const activeListings = useMemo(() =>
    (listings || []).filter(l => l.active).sort((a, b) => Number(a.price) - Number(b.price)),
  [listings]);

  const listedIds = useMemo(() =>
    new Set(activeListings.map(l => String(l.token_id))),
  [activeListings]);

  const [unlistedTokens, setUnlistedTokens] = useState([]);
  const [tokensLoading,  setTokensLoading]  = useState(false);
  const [page,           setPage]           = useState(1);
  const [hasMore,        setHasMore]        = useState(true);
  const [tab,            setTab]            = useState("Items");
  const [buyModal,       setBuyModal]       = useState(null);
  const loaderRef = useRef(null);

  // ✅ Stats computation — UNTOUCHED
  const stats = useMemo(() => {
    const supply     = rpcStats.totalSupply  || collection?.total_supply || 0;
    const floorPrice = rpcStats.floorPrice   || collection?.floor_price  || 0;
    const owners     = rpcStats.uniqueOwners || collection?.owners       || 0;
    const listed     = rpcStats.listedCount  || activeListings.length;
    const royaltyBps = collection?.royalty_bps ?? 0;

    return {
      floor:     floorPrice > 0 ? `${Number(floorPrice).toFixed(2)} USD` : "—",
      topOffer:  collection?.top_offer ? `${Number(collection.top_offer).toFixed(2)} USD` : "—",
      vol24h:    collection?.volume_24h    ? `${Number(collection.volume_24h).toFixed(2)} USD`    : "0 USD",
      totalVol:  collection?.volume_total  ? `${Number(collection.volume_total).toFixed(2)} USD`  : "0 USD",
      mktCap:    floorPrice && supply ? `${(Number(floorPrice) * supply).toLocaleString()} USD` : "—",
      owners,
      ownerPct:  supply && owners ? `${((owners / supply) * 100).toFixed(1)}%` : "0%",
      listed,
      listedPct: supply ? `${((listed / supply) * 100).toFixed(1)}% listed` : "",
      supply:    supply?.toLocaleString() || "0",
      royalties: royaltyBps ? `${(royaltyBps / 100).toFixed(1)}%` : "0%",
    };
  }, [collection, activeListings, rpcStats]);

  // ✅ Fetch unlisted tokens — UNTOUCHED
  const fetchPage = useCallback(async (pageNum) => {
    if (!collection?.metadata_base_uri) return;
    let base = collection.metadata_base_uri;
    if (base.startsWith("ipfs://")) base = base.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
    if (!base.endsWith("/")) base += "/";

    const supply = rpcStats.totalSupply || collection.total_supply || 2000;
    const start  = (pageNum - 1) * PAGE_SIZE + 1;
    const end    = Math.min(start + PAGE_SIZE - 1, supply);
    if (start > supply) { setHasMore(false); return; }

    setTokensLoading(true);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    const results = await Promise.all(ids.map(async (tokenId) => {
      const idStr = String(tokenId);
      if (listedIds.has(idStr)) return null;
      try {
        const res  = await fetch(`${base}${tokenId}.json`, { cache: "force-cache" });
        const json = await res.json();
        return { tokenId: idStr, name: json.name || `${collection.name} #${tokenId}`, image: extractImageUrl(json) };
      } catch {
        return { tokenId: idStr, name: `${collection.name} #${tokenId}`, image: "" };
      }
    }));

    const valid = results.filter(Boolean);
    setUnlistedTokens(prev => pageNum === 1 ? valid : [...prev, ...valid]);
    setHasMore(end < supply);
    setTokensLoading(false);
  }, [collection, listedIds, rpcStats.totalSupply]);

  useEffect(() => {
    if (collection?.metadata_base_uri) {
      setUnlistedTokens([]); setPage(1); setHasMore(true); fetchPage(1);
    }
  }, [collection?.metadata_base_uri, fetchPage]);

  useEffect(() => { if (page > 1) fetchPage(page); }, [page, fetchPage]);

  useEffect(() => {
    if (!loaderRef.current) return;
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !tokensLoading && tab === "Items") setPage(p => p + 1);
    }, { rootMargin: "200px" });
    observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [hasMore, tokensLoading, tab]);

  // Buy handlers
  function handleBuyClick(listing) {
    clearStatus();
    setBuyModal(listing);
  }

  async function confirmBuy() {
    if (!buyModal) return;
    await buyNFT({
      listingId:    String(buyModal.listing_id),
      seller:       buyModal.seller,
      nftAddress:   buyModal.nft_contract,
      tokenId:      String(buyModal.token_id),
      price:        String(buyModal.price),  // human USD → useMarketplace converts
      displayPrice: Number(buyModal.price).toFixed(2),
      active:       true,
    });
  }

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
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #0b0f14)" }} />
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
              <h1 className="text-3xl font-extrabold uppercase tracking-tight" style={{ color: "#e6edf3" }}>
                {collection?.name}
              </h1>
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
              <p className="text-sm mt-2 line-clamp-2" style={{ color: "#9da7b3" }}>{collection.description}</p>
            )}
          </div>
        </div>

        {/* ✅ Stats Grid — UNTOUCHED */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
          <StatItem label="Floor Price" value={stats.floor}    subValue={null} />
          <StatItem label="Top Offer"   value={stats.topOffer} />
          <StatItem label="24H VOL"     value={stats.vol24h}   />
          <StatItem label="Total VOL"   value={stats.totalVol} />
          <StatItem label="Market Cap"  value={stats.mktCap}   />
          <StatItem label="Owners"      value={stats.owners}   subValue={stats.ownerPct} />
          <StatItem label="Listed"      value={stats.listed}   subValue={stats.listedPct} />
          <StatItem label="Supply"      value={stats.supply}   />
          <StatItem label="Royalties"   value={stats.royalties} />
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b mb-6" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="pb-4 text-sm font-bold uppercase tracking-widest border-b-2 transition-all"
              style={{
                background: "none", border: "none",
                borderBottom: tab === t ? "2px solid #22d3ee" : "2px solid transparent",
                color: tab === t ? "#22d3ee" : "#9da7b3",
                cursor: "pointer",
              }}>
              {t}
            </button>
          ))}
        </div>

        {/* Items Tab */}
        {tab === "Items" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {/* Listed first */}
              {activeListings.map(listing => (
                <NFTGridItem
                  key={`listed-${listing.token_id}`}
                  token={{
                    tokenId: String(listing.token_id),
                    name: listing.name || `${collection?.name} #${listing.token_id}`,
                    image: listing.image || listing.image_url || "",
                  }}
                  collectionName={collection?.name}
                  slug={id}
                  listing={listing}
                  onBuy={handleBuyClick}
                />
              ))}
              {/* Unlisted */}
              {unlistedTokens.map(token => (
                <NFTGridItem
                  key={`unlisted-${token.tokenId}`}
                  token={token}
                  collectionName={collection?.name}
                  slug={id}
                  listing={null}
                  onBuy={handleBuyClick}
                />
              ))}
              {tokensLoading && Array(10).fill(0).map((_, i) => <CardSkeleton key={`sk-${i}`} />)}
            </div>

            <div ref={loaderRef} className="h-10" />
            {!hasMore && (unlistedTokens.length + activeListings.length) > 0 && (
              <div className="text-center py-8 text-sm" style={{ color: "#9da7b3" }}>
                All {unlistedTokens.length + activeListings.length} items loaded
              </div>
            )}
          </>
        )}

        {tab === "Activity" && (
          <ActivityFeed collectionId={id} nftContract={collection?.contract_address} limit={40} />
        )}

        {tab !== "Items" && tab !== "Activity" && (
          <div className="py-20 text-center text-sm" style={{ color: "#9da7b3" }}>
            {tab} coming soon — data is being indexed from Tempo chain.
          </div>
        )}
      </div>

      {/* Buy Modal */}
      {buyModal && (
        <BuyModal
          listing={buyModal}
          onConfirm={confirmBuy}
          onClose={() => { setBuyModal(null); clearStatus(); }}
          loading={buyLoading}
          txStatus={txStatus}
        />
      )}
    </div>
  );
}
