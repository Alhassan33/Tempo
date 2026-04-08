import { useState, useEffect } from "react";
import { ArrowRight, ExternalLink } from "lucide-react";
import { supabase } from "@/lib/supabase";

const EXPLORER_BASE = "https://explore.tempo.xyz";

const TYPE_CONFIG = {
  sale:     { label: "Sale",     color: "#22c55e",  bg: "rgba(34,197,94,0.1)"   },
  listing:  { label: "List",     color: "#22d3ee",  bg: "rgba(34,211,238,0.1)"  },
  delist:   { label: "Delist",   color: "#9da7b3",  bg: "rgba(157,167,179,0.1)" },
  transfer: { label: "Transfer", color: "#9da7b3",  bg: "rgba(157,167,179,0.1)" },
  mint:     { label: "Mint",     color: "#f97316",  bg: "rgba(249,115,22,0.1)"  },
  offer:    { label: "Offer",    color: "#a855f7",  bg: "rgba(168,85,247,0.1)"  },
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
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${d}d ago`;
}

export default function ActivityFeed({ collectionId, tokenId, limit = 20 }) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    async function fetch() {
      setLoading(true);

      // Pull from sales table
      let salesQuery = supabase
        .from("sales")
        .select("*")
        .order("sold_at", { ascending: false })
        .limit(limit);

      if (tokenId != null) {
        salesQuery = salesQuery.eq("token_id", tokenId);
      }

      const { data: sales } = await salesQuery;

      // Pull from listings table for list/delist events
      let listingsQuery = supabase
        .from("listings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (tokenId != null) {
        listingsQuery = listingsQuery.eq("token_id", tokenId);
      }

      const { data: listings } = await listingsQuery;

      // Merge and sort
      const events = [
        ...(sales || []).map((s) => ({
          type:      "sale",
          name:      `#${s.token_id}`,
          from:      s.seller,
          to:        s.buyer,
          price:     s.price,
          time:      timeAgo(s.sold_at),
          tx:        s.tx_hash,
          tokenId:   s.token_id,
          timestamp: new Date(s.sold_at).getTime(),
        })),
        ...(listings || []).map((l) => ({
          type:      l.active ? "listing" : "delist",
          name:      `#${l.token_id}`,
          from:      l.seller,
          to:        null,
          price:     l.active ? l.price : null,
          time:      timeAgo(l.created_at),
          tx:        l.tx_hash,
          tokenId:   l.token_id,
          timestamp: new Date(l.created_at).getTime(),
        })),
      ].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);

      setActivity(events);
      setLoading(false);
    }

    fetch();
  }, [collectionId, tokenId, limit]);

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-xl animate-pulse" style={{ background: "#161d28" }} />
        ))}
      </div>
    );
  }

  if (!activity.length) {
    return (
      <div className="py-12 text-center text-sm" style={{ color: "#9da7b3" }}>
        No activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {activity.map((ev, i) => {
        const cfg = TYPE_CONFIG[ev.type] ?? TYPE_CONFIG.transfer;
        return (
          <div key={i}
            className="flex items-center gap-3 px-4 py-3 rounded-xl transition-colors"
            style={{ background: "rgba(22,29,40,0.6)" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(34,211,238,0.04)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "rgba(22,29,40,0.6)"}>

            {/* Type badge */}
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md flex-shrink-0 w-14 text-center"
              style={{ background: cfg.bg, color: cfg.color }}>
              {cfg.label}
            </span>

            {/* Token name */}
            <span className="flex-1 text-xs font-semibold truncate" style={{ color: "#e6edf3", fontFamily: "Space Mono, monospace" }}>
              {ev.name}
            </span>

            {/* From → To */}
            <span className="text-[11px] font-mono hidden sm:flex items-center gap-1.5 flex-shrink-0" style={{ color: "#9da7b3" }}>
              {shortenAddress(ev.from)}
              {ev.to && (
                <>
                  <ArrowRight size={9} />
                  {shortenAddress(ev.to)}
                </>
              )}
            </span>

            {/* Price */}
            {ev.price != null && (
              <span className="font-mono text-xs flex-shrink-0 font-bold" style={{ color: "#22d3ee" }}>
                {Number(ev.price).toFixed(2)} USD
              </span>
            )}

            {/* Time + tx link */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <span className="text-[11px]" style={{ color: "#9da7b3" }}>{ev.time}</span>
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
  );
}
