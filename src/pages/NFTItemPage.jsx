import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  ArrowLeft, ExternalLink, Tag, ShoppingCart,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Layers, Heart, Share2, Check, Copy, XCircle
} from "lucide-react";

import { useCollection, useListings } from "@/hooks/useSupabase";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useNFTMetadata, formatTraits, traitColor } from "@/hooks/useNFTMetadata";
import ListModal from "@/components/ListModal.jsx";
import DelistModal from "@/components/DelistModal.jsx";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import NFTImage from "@/components/NFTImage.jsx";

const EXPLORER_BASE = "https://explore.tempo.xyz";
const TABS = ["Details", "Activity", "My Items", "Analytics"];

function shortenAddress(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/**
 * Convert raw 6-decimal units to display USD
 * DB stores: 25000000 (raw atomic units)
 * Display: 25.00 USD
 */
function fmtPrice(raw) {
  if (!raw) return "—";
  return (Number(raw) / 1e6).toFixed(2);
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button 
      onClick={() => { 
        navigator.clipboard.writeText(text); 
        setCopied(true); 
        setTimeout(() => setCopied(false), 2000); 
      }}
      style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#00E6A8" : "#9CA3AF" }}
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function TraitBadge({ trait, index }) {
  const c = traitColor(index);
  return (
    <div 
      className="rounded-xl p-3 flex flex-col gap-1 card-hover"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}
    >
      <span className="text-[9px] font-medium uppercase tracking-widest truncate" style={{ color: c.color }}>
        {trait.type}
      </span>
      <span className="text-sm font-bold truncate" style={{ color: "#EDEDED" }}>
        {trait.value}
      </span>
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div 
      className="rounded-2xl overflow-hidden"
      style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}
    >
      <button 
        onClick={() => setOpen(o => !o)} 
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ background: "none", border: "none", cursor: "pointer" }}
      >
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={14} style={{ color: "#00E6A8" }} />}
          <span className="text-xs font-medium uppercase tracking-widest" style={{ color: "#9CA3AF" }}>
            {title}
          </span>
        </div>
        {open ? (
          <ChevronUp size={14} style={{ color: "#9CA3AF" }} />
        ) : (
          <ChevronDown size={14} style={{ color: "#9CA3AF" }} />
        )}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── Sticky Buy Bar ───────────────────────────────────────────────────────────
function StickyBuyBar({ listing, isOwner, onBuy, loading, txStatus, visible }) {
  const navigate = useNavigate();
  const { id: collectionSlug } = useParams();
  
  if (!visible) return null;

  const price = listing ? fmtPrice(listing.price) : null;
  const isSuccess = txStatus?.type === "success";

  return (
    <div 
      className={`sticky-action-bar ${visible ? '' : 'hidden'}`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        {/* Price Info */}
        {listing ? (
          <div className="flex items-center gap-4">
            <div>
              <div 
                className="text-[10px] uppercase tracking-wider mb-0.5"
                style={{ color: "#9CA3AF" }}
              >
                Current Price
              </div>
              <div 
                className="font-mono-web3 text-xl font-bold"
                style={{ color: "#00E6A8" }}
              >
                {price} <span className="text-sm">USD</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-sm" style={{ color: "#9CA3AF" }}>
            Not listed for sale
          </div>
        )}

        {/* Action Button */}
        {listing ? (
          isOwner ? (
            // Owner sees Cancel Listing
            <button
              onClick={onBuy}
              disabled={loading}
              className="px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
              style={{
                background: loading ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.15)",
                color: "#EF4444",
                border: "1px solid rgba(239,68,68,0.3)",
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              <XCircle size={16} />
              Cancel Listing
            </button>
          ) : (
            // Buyer sees Buy Now
            <button
              onClick={onBuy}
              disabled={loading || isSuccess}
              className="px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
              style={{
                background: isSuccess ? "#22C55E" : "#00E6A8",
                color: "#0A0F14",
                cursor: loading || isSuccess ? "not-allowed" : "pointer",
                boxShadow: isSuccess ? "none" : "0 0 24px rgba(0, 230, 168, 0.3)",
              }}
              onMouseEnter={(e) => {
                if (!loading && !isSuccess) {
                  e.currentTarget.style.background = "#00FFC6";
                  e.currentTarget.style.boxShadow = "0 0 32px rgba(0, 230, 168, 0.5)";
                }
              }}
              onMouseLeave={(e) => {
                if (!loading && !isSuccess) {
                  e.currentTarget.style.background = "#00E6A8";
                  e.currentTarget.style.boxShadow = "0 0 24px rgba(0, 230, 168, 0.3)";
                }
              }}
            >
              {loading && (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              )}
              {isSuccess && <CheckCircle2 size={16} />}
              <ShoppingCart size={16} />
              {isSuccess ? "Purchased!" : loading ? "Processing..." : "Buy Now"}
            </button>
          )
        ) : (
          // Not listed - maybe show list button if owner
          <button
            onClick={() => navigate(`/collection/${collectionSlug}/${tokenId}/list`)}
            className="px-6 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
            style={{
              background: "rgba(0, 230, 168, 0.1)",
              color: "#00E6A8",
              border: "1px solid rgba(0, 230, 168, 0.3)",
            }}
          >
            <Tag size={16} />
            List for Sale
          </button>
        )}
      </div>

      {/* Status Message */}
      {txStatus && txStatus.type !== "success" && (
        <div 
          className="px-4 pb-3"
          style={{ 
            background: txStatus.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(0,230,168,0.05)" 
          }}
        >
          <div 
            className="max-w-6xl mx-auto text-xs py-2 px-3 rounded-lg"
            style={{
              background: txStatus.type === "error" ? "rgba(239,68,68,0.1)" : "rgba(0,230,168,0.1)",
              color: txStatus.type === "error" ? "#EF4444" : "#00E6A8",
              border: `1px solid ${txStatus.type === "error" ? "rgba(239,68,68,0.2)" : "rgba(0,230,168,0.2)"}`,
            }}
          >
            <div className="flex items-center gap-2">
              <AlertCircle size={12} />
              {txStatus.msg}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── My Items Tab ─────────────────────────────────────────────────────────────
function MyItemsTab({ nftContract, collectionSlug, baseUri, collection }) {
  const { address } = useAccount();
  const navigate = useNavigate();
  const { listings } = useListings(nftContract);

  const myListings = listings.filter(
    l => l.seller?.toLowerCase() === address?.toLowerCase() && l.active
  );

  if (!address) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: "#9CA3AF" }}>
        Connect your wallet to see your items.
      </div>
    );
  }

  if (myListings.length === 0) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: "#9CA3AF" }}>
        You have no active listings for this collection.
        <div className="mt-2 text-xs" style={{ color: "#6B7280" }}>
          Own NFTs from this collection? List them from the NFT item page.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {myListings.map((l) => (
        <div 
          key={l.listing_id}
          className="rounded-2xl overflow-hidden cursor-pointer card-hover"
          style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.05)" }}
          onClick={() => navigate(`/collection/${collectionSlug}/${l.token_id}`)}
        >
          <MyItemCard tokenId={l.token_id} baseUri={baseUri} nftContract={nftContract} price={l.price} />
        </div>
      ))}
    </div>
  );
}

