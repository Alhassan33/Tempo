// components/ActivityFeed.jsx
// Queries Supabase directly — no /api/activity endpoint needed.
// Shows: LISTED, DELIST, SALE events with correct price display and time.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

const EXPLORER_BASE = "https://explore.tempo.xyz";
const FONT          = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// price in DB = raw 6-decimal units
function fmtPrice(raw) {
  if (!raw && raw !== 0) return null;
  return (Number(raw) / 1e6).toFixed(2);
}

function timeAgo(isoString) {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return s + "s ago";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  return Math.floor(h / 24) + "d ago";
}

function shorten(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

const TYPE_CONFIG = {
  SALE:   { label: "SALE",   color: "#22C55E", bg: "rgba(34,197,94,0.12)"   },
  LISTED: { label: "LISTED", color: "#00E6A8", bg: "rgba(0,230,168,0.10)"   },
  DELIST: { label: "DELIST", color: "#9da7b3", bg: "rgba(157,167,179,0.10)" },
};

// ─── useActivityData — Supabase direct query ──────────────────────────────────
function useActivityData({ nftContract, collectionId, address, limit = 40 }) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);

      try {
        // ── 1. Fetch from sales table ────────────────────────────────────────
        let salesQuery = supabase
          .from("sales")
          .select("listing_id, buyer, seller, nft_contract, token_id, price, tx_hash, sold_at")
          .order("sold_at", { ascending: false })
          .limit(limit);

        if (nftContract) salesQuery = salesQuery.ilike("nft_contract", nftContract);
        if (address)     salesQuery = salesQuery.or("buyer.ilike." + address + ",seller.ilike." + address);

        // ── 2. Fetch from listings table (both active and inactive) ──────────
        let listingsQuery = supabase
          .from("listings")
          .select("listing_id, seller, nft_contract, token_id, price, active, tx_hash, updated_at")
          .order("updated_at", { ascending: false })
          .limit(limit);

        if (nftContract) listingsQuery = listingsQuery.ilike("nft_contract", nftContract);
        if (address)     listingsQuery = listingsQuery.ilike("seller", address);

        const [{ data: salesData, error: salesErr }, { data: listingsData, error: listErr }] =
          await Promise.all([salesQuery, listingsQuery]);

        if (salesErr)  console.warn("[ActivityFeed] sales error:", salesErr);
        if (listErr)   console.warn("[ActivityFeed] listings error:", listErr);

        // ── 3. Merge + normalise ─────────────────────────────────────────────
        const saleEvents = (salesData || []).map(s => ({
          type:         "SALE",
          token_id:     s.token_id,
          nft_contract: s.nft_contract,
          price:        s.price,
          from:         s.seller,
          to:           s.buyer,
          tx_hash:      s.tx_hash,
          timestamp:    s.sold_at,
          sort_ts:      new Date(s.sold_at).getTime(),
        }));

        // Separate listings into LISTED vs DELIST based on active flag
        const listingEvents = (listingsData || []).map(l => ({
          type:         l.active ? "LISTED" : "DELIST",
          token_id:     l.token_id,
          nft_contract: l.nft_contract,
          price:        l.active ? l.price : null,
          from:         l.seller,
          to:           null,
          tx_hash:      l.tx_hash,
          timestamp:    l.updated_at,
          sort_ts:      new Date(l.updated_at).getTime(),
        }));

        // Merge, sort by time descending, deduplicate
        const seen = new Set();
        const merged = [...saleEvents, ...listingEvents]
          .sort((a, b) => b.sort_ts - a.sort_ts)
          .filter(ev => {
            // Deduplicate by tx_hash + type
            const key = ev.tx_hash + "|" + ev.type + "|" + ev.token_id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, limit);

        if (!cancelled) setEvents(merged);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [nftContract, collectionId, address, limit]);

  return { events, loading, error };
}

