import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCollections, useFeaturedProjects } from "../hooks/useSupabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(secs) {
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

const GRAD_KEYS = [
  "from-[#0e2233] to-[#031220]",
  "from-[#1a0e33] to-[#0d0b1e]",
  "from-[#0e2818] to-[#051a0d]",
  "from-[#331a0e] to-[#1e0b05]",
  "from-[#1a1a0e] to-[#101005]",
];

// ─── Sub-components ───────────────────────────────────────────────────────────
function CollectionImg({ logoUrl, name, className = "" }) {
  if (logoUrl) {
    return (
      <div className={`overflow-hidden ${className}`}>
        <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
      </div>
    );
  }
  const initials = name?.slice(0, 2).toUpperCase() || "??";
  return (
    <div className={`bg-gradient-to-br from-[#0e2233] to-[#031220] flex items-center justify-center ${className}`}>
      <span className="font-bold text-2xl" style={{ color: "#22d3ee" }}>{initials}</span>
    </div>
  );
}

function Stat({ label, value, small }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>{label}</div>
      <div className={`font-mono ${small ? "text-xs" : "text-sm"}`} style={{ color: "#e6edf3" }}>{value ?? "—"}</div>
    </div>
  );
}

function SkeletonCard({ large }) {
  return (
    <div
      className={`rounded-2xl overflow-hidden animate-pulse ${large ? "col-span-2 row-span-2" : ""}`}
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className={`w-full ${large ? "h-72" : "h-36"}`} style={{ background: "#161d28" }} />
      <div className="p-4 space-y-2">
        <div className="h-3 rounded w-2/3" style={{ background: "#161d28" }} />
        <div className="h-3 rounded w-1/3" style={{ background: "#161d28" }} />
      </div>
    </div>
  );
}

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdown(isoTime) {
  const [secs, setSecs] = useState(() =>
    Math.max(0, Math.floor((new Date(isoTime) - Date.now()) / 1000))
  );
  useEffect(() => {
    const id = setInterval(() => setSecs((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, []);
  return fmtTime(secs);
}

function MintCard({ project, navigate }) {
  const countdown = useCountdown(project.mint_start_time);
  const isLive = project.status === "live";

  return (
    <div
      className="flex-shrink-0 w-48 rounded-2xl overflow-hidden cursor-pointer card-hover"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
      onClick={() => navigate("/launchpad")}
    >
      <div className="relative">
        <CollectionImg
          logoUrl={project.banner_url || project.logo_url}
          name={project.name}
          className="h-28 w-full"
        />
        <span
          className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded"
          style={{ background: isLive ? "#EF4444" : "#22d3ee", color: isLive ? "white" : "#0b0f14" }}
        >
          {isLive && <span className="live-dot" style={{ color: "white" }} />}
          {isLive ? "LIVE" : "SOON"}
        </span>
      </div>
      <div className="p-3">
        <div className="font-bold text-xs mb-2 truncate" style={{ color: "#e6edf3" }}>{project.name}</div>
        <div className="flex justify-between mb-2">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "#9da7b3" }}>Price</div>
            <div className="font-mono text-xs" style={{ color: "#e6edf3" }}>
              {project.mint_price ? `${project.mint_price} USD` : "Free"}
            </div>
          </div>
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "#9da7b3" }}>Supply</div>
            <div className="font-mono text-xs" style={{ color: "#e6edf3" }}>
              {project.max_supply?.toLocaleString() || "—"}
            </div>
          </div>
        </div>
        <div className="font-mono text-xs text-center mb-2" style={{ color: "#22d3ee" }}>
          {isLive ? "Minting now" : countdown}
        </div>
        <button
          className="w-full h-7 rounded-lg text-xs font-bold transition-colors"
          style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
          onClick={(e) => { e.stopPropagation(); navigate("/launchpad"); }}
        >
          {isLive ? "Mint" : "View"}
        </button>
      </div>
    </div>
  );
}