function MyItemCard({ tokenId, baseUri, nftContract, price }) {
  const { metadata, loading } = useNFTMetadata(nftContract, tokenId, baseUri);
  return (
    <>
      <div className="aspect-square overflow-hidden" style={{ background: "#121821" }}>
        {loading ? (
          <div className="w-full h-full animate-pulse" style={{ background: "#161d28" }} />
        ) : (
          <NFTImage 
            src={metadata?.image} 
            alt={metadata?.name} 
            className="w-full h-full object-cover" 
            style={{ objectFit: "cover" }} 
          />
        )}
      </div>
      <div className="p-3">
        <div className="text-xs font-semibold truncate mb-1" style={{ color: "#EDEDED" }}>
          {metadata?.name || `#${tokenId}`}
        </div>
        <div className="font-mono-web3 text-xs" style={{ color: "#00E6A8" }}>
          {fmtPrice(price)} USD <span style={{ color: "#9CA3AF" }}>listed</span>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NFTItemPage() {
  const { id: collectionSlug, tokenId } = useParams();
  const navigate = useNavigate();
  const { address } = useAccount();

  const { collection, isLoading: colLoading } = useCollection(collectionSlug);
  const nftContract = collection?.contract_address;
  const baseUri = collection?.metadata_base_uri;

  const { metadata, loading: metaLoading } = useNFTMetadata(nftContract, tokenId, baseUri);
  const { listings } = useListings(nftContract);
  const { buyNFT, delistNFT, loading, txStatus, clearStatus } = useMarketplace();

  const [tab, setTab] = useState("Details");
  const [showList, setShowList] = useState(false);
  const [showDelist, setShowDelist] = useState(false);
  const [liked, setLiked] = useState(false);
  const [shared, setShared] = useState(false);
  const [showStickyBar, setShowStickyBar] = useState(true);
  const lastScrollY = useRef(0);

  const listing = listings.find(l => Number(l.token_id) === Number(tokenId) && l.active);
  const isOwner = address && listing?.seller?.toLowerCase() === address?.toLowerCase();
  const traits = metadata ? formatTraits(metadata.attributes || []) : [];
  const tokenNum = Number(tokenId);
  const totalSupply = collection?.total_supply || 0;

  // Scroll handler for sticky bar
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      if (currentScrollY > lastScrollY.current && currentScrollY > 200) {
        setShowStickyBar(false);
      } else {
        setShowStickyBar(true);
      }
      
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Clear status on unmount
  useEffect(() => {
    return () => clearStatus();
  }, [clearStatus]);

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  async function handleBuy() {
    if (!listing) return;
    
    if (isOwner) {
      // Owner cancels listing
      setShowDelist(true);
    } else {
      // Buyer purchases
      const listingWithId = {
        ...listing,
        listingId: listing.listingId || listing.listing_id
      };
      await buyNFT(listingWithId);
    }
  }

  if (colLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div 
        className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: "#00E6A8", borderTopColor: "transparent" }} 
      />
    </div>
  );

  return (
    <div className="fade-up max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-32">
      {/* Top nav */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={() => navigate(`/collection/${collectionSlug}`)}
          className="flex items-center gap-2 text-sm"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}
        >
          <ArrowLeft size={14} /> {collection?.name ?? "Collection"}
        </button>
        <div className="flex items-center gap-2">
          <button 
            disabled={tokenNum <= 1}
            onClick={() => navigate(`/collection/${collectionSlug}/${tokenNum - 1}`)}
            className="h-8 px-3 rounded-lg text-xs font-medium"
            style={{ 
              background: "#11161D", 
              border: "1px solid rgba(255,255,255,0.05)", 
              color: tokenNum > 1 ? "#EDEDED" : "#6B7280", 
              cursor: tokenNum > 1 ? "pointer" : "not-allowed" 
            }}
          >
            ← Prev
          </button>
          <span className="font-mono-web3 text-xs" style={{ color: "#9CA3AF" }}>#{tokenId}</span>
          <button 
            disabled={totalSupply > 0 && tokenNum >= totalSupply}
            onClick={() => navigate(`/collection/${collectionSlug}/${tokenNum + 1}`)}
            className="h-8 px-3 rounded-lg text-xs font-medium"
            style={{ 
              background: "#11161D", 
              border: "1px solid rgba(255,255,255,0.05)", 
              color: "#EDEDED", 
              cursor: "pointer" 
            }}
          >
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Image + Traits */}
        <div className="space-y-4">
          <div 
            className="aspect-square rounded-2xl overflow-hidden relative"
            style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            {metaLoading || !baseUri ? (
              <div className="w-full h-full animate-pulse" style={{ background: "#161d28" }} />
            ) : (
              <NFTImage 
                src={metadata?.image} 
                alt={metadata?.name}
                className="w-full h-full" 
                style={{ objectFit: "cover" }} 
              />
            )}
            <div className="absolute top-3 right-3 flex gap-2">
              <button 
                onClick={() => setLiked(l => !l)}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ 
                  background: "rgba(10, 15, 20, 0.8)", 
                  backdropFilter: "blur(8px)", 
                  border: "1px solid rgba(255,255,255,0.08)", 
                  color: liked ? "#EF4444" : "#9CA3AF",
                  cursor: "pointer"
                }}
              >
                <Heart size={14} fill={liked ? "#EF4444" : "none"} />
              </button>
              <button 
                onClick={handleShare}
                className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                style={{ 
                  background: "rgba(10, 15, 20, 0.8)", 
                  backdropFilter: "blur(8px)", 
                  border: "1px solid rgba(255,255,255,0.08)", 
                  color: shared ? "#00E6A8" : "#9CA3AF",
                  cursor: "pointer"
                }}
              >
                {shared ? <Check size={14} /> : <Share2 size={14} />}
              </button>
            </div>
          </div>

          {nftContract && (
            <div className="flex items-center gap-3 px-1">
              <a 
                href={`${EXPLORER_BASE}/address/${nftContract}`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs hover:text-white transition-colors"
                style={{ color: "#9CA3AF", textDecoration: "none" }}
              >
                <ExternalLink size={11} /> Contract
              </a>
              <span style={{ color: "#6B7280" }}>·</span>
              <a 
                href={`${EXPLORER_BASE}/token/${nftContract}/instance/${tokenId}`} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-1.5 text-xs hover:text-white transition-colors"
                style={{ color: "#9CA3AF", textDecoration: "none" }}
              >
                <ExternalLink size={11} /> Token #{tokenId}
              </a>
            </div>
          )}

          {traits.length > 0 && (
            <Section title={`Traits · ${traits.length}`} icon={Layers}>
              <div className="grid grid-cols-2 gap-2">
                {traits.map((trait, i) => <TraitBadge key={i} trait={trait} index={i} />)}
              </div>
            </Section>
          )}
        </div>

        {/* Right: Info + Actions */}
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-medium" style={{ color: "#00E6A8" }}>
                {collection?.name}
              </span>
              {collection?.verified && <CheckCircle2 size={12} style={{ color: "#00E6A8" }} />}
            </div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "#EDEDED" }}>
              {metaLoading ? (
                <div className="h-8 w-48 rounded animate-pulse" style={{ background: "#161d28" }} />
              ) : (
                metadata?.name ?? `${collection?.name} #${tokenId}`
              )}
            </h1>
            {metadata?.description && (
              <p className="text-sm" style={{ color: "#9CA3AF" }}>{metadata.description}</p>
            )}
          </div>

          {/* Price Display (no buttons here anymore) */}
          {listing && (
            <div 
              className="rounded-2xl p-5"
              style={{ background: "#11161D", border: "1px solid rgba(0,230,168,0.1)" }}
            >
              <div className="text-xs mb-1 font-medium uppercase tracking-wide" style={{ color: "#9CA3AF" }}>
                Current Price
              </div>
              <div className="font-mono-web3 text-4xl font-bold" style={{ color: "#00E6A8" }}>
                {fmtPrice(listing.price)}<span className="text-xl ml-2" style={{ color: "#9CA3AF" }}>USD</span>
              </div>
              <div className="text-xs mt-1" style={{ color: "#9CA3AF" }}>
                Listed by {shortenAddress(listing.seller)}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div 
            className="flex items-center gap-1 overflow-x-auto border-b"
            style={{ borderColor: "rgba(255,255,255,0.05)" }}
          >
            {TABS.map(t => (
              <button 
                key={t} 
                onClick={() => setTab(t)}
                className="h-10 px-3 text-xs font-medium uppercase tracking-wide -mb-px whitespace-nowrap"
                style={{ 
                  background: "none", 
                  border: "none", 
                  cursor: "pointer", 
                  color: tab === t ? "#00E6A8" : "#9CA3AF", 
                  borderBottom: tab === t ? "2px solid #00E6A8" : "2px solid transparent" 
                }}
              >
                {t}
              </button>
            ))}
          </div>

          <div>
            {tab === "Details" && (
              <div 
                className="rounded-2xl overflow-hidden"
                style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                {[
                  { label: "Token ID", value: `#${tokenId}`, mono: true },
                  { label: "Contract", value: shortenAddress(nftContract), mono: true, copy: nftContract },
                  { label: "Standard", value: "ERC-721", mono: false },
                  { label: "Network", value: "Tempo Chain", mono: false },
                  { label: "Supply", value: collection?.total_supply?.toLocaleString() ?? "—", mono: true },
                  { label: "Royalties", value: collection?.royalty_bps != null ? `${collection.royalty_bps / 100}%` : "—", mono: true },
                ].map(({ label, value, mono, copy }, i, arr) => (
                  <div 
                    key={label} 
                    className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.03)" : "none" }}
                  >
                    <span className="text-xs" style={{ color: "#9CA3AF" }}>{label}</span>
                    <div className="flex items-center gap-2">
                      <span 
                        className={`text-xs font-semibold ${mono ? "font-mono-web3" : ""}`} 
                        style={{ color: "#EDEDED" }}
                      >
                        {value ?? "—"}
                      </span>
                      {copy && <CopyButton text={copy} />}
                    </div>
                  </div>
                ))}
              </div>
            )}
            {tab === "Activity" && (
              <ActivityFeed collectionId={collectionSlug} nftContract={nftContract} tokenId={Number(tokenId)} limit={20} />
            )}
            {tab === "My Items" && (
              <MyItemsTab nftContract={nftContract} collectionSlug={collectionSlug} baseUri={baseUri} collection={collection} />
            )}
            {tab === "Analytics" && (
              <div 
                className="rounded-2xl p-5"
                style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}
              >
                <div className="text-xs font-medium uppercase tracking-wide mb-4" style={{ color: "#9CA3AF" }}>
                  Price History
                </div>
                <PriceChart data={[]} tokenId={Number(tokenId)} nftContract={nftContract} />
                <div className="text-center py-6 text-xs" style={{ color: "#6B7280" }}>
                  Price history will appear once this token has sale activity.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky Buy Bar */}
      <StickyBuyBar
        listing={listing}
        isOwner={isOwner}
        onBuy={handleBuy}
        loading={loading}
        txStatus={txStatus}
        visible={showStickyBar}
      />

      {/* Modals */}
      {showList && (
        <ListModal
          nft={{ 
            tokenId: Number(tokenId), 
            name: metadata?.name, 
            image: metadata?.image, 
            collection: collection?.name, 
            contract: nftContract 
          }}
          onClose={() => setShowList(false)}
        />
      )}
      
      {showDelist && listing && (
        <DelistModal
          nft={{
            listingId: listing.listing_id,
            tokenId: Number(tokenId),
            name: metadata?.name,
            image: metadata?.image,
            collection: collection?.name,
            price: listing.price,
            displayPrice: fmtPrice(listing.price)
          }}
          onClose={() => setShowDelist(false)}
        />
      )}
    </div>
  );
}
