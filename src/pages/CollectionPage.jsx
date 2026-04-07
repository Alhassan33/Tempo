import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  CheckCircle2, 
  Grid, 
  List, 
  ExternalLink, 
  Twitter, 
  Globe, 
  MessageCircle 
} from "lucide-react";
import { useAccount } from "wagmi";
import { useCollection, useRealtimeListings } from "@/hooks/useSupabase";
import { useMarketplace } from "@/hooks/useMarketplace"; 
import NFTImage from "@/components/NFTImage.jsx";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import CollectionBids from "@/components/CollectionBids.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import { extractImageUrl } from "@/utils/nftImageUtils.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const TABS = ["Items", "Activity", "Bids", "Analytics"];
const IPFS_BASE = "https://gateway.lighthouse.storage/ipfs/bafybeiaksg5cena4ucpfjyqghnox73cflc6c4du2g3sn4qtovgzl67inpu/";
const NFT_CONTRACT = "0x1Ee82CC5946EdBD88eaf90D6d3c2B5baA4f9966C";
const TOTAL_SUPPLY = 2000;
const EXPLORER_BASE = "https://explore.tempo.xyz";

async function fetchTokenMetadata(tokenId) {
  try {
    const url = `${IPFS_BASE}${tokenId}.json`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("not found");
    const json = await res.json();
    return {
      tokenId,
      name: json.name || `TEMPONYAW #${tokenId}`,
      image: extractImageUrl(json) || `${IPFS_BASE}${tokenId}.png`,
      attributes: json.attributes || [],
    };
  } catch {
    return {
      tokenId,
      name: `TEMPONYAW #${tokenId}`,
      image: `${IPFS_BASE}${tokenId}.png`,
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
  const { id } = useParams();
  const navigate = useNavigate();
  const { address } = useAccount();

  const { collection, loading: colLoading } = useCollection(id);
  const { listings: supabaseListings } = useRealtimeListings(collection?.contract_address || NFT_CONTRACT);
  
  const [tokens, setTokens] = useState([]);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const [tab, setTab] = useState("Items");
  const [view, setView] = useState("grid");
  const [buyTarget, setBuyTarget] = useState(null);
  const [listModal, setListModal] = useState(null);

  useEffect(() => {
    setTokensLoading(true);
    const start = (page - 1) * PAGE_SIZE + 1;
    const end = Math.min(start + PAGE_SIZE - 1, TOTAL_SUPPLY);
    const ids = Array.from({ length: end - start + 1 }, (_, i) => start + i);

    Promise.all(ids.map(fetchTokenMetadata)).then((results) => {
      setTokens(results);
      setTokensLoading(false);
    });
  }, [page]);

  const listingMap = supabaseListings.reduce((acc, l) => {
    acc[l.token_id] = l;
    return acc;
  }, {});

  // ✅ Fallback and Data Source Mapping
  const col = collection || {
    name: "TEMPONYAW", 
    verified: true,
    logo_url: `https://snnezzwrfxhawzcakfqc.supabase.co/storage/v1/object/public/collection_assets/Temponyaw/Nyaw-logo.jpg`, 
    banner_url: `https://snnezzwrfxhawzcakfqc.supabase.co/storage/v1/object/public/collection_assets/Temponyaw/Nyaw-banner.jpg`,
    floor_price: 0, 
    volume_total: 0, 
    total_sales: 0,
    total_supply: TOTAL_SUPPLY,
    description: "The official TEMPONYAW NFT collection on Tempo Chain.",
    contract_address: NFT_CONTRACT,
    twitter: "https://x.com/Temponyan",
    discord: "https://discord.gg/RR8kw4EqNF",
    website: "https://temponyaw.xyz"
  };

  return (
    <div className="fade-up min-h-screen">
      {/* Banner */}
      <div className="relative h-64 w-full overflow-hidden bg-slate-900">
        {col.banner_url && <img src={col.banner_url} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f14] via-transparent to-transparent" />
      </div>

      <div className="px-6 max-w-7xl mx-auto">
        {/* Profile Header section - OpenSea/Magic Eden Style */}
        <div className="flex items-end gap-6 -mt-16 mb-8 relative z-10 flex-wrap">
          <div className="w-32 h-32 rounded-3xl flex-shrink-0 overflow-hidden border-8 border-[#0b0f14] bg-[#161d28] shadow-2xl">
            <NFTImage src={col.logo_url} alt={col.name} className="w-full h-full object-cover" />
          </div>
          
          <div className="pb-2 flex-1 min-w-0">
             <div className="flex items-center gap-2 mb-2">
                <h1 className="text-4xl font-black text-white uppercase tracking-tight">{col.name}</h1>
                {col.verified && <CheckCircle2 size={24} className="fill-cyan-400 text-[#0b0f14]" />}
             </div>
             
             {/* Social Bar */}
             <div className="flex items-center gap-5">
                <p className="text-gray-400 font-medium">{col.total_supply?.toLocaleString()} items</p>
                <div className="h-4 w-[1px] bg-white/10" />
                <div className="flex items-center gap-4 text-gray-400">
                   {col.website && (
                      <a href={col.website} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                         <Globe size={20} />
                      </a>
                   )}
                   {col.twitter && (
                      <a href={col.twitter} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                         <Twitter size={20} />
                      </a>
                   )}
                   {col.discord && (
                      <a href={col.discord} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                         <MessageCircle size={20} />
                      </a>
                   )}
                   <a href={`${EXPLORER_BASE}/address/${col.contract_address}`} target="_blank" rel="noreferrer" className="hover:text-white transition-colors">
                      <ExternalLink size={20} />
                   </a>
                </div>
             </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div className="rounded-2xl p-4 bg-[#121821] border border-white/5 shadow-sm">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Floor Price</div>
                <div className="font-mono text-xl font-black text-white">{col.floor_price > 0 ? `${col.floor_price} USD` : "—"}</div>
            </div>
            <div className="rounded-2xl p-4 bg-[#121821] border border-white/5 shadow-sm">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Volume</div>
                <div className="font-mono text-xl font-black text-white">{col.volume_total || 0} USD</div>
            </div>
            <div className="rounded-2xl p-4 bg-[#121821] border border-white/5 shadow-sm">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Owners</div>
                <div className="font-mono text-xl font-black text-white">{col.owners || 0}</div>
            </div>
            <div className="rounded-2xl p-4 bg-[#121821] border border-white/5 shadow-sm">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">Items</div>
                <div className="font-mono text-xl font-black text-white">{col.total_supply?.toLocaleString()}</div>
            </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-8 mb-8 border-b border-white/5">
            {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} 
                  className={`h-12 px-2 text-sm font-bold border-b-2 transition-all relative ${
                    tab === t ? 'text-cyan-400 border-cyan-400' : 'text-gray-500 border-transparent hover:text-gray-300'
                  }`}>
                    {t}
                </button>
            ))}
        </div>

        {/* Main Content */}
        <div className="pb-20">
          {tab === "Items" && (
            <>
              {tokensLoading ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                  {Array.from({ length: 10 }).map((_, i) => <CardSkeleton key={i} />)}
                </div>
              ) : (
                <div className={view === "grid" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6" : "flex flex-col gap-3"}>
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
          {tab === "Bids" && <CollectionBids collectionId={id} />}
          {tab === "Analytics" && <PriceChart collectionId={id} />}
        </div>
      </div>

      {/* Modals */}
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

