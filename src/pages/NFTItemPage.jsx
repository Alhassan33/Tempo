import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount, useWriteContract, usePublicClient } from "wagmi";
import { parseUnits } from "viem";
import {
  ArrowLeft, ExternalLink, Tag, ShoppingCart,
  AlertCircle, CheckCircle2, ChevronDown, ChevronUp,
  Layers, Heart, Share2, Check, Copy, Gavel, XCircle,
  Pencil, User, Wallet
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import { useCollection, useListings } from "@/hooks/useSupabase";
import { useMarketplace } from "@/hooks/useMarketplace";
import { useNFTMetadata, formatTraits, traitColor } from "@/hooks/useNFTMetadata";
import ListModal from "@/components/ListModal.jsx";
import DelistModal from "@/components/DelistModal.jsx";
import BuyModal from "@/components/BuyModal.jsx";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import CollectionBids from "@/components/CollectionBids.jsx";
import PriceChart from "@/components/PriceChart.jsx";
import NFTImage from "@/components/NFTImage.jsx";

const EXPLORER_BASE = "https://explore.tempo.xyz";
const MARKETPLACE   = "0x218ab916fe8d7a1ca87d7cd5dfb1d44684ab926b";
const TABS          = ["Details", "Activity", "Offers", "Analytics"];

function shortenAddress(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function fmtPrice(raw) {
  if (!raw && raw !== 0) return "—";
  return (Number(raw) / 1e6).toFixed(2);
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
    <div className="rounded-xl p-3 flex flex-col gap-1"
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

// ─── Modify Price Modal ───────────────────────────────────────────────────────
function ModifyPriceModal({ listing, onClose, onSuccess }) {
  const { writeContractAsync: write } = useWriteContract();
  const publicClient = usePublicClient();
  const [price,   setPrice]   = useState("");
  const [loading, setLoading] = useState(false);
  const [status,  setStatus]  = useState(null);
  const [errMsg,  setErrMsg]  = useState("");

  const UPDATE_PRICE_ABI = [{
    name: "updatePrice",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "listingId", type: "uint256" },
      { name: "newPrice",  type: "uint256" },
    ],
    outputs: [],
  }];

  const MARKETPLACE_ADDRESS = "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b";
  const currentPrice = fmtPrice(listing?.price);

  async function handleModify() {
    if (!price || isNaN(price) || Number(price) <= 0) return;
    setLoading(true);
    setStatus(null);
    setErrMsg("");
    try {
      const priceRaw = parseUnits(Number(price).toFixed(6), 6);
      const listingId = listing?.listing_id ?? listing?.listingId;

      const hash = await write({
        address: MARKETPLACE_ADDRESS,
        abi: UPDATE_PRICE_ABI,
        functionName: "updatePrice",
        args: [BigInt(listingId), priceRaw],
      });
      await publicClient.waitForTransactionReceipt({ hash });

      // Update Supabase
      await supabase.from("listings")
        .update({ price: Number(priceRaw), updated_at: new Date().toISOString() })
        .eq("listing_id", Number(listingId));

      setStatus("success");
      setTimeout(() => { onClose(); onSuccess?.(); }, 1500);
    } catch (e) {
      setErrMsg(e?.shortMessage || e?.message || "Transaction failed");
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center"
      style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
      onClick={() => { if (!loading) onClose(); }}>
      <div className="w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "#0d1219", border: "1px solid rgba(34,211,238,0.15)" }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold uppercase tracking-wide" style={{ color: "#e6edf3" }}>Modify Price</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#9da7b3" }}>
            <XCircle size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="text-xs" style={{ color: "#9da7b3" }}>
            Current price: <span className="font-mono font-bold" style={{ color: "#22d3ee" }}>{currentPrice} USD</span>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wide mb-2" style={{ color: "#9da7b3" }}>
              New Price (USD)
            </label>
            <div className="relative">
              <input type="number" placeholder="Enter new price..."
                value={price} onChange={e => setPrice(e.target.value)}
                className="w-full h-14 rounded-2xl px-4 pr-16 text-xl font-mono outline-none"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
                onFocus={e => e.target.style.borderColor = "#22d3ee"}
                onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
                autoFocus />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 font-bold text-sm" style={{ color: "#9da7b3" }}>USD</span>
            </div>
          </div>

          {status === "error" && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444" }}>
              <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {errMsg}
            </div>
          )}

          {status === "success" ? (
            <div className="flex flex-col items-center py-4">
              <CheckCircle2 size={36} className="mb-2" style={{ color: "#22C55E" }} />
              <div className="font-bold" style={{ color: "#e6edf3" }}>Price Updated!</div>
            </div>
          ) : (
            <div className="space-y-3">
              <button onClick={handleModify} disabled={loading || !price || Number(price) <= 0}
                className="w-full h-14 rounded-2xl text-base font-bold flex items-center justify-center gap-2"
                style={{
                  background: loading || !price ? "#161d28" : "#22d3ee",
                  color:      loading || !price ? "#9da7b3" : "#0b0f14",
                  border: "none",
                  cursor: loading || !price ? "not-allowed" : "pointer",
                }}>
                {loading && <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {loading ? "Updating..." : `Update to ${price ? `${Number(price).toFixed(2)} USD` : "..."}`}
              </button>
              <button onClick={onClose} disabled={loading}
                className="w-full h-11 rounded-2xl text-sm font-bold"
                style={{ background: "transparent", color: "#9da7b3", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function NFTItemPage() {
  const { id: collectionSlug, tokenId } = useParams();
  const navigate    = useNavigate();
  const { address } = useAccount();

  const { collection, isLoading: colLoading } = useCollection(collectionSlug);
  const nftContract = collection?.contract_address;
  const baseUri     = collection?.metadata_base_uri;

  const { metadata, loading: metaLoading } = useNFTMetadata(nftContract, tokenId, baseUri);
  const { listings } = useListings(nftContract);
  const { clearStatus } = useMarketplace();

  // ✅ Fetch actual owner from nfts table — not inferred from listing
  const [nftOwner,    setNftOwner]    = useState(null);
  const [ownerLoading, setOwnerLoading] = useState(false);

  useEffect(() => {
    if (!nftContract || !tokenId) return;
    setOwnerLoading(true);
    supabase
      .from("nfts")
      .select("owner_address")
      .eq("contract_address", nftContract.toLowerCase())
      .eq("token_id", Number(tokenId))
      .single()
      .then(({ data }) => {
        setNftOwner(data?.owner_address?.toLowerCase() || null);
        setOwnerLoading(false);
      })
      .catch(() => setOwnerLoading(false));
  }, [nftContract, tokenId]);

  const [tab,         setTab]         = useState("Details");
  const [showBuy,     setShowBuy]     = useState(false);
  const [showOffer,   setShowOffer]   = useState(false);
  const [showList,    setShowList]    = useState(false);
  const [showDelist,  setShowDelist]  = useState(false);
  const [showModify,  setShowModify]  = useState(false);
  const [liked,       setLiked]       = useState(false);
  const [shared,      setShared]      = useState(false);

  // Active listing for this token
  const listing = listings.find(l => Number(l.token_id) === Number(tokenId) && l.active);

  // ✅ Ownership logic:
  // - NFT held by marketplace = it's listed, owner is the seller
  // - NFT held by wallet = owner is that wallet
  const effectiveOwner = nftOwner === MARKETPLACE
    ? listing?.seller?.toLowerCase()  // listed — seller is the real owner
    : nftOwner;

  // ✅ isOwner: connected wallet is the real owner of this NFT
  const isOwner = !!(address && effectiveOwner && address.toLowerCase() === effectiveOwner);

  // ✅ isListed: this NFT has an active listing
  const isListed = !!listing;

  // ✅ isOwnerListing: owner has it listed (they can modify/delist)
  const isOwnerListing = isOwner && isListed;

  const traits      = metadata ? formatTraits(metadata.attributes || []) : [];
  const tokenNum    = Number(tokenId);
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

        {/* ── Left: Image + Traits ── */}
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl overflow-hidden relative"
            style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
            {metaLoading || !baseUri ? (
              <div className="w-full h-full animate-pulse" style={{ background: "#161d28" }} />
            ) : (
              <NFTImage src={metadata?.image} alt={metadata?.name} className="w-full h-full" style={{ objectFit: "cover" }} />
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

        {/* ── Right: Info + Actions ── */}
        <div className="space-y-4">

          {/* Name + collection */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold" style={{ color: "#22d3ee" }}>{collection?.name}</span>
              {collection?.verified && <CheckCircle2 size={12} style={{ color: "#22d3ee" }} />}
            </div>
            <h1 className="text-3xl font-extrabold mb-2" style={{ color: "#e6edf3" }}>
              {metaLoading
                ? <div className="h-8 w-48 rounded animate-pulse" style={{ background: "#161d28" }} />
                : metadata?.name ?? `${collection?.name} #${tokenId}`}
            </h1>
            {metadata?.description && (
              <p className="text-sm" style={{ color: "#9da7b3" }}>{metadata.description}</p>
            )}
          </div>

          {/* Owner info */}
          <div className="flex items-center gap-2 text-xs" style={{ color: "#9da7b3" }}>
            <User size={12} />
            {ownerLoading ? (
              <span>Loading owner...</span>
            ) : effectiveOwner ? (
              <>
                <span>Owned by</span>
                <a href={`${EXPLORER_BASE}/address/${effectiveOwner}`} target="_blank" rel="noreferrer"
                  className="font-mono font-bold hover:underline"
                  style={{ color: isOwner ? "#22d3ee" : "#e6edf3" }}>
                  {isOwner ? "You" : shortenAddress(effectiveOwner)}
                </a>
              </>
            ) : (
              <span>Owner unknown</span>
            )}
          </div>

          {/* ── Price + Actions panel ── */}
          <div className="rounded-2xl p-5 space-y-4"
            style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.1)" }}>

            {/* ══ CASE 1: NFT is listed ══════════════════════════════════════ */}
            {isListed && (
              <div>
                <div className="text-xs mb-1 font-semibold uppercase tracking-wide" style={{ color: "#9da7b3" }}>Current Price</div>
                <div className="font-mono text-4xl font-bold" style={{ color: "#22d3ee" }}>
                  {fmtPrice(listing.price)}<span className="text-xl ml-2" style={{ color: "#9da7b3" }}>USD</span>
                </div>
                <div className="text-xs mt-1" style={{ color: "#9da7b3" }}>
                  Listed by {isOwner ? <span style={{ color: "#22d3ee" }}>you</span> : shortenAddress(listing.seller)}
                </div>
              </div>
            )}
            {/* ══ OWNER ACTIONS ══════════════════════════════════════════════ */}
            {isOwner && (
              <>
                {isOwnerListing ? (
                  // Owner has it listed → show Modify + Delist
                  <div className="space-y-2">
                    <button onClick={() => setShowModify(true)}
                      className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer" }}>
                      <Pencil size={14} /> Modify Price
                    </button>
                    <button onClick={() => setShowDelist(true)}
                      className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer" }}>
                      <XCircle size={14} /> Cancel Listing
                    </button>
                  </div>
                ) : (
                  // Owner has it unlisted → show List for Sale only
                  <div>
                    <div className="text-sm mb-4" style={{ color: "#9da7b3" }}>You own this NFT</div>
                    <button onClick={() => setShowList(true)}
                      className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer" }}>
                      <Tag size={14} /> List for Sale
                    </button>
                  </div>
                )}
              </>
            )}

            {/* ══ BUYER ACTIONS (not owner) ══════════════════════════════════ */}
            {!isOwner && (
              <>
                {isListed ? (
                  // Listed + not owner → Buy Now + Make Offer
                  <div className="flex gap-3">
                    <button onClick={() => setShowBuy(true)}
                      className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer" }}>
                      <ShoppingCart size={15} /> Buy Now
                    </button>
                    <button onClick={() => setShowOffer(true)}
                      className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                      style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", cursor: "pointer" }}>
                      <Gavel size={14} /> Make Offer
                    </button>
                  </div>
                ) : (
                  // Not listed + not owner → just show info, no actions
                  <div className="rounded-xl p-4 text-center"
                    style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>Not Listed</div>
                    <p className="text-xs" style={{ color: "#9da7b3" }}>This NFT is not currently for sale.</p>
                  </div>
                )}
              </>
            )}

            {/* ══ NOT CONNECTED ══════════════════════════════════════════════ */}
            {!address && isListed && (
              <div className="flex gap-3">
                <button onClick={() => setShowBuy(true)}
                  className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer" }}>
                  <ShoppingCart size={15} /> Buy Now
                </button>
                <button onClick={() => setShowOffer(true)}
                  className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                  style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", cursor: "pointer" }}>
                  <Gavel size={14} /> Make Offer
                </button>
              </div>
            )}

            {!address && !isListed && (
              <div className="flex items-center gap-2 text-xs rounded-xl px-4 py-3"
                style={{ background: "rgba(255,255,255,0.03)", color: "#9da7b3", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Wallet size={13} /> Connect wallet to interact with this NFT
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

          {/* Tab content */}
          <div>
            {tab === "Details" && (
              <div className="space-y-3">
                {/* Owner row */}
                <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {[
                    { label: "Owner",     value: effectiveOwner ? shortenAddress(effectiveOwner) : "—", copy: effectiveOwner, link: effectiveOwner ? `${EXPLORER_BASE}/address/${effectiveOwner}` : null },
                    { label: "Token ID",  value: `#${tokenId}`,                    mono: true  },
                    { label: "Contract",  value: shortenAddress(nftContract),       mono: true,  copy: nftContract },
                    { label: "Standard",  value: "ERC-721" },
                    { label: "Network",   value: "Tempo Chain" },
                    { label: "Supply",    value: collection?.total_supply?.toLocaleString() ?? "—", mono: true },
                    { label: "Royalties", value: collection?.royalty_bps != null ? `${collection.royalty_bps / 100}%` : "—", mono: true },
                  ].map(({ label, value, mono, copy, link }, i, arr) => (
                    <div key={label} className="flex items-center justify-between px-5 py-3"
                      style={{ borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                      <span className="text-xs" style={{ color: "#9da7b3" }}>{label}</span>
                      <div className="flex items-center gap-2">
                        {link
                          ? <a href={link} target="_blank" rel="noreferrer" className={`text-xs font-semibold hover:underline ${mono ? "font-mono" : ""}`} style={{ color: "#22d3ee" }}>{value}</a>
                          : <span className={`text-xs font-semibold ${mono ? "font-mono" : ""}`} style={{ color: "#e6edf3" }}>{value ?? "—"}</span>}
                        {copy && <CopyButton text={copy} />}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tab === "Activity" && (
              <ActivityFeed collectionId={collectionSlug} nftContract={nftContract} tokenId={Number(tokenId)} limit={20} />
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

      {/* ── Modals ── */}
      {showBuy && listing && (
        <BuyModal
          listing={listing}
          onClose={() => { setShowBuy(false); clearStatus(); }}
          onSuccess={() => setShowBuy(false)}
        />
      )}

      {showList && (
        <ListModal
          nft={{
            tokenId:    Number(tokenId),
            name:       metadata?.name,
            image:      metadata?.image,
            collection: collection?.name,
            contract:   nftContract,
            attributes: metadata?.attributes || [],
            slug:       collectionSlug,
          }}
          onClose={() => setShowList(false)}
        />
      )}

      {showDelist && listing && (
        <DelistModal
          nft={{
            listingId:  listing.listing_id,
            tokenId:    Number(tokenId),
            contract:   nftContract,
            name:       metadata?.name,
            image:      metadata?.image,
            collection: collection?.name,
            price:      listing.price,
            displayPrice: fmtPrice(listing.price),
          }}
          onClose={() => setShowDelist(false)}
        />
      )}

      {showModify && listing && (
        <ModifyPriceModal
          listing={listing}
          onClose={() => setShowModify(false)}
          onSuccess={() => window.location.reload()}
        />
      )}

      {showOffer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)" }}
          onClick={() => setShowOffer(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6"
            style={{ background: "#121821", border: "1px solid rgba(167,139,250,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2" style={{ color: "#e6edf3" }}>Make an Offer</h2>
            <p className="text-xs mb-6" style={{ color: "#9da7b3" }}>{metadata?.name}</p>
            <div className="rounded-xl p-4 mb-5"
              style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.15)" }}>
              <p className="text-xs" style={{ color: "#a78bfa" }}>
                Off-chain offers coming soon. On-chain offer support will be added in the next update.
              </p>
            </div>
            <button onClick={() => setShowOffer(false)} className="w-full h-10 rounded-xl text-sm"
              style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)", cursor: "pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
