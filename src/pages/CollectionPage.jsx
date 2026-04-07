import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Grid, List, ExternalLink, Twitter, Globe } from "lucide-react";
import { useAccount } from "wagmi";
import { useCollection, useRealtimeListings } from "@/hooks/useSupabase";
// ✅ Fixed: Unified hook import
import { useMarketplace } from "@/hooks/useMarketplace"; 
import NFTImage from "@/components/NFTImage.jsx";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import CollectionBids from "@/components/CollectionBids.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS       = ["Items", "Activity", "Bids", "Analytics"];
const IPFS_BASE  = "https://gateway.lighthouse.storage/ipfs/bafybeiaksg5cena4ucpfjyqghnox73cflc6c4du2g3sn4qtovgzl67inpu/";
const NFT_CONTRACT  = "0x1Ee82CC5946EdBD88eaf90D6d3c2B5baA4f9966C";
const TOTAL_SUPPLY  = 2000;
const EXPLORER_BASE = "https://explore.tempo.xyz";

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
            <div className="font-mono text-xs" style={{ color: "#22d3ee" }}>{(Number(listing.price) / 1e18).toFixed(2)} USD</div>
          )}
        </div>
        {hasListing && !isOwner && (
          <button onClick={(e) => { e.stopPropagation(); onBuy(listing); }}
            className="h-8 px-4 rounded-lg text-xs font-bold flex-shrink-0 btn-primary">
            Buy
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
            <span className="font-mono text-sm" style={{ color: "#22d3ee" }}>{(Number(listing.price) / 1e18).toFixed(2)} USD</span>
            {!isOwner && (
              <button onClick={(e) => { e.stopPropagation(); onBuy(listing); }}
                className="h-7 px-3 rounded-lg text-xs font-bold btn-primary">
                Buy
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: "#9da7b3" }}>Not listed</span>
            {isOwner && (
              <button onClick={(e) => { e.stopPropagation(); onList(token); }}
                className="h-7 px-3 rounded-lg text-xs font-bold btn-secondary">
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
function BuyModal({ listing, token, onClose }) {
  // ✅ Fixed: Using unified hook functions
  const { buyNFT, loading, txStatus } = useMarketplace();

  async function handleBuy() {
    await buyNFT(listing);
    if (txStatus?.type === "success") setTimeout(onClose, 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="aspect-square rounded-xl overflow-hidden mb-4">
          <NFTImage src={token?.image} alt={token?.name} className="w-full h-full" style={{ objectFit: "cover" }} />
        </div>
        <div className="font-bold text-lg mb-1" style={{ color: "#e6edf3" }}>{token?.name}</div>
        <div className="font-mono text-2xl mb-6" style={{ color: "#22d3ee" }}>
            {(Number(listing.price) / 1e18).toFixed(2)} USD
        </div>

        {txStatus && (
          <div className={`rounded-xl px-4 py-2 mb-4 text-xs border ${
            txStatus.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            {txStatus.msg}
          </div>
        )}

        <button onClick={handleBuy}
          disabled={loading}
          className="w-full h-12 rounded-xl font-bold text-sm mb-3 btn-primary disabled:opacity-50">
          {loading ? "Processing..." : "Confirm Purchase"}
        </button>
        <button onClick={onClose}
          className="w-full h-10 rounded-xl text-sm font-semibold border border-white/5 text-gray-400 hover:text-white transition-colors">
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

  // Supabase Data
  const { collection } = useCollection(id);
  const { listings: supabaseListings }   = useRealtimeListings(collection?.contract_address || NFT_CONTRACT);
  
  // ✅ Fixed: Destructure what we need from the unified hook
  const { network } = useMarketplace();

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

  const listingMap = supabaseListings.reduce((acc, l) => {
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
    <div className="fade-up min-h-screen">
      {/* Banner */}
      <div className="relative h-44 w-full overflow-hidden bg-slate-900">
        {col.banner_url && <img src={col.banner_url} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f14] to-transparent" />
      </div>

      <div className="px-6 max-w-6xl mx-auto">
        {/* Profile Header section same as before */}
        <div className="flex items-end gap-5 -mt-10 mb-6 relative z-10 flex-wrap">
          <div className="w-20 h-20 rounded-2xl flex-shrink-0 overflow-hidden border-4 border-[#0b0f14] bg-[#161d28]">
            <NFTImage src={col.logo_url} alt={col.name} className="w-full h-full object-cover" />
          </div>
          <div className="pb-1 flex-1 min-w-0">
             <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold text-white">{col.name}</h1>
                {col.verified && <CheckCircle2 size={16} className="text-cyan-400" />}
             </div>
             <p className="text-sm text-gray-400">{col.total_supply?.toLocaleString()} items</p>
          </div>
          <div className="flex items-center gap-2 pb-1">
             <a href={`${EXPLORER_BASE}/address/${col.contract_address}`} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-lg bg-[#161d28] border border-white/5 flex items-center justify-center text-gray-400 hover:text-white">
                <ExternalLink size={13} />
             </a>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl p-3 bg-[#121821] border border-white/5">
                <div className="text-[10px] font-semibold text-gray-500 uppercase">Floor Price</div>
                <div className="font-mono text-sm font-bold text-white">{col.floor_price ? `${col.floor_price} USD` : "—"}</div>
            </div>
            {/* ... other stats */}
        </div>

        {/* Tabs & Content Logic */}
        <div className="flex items-center gap-2 mb-6 border-b border-white/5">
            {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} className={`h-10 px-4 text-sm font-semibold border-b-2 transition-all ${tab === t ? 'text-cyan-400 border-cyan-400' : 'text-gray-500 border-transparent hover:text-gray-300'}`}>
                    {t}
                </button>
            ))}
        </div>

        <div className="pb-12">
          {tab === "Items" && (
            <>
              {tokensLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                  {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
              ) : (
                <div className={view === "grid" ? "grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4" : "flex flex-col gap-2"}>
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
              )}
            </>
          )}
          {tab === "Activity" && <ActivityFeed collectionId={id} />}
        </div>
      </div>

      {buyTarget && (
        <BuyModal 
          listing={buyTarget.listing} 
          token={buyTarget.token}
          onClose={() => setBuyTarget(null)} 
        />
      )}
      {listModal && <ListModal nft={listModal} onClose={() => setListModal(null)} />}
    </div>
  );
}