// ─── Activity Row ─────────────────────────────────────────────────────────────
function ActivityRow({ ev, slug }) {
  const navigate = useNavigate();
  const cfg = TYPE_CONFIG[ev.type] || TYPE_CONFIG.LISTED;
  const price = fmtPrice(ev.price);

  function goToToken() {
    if (slug && ev.token_id != null) navigate("/collection/" + slug + "/" + ev.token_id);
  }

  return (
    <div
      className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer"
      style={{ background: "rgba(22,29,40,0.6)", fontFamily: FONT }}
      onMouseEnter={e => (e.currentTarget.style.background = "rgba(22,29,40,0.9)")}
      onMouseLeave={e => (e.currentTarget.style.background = "rgba(22,29,40,0.6)")}
      onClick={goToToken}>

      {/* Type badge */}
      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md flex-shrink-0 tracking-wide"
        style={{ background: cfg.bg, color: cfg.color, border: "1px solid " + cfg.color + "30" }}>
        {cfg.label}
      </span>

      {/* Token ID */}
      <span className="text-xs font-bold flex-shrink-0" style={{ color: "#e6edf3" }}>
        #{ev.token_id ?? "—"}
      </span>

      {/* From → To (hidden on small screens) */}
      <span className="text-[11px] font-mono flex-1 hidden sm:flex items-center gap-1 min-w-0" style={{ color: "#9da7b3" }}>
        <span className="truncate">{shorten(ev.from)}</span>
        {ev.to && (
          <>
            <ArrowRight size={10} className="flex-shrink-0" />
            <span className="truncate">{shorten(ev.to)}</span>
          </>
        )}
      </span>

      {/* Price */}
      <span className="font-mono text-xs font-bold flex-shrink-0"
        style={{ color: ev.type === "SALE" ? "#22C55E" : ev.type === "LISTED" ? "#00E6A8" : "#9da7b3" }}>
        {price ? price + " USD" : ev.type === "DELIST" ? "Delisted" : "—"}
      </span>

      {/* Time */}
      <span className="text-[11px] flex-shrink-0 text-right" style={{ color: "#9da7b3", minWidth: "52px" }}>
        {timeAgo(ev.timestamp)}
      </span>

      {/* Explorer link */}
      {ev.tx_hash && (
        <a
          href={EXPLORER_BASE + "/tx/" + ev.tx_hash}
          target="_blank" rel="noreferrer"
          onClick={e => e.stopPropagation()}
          className="flex-shrink-0"
          style={{ color: "#6b7280" }}
          onMouseEnter={e => (e.currentTarget.style.color = "#00E6A8")}
          onMouseLeave={e => (e.currentTarget.style.color = "#6b7280")}>
          <ExternalLink size={11} />
        </a>
      )}
    </div>
  );
}

// ─── ActivityFeed ─────────────────────────────────────────────────────────────
export default function ActivityFeed({
  nftContract,    // filter by contract address
  collectionId,   // slug (used for token links)
  address,        // filter by wallet address
  limit = 40,
}) {
  const { events, loading, error } = useActivityData({ nftContract, collectionId, address, limit });

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#161d28" }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-center text-xs rounded-xl" style={{ color: "#EF4444", background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)" }}>
        Failed to load activity: {error}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: "#9da7b3", fontFamily: FONT }}>
        No activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Column headers */}
      <div className="flex items-center gap-3 px-3 pb-2" style={{ fontFamily: FONT }}>
        {["TYPE", "ITEM", "", "PRICE", "TIME", "TX"].map((h, i) => (
          <span key={i}
            className={"text-[9px] font-bold uppercase tracking-widest " + (i === 2 ? "flex-1 hidden sm:block" : i === 3 ? "flex-shrink-0" : i === 4 ? "flex-shrink-0" : i === 5 ? "flex-shrink-0 w-4" : "flex-shrink-0")}
            style={{ color: "#6b7280" }}>
            {h}
          </span>
        ))}
      </div>

      {events.map((ev, i) => (
        <ActivityRow key={i} ev={ev} slug={collectionId} />
      ))}
    </div>
  );
}
