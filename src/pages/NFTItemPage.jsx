import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import {
  ArrowLeft, ExternalLink, Tag, ShoppingCart,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Layers, Heart, Share2, Check, Copy, Gavel, XCircle
} from "lucide-react";

import { useCollection, useListings } from "@/hooks/useSupabase";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useNFTMetadata, formatTraits, traitColor } from "@/hooks/useNFTMetadata";
import ListModal from "@/components/ListModal.jsx";
import DelistModal from "@/components/DelistModal.jsx";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import CollectionBids from "@/components/CollectionBids.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import NFTImage from "@/components/NFTImage.jsx";

const EXPLORER_BASE = "https://explore.tempo.xyz";
const TABS = ["Details", "Activity", "My Items", "Offers", "Analytics"];

function shortenAddress(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtPrice(raw) {
  if (!raw) return "—";
  return Number(raw).toFixed(2);
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#22d3ee" : "#9da7b3" }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

function TraitBadge({ trait, index }) {
  const c = traitColor(index);
  return (
    <div className="rounded-xl p-3 flex flex-col gap-1 card-hover"
      style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <span className="text-[9px] font-bold uppercase tracking-widest truncate" style={{ color: c.color }}>{trait.type}</span>
      <span className="text-sm font-bold truncate" style={{ color: "#e6edf3" }}>{trait.value}</span>
    </div>
  );
}

function Section({ title, icon: Icon, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4"
        style={{ background: "none", border: "none", cursor: "pointer" }}>
        <div className="flex items-center gap-2.5">
          {Icon && <Icon size={14} style={{ color: "#22d3ee" }} />}
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9da7b3" }}>{title}</span>
        </div>
        {open ? <ChevronUp size={14} style={{ color: "#9da7b3" }} /> : <ChevronDown size={14} style={{ color: "#9da7b3" }} />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

function BuyModal({ listing, metadata, onClose }) {
  const { buyNFT, loading, txStatus, clearStatus } = useMarketplace();

  async function handleBuy() { clearStatus(); await buyNFT(listing); }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.15)" }} onClick={e => e.stopPropagation()}>
        <div className="aspect-square overflow-hidden" style={{ background: "#161d28" }}>
          {metadata?.image && <img src={metadata.image} alt={metadata.name} className="w-full h-full object-cover" />}
        </div>
        <div className="p-6">
          <div className="font-bold text-xl mb-1" style={{ color: "#e6edf3" }}>{metadata?.name}</div>
          <div className="font-mono text-3xl font-bold mb-6" style={{ color: "#22d3ee" }}>
            {fmtPrice(listing.price)}<span className="text-lg ml-2" style={{ color: "#9da7b3" }}>USD</span>
          </div>
          {txStatus && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 mb-4 text-xs"
              style={{
                background: txStatus.type === "error" ? "rgba(239,68,68,0.1)" : txStatus.type === "success" ? "rgba(34,197,94,0.1)" : "rgba(34,211,238,0.1)",
                border: `1px solid ${txStatus.type === "error" ? "rgba(239,68,68,0.3)" : txStatus.type === "success" ? "rgba(34,197,94,0.3)" : "rgba(34,211,238,0.3)"}`,
                color: txStatus.type === "error" ? "#EF4444" : txStatus.type === "success" ? "#22C55E" : "#22d3ee",
              }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />{txStatus.msg}
            </div>
          )}
          {txStatus?.type === "success" ? (
            <div className="text-center py-2">
              <CheckCircle2 size={36} className="mx-auto mb-3" style={{ color: "#22C55E" }} />
              <div className="font-bold mb-4" style={{ color: "#e6edf3" }}>Purchase Complete!</div>
              <button onClick={onClose} className="w-full h-10 rounded-xl text-sm font-bold"
                style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer" }}>Close</button>
            </div>
          ) : (
            <>
              <button onClick={handleBuy} disabled={loading}
                className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mb-3"
                style={{ background: loading ? "#161d28" : "#22d3ee", color: loading ? "#9da7b3" : "#0b0f14", border: "none", cursor: loading ? "not-allowed" : "pointer" }}>
                {loading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {loading ? "Processing..." : "Confirm Purchase"}
              </button>
              <button onClick={onClose} className="w-full h-9 rounded-xl text-sm"
                style={{ background: "none", color: "#9da7b3", border: "none", cursor: "pointer" }}>Cancel</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── My Items Tab ─────────────────────────────────────────────────────────────
function MyItemsTab({ nftContract, collectionSlug, baseUri, collection }) {
  const { address } = useAccount();
  const navigate = useNavigate();
  const { listings } = useListings(nftContract);
  const [myTokens, setMyTokens] = useState([]);
  const [loading, setLoading] = useState(false);

  // Find tokens listed by this wallet
  const myListings = listings.filter(
    l => l.seller?.toLowerCase() === address?.toLowerCase() && l.active
  );

  if (!address) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: "#9da7b3" }}>
        Connect your wallet to see your items.
      </div>
    );
  }

  if (myListings.length === 0) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: "#9da7b3" }}>
        You have no active listings for this collection.
        <div className="mt-2 text-xs" style={{ color: "#9da7b3" }}>
          Own NFTs from this collection? List them from the NFT item page.
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {myListings.map((l) => (
        <div key={l.listing_id}
          className="rounded-2xl overflow-hidden cursor-pointer card-hover"
          style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}
          onClick={() => navigate(`/collection/${collectionSlug}/${l.token_id}`)}>
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
        {loading
          ? <div className="w-full h-full animate-pulse" style={{ background: "#161d28" }} />
          : <NFTImage src={metadata?.image} alt={metadata?.name} className="w-full h-full object-cover" style={{ objectFit: "cover" }} />
        }
      </div>
      <div className="p-3">
        <div className="text-xs font-semibold truncate mb-1" style={{ color: "#e6edf3" }}>
          {metadata?.name || `#${tokenId}`}
        </div>
        <div className="font-mono text-xs" style={{ color: "#22d3ee" }}>
          {fmtPrice(price)} USD <span style={{ color: "#9da7b3" }}>listed</span>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NFTItemPage() {
  const { id: collectionSlug, tokenId } = useParams();
  const navigate  = useNavigate();
  const { address } = useAccount();

  const { collection, isLoading: colLoading } = useCollection(collectionSlug);
  const nftContract = collection?.contract_address;
  const baseUri     = collection?.metadata_base_uri;

  // ✅ Now passes all 3 args correctly
  const { metadata, loading: metaLoading } = useNFTMetadata(nftContract, tokenId, baseUri);
  const { listings } = useListings(nftContract);
  const { clearStatus } = useMarketplace();

  const [tab,       setTab]       = useState("Details");
  const [showBuy,   setShowBuy]   = useState(false);
  const [showOffer, setShowOffer] = useState(false);
  const [showList,  setShowList]  = useState(false);
  const [showDelist, setShowDelist] = useState(false);
  const [liked,     setLiked]     = useState(false);
  const [shared,    setShared]    = useState(false);

  const listing   = listings.find(l => Number(l.token_id) === Number(tokenId) && l.active);
  const isOwner   = address && listing?.seller?.toLowerCase() === address?.toLowerCase();
  const traits    = metadata ? formatTraits(metadata.attributes || []) : [];
  const tokenNum  = Number(tokenId);
  const totalSupply = collection?.total_supply || 0;

  function handleShare() {
    navigator.clipboard.writeText(window.location.href);
    setShared(true);
    setTimeout(() => setShared(false), 2000);
  }

  if (colLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#22d3ee", borderTopColor: "transparent" }} />
    </div>
  );

  return (
    <div className="fade-up max-w-6xl mx-auto px-4 sm:px-6 py-8">

      {/* Top nav */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => navigate(`/collection/${collectionSlug}`)}
          className="flex items-center gap-2 text-sm"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9da7b3" }}>
          <ArrowLeft size={14} /> {collection?.name ?? "Collection"}
        </button>
        <div className="flex items-center gap-2">
          <button disabled={tokenNum <= 1}
            onClick={() => navigate(`/collection/${collectionSlug}/${tokenNum - 1}`)}
            className="h-8 px-3 rounded-lg text-xs font-semibold"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: tokenNum > 1 ? "#e6edf3" : "#9da7b3", cursor: tokenNum > 1 ? "pointer" : "not-allowed" }}>
            ← Prev
          </button>
          <span className="font-mono text-xs" style={{ color: "#9da7b3" }}>#{tokenId}</span>
          <button disabled={totalSupply > 0 && tokenNum >= totalSupply}
            onClick={() => navigate(`/collection/${collectionSlug}/${tokenNum + 1}`)}
            className="h-8 px-3 rounded-lg text-xs font-semibold"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", cursor: "pointer" }}>
            Next →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Left: Image + Traits */}
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl overflow-hidden relative"
            style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
            {metaLoading || !baseUri ? (
              <div className="w-full h-full animate-pulse" style={{ background: "#161d28" }} />
            ) : (
              <NFTImage src={metadata?.image} alt={metadata?.name}
                className="w-full h-full" style={{ objectFit: "cover" }} />
            )}
            <div className="absolute top-3 right-3 flex gap-2">
              <button onClick={() => setLiked(l => !l)}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(11,15,20,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)", color: liked ? "#EF4444" : "#9da7b3", cursor: "pointer" }}>
                <Heart size={14} fill={liked ? "#EF4444" : "none"} />
              </button>
              <button onClick={handleShare}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "rgba(11,15,20,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.08)", color: shared ? "#22d3ee" : "#9da7b3", cursor: "pointer" }}>
                {shared ? <Check size={14} /> : <Share2 size={14} />}
              </button>
            </div>
          </div>

          {nftContract && (
            <div className="flex items-center gap-3 px-1">
              <a href={`${EXPLORER_BASE}/address/${nftContract}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs" style={{ color: "#9da7b3", textDecoration: "none" }}>
                <ExternalLink size={11} /> Contract
              </a>
              <span style={{ color: "#9da7b3" }}>·</span>
              <a href={`${EXPLORER_BASE}/token/${nftContract}/instance/${tokenId}`} target="_blank" rel="noreferrer"
                className="flex items-center gap-1.5 text-xs" style={{ color: "#9da7b3", textDecoration: "none" }}>
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
              <span className="text-xs font-bold" style={{ color: "#22d3ee" }}>{collection?.name}</span>
              {collection?.verified && <CheckCircle2 size={12} style={{ color: "#22d3ee" }} />}
            </div>
            <h1 className="text-3xl font-extrabold mb-2" style={{ color: "#e6edf3" }}>
              {metaLoading ? (
                <div className="h-8 w-48 rounded animate-pulse" style={{ background: "#161d28" }} />
              ) : (
                metadata?.name ?? `${collection?.name} #${tokenId}`
              )}
            </h1>
            {metadata?.description && (
              <p className="text-sm" style={{ color: "#9da7b3" }}>{metadata.description}</p>
            )}
          </div>

          {/* Price + Actions */}
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.1)" }}>
            {listing ? (
              <>
                <div>
                  <div className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "#9da7b3" }}>Current Price</div>
                  <div className="font-mono text-4xl font-bold" style={{ color: "#22d3ee" }}>
                    {fmtPrice(listing.price)}<span className="text-xl ml-2" style={{ color: "#9da7b3" }}>USD</span>
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#9da7b3" }}>Listed by {shortenAddress(listing.seller)}</div>
                </div>
                {isOwner ? (
                  <button 
                    onClick={() => setShowDelist(true)} 
                    className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: "rgba(239,68,68,0.15)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.3)", cursor: "pointer" }}>
                    <XCircle size={14} /> Cancel Listing
                  </button>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => setShowBuy(true)} className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer" }}>
                      <ShoppingCart size={15} /> Buy Now
                    </button>
                    <button onClick={() => setShowOffer(true)} className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", cursor: "pointer" }}>
                      <Gavel size={14} /> Make Offer
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div>
                <div className="text-sm mb-4" style={{ color: "#9da7b3" }}>Not listed for sale</div>
                <div className="flex gap-3">
                  {address && (
                    <button onClick={() => setShowList(true)} className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer" }}>
                      <Tag size={14} /> List for Sale
                    </button>
                  )}
                  <button onClick={() => setShowOffer(true)} className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", cursor: "pointer" }}>
                      <Gavel size={14} /> Make Offer
                    </button>
                </div>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
            {TABS.map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="h-10 px-3 text-xs font-bold uppercase tracking-wide -mb-px whitespace-nowrap"
                style={{ background: "none", border: "none", cursor: "pointer", color: tab === t ? "#22d3ee" : "#9da7b3", borderBottom: tab === t ? "2px solid #22d3ee" : "2px solid transparent" }}>
                {t}
              </button>
            ))}
          </div>

          <div>
            {tab === "Details" && (
              <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                {[
                  { label: "Token ID",  value: `#${tokenId}`,                    mono: true  },
                  { label: "Contract",  value: shortenAddress(nftContract),       mono: true,  copy: nftContract },
                  { label: "Standard",  value: "ERC-721",                        mono: false },
                  { label: "Network",   value: "Tempo Chain",                    mono: false },
                  { label: "Supply",    value: collection?.total_supply?.toLocaleString() ?? "—", mono: true },
                  { label: "Royalties", value: collection?.royalty_bps != null ? `${collection.royalty_bps / 100}%` : "—", mono: true },
                ].map(({ label, value, mono, copy }, i, arr) => (
                  <div key={label} className="flex items-center justify-between px-5 py-3"
                    style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                    <span className="text-xs" style={{ color: "#9da7b3" }}>{label}</span>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold ${mono ? "font-mono" : ""}`} style={{ color: "#e6edf3" }}>{value ?? "—"}</span>
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
            {tab === "Offers" && (
              <CollectionBids collectionId={collectionSlug} tokenId={Number(tokenId)} />
            )}
            {tab === "Analytics" && (
              <div className="rounded-2xl p-5" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: "#9da7b3" }}>Price History</div>
                <PriceChart data={[]} tokenId={Number(tokenId)} nftContract={nftContract} />
                <div className="text-center py-6 text-xs" style={{ color: "#9da7b3" }}>
                  Price history will appear once this token has sale activity.
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      {showBuy && listing && (
        <BuyModal listing={listing} metadata={metadata} onClose={() => { setShowBuy(false); clearStatus(); }} />
      )}
      {showOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }} onClick={() => setShowOffer(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#121821", border: "1px solid rgba(167,139,250,0.2)" }} onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2" style={{ color: "#e6edf3" }}>Make an Offer</h2>
            <p className="text-xs mb-6" style={{ color: "#9da7b3" }}>{metadata?.name}</p>
            <div className="rounded-xl p-4 mb-5" style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
              <p className="text-xs" style={{ color: "#a78bfa" }}>Off-chain offers coming soon. On-chain offer support will be added in the next update.</p>
            </div>
            <button onClick={() => setShowOffer(false)} className="w-full h-10 rounded-xl text-sm"
              style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}
      {showList && (
        <ListModal
          nft={{ tokenId: Number(tokenId), name: metadata?.name, image: metadata?.image, collection: collection?.name, contract: nftContract }}
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
