import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  ArrowLeft, ExternalLink, Tag, ShoppingCart,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Layers, Heart, Share2, Check, Copy, Gavel, RefreshCw
} from "lucide-react";

import { useCollection, useListings } from "@/hooks/useSupabase";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useNFTMetadata, formatTraits, traitColor } from "@/hooks/useNFTMetadata";
import ListModal from "@/components/ListModal.jsx";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import CollectionBids from "@/components/CollectionBids.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import NFTImage from "@/components/NFTImage.jsx";

const EXPLORER_BASE = "https://explore.tempo.xyz";
const TABS = ["Details", "Activity", "Offers", "Analytics"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function shortenAddress(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtPrice(raw) {
  if (!raw) return "—";
  return Number(raw).toFixed(2);
}

// ─── Trait Badge ──────────────────────────────────────────────────────────────
function TraitBadge({ trait, index }) {
  const c = traitColor(index);
  // Support both hook-formatted 'type' and raw 'trait_type'
  const label = trait.type || trait.trait_type || "Property";
  const value = trait.value || "—";
  
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1 transition-all border hover:brightness-110"
      style={{ background: c.bg, borderColor: c.border }}>
      <span className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: c.color }}>
        {label}
      </span>
      <span className="text-sm font-bold truncate text-white">
        {value}
      </span>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NFTItemPage() {
  const { id: collectionSlug, tokenId } = useParams();
  const navigate = useNavigate();
  const { address } = useAccount();

  // 1. Fetch Collection Data (contains the base URI and contract address)
  const { collection, loading: colLoading } = useCollection(collectionSlug);
  const nftContract = collection?.contract_address;

  // 2. Fetch Metadata (Passing the dynamic baseUri is what fixes the missing traits)
  const { metadata, loading: metaLoading } = useNFTMetadata(
    nftContract,
    tokenId, 
    collection?.metadata_base_uri 
  );

  // 3. Fetch Marketplace Listings
  const { listings } = useListings(nftContract);
  const { clearStatus } = useMarketplace();

  const [tab, setTab] = useState("Details");
  const [showBuy, setShowBuy] = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [showList, setShowList] = useState(false);
  const [liked, setLiked] = useState(false);
  const [shared, setShared] = useState(false);

  const listing = listings?.find(
    (l) => Number(l.token_id) === Number(tokenId) && l.active
  );

  const isOwner = address && listing?.seller?.toLowerCase() === address?.toLowerCase();
  const traits = metadata?.attributes ? formatTraits(metadata.attributes) : [];

  if (colLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="animate-spin text-cyan-400" size={32} />
        <span className="text-xs font-mono text-gray-500 uppercase tracking-widest">Loading Collection Data</span>
      </div>
    );
  }

  return (
    <div className="fade-up max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Top Nav */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate(`/collection/${collectionSlug}`)}
          className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500 hover:text-cyan-400 transition-colors">
          <ArrowLeft size={14} /> {collection?.name || "Back"}
        </button>
        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] font-mono text-gray-400">
          ID: {tokenId}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Left: Media Area (40%) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="aspect-square rounded-3xl overflow-hidden border border-white/5 bg-[#121821] relative shadow-2xl">
            <NFTImage 
              src={metadata?.image} 
              alt={metadata?.name} 
              className="w-full h-full object-cover" 
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={() => setLiked(!liked)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 text-white">
                <Heart size={18} fill={liked ? "#EF4444" : "none"} className={liked ? "text-red-500" : ""} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <a href={`${EXPLORER_BASE}/address/${nftContract}`} target="_blank" className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold uppercase text-gray-400 hover:bg-white/10 transition-all">
              <ExternalLink size={12} /> View Contract
            </a>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); setShared(true); setTimeout(()=>setShared(false), 2000); }} 
              className="flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/5 text-[10px] font-bold uppercase text-gray-400 hover:bg-white/10 transition-all">
              {shared ? <Check size={12} className="text-green-400"/> : <Share2 size={12} />} {shared ? "Copied" : "Share NFT"}
            </button>
          </div>
        </div>

        {/* Right: Info Area (60%) */}
        <div className="lg:col-span-7">
          <div className="mb-8">
            <h1 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase italic">
              {metadata?.name || `${collection?.name} #${tokenId}`}
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed max-w-xl">
              {metadata?.description || `A unique piece from the ${collection?.name} collection.`}
            </p>
          </div>

          {/* Pricing Card */}
          <div className="p-8 rounded-3xl bg-[#121821] border border-cyan-400/10 mb-8 shadow-xl">
            {listing ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-400/60 mb-2 block">Current Price</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-5xl font-black text-white">{fmtPrice(listing.price)}</span>
                    <span className="text-xl font-bold text-gray-500">USD</span>
                  </div>
                </div>
                <div className="flex gap-3">
                  {isOwner ? (
                    <button onClick={() => setShowList(true)} className="h-14 px-8 rounded-2xl bg-white/5 border border-white/10 text-white font-bold hover:bg-white/10 transition-all">
                      Edit Listing
                    </button>
                  ) : (
                    <button onClick={() => setShowBuy(true)} className="h-14 px-10 rounded-2xl bg-cyan-400 text-black font-black uppercase tracking-tighter hover:scale-105 transition-transform flex items-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                      <ShoppingCart size={20} /> Buy Now
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-bold italic uppercase">Not for sale</span>
                {address && (
                   <button onClick={() => setShowList(true)} className="h-12 px-6 rounded-xl bg-cyan-400/10 border border-cyan-400/30 text-cyan-400 font-bold hover:bg-cyan-400/20 transition-all">
                     List for Sale
                   </button>
                )}
              </div>
            )}
          </div>

          {/* Tabs Navigation */}
          <div className="flex gap-8 border-b border-white/5 mb-8">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`pb-4 text-xs font-black uppercase tracking-widest transition-all ${
                  tab === t ? "text-cyan-400 border-b-2 border-cyan-400" : "text-gray-500 hover:text-white"
                }`}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="min-h-[300px]">
            {tab === "Details" && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 animate-in fade-in slide-in-from-bottom-2">
                {traits.length > 0 ? (
                  traits.map((trait, i) => (
                    <TraitBadge key={i} trait={trait} index={i} />
                  ))
                ) : (
                  <div className="col-span-full py-12 text-center border border-dashed border-white/5 rounded-3xl text-gray-600 text-xs uppercase font-bold tracking-widest">
                    {metaLoading ? "Fetching Metadata..." : "No traits found"}
                  </div>
                )}
              </div>
            )}

            {tab === "Activity" && (
              <div className="bg-[#121821] rounded-3xl p-2 border border-white/5">
                <ActivityFeed nftContract={nftContract} tokenId={tokenId} />
              </div>
            )}

            {tab === "Offers" && (
              <div className="bg-[#121821] rounded-3xl p-8 border border-white/5 text-center">
                <Gavel className="mx-auto mb-4 text-gray-700" size={48} />
                <p className="text-gray-500 text-sm font-bold uppercase tracking-widest">Offers coming soon</p>
              </div>
            )}

            {tab === "Analytics" && (
               <div className="bg-[#121821] rounded-3xl p-6 border border-white/5">
                 <PriceChart nftContract={nftContract} tokenId={tokenId} />
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showList && (
        <ListModal
          nft={{ tokenId: Number(tokenId), name: metadata?.name, image: metadata?.image, contract: nftContract }}
          onClose={() => setShowList(false)}
        />
      )}
    </div>
  );
}
