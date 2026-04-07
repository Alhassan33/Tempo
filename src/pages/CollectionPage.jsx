import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Grid, List, ExternalLink, Twitter, Globe } from "lucide-react";
import { useAccount } from "wagmi";
import { useCollection, useRealtimeListings } from "@/hooks/useSupabase";
import { useBuyNFT, useMarketplaceInfo } from "@/hooks/useMarketplace";
import NFTImage from "@/components/NFTImage.jsx";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import CollectionBids from "@/components/CollectionBids.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";
import { useNavigate as useNav } from "react-router-dom";

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS       = ["Items", "Activity", "Bids", "Analytics"];
const IPFS_BASE  = "https://gateway.lighthouse.storage/ipfs/bafybeiaksg5cena4ucpfjyqghnox73cflc6c4du2g3sn4qtovgzl67inpu/";
const NFT_CONTRACT  = "0x1Ee82CC5946EdBD88eaf90D6d3c2B5baA4f9966C";
const TOTAL_SUPPLY  = 2000;
const EXPLORER_BASE = "https://explore.tempo.xyz"; // ✅ Mainnet explorer

async function fetchTokenMetadata(tokenId) {
  try {
    const url = `${IPFS_BASE}${tokenId}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("not found");
    const json = await res.json();
    return {
      tokenId,
      name:       json.name        || `TEMPONYAW #${tokenId}`,
      image:      extractImageUrl(json) || `${IPFS_BASE}${tokenId}.png`,
      attributes: json.attributes  || [],
    };
  } catch {
    return {
      tokenId,
      name:       `TEMPONYAW #${tokenId}`,
      image:      `${IPFS_BASE}${tokenId}.png`,
      attributes: [],
    };
  }
}

