import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  ArrowLeft, ExternalLink, Tag, ShoppingCart,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Layers
} from "lucide-react";

import { useCollection, useListings } from "@/hooks/useSupabase";
// ✅ Fixed: Using the unified hook
import { useMarketplace } from "@/hooks/useMarketplace";
import { useNFTMetadata, formatTraits, traitColor } from "@/hooks/useNFTMetadata";
import ListModal from "@/components/ListModal.jsx";

const NFT_CONTRACT = "0x1Ee82CC5946EdBD88eaf90D6d3c2B5baA4f9966C";
const COLLECTION_SLUG = "temponyaw";

// ─── Trait Badge ──────────────────────────────────────────────────────────────
function TraitBadge({ trait, index }) {
  const c = traitColor(index);
  return (
    <div className="rounded-xl p-3 flex flex-col gap-0.5" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: c.color }}>{trait.type}</span>
      <span className="text-sm font-bold truncate" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>{trait.value}</span>
    </div>
  );
}

// ─── Buy Modal ────────────────────────────────────────────────────────────────
function BuyModal({ listing, metadata, onClose }) {
  // ✅ Fixed: Using functions from useMarketplace
  const { buyNFT, loading, txStatus } = useMarketplace();

  async function handleBuy() {
    // Note: The hook handles the listingId and conversion to BigInt internally
    await buyNFT(listing);
    if (txStatus?.type === "success") setTimeout(onClose, 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(10px)" }}
      onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl p-6 shadow-2xl"
        style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.1)" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="aspect-square rounded-xl overflow-hidden mb-4" style={{ background: "#161d28" }}>
          {metadata?.image && <img src={metadata.image} alt={metadata.name} className="w-full h-full object-cover" />}
        </div>

        <div className="font-bold text-lg mb-0.5 text-white">{metadata?.name}</div>
        <div className="font-mono text-2xl mb-6 text-cyan-400">
          {(Number(listing.price) / 1e18).toFixed(2)} <span className="text-base text-gray-500">USD</span>
        </div>

        {txStatus && (
          <div className={`flex items-start gap-2 rounded-xl px-3 py-2 mb-4 text-xs border ${
            txStatus.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {txStatus.msg}
          </div>
        )}

        <button
          onClick={handleBuy}
          disabled={loading}
          className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 btn-primary disabled:opacity-50">
          {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
          {loading ? "Processing..." : "Confirm Purchase"}
        </button>

        <button onClick={onClose} className="w-full mt-3 h-9 rounded-xl text-sm text-gray-500 hover:text-white transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Collapsible Section ──────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-5 py-4 bg-transparent border-none cursor-pointer">
        <div className="flex items-center gap-2">
          {Icon && <Icon size={14} className="text-cyan-400" />}
          <span className="text-xs font-bold uppercase tracking-widest text-gray-500" style={{ fontFamily: "Syne, sans-serif" }}>{title}</span>
        </div>
        {open ? <ChevronUp size={14} className="text-gray-500" /> : <ChevronDown size={14} className="text-gray-500" />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NFTItemPage() {
  const { tokenId }  = useParams();
  const navigate     = useNavigate();
  const { address }  = useAccount();

  // Data from Supabase
  const { metadata, loading: metaLoading } = useNFTMetadata(tokenId);
  const { collection }  = useCollection(COLLECTION_SLUG);
  const { listings }    = useListings(NFT_CONTRACT);
  
  // ✅ Fixed: Pulling network and account info from the unified hook
  const { network, account } = useMarketplace();

  const listing = listings.find(
    (l) => Number(l.token_id) === Number(tokenId) && l.active
  );

  const isOwner = address && listing?.seller?.toLowerCase() === address?.toLowerCase();

  const [showBuy,  setShowBuy]  = useState(false);
  const [showList, setShowList] = useState(false);

  const traits    = metadata ? formatTraits(metadata.attributes) : [];
  const explorerBase = "https://explore.tempo.xyz"; // ✅ Correct Mainnet Explorer

  return (
    <div className="fade-up px-4 sm:px-6 max-w-5xl mx-auto py-8">
      <button
        onClick={() => navigate(`/collection/${COLLECTION_SLUG}`)}
        className="flex items-center gap-2 text-sm mb-6 text-gray-500 hover:text-white transition-all bg-transparent border-none cursor-pointer"
        style={{ fontFamily: "Syne, sans-serif" }}>
        <ArrowLeft size={14} /> {collection?.name ?? "Collection"}
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Image */}
        <div>
          <div className="aspect-square rounded-2xl overflow-hidden border border-white/5 bg-[#121821]">
            {metaLoading ? (
              <div className="w-full h-full animate-pulse bg-[#161d28]" />
            ) : (
              <img src={metadata?.image} alt={metadata?.name} className="w-full h-full object-cover" />
            )}
          </div>
          <div className="flex items-center gap-2 mt-3 text-gray-500">
            <a href={`${explorerBase}/address/${NFT_CONTRACT}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs hover:text-white">
              <ExternalLink size={11} /> Contract
            </a>
            <span>·</span>
            <a href={`${explorerBase}/token/${NFT_CONTRACT}/instance/${tokenId}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-xs hover:text-white">
              <ExternalLink size={11} /> Token #{tokenId}
            </a>
          </div>
        </div>

        {/* Right: Info + Actions */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-cyan-400">{collection?.name ?? "TEMPONYAW"}</span>
              {collection?.verified && <CheckCircle2 size={12} className="text-cyan-400" />}
            </div>
            <h1 className="text-2xl font-extrabold text-white" style={{ fontFamily: "Syne, sans-serif" }}>
              {metadata?.name ?? `TEMPONYAW #${tokenId}`}
            </h1>
            {metadata?.description && <p className="text-sm mt-2 text-gray-500">{metadata.description}</p>}
          </div>

          <div className="rounded-2xl p-5 bg-[#121821] border border-white/5">
            {listing ? (
              <>
                <div className="text-xs mb-1 text-gray-500">Listed price</div>
                <div className="font-mono text-3xl font-bold mb-4 text-cyan-400">
                  {(Number(listing.price) / 1e18).toFixed(2)}
                  <span className="text-lg ml-1.5 text-gray-500">USD</span>
                </div>
                {isOwner ? (
                  <button onClick={() => setShowList(true)} className="w-full h-11 rounded-xl text-sm font-bold btn-secondary">
                    Manage Listing
                  </button>
                ) : (
                  <button onClick={() => setShowBuy(true)} className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 btn-primary">
                    <ShoppingCart size={15} /> Buy Now
                  </button>
                )}
              </>
            ) : (
              <div className="py-2">
                <div className="text-sm mb-4 text-gray-500">Not listed for sale</div>
                {address && (
                  <button onClick={() => setShowList(true)} className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 btn-secondary">
                    <Tag size={14} /> List for Sale
                  </button>
                )}
              </div>
            )}
          </div>

          <Section title="Details" icon={Layers}>
            <div className="space-y-2">
              {[
                { label: "Token ID", value: `#${tokenId}` },
                { label: "Contract", value: `${NFT_CONTRACT.slice(0, 6)}...${NFT_CONTRACT.slice(-4)}` },
                { label: "Standard", value: "ERC-721" },
                { label: "Network", value: "Tempo Chain" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-xs py-1.5 border-b border-white/5">
                  <span className="text-gray-500">{label}</span>
                  <span className="font-mono font-semibold text-white">{value}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>

      {showBuy && listing && (
        <BuyModal listing={listing} metadata={metadata} onClose={() => setShowBuy(false)} />
      )}
      {showList && (
        <ListModal nft={{ tokenId: Number(tokenId), ...metadata }} onClose={() => setShowList(false)} />
      )}
    </div>
  );
}
