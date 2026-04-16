// components/ActivityFeed.jsx
// Shows sales + listing/delist events for a collection or single token.
//
// FIXES:
//   1. Sales query now filters by nft_contract when collectionId is passed
//   2. Price divided by 1e6 for display (DB stores raw 6-decimal units)
//   3. Realtime subscription so sales appear without page refresh
//   4. collectionId accepted as either slug OR contract_address

import { useState, useEffect } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

const EXPLORER_BASE = "https://explore.tempo.xyz";

const TYPE_CONFIG = {
  sale:     { label: "SALE",     color: "#22c55e", bg: "rgba(34,197,94,0.1)"   },
  listing:  { label: "LIST",     color: "#22d3ee", bg: "rgba(34,211,238,0.1)"  },
  delist:   { label: "DELIST",   color: "#9da7b3", bg: "rgba(157,167,179,0.1)" },
  mint:     { label: "MINT",     color: "#f97316", bg: "rgba(249,115,22,0.1)"  },
  transfer: { label: "TRANSFER", color: "#9da7b3", bg: "rgba(157,167,179,0.1)" },
};

function shortenAddress(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

// ✅ Price stored as raw 6-decimal units — always ÷1e6 for display
function displayPrice(raw) {
  if (raw == null) return null;
  return (Number(raw) / 1e6).toFixed(2);
}

export default function ActivityFeed({
  collectionId,    // slug or contract_address of the collection
  nftContract,     // explicit contract_address (preferred over collectionId)
  tokenId,         // if set, filter to single token
  limit = 30,
}) {
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);

  // Resolve contract address: use nftContract directly, or look up via collectionId
  const [contractAddr, setContractAddr] = useState(nftContract?.toLowerCase() || null);

  useEffect(() => {
    if (nftContract) {
      setContractAddr(nftContract.toLowerCase());
      return;
    }
    if (!collectionId) return;

    // collectionId might be a slug — resolve to contract_address
    const isAddress = collectionId.startsWith("0x");
    if (isAddress) {
      setContractAddr(collectionId.toLowerCase());
    } else {
      supabase.from("collections").select("contract_address")
        .eq("slug", collectionId).single()
        .then(({ data }) => {
          if (data?.contract_address) setContractAddr(data.contract_address.toLowerCase());
        });
    }
  }, [collectionId, nftContract]);

  async function loadActivity() {
    if (!contractAddr && !tokenId) { setLoading(false); return; }
    setLoading(true);

    // ── Sales ─────────────────────────────────────────────────────────────
    let salesQ = supabase.from("sales").select("*")
      .order("sold_at", { ascending: false }).limit(limit);

    // ✅ FIX: filter sales by contract address (was missing before)
    if (contractAddr) salesQ = salesQ.eq("nft_contract", contractAddr);
    if (tokenId != null) salesQ = salesQ.eq("token_id", tokenId);

    const { data: sales } = await salesQ;

    // ── Listings ──────────────────────────────────────────────────────────
    let listQ = supabase.from("listings").select("*")
      .order("updated_at", { ascending: false }).limit(limit);

    if (contractAddr) listQ = listQ.eq("nft_contract", contractAddr);
    if (tokenId != null) listQ = listQ.eq("token_id", tokenId);

    const { data: listings } = await listQ;

    // ── Merge + sort ──────────────────────────────────────────────────────
    const events = [
      ...(sales || []).map(s => ({
        type:      "sale",
        name:      `#${s.token_id}`,
        from:      s.seller,
        to:        s.buyer,
        price:     s.price,           // raw — displayed via displayPrice()
        time:      timeAgo(s.sold_at),
        tx:        s.tx_hash,
        tokenId:   s.token_id,
        timestamp: new Date(s.sold_at || 0).getTime(),
      })),
      ...(listings || []).map(l => ({
        type:      l.active ? "listing" : "delist",
        name:      `#${l.token_id}`,
        from:      l.seller,
        to:        null,
        price:     l.active ? l.price : null,
        time:      timeAgo(l.updated_at || l.created_at),
        tx:        l.tx_hash,
        tokenId:   l.token_id,
        timestamp: new Date(l.updated_at || l.created_at || 0).getTime(),
      })),
    ]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);

    setActivity(events);
    setLoading(false);
  }

  useEffect(() => {
    loadActivity();
  }, [contractAddr, tokenId, limit]);

  // ── Realtime: re-fetch when a new sale or listing comes in ───────────────
  useEffect(() => {
    if (!contractAddr) return;

    const salesChannel = supabase
      .channel(`activity-sales-${contractAddr}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "sales",
        filter: `nft_contract=eq.${contractAddr}`,
      }, () => loadActivity())
      .subscribe();

    const listingsChannel = supabase
      .channel(`activity-listings-${contractAddr}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "listings",
        filter: `nft_contract=eq.${contractAddr}`,
      }, () => loadActivity())
      .subscribe();

    return () => {
      supabase.removeChannel(salesChannel);
      supabase.removeChannel(listingsChannel);
    };
  }, [contractAddr]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#161d28" }} />
        ))}
      </div>
    );
  }

  if (!activity.length) {
    return (
      <div className="py-16 text-center">
        <div className="text-3xl mb-3">📊</div>
        <div className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>No activity yet</div>
        <p className="text-xs" style={{ color: "#9da7b3" }}>Sales and listings will appear here.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header row */}
      <div className="grid grid-cols-[80px_1fr_1fr_80px_80px] gap-3 px-4 pb-2 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "#9da7b3", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span>Type</span>
        <span>Item</span>
        <span className="hidden sm:block">Address</span>
        <span>Price</span>
        <span>Time</span>
      </div>

      <div className="space-y-0.5 mt-1">
        {activity.map((ev, i) => {
          const cfg = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.transfer;
          const price = displayPrice(ev.price);

          return (
            <div key={i}
              className="grid grid-cols-[80px_1fr_1fr_80px_80px] gap-3 items-center px-4 py-3 rounded-xl transition-colors"
              style={{ background: "transparent" }}
              onMouseEnter={e => e.currentTarget.style.background = "rgba(34,211,238,0.03)"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>

              {/* Type badge */}
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md text-center w-fit"
                style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>

              {/* Token name */}
              <span className="text-xs font-semibold font-mono truncate" style={{ color: "#e6edf3" }}>
                {ev.name}
              </span>

              {/* From → To */}
              <span className="hidden sm:flex items-center gap-1 text-[10px] font-mono truncate" style={{ color: "#9da7b3" }}>
                {shortenAddress(ev.from)}
                {ev.to && <><ArrowRight size={9} />{shortenAddress(ev.to)}</>}
              </span>

              {/* Price */}
              <span className="text-xs font-mono font-bold" style={{ color: ev.type === "sale" ? "#22c55e" : "#22d3ee" }}>
                {price ? `${price} USD` : "—"}
              </span>

              {/* Time + tx */}
              <div className="flex items-center gap-1.5 justify-end">
                <span className="text-[10px]" style={{ color: "#9da7b3" }}>{ev.time}</span>
                {ev.tx && (
                  <a href={`${EXPLORER_BASE}/tx/${ev.tx}`} target="_blank" rel="noreferrer"
                    style={{ color: "#9da7b3" }}>
                    <ExternalLink size={10} />
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