// ─── NFT Card ─────────────────────────────────────────────────────────────────
function NFTCard({ token, listing, onBuy, onList, isOwner, view, onClick }) {
  const hasListing = !!listing;

  if (view === "list") {
    return (
      <div
        onClick={onClick}
        className="flex items-center gap-4 p-3 rounded-xl cursor-pointer card-hover"
        style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
      >
        <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0">
          <NFTImage src={token.image} alt={token.name} className="w-full h-full" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate" style={{ color: "#e6edf3" }}>{token.name}</div>
          {hasListing && (
            <div className="font-mono text-xs" style={{ color: "#22d3ee" }}>{listing.price.toFixed(2)} USD</div>
          )}
        </div>
        {hasListing && !isOwner && (
          <button onClick={(e) => { e.stopPropagation(); onBuy(listing); }}
            className="h-8 px-4 rounded-lg text-xs font-bold flex-shrink-0"
            style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
            Buy
          </button>
        )}
        {isOwner && !hasListing && (
          <button onClick={(e) => { e.stopPropagation(); onList(token); }}
            className="h-8 px-4 rounded-lg text-xs font-bold flex-shrink-0"
            style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
            List
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      className="rounded-2xl overflow-hidden card-hover cursor-pointer"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="aspect-square overflow-hidden">
        <NFTImage src={token.image} alt={token.name} className="w-full h-full" style={{ objectFit: "cover" }} />
      </div>
      <div className="p-3">
        <div className="font-semibold text-sm truncate mb-1" style={{ color: "#e6edf3" }}>{token.name}</div>
        {hasListing ? (
          <div className="flex items-center justify-between">
            <span className="font-mono text-sm" style={{ color: "#22d3ee" }}>{listing.price.toFixed(2)} USD</span>
            {!isOwner && (
              <button onClick={(e) => { e.stopPropagation(); onBuy(listing); }}
                className="h-7 px-3 rounded-lg text-xs font-bold"
                style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                Buy
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "#9da7b3" }}>Not listed</span>
            {isOwner && (
              <button onClick={(e) => { e.stopPropagation(); onList(token); }}
                className="h-7 px-3 rounded-lg text-xs font-bold"
                style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                List
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Buy Modal ────────────────────────────────────────────────────────────────
function BuyModal({ listing, token, onClose, pathUSD }) {
  const { buy, step, error } = useBuyNFT(pathUSD);

  const stepLabel = {
    idle:      "Buy Now",
    approving: "Approving USD...",
    buying:    "Buying NFT...",
    done:      "Done! 🎉",
    error:     "Try Again",
  }[step];

  async function handleBuy() {
    await buy(BigInt(listing.listing_id), BigInt(Math.round(listing.price * 1e6)));
    if (step === "done") setTimeout(onClose, 1500);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6"
        style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="aspect-square rounded-xl overflow-hidden mb-4">
          <NFTImage src={token?.image} alt={token?.name} className="w-full h-full" style={{ objectFit: "cover" }} />
        </div>
        <div className="font-bold text-lg mb-1" style={{ color: "#e6edf3" }}>{token?.name}</div>
        <div className="font-mono text-2xl mb-6" style={{ color: "#22d3ee" }}>{listing.price.toFixed(2)} USD</div>

        {error && (
          <div className="rounded-xl px-4 py-2 mb-4 text-xs"
            style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)" }}>
            {error}
          </div>
        )}

        <button onClick={handleBuy}
          disabled={step === "approving" || step === "buying" || step === "done"}
          className="w-full h-12 rounded-xl font-bold text-sm mb-3"
          style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif", opacity: step === "approving" || step === "buying" ? 0.7 : 1 }}>
          {stepLabel}
        </button>
        <button onClick={onClose}
          className="w-full h-10 rounded-xl text-sm font-semibold"
          style={{ background: "transparent", color: "#9da7b3", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main CollectionPage ──────────────────────────────────────────────────────
export default function CollectionPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const { address }  = useAccount();

  const { collection } = useCollection(id);
  const { listings }   = useRealtimeListings(collection?.contract_address || NFT_CONTRACT);
  const { pathUSD }    = useMarketplaceInfo();

  const [tokens, setTokens]             = useState([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [page, setPage]                 = useState(1);
  const PAGE_SIZE = 20;

  const [tab, setTab]           = useState("Items");
  const [view, setView]         = useState("grid");
  const [buyTarget, setBuyTarget] = useState(null);
  const [listModal, setListModal] = useState(null);

  useEffect(() => {
    setTokensLoading(true);
    const start = (page - 1) * PAGE_SIZE + 1;
    const end   = Math.min(start + PAGE_SIZE - 1, TOTAL_SUPPLY);
    const ids   = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    Promise.all(ids.map(fetchTokenMetadata)).then((results) => {
      setTokens(results);
      setTokensLoading(false);
    });
  }, [page]);

  const listingMap = listings.reduce((acc, l) => {
    acc[l.token_id] = l;
    return acc;
  }, {});

  const col = collection || {
    name: "TEMPONYAW", verified: true,
    logo_url: `${IPFS_BASE}1.png`, banner_url: null,
    floor_price: 0, volume_total: 0, total_sales: 0,
    total_supply: TOTAL_SUPPLY,
    description: "The official TEMPONYAW NFT collection on Tempo Chain.",
    contract_address: NFT_CONTRACT,
  };

  const totalPages = Math.ceil(TOTAL_SUPPLY / PAGE_SIZE);

  return (
    <div className="fade-up">
      {/* Banner */}
      <div className="relative h-44 w-full overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0e2233 0%, #0B1A2E 40%, #031220 100%)" }}>
        {col.banner_url && <img src={col.banner_url} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, #0b0f14)" }} />
      </div>

      <div className="px-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-end gap-5 -mt-10 mb-6 relative z-10 flex-wrap">
          <div className="w-20 h-20 rounded-2xl flex-shrink-0 overflow-hidden"
            style={{ border: "3px solid #0b0f14", background: "#161d28" }}>
            <NFTImage src={col.logo_url} alt={col.name} className="w-full h-full" style={{ objectFit: "cover" }} />
          </div>

          <div className="pb-1 flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-extrabold" style={{ color: "#e6edf3" }}>{col.name}</h1>
              {col.verified && <CheckCircle2 size={16} color="#22d3ee" />}
            </div>
            <p className="text-sm mt-0.5" style={{ color: "#9da7b3" }}>{col.total_supply?.toLocaleString()} items</p>
            {col.description && <p className="text-xs mt-1 max-w-md" style={{ color: "#9da7b3" }}>{col.description}</p>}
          </div>

          <div className="flex items-center gap-2 pb-1">
            {col.twitter && (
              <a href={col.twitter} target="_blank" rel="noreferrer"
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}>
                <Twitter size={13} />
              </a>
            )}
            {col.website && (
              <a href={col.website} target="_blank" rel="noreferrer"
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}>
                <Globe size={13} />
              </a>
            )}
            {/* ✅ Mainnet explorer */}
            <a href={`${EXPLORER_BASE}/address/${col.contract_address}`}
              target="_blank" rel="noreferrer"
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}>
              <ExternalLink size={13} />
            </a>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: "Floor Price",   value: col.floor_price  ? `${col.floor_price.toFixed(2)} USD`       : "—" },
            { label: "Total Volume",  value: col.volume_total ? `${col.volume_total.toLocaleString()} USD` : "—" },
            { label: "Total Sales",   value: col.total_sales  || "—" },
            { label: "Items",         value: col.total_supply?.toLocaleString() || "2,000" },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-3"
              style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#9da7b3" }}>{label}</div>
              <div className="font-mono text-sm font-bold" style={{ color: "#e6edf3" }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          {TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="h-10 px-4 text-sm font-semibold transition-colors -mb-px"
              style={{
                background: "none", border: "none", cursor: "pointer",
                color: tab === t ? "#22d3ee" : "#9da7b3",
                borderBottom: tab === t ? "2px solid #22d3ee" : "2px solid transparent",
                fontFamily: "Syne, sans-serif",
              }}>
              {t}
            </button>
          ))}
          {tab === "Items" && (
            <div className="ml-auto flex items-center gap-1.5">
              {[{ v: "grid", Icon: Grid }, { v: "list", Icon: List }].map(({ v, Icon }) => (
                <button key={v} onClick={() => setView(v)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ background: view === v ? "rgba(34,211,238,0.12)" : "#161d28", border: "none", cursor: "pointer", color: view === v ? "#22d3ee" : "#9da7b3" }}>
                  <Icon size={14} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="pb-12">
          {tab === "Items" && (
            <>
              {tokensLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
              ) : (
                <>
                  <div className={view === "grid"
                    ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4"
                    : "flex flex-col gap-2"}>
                    {tokens.map((token) => (
                      <NFTCard
                        key={token.tokenId}
                        token={token}
                        listing={listingMap[token.tokenId]}
                        onBuy={(listing) => setBuyTarget({ listing, token })}
                        onList={(token) => setListModal(token)}
                        onClick={() => navigate(`/nft/${token.tokenId}`)}
                        isOwner={address?.toLowerCase() === listingMap[token.tokenId]?.seller?.toLowerCase()}
                        view={view}
                      />
                    ))}
                  </div>

                  <div className="flex items-center justify-center gap-3 mt-8">
                    <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                      className="h-9 px-4 rounded-xl text-sm font-semibold"
                      style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: page === 1 ? "#9da7b3" : "#e6edf3", cursor: page === 1 ? "not-allowed" : "pointer", fontFamily: "Syne, sans-serif" }}>
                      ← Prev
                    </button>
                    <span className="text-sm font-mono" style={{ color: "#9da7b3" }}>{page} / {totalPages}</span>
                    <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="h-9 px-4 rounded-xl text-sm font-semibold"
                      style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: page === totalPages ? "#9da7b3" : "#e6edf3", cursor: page === totalPages ? "not-allowed" : "pointer", fontFamily: "Syne, sans-serif" }}>
                      Next →
                    </button>
                  </div>
                </>
              )}
            </>
          )}

          {tab === "Activity"  && <ActivityFeed collectionId={id} />}
          {tab === "Bids"      && <CollectionBids collectionId={id} />}
          {tab === "Analytics" && (
            <div className="rounded-2xl p-6" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="text-sm font-bold mb-4" style={{ color: "#9da7b3" }}>Floor Price History</h3>
              <PriceChart data={[]} />
            </div>
          )}
        </div>
      </div>

      {buyTarget && (
        <BuyModal listing={buyTarget.listing} token={buyTarget.token}
          pathUSD={pathUSD} onClose={() => setBuyTarget(null)} />
      )}
      {listModal && <ListModal nft={listModal} onClose={() => setListModal(null)} />}
    </div>
  );
}
