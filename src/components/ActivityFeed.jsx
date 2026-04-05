import { useActivity } from "@/hooks/useActivity.js";
import Skeleton from "./Skeleton.jsx";
import { ArrowRight } from "lucide-react";

const TYPE_COLORS = {
  sale:     "#22c55e",
  listing:  "#22d3ee",
  offer:    "#a855f7",
  transfer: "#9da7b3",
  mint:     "#f97316",
};

function shortenAddress(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function ActivityFeed({ collectionId, address, limit = 20 }) {
  const { activity, loading } = useActivity({ collectionId, address, limit });

  return (
    <div className="flex flex-col gap-0.5">
      {loading
        ? Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} style={{ height: 44, borderRadius: 8 }} />
          ))
        : activity.length === 0
        ? (
          <p className="py-8 text-center text-sm" style={{ color: "#9da7b3" }}>No activity yet.</p>
        )
        : activity.map((ev, i) => (
            <div
              key={i}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors"
              style={{ background: "rgba(22,29,40,0.6)" }}
            >
              {/* Type badge */}
              <span
                className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-md flex-shrink-0"
                style={{ background: `${TYPE_COLORS[ev.type] ?? "#9da7b3"}18`, color: TYPE_COLORS[ev.type] ?? "#9da7b3" }}
              >
                {ev.type ?? "—"}
              </span>

              {/* Name */}
              <span className="flex-1 text-xs font-semibold truncate" style={{ color: "#e6edf3" }}>
                {ev.name ?? ev.tokenId ?? "—"}
              </span>

              {/* From → To */}
              <span className="text-[11px] font-mono hidden sm:flex items-center gap-1" style={{ color: "#9da7b3" }}>
                {shortenAddress(ev.from)}
                <ArrowRight size={10} />
                {shortenAddress(ev.to)}
              </span>

              {/* Price */}
              {ev.price != null && (
                <span className="font-mono text-xs flex-shrink-0" style={{ color: "#e6edf3" }}>
                  {Number(ev.price).toFixed(4)} ETH
                </span>
              )}

              {/* Time */}
              <span className="text-[11px] flex-shrink-0" style={{ color: "#9da7b3" }}>
                {ev.time ?? ev.timestamp ?? ""}
              </span>
            </div>
          ))}
    </div>
  );
}
