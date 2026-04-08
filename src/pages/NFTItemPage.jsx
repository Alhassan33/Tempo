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
  const label = trait.type || trait.trait_type || "Property";
  const value = trait.value || "—";
  
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1 transition-all border hover:brightness-110 shadow-sm"
      style={{ background: c.bg, borderColor: c.border }}>
      <span className="text-[9px] font-bold uppercase tracking-widest truncate opacity-80" style={{ color: c.color }}>
        {label}
      </span>
      <span className="text-sm font-bold truncate text-white">
        {value}
      </span>
    </div>
  );
}

// ─── Section Wrapper ─────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden border border-white/5 bg-[#121821]">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={14} className="text-cyan-400" />}
          <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
            {title}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-600" /> : <ChevronDown size={14} className="text-gray-600" />}
      </button>
      {open && <div className="px-5 pb-5 animate-in fade-in duration-300">{children}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NFTItemPage() {
  const { id: collectionSlug, tokenId } = useParams();
  const navigate = useNavigate();
  const { address } = useAccount();

  // 1. Fetch Collection from Supabase
  const { collection, loading: colLoading } = useCollection(collectionSlug);
  const nftContract = collection?.contract_address;

  // 2. Fetch Metadata (Crucial: Passes contract + baseUri to hook)
  const { metadata, loading: metaLoading } = useNFTMetadata(
    nftContract,
    tokenId, 
    collection?.metadata_base_uri 
  );

  // 3. Listings & Marketplace Logic
  const { listings } = useListings(nftContract);
  const { clearStatus } = useMarketplace();

  const [tab, setTab] = useState("Details");
  const [showBuy, setShowBuy] = useState(false);
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
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Syncing with Tempo...</span>
      </div>
    );
  }

  return (
    <div className="fade-up max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-20">
      
      {/* Top Navigation */}
      <div className="flex items-center justify-between mb-8">
        <button onClick={() => navigate(`/collection/${collectionSlug}`)}
          className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 hover:text-cyan-400 transition-colors">
          <ArrowLeft size={14} /> {collection?.name || "Collection"}
        </button>
        <div className="flex items-center gap-4">
           <span className="text-[10px] font-mono text-gray-500">#{tokenId}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        
        {/* LEFT: Media Section (40%) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="aspect-square rounded-3xl overflow-hidden border border-white/5 bg-[#121821] relative shadow-2xl group">
            <NFTImage 
              src={metadata?.image} 
              alt={metadata?.name} 
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <button onClick={() => setLiked(!liked)} className="w-10 h-10 rounded-xl flex items-center justify-center bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-all">
                <Heart size={18} fill={liked ? "#EF4444" : "none"} className={liked ? "text-red-500" : ""} />
              </button>
            </div>
          </div>

          {/* External Links */}
          <div className="grid grid-cols-2 gap-3">
            <a href={`${EXPLORER_BASE}/address/${nftContract}`} target="_blank" className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black uppercase text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              <ExternalLink size={12} /> Explorer
            </a>
            <button onClick={() => { navigator.clipboard.writeText(window.location.href); setShared(true); setTimeout(()=>setShared(false), 2000); }} 
              className="flex items-center justify-center gap-2 p-3.5 rounded-2xl bg-white/5 border border-white/5 text-[10px] font-black uppercase text-gray-400 hover:text-white hover:bg-white/10 transition-all">
              {shared ? <Check size={12} className="text-green-400"/> : <Share2 size={12} />} {shared ? "Copied" : "Share"}
            </button>
          </div>
        </div>

        {/* RIGHT: Content Section (60%) */}
        <div className="lg:col-span-7">
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
               <span className="text-xs font-bold text-cyan-400 uppercase tracking-widest">{collection?.name}</span>
               {collection?.verified && <CheckCircle2 size={14} className="text-cyan-400" />}
            </div>
            <h1 className="text-5xl font-black text-white mb-4 tracking-tighter uppercase italic leading-none">
              {metadata?.name || `${collection?.name} #${tokenId}`}
            </h1>
            <p className="text-gray-400 text-sm leading-relaxed max-w-xl">
              {metadata?.description || "No description provided for this NFT."}
            </p>
          </div>

          {/* Price & Action Card */}
          <div className="p-8 rounded-3xl bg-[#121821] border border-white/5 mb-10">
            {listing ? (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2 block">Current Price</span>
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
                    <button onClick={() => setShowBuy(true)} className="h-14 px-10 rounded-2xl bg-cyan-400 text-black font-black uppercase tracking-tighter hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_30px_rgba(34,211,238,0.2)]">
                      <ShoppingCart size={20} /> Buy Now
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <span className="text-gray-500 font-bold italic uppercase tracking-widest">Not currently listed</span>
                {address && (
                   <button onClick={() => setShowList(true)} className="h-12 px-6 rounded-xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 font-bold hover:bg-cyan-400/20 transition-all">
                     List Item
                   </button>
                )}
              </div>
            )}
          </div>

          {/* Navigation Tabs */}
          <div className="flex gap-8 border-b border-white/5 mb-8">
            {TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`pb-4 text-xs font-black uppercase tracking-widest transition-all relative ${
                  tab === t ? "text-cyan-400" : "text-gray-500 hover:text-gray-300"
                }`}>
                {t}
                {tab === t && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-cyan-400" />}
              </button>
            ))}
          </div>

          {/* Dynamic Tab Content */}
          <div className="min-h-[300px]">
            {tab === "Details" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {traits.length > 0 ? (
                    traits.map((trait, i) => (
                      <TraitBadge key={i} trait={trait} index={i} />
                    ))
                  ) : (
                    <div className="col-span-full py-16 text-center border border-dashed border-white/5 rounded-3xl text-gray-600">
                      {metaLoading ? (
                        <RefreshCw className="animate-spin mx-auto mb-2 opacity-20" />
                      ) : (
                        <p className="text-[10px] font-bold uppercase tracking-widest">No Traits Found</p>
                      )}
                    </div>
                  )}
                </div>
                
                <Section title="Contract Details" icon={Layers}>
                   <div className="space-y-3 pt-2">
                      <div className="flex justify-between text-xs">
                         <span className="text-gray-500">Contract Address</span>
                         <span className="text-white font-mono">{shortenAddress(nftContract)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                         <span className="text-gray-500">Token ID</span>
                         <span className="text-white font-mono">{tokenId}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                         <span className="text-gray-500">Network</span>
                         <span className="text-white">Tempo Mainnet</span>
                      </div>
                   </div>
                </Section>
              </div>
            )}

            {tab === "Activity" && (
              <div className="bg-[#121821] rounded-3xl border border-white/5 overflow-hidden animate-in fade-in">
                <ActivityFeed nftContract={nftContract} tokenId={tokenId} />
              </div>
            )}

            {tab === "Offers" && (
              <div className="bg-[#121821] rounded-3xl p-12 border border-white/5 text-center animate-in fade-in">
                <Gavel className="mx-auto mb-4 text-gray-700 opacity-20" size={48} />
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.2em]">Offers Module Coming Soon</p>
              </div>
            )}

            {tab === "Analytics" && (
               <div className="bg-[#121821] rounded-3xl p-6 border border-white/5 animate-in fade-in">
                 <PriceChart nftContract={nftContract} tokenId={tokenId} />
               </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showList && (
        <ListModal
          nft={{ 
            tokenId: Number(tokenId), 
            name: metadata?.name || `${collection?.name} #${tokenId}`, 
            image: metadata?.image, 
            contract: nftContract 
          }}
          onClose={() => setShowList(false)}
        />
      )}
    </div>
  );
}
