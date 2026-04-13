import { useState, useEffect } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

const EXPLORER_BASE = "https://explore.tempo.xyz";

const TYPE_CONFIG = {
  sale:     { label: "Sale",     color: "#22c55e", bg: "rgba(34,197,94,0.1)"   },
  listing:  { label: "Listed",   color: "#22d3ee", bg: "rgba(34,211,238,0.1)"  },
  delist:   { label: "Delist",   color: "#9da7b3", bg: "rgba(157,167,179,0.1)" },
  transfer: { label: "Transfer", color: "#9da7b3", bg: "rgba(157,167,179,0.1)" },
  mint:     { label: "Mint",     color: "#f97316", bg: "rgba(249,115,22,0.1)"  },
  offer:    { label: "Offer",    color: "#a855f7", bg: "rgba(168,85,247,0.1)"  },
};

/**
 * ✅ PRICE FIX: All prices in DB are raw 6-decimal units (e.g. 20000000 = $20.00)
 * Always divide by 1e6 before displaying.
 */
function formatPrice(raw) {
  if (raw == null || raw === "") return null;
  const num = Number(raw);
  if (isNaN(num) || num === 0) return null;
  return (num / 1_000_000).toFixed(2);
}

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
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export default function ActivityFeed({ collectionId, nftContract, tokenId, limit = 40 }) {
  const [activity, setActivity] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        // ── Sales ────────────────────────────────────────────────────────────
        let salesQ = supabase
          .from("sales")
          .select("listing_id, buyer, seller, nft_contract, token_id, price, tx_hash, sold_at")
          .order("sold_at", { ascending: false })
          .limit(limit);

        if (tokenId != null)   salesQ = salesQ.eq("token_id", tokenId);
        if (nftContract)       salesQ = salesQ.ilike("nft_contract", nftContract);

        const { data: sales, error: salesErr } = await salesQ;
        if (salesErr) console.warn("[ActivityFeed] sales:", salesErr.message);

        // ── Listings (list + delist events) ──────────────────────────────────
        let listingsQ = supabase
          .from("listings")
          .select("listing_id, seller, nft_contract, token_id, price, active, tx_hash, created_at, updated_at")
          .order("created_at", { ascending: false })
          .limit(limit);

        if (tokenId != null)   listingsQ = listingsQ.eq("token_id", tokenId);
        if (nftContract)       listingsQ = listingsQ.ilike("nft_contract", nftContract);

        const { data: listings, error: listErr } = await listingsQ;
        if (listErr) console.warn("[ActivityFeed] listings:", listErr.message);

        // ── Merge ─────────────────────────────────────────────────────────────
        const events = [
          // Sales
          ...(sales || []).map(s => ({
            type:      "sale",
            label:     `#${s.token_id}`,
            from:      s.seller,
            to:        s.buyer,
            // ✅ formatPrice divides by 1e6
            price:     formatPrice(s.price),
            time:      timeAgo(s.sold_at),
            tx:        s.tx_hash,
            tokenId:   s.token_id,
            timestamp: new Date(s.sold_at || 0).getTime(),
          })),

          // Listings — create a "Listed" event on creation
          ...(listings || []).map(l => ({
            type:      l.active ? "listing" : "delist",
            label:     `#${l.token_id}`,
            from:      l.seller,
            to:        null,
            // ✅ Only show price on list events, not deList
            price:     l.active ? formatPrice(l.price) : null,
            time:      timeAgo(l.created_at),
            tx:        l.tx_hash,
            tokenId:   l.token_id,
            timestamp: new Date(l.created_at || 0).getTime(),
          })),
        ]
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, limit);

        if (!cancelled) {
          setActivity(events);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e.message || "Failed to load activity");
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [collectionId, nftContract, tokenId, limit]);

  // ── Realtime updates ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nftContract) return;

    const channel = supabase
      .channel(`activity-feed:${nftContract.toLowerCase()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sales" }, () => {
        // Re-fetch on new sale
        setLoading(true);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "listings" }, () => {
        setLoading(true);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [nftContract]);

  // Re-fetch when loading flips back to true (triggered by realtime)
  useEffect(() => {
    if (loading) {
      // small debounce
      const t = setTimeout(() => setLoading(false), 300);
      return () => clearTimeout(t);
    }
  }, [loading]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#161d28" }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl px-4 py-3 text-sm"
        style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
        Failed to load activity: {error}
      </div>
    );
  }

  if (!activity.length) {
    return (
      <div className="py-16 text-center rounded-3xl" style={{ border: "1px dashed rgba(255,255,255,0.06)" }}>
        <div className="text-3xl mb-3">📋</div>
        <p className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>No activity yet</p>
        <p className="text-xs" style={{ color: "#9da7b3" }}>Sales and listings will appear here.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-2 mb-1 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "#6B7280", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <span className="w-14 text-center flex-shrink-0">Type</span>
        <span className="flex-1">Item</span>
        <span className="hidden sm:block w-40 flex-shrink-0">From / To</span>
        <span className="w-24 text-right flex-shrink-0">Price</span>
        <span className="w-16 text-right flex-shrink-0">Time</span>
      </div>

      <div className="space-y-1">
        {activity.map((ev, i) => {
          const cfg = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.transfer;
          return (
            <div key={i}
              className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors cursor-default"
              style={{ background: "rgba(22,29,40,0.5)" }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(0,230,168,0.03)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(22,29,40,0.5)"; }}>

              {/* Type badge */}
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md flex-shrink-0 w-14 text-center"
                style={{ background: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </span>

              {/* Token */}
              <span className="flex-1 text-xs font-semibold truncate font-mono" style={{ color: "#e6edf3" }}>
                {ev.label}
              </span>

              {/* From → To */}
              <span className="text-[11px] font-mono hidden sm:flex items-center gap-1.5 flex-shrink-0 w-40" style={{ color: "#9da7b3" }}>
                {shortenAddress(ev.from)}
                {ev.to && (
                  <>
                    <ArrowRight size={9} />
                    {shortenAddress(ev.to)}
                  </>
                )}
              </span>

              {/* ✅ Price — already divided by 1e6 in formatPrice */}
              <span className="font-mono text-xs flex-shrink-0 w-24 text-right font-bold"
                style={{ color: ev.price ? "#22d3ee" : "transparent" }}>
                {ev.price ? `${ev.price} USD` : "—"}
              </span>

              {/* Time + tx link */}
              <div className="flex items-center justify-end gap-1.5 flex-shrink-0 w-16">
                <span className="text-[11px]" style={{ color: "#9da7b3" }}>{ev.time}</span>
                {ev.tx && (
                  <a href={`${EXPLORER_BASE}/tx/${ev.tx}`} target="_blank" rel="noreferrer"
                    style={{ color: "#6B7280" }}
                    onClick={e => e.stopPropagation()}>
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
