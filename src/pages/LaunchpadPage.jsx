import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Clock, Zap, CheckCircle2, Globe, Twitter, ArrowRight, Rocket } from "lucide-react";
import { useFeaturedProjects } from "@/hooks/useSupabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPhase(project) {
  const now = Date.now();
  const mintStart = project.mint_start_time ? new Date(project.mint_start_time).getTime() : null;
  const alStart   = project.allowlist_start_time ? new Date(project.allowlist_start_time).getTime() : null;

  if (project.status === "ended") return "ended";
  if (project.status === "live")  return "live";
  if (mintStart && now >= mintStart) return "live";
  if (alStart   && now >= alStart && project.allowlist_active) return "allowlist";
  return "upcoming";
}

function formatCountdown(targetMs) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return "Now";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function mintTarget(project) {
  if (project.allowlist_active && project.allowlist_start_time) {
    const alMs = new Date(project.allowlist_start_time).getTime();
    if (alMs > Date.now()) return alMs;
  }
  return project.mint_start_time ? new Date(project.mint_start_time).getTime() : null;
}

// ─── Phase Badge ──────────────────────────────────────────────────────────────
function PhaseBadge({ phase }) {
  const config = {
    live:       { label: "● LIVE",       color: "#22d3ee", bg: "rgba(34,211,238,0.12)",  border: "rgba(34,211,238,0.3)"  },
    allowlist:  { label: "★ ALLOWLIST",  color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)" },
    upcoming:   { label: "◎ UPCOMING",   color: "#9da7b3", bg: "rgba(157,167,179,0.08)", border: "rgba(157,167,179,0.2)" },
    ended:      { label: "✕ ENDED",      color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)" },
  }[phase] ?? { label: phase.toUpperCase(), color: "#9da7b3", bg: "transparent", border: "rgba(255,255,255,0.1)" };

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}`, fontFamily: "Syne, sans-serif" }}>
      {config.label}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function ProjectSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="h-36 w-full" style={{ background: "#161d28" }} />
      <div className="p-5 space-y-3">
        <div className="h-4 w-2/3 rounded" style={{ background: "#161d28" }} />
        <div className="h-3 w-full rounded" style={{ background: "#161d28" }} />
        <div className="h-3 w-4/5 rounded" style={{ background: "#161d28" }} />
        <div className="flex gap-2 pt-1">
          <div className="h-7 flex-1 rounded-lg" style={{ background: "#161d28" }} />
          <div className="h-7 flex-1 rounded-lg" style={{ background: "#161d28" }} />
        </div>
      </div>
    </div>
  );
}

// ─── Featured Hero Card ───────────────────────────────────────────────────────
function FeaturedCard({ project, onClick }) {
  const phase  = getPhase(project);
  const target = mintTarget(project);

  return (
    <div
      onClick={() => onClick(project)}
      className="relative rounded-2xl overflow-hidden cursor-pointer group"
      style={{
        background: "#121821",
        border: "1px solid rgba(34,211,238,0.2)",
        boxShadow: "0 0 40px rgba(34,211,238,0.06)",
        minHeight: 320,
      }}
    >
      {/* Banner */}
      <div className="relative h-48 overflow-hidden">
        {project.banner_url ? (
          <img src={project.banner_url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233 0%, #031220 100%)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #121821 100%)" }} />

        {/* Featured pill */}
        <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest flex items-center gap-1.5"
          style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.4)", color: "#22d3ee", fontFamily: "Syne, sans-serif" }}>
          <Zap size={10} fill="#22d3ee" /> FEATURED
        </div>

        <div className="absolute top-3 right-3">
          <PhaseBadge phase={phase} />
        </div>
      </div>

      {/* Logo overlap */}
      <div className="absolute left-5" style={{ top: 148 }}>
        <div className="w-16 h-16 rounded-xl overflow-hidden"
          style={{ border: "3px solid #121821", background: "#161d28" }}>
          {project.logo_url
            ? <img src={project.logo_url} alt={project.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: "#22d3ee" }}>{project.name[0]}</div>
          }
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pt-10 pb-5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-lg font-extrabold leading-tight" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>{project.name}</h3>
          <div className="flex items-center gap-1.5 flex-shrink-0 pt-0.5">
            {project.twitter && (
              <a href={project.twitter} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}>
                <Twitter size={11} />
              </a>
            )}
            {project.website && (
              <a href={project.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}>
                <Globe size={11} />
              </a>
            )}
          </div>
        </div>

        {project.description && (
          <p className="text-xs mb-4 line-clamp-2" style={{ color: "#9da7b3" }}>{project.description}</p>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { label: "Price",  value: project.mint_price != null ? `${project.mint_price} USD` : "TBA" },
            { label: "Supply", value: project.max_supply?.toLocaleString() ?? "TBA" },
            { label: phase === "upcoming" && target ? "Starts In" : "Status",
              value: phase === "upcoming" && target ? formatCountdown(target) : phase.toUpperCase() },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-xl p-2.5" style={{ background: "#0b0f14" }}>
              <div className="text-[9px] font-semibold uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>{label}</div>
              <div className="text-xs font-bold font-mono" style={{ color: "#e6edf3" }}>{value}</div>
            </div>
          ))}
        </div>

        <button
          className="w-full h-10 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
          onClick={(e) => { e.stopPropagation(); onClick(project); }}>
          {phase === "live" ? "Mint Now" : phase === "allowlist" ? "Allowlist Mint" : "View Project"}
          <ArrowRight size={14} />
        </button>
      </div>
    </div>
  );
}

// ─── Regular Project Card ─────────────────────────────────────────────────────
function ProjectCard({ project, onClick }) {
  const phase  = getPhase(project);
  const target = mintTarget(project);

  return (
    <div
      onClick={() => onClick(project)}
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all duration-200"
      style={{
        background: "#121821",
        border: "1px solid rgba(255,255,255,0.06)",
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.2)"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)"}
    >
      {/* Banner */}
      <div className="relative h-28 overflow-hidden">
        {project.banner_url ? (
          <img src={project.banner_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, #121821 100%)" }} />
        <div className="absolute top-2 right-2">
          <PhaseBadge phase={phase} />
        </div>
      </div>

      {/* Logo */}
      <div className="relative px-4 -mt-6 mb-2">
        <div className="w-12 h-12 rounded-xl overflow-hidden"
          style={{ border: "2px solid #121821", background: "#161d28" }}>
          {project.logo_url
            ? <img src={project.logo_url} alt={project.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ color: "#22d3ee" }}>{project.name[0]}</div>
          }
        </div>
      </div>

      <div className="px-4 pb-4">
        <h3 className="font-bold text-sm mb-1 truncate" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>{project.name}</h3>
        {project.description && (
          <p className="text-xs mb-3 line-clamp-2" style={{ color: "#9da7b3" }}>{project.description}</p>
        )}

        <div className="flex items-center justify-between text-xs mb-3">
          <span style={{ color: "#9da7b3" }}>
            {project.mint_price != null ? (
              <span className="font-mono font-bold" style={{ color: "#e6edf3" }}>{project.mint_price} <span style={{ color: "#9da7b3" }}>USD</span></span>
            ) : "Price TBA"}
          </span>
          {phase === "upcoming" && target && (
            <span className="flex items-center gap-1 font-mono text-[10px]" style={{ color: "#22d3ee" }}>
              <Clock size={10} /> {formatCountdown(target)}
            </span>
          )}
          {phase === "live" && (
            <span className="font-mono text-[10px] font-bold" style={{ color: "#22d3ee" }}>MINTING NOW</span>
          )}
        </div>

        <button
          className="w-full h-8 rounded-lg text-xs font-bold transition-colors"
          style={{
            background: phase === "live" ? "#22d3ee" : "rgba(34,211,238,0.08)",
            color: phase === "live" ? "#0b0f14" : "#22d3ee",
            border: phase === "live" ? "none" : "1px solid rgba(34,211,238,0.25)",
            cursor: "pointer",
            fontFamily: "Syne, sans-serif",
          }}
          onClick={(e) => { e.stopPropagation(); onClick(project); }}>
          {phase === "live" ? "Mint Now" : phase === "allowlist" ? "Allowlist Mint" : "View"}
        </button>
      </div>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filter }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <Rocket size={40} style={{ color: "rgba(34,211,238,0.3)" }} className="mb-4" />
      <p className="font-bold text-sm mb-1" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
        No {filter !== "all" ? filter : ""} projects yet
      </p>
      <p className="text-xs" style={{ color: "#9da7b3" }}>
        Check back soon or apply to launch your project.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const FILTERS = ["all", "live", "allowlist", "upcoming", "ended"];

export default function LaunchpadPage() {
  const navigate = useNavigate();
  const { projects, isLoading, error } = useFeaturedProjects();
  const [filter, setFilter] = useState("all");

  function handleProjectClick(project) {
    navigate(`/launchpad/${project.id}`);
  }

  const featured = useMemo(() =>
    projects.filter(p => p.status === "featured"),
  [projects]);

  const filtered = useMemo(() => {
    const list = projects.filter(p => p.status !== "featured" || featured.length === 0);
    if (filter === "all") return list;
    return list.filter(p => getPhase(p) === filter);
  }, [projects, filter, featured]);

  return (
    <div className="fade-up px-4 sm:px-6 max-w-6xl mx-auto py-8">

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Rocket size={18} style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#22d3ee", fontFamily: "Syne, sans-serif" }}>
            Launchpad
          </span>
        </div>
        <h1 className="text-3xl font-extrabold mb-2" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
          NFT Drops on Tempo Chain
        </h1>
        <p className="text-sm" style={{ color: "#9da7b3" }}>
          Discover and mint the latest collections launching on Tempo.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          Failed to load projects: {error}
        </div>
      )}

      {/* Featured section */}
      {!isLoading && featured.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs font-bold tracking-widest uppercase mb-4" style={{ color: "#9da7b3", fontFamily: "Syne, sans-serif" }}>
            ★ Featured Drops
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {featured.map(p => (
              <FeaturedCard key={p.id} project={p} onClick={handleProjectClick} />
            ))}
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className="h-8 px-4 rounded-full text-xs font-semibold capitalize whitespace-nowrap transition-colors"
            style={{
              background:   filter === f ? "rgba(34,211,238,0.12)" : "#121821",
              color:        filter === f ? "#22d3ee" : "#9da7b3",
              border:       filter === f ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.06)",
              cursor:       "pointer",
              fontFamily:   "Syne, sans-serif",
            }}>
            {f === "all" ? "All Projects" : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        {/* Apply CTA — right side */}
        <button
          onClick={() => navigate("/manage")}
          className="ml-auto h-8 px-4 rounded-full text-xs font-bold whitespace-nowrap flex items-center gap-1.5"
          style={{
            background: "transparent",
            color: "#22d3ee",
            border: "1px solid rgba(34,211,238,0.3)",
            cursor: "pointer",
            fontFamily: "Syne, sans-serif",
          }}>
          Apply to Launch <ArrowRight size={11} />
        </button>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <ProjectSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <ProjectCard key={p.id} project={p} onClick={handleProjectClick} />
          ))}
        </div>
      )}

      {/* Bottom CTA */}
      {!isLoading && (
        <div className="mt-12 rounded-2xl p-6 text-center"
          style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.12)" }}>
          <Rocket size={28} className="mx-auto mb-3" style={{ color: "#22d3ee" }} />
          <h3 className="font-extrabold text-base mb-1" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
            Launch Your Collection
          </h3>
          <p className="text-xs mb-4" style={{ color: "#9da7b3" }}>
            Apply to list your NFT project on the Tempo Launchpad. Our team reviews all submissions.
          </p>
          <button
            onClick={() => navigate("/manage")}
            className="h-10 px-6 rounded-xl text-sm font-bold"
            style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
            Apply Now
          </button>
        </div>
      )}
    </div>
  );
}