// ─── Featured Collections ─────────────────────────────────────────────────────
function FeaturedCollections({ navigate }) {
  const [tab, setTab] = useState("trending");
  const { collections, isLoading } = useCollections(
    tab === "trending" ? "volume_total" : "volume_24h"
  );

  const featured = collections.slice(0, 5);
  const [hero, ...rest] = featured;

  if (isLoading) {
    return (
      <section className="px-6 pt-8 pb-6">
        <div className="h-5 w-48 rounded animate-pulse mb-5" style={{ background: "#161d28" }} />
        <div className="grid grid-cols-4 gap-4">
          <SkeletonCard large />
          {[1, 2, 3, 4].map((i) => <SkeletonCard key={i} />)}
        </div>
      </section>
    );
  }

  if (!hero) {
    return (
      <section className="px-6 pt-8 pb-6 fade-up">
        <h2 className="text-lg font-bold mb-5" style={{ color: "#e6edf3" }}>Featured Collections</h2>
        <div className="rounded-2xl p-12 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="text-4xl mb-3">🎨</div>
          <div className="font-semibold mb-1" style={{ color: "#e6edf3" }}>No collections yet</div>
          <div className="text-sm" style={{ color: "#9da7b3" }}>Collections will appear here once approved</div>
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 pt-8 pb-6 fade-up">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold tracking-tight" style={{ color: "#e6edf3" }}>Featured Collections</h2>
        <div className="flex overflow-hidden rounded-lg" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
          {["trending", "movers"].map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className="px-4 py-1.5 text-xs font-semibold transition-colors"
              style={{
                color: tab === t ? "#22d3ee" : "#9da7b3",
                background: tab === t ? "rgba(34,211,238,0.08)" : "transparent",
                border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif",
              }}>
              {t === "trending" ? "Trending" : "Top Movers"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {/* Hero */}
        <div
          className="col-span-2 row-span-2 rounded-2xl overflow-hidden cursor-pointer card-hover"
          style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
          onClick={() => navigate(`/collection/${hero.slug}`)}
        >
          <CollectionImg logoUrl={hero.banner_url} name={hero.name} className="h-72 w-full" />
          <div className="p-4">
            {hero.verified && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded mb-2"
                style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)", color: "#22d3ee" }}>
                ✓ Verified
              </span>
            )}
            <div className="font-bold text-lg mb-3" style={{ color: "#e6edf3" }}>{hero.name}</div>
            <div className="flex gap-5">
              <Stat label="Floor" value={hero.floor_price ? `${hero.floor_price.toFixed(2)} USD` : "—"} />
              <Stat label="Volume" value={hero.volume_total ? hero.volume_total.toLocaleString() : "—"} />
              <Stat label="Sales" value={hero.total_sales || "—"} />
            </div>
          </div>
        </div>

        {/* Small cards */}
        {rest.map((c, i) => (
          <div key={c.id}
            className="rounded-2xl overflow-hidden cursor-pointer card-hover"
            style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
            onClick={() => navigate(`/collection/${c.slug}`)}>
            <div className="relative">
              <CollectionImg logoUrl={c.banner_url || c.logo_url} name={c.name} className="h-36 w-full" />
              <span className="absolute top-2 left-2 text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: "rgba(11,15,20,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.06)", color: "#22d3ee" }}>
                #{i + 2}
              </span>
            </div>
            <div className="p-3">
              <div className="font-bold text-sm mb-2 truncate" style={{ color: "#e6edf3" }}>{c.name}</div>
              <div className="flex gap-4">
                <Stat label="Floor" value={c.floor_price ? `${c.floor_price.toFixed(2)}` : "—"} small />
                <Stat label="Sales" value={c.total_sales || "—"} small />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Live Mints Strip ─────────────────────────────────────────────────────────
function LiveMints({ navigate }) {
  const { projects, isLoading } = useFeaturedProjects();

  if (isLoading) return (
    <section className="px-6 pb-6">
      <div className="h-5 w-32 rounded animate-pulse mb-4" style={{ background: "#161d28" }} />
      <div className="flex gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex-shrink-0 w-48 h-64 rounded-2xl animate-pulse" style={{ background: "#121821" }} />
        ))}
      </div>
    </section>
  );

  if (!projects.length) return null;

  return (
    <section className="px-6 pb-6 fade-up-d1">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold tracking-tight" style={{ color: "#e6edf3" }}>Live Mints</h2>
        <button onClick={() => navigate("/launchpad")} className="text-xs font-semibold"
          style={{ color: "#22d3ee", background: "none", border: "none", cursor: "pointer" }}>
          View all →
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {projects.map((p) => <MintCard key={p.id} project={p} navigate={navigate} />)}
      </div>
    </section>
  );
}

// ─── Collections Table ────────────────────────────────────────────────────────
function CollectionsTable({ navigate }) {
  const [sortKey, setSortKey] = useState("volume_total");
  const [sortDir, setSortDir] = useState("desc");
  const { collections, isLoading } = useCollections(sortKey);

  const sorted = [...collections].sort((a, b) => {
    const mul = sortDir === "desc" ? -1 : 1;
    return ((a[sortKey] || 0) - (b[sortKey] || 0)) * mul;
  });

  function handleSort(key) {
    if (sortKey === key) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  const cols = [
    { key: "floor_price",  label: "Floor Price" },
    { key: "volume_24h",   label: "24h Volume"  },
    { key: "volume_total", label: "Volume"      },
    { key: "total_sales",  label: "Sales"       },
  ];

  return (
    <section className="px-6 pb-16 fade-up-d2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold tracking-tight" style={{ color: "#e6edf3" }}>Collections</h2>
        <span className="text-xs" style={{ color: "#9da7b3" }}>
          Sorted by {sortKey.replace(/_/g, " ")} {sortDir === "desc" ? "↓" : "↑"}
        </span>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9da7b3", width: 36 }}>#</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9da7b3" }}>Collection</th>
              {cols.map((c) => (
                <th key={c.key}
                  className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wide cursor-pointer select-none"
                  style={{ color: sortKey === c.key ? "#22d3ee" : "#9da7b3" }}
                  onClick={() => handleSort(c.key)}>
                  {c.label} {sortKey === c.key ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  {[...Array(6)].map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 rounded animate-pulse" style={{ background: "#161d28", width: j === 1 ? "120px" : "60px" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm" style={{ color: "#9da7b3" }}>
                  No collections yet — be the first to launch on TempoNFT
                </td>
              </tr>
            ) : (
              sorted.map((c, i) => (
                <tr key={c.id}
                  className="cursor-pointer transition-colors"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,211,238,0.04)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  onClick={() => navigate(`/collection/${c.slug}`)}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs" style={{ color: "#9da7b3" }}>{i + 1}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br ${GRAD_KEYS[i % 5]}`}>
                        {c.logo_url
                          ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ color: "#22d3ee" }}>{c.name?.slice(0, 2).toUpperCase()}</div>
                        }
                      </div>
                      <div>
                        <div className="text-sm font-semibold flex items-center gap-1" style={{ color: "#e6edf3" }}>
                          {c.name}
                          {c.verified && <span style={{ color: "#22d3ee" }}>✓</span>}
                        </div>
                        <div className="text-xs" style={{ color: "#9da7b3" }}>
                          {c.total_supply?.toLocaleString() || "—"} items
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: "#e6edf3" }}>
                    {c.floor_price ? `${c.floor_price.toFixed(2)} USD` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: "#9da7b3" }}>
                    {c.volume_24h ? `${c.volume_24h.toFixed(2)} USD` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: "#e6edf3" }}>
                    {c.volume_total ? `${c.volume_total.toLocaleString()} USD` : "—"}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: "#9da7b3" }}>
                    {c.total_sales || "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ─── Market Page ──────────────────────────────────────────────────────────────
export default function Market() {
  const navigate = useNavigate();
  return (
    <div className="min-h-full">
      <FeaturedCollections navigate={navigate} />
      <LiveMints navigate={navigate} />
      <CollectionsTable navigate={navigate} />
    </div>
  );
}
