// pages/LaunchpadPage.jsx
import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Clock, Zap, Globe, Twitter, ArrowRight, Rocket,
  Flame, Star, TrendingUp, Search, ChevronRight
} from "lucide-react";
import { useFeaturedProjects } from "@/hooks/useSupabase";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getPhase(project) {
  const now      = Date.now();
  const mintStart = project.mint_start_time      ? new Date(project.mint_start_time).getTime()      : null;
  const alStart   = project.allowlist_start_time ? new Date(project.allowlist_start_time).getTime() : null;
  if (project.status === "ended") return "ended";
  if (project.status === "live")  return "live";
  if (mintStart && now >= mintStart) return "live";
  if (alStart && now >= alStart && project.allowlist_active) return "allowlist";
  return "upcoming";
}

function formatCountdown(targetMs) {
  const diff = targetMs - Date.now();
  if (diff <= 0) return "Live Now";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function mintTarget(project) {
  if (project.allowlist_active && project.allowlist_start_time) {
    const alMs = new Date(project.allowlist_start_time).getTime();
    if (alMs > Date.now()) return alMs;
  }
  return project.mint_start_time ? new Date(project.mint_start_time).getTime() : null;
}

// Live countdown hook
function useCountdown(targetMs) {
  const [display, setDisplay] = useState(targetMs ? formatCountdown(targetMs) : "");
  useEffect(() => {
    if (!targetMs) return;
    const id = setInterval(() => setDisplay(formatCountdown(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);
  return display;
}

// ─── Phase Badge ──────────────────────────────────────────────────────────────
function PhaseBadge({ phase, size = "sm" }) {
  const config = {
    live:      { label: "● LIVE",      color: "#22C55E", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)"   },
    allowlist: { label: "★ ALLOWLIST", color: "#a78bfa", bg: "rgba(167,139,250,0.12)", border: "rgba(167,139,250,0.3)" },
    upcoming:  { label: "◎ UPCOMING",  color: "#f59e0b", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
    ended:     { label: "✕ ENDED",     color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)" },
  }[phase] ?? { label: phase?.toUpperCase(), color: "#9da7b3", bg: "transparent", border: "rgba(255,255,255,0.1)" };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md font-bold tracking-widest ${size === "lg" ? "text-xs" : "text-[10px]"}`}
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}` }}>
      {config.label}
    </span>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────
function ProjectSkeleton() {
  return (
    <div className="rounded-2xl overflow-hidden animate-pulse" style={{ background: "#0d1219", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="h-40 w-full" style={{ background: "#161d28" }} />
      <div className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl flex-shrink-0" style={{ background: "#161d28" }} />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded" style={{ background: "#161d28" }} />
            <div className="h-3 w-1/3 rounded" style={{ background: "#161d28" }} />
          </div>
        </div>
        <div className="h-3 w-full rounded" style={{ background: "#161d28" }} />
        <div className="h-3 w-4/5 rounded" style={{ background: "#161d28" }} />
        <div className="h-9 w-full rounded-xl" style={{ background: "#161d28" }} />
      </div>
    </div>
  );
}

// ─── Featured Hero (large card) ───────────────────────────────────────────────
function FeaturedHero({ project, onClick }) {
  const phase   = getPhase(project);
  const target  = mintTarget(project);
  const countdown = useCountdown(phase === "upcoming" && target ? target : null);

  return (
    <div onClick={() => onClick(project)}
      className="relative rounded-3xl overflow-hidden cursor-pointer group"
      style={{ background: "#0d1219", border: "1px solid rgba(34,211,238,0.2)", minHeight: 400 }}>

      {/* Full background banner */}
      <div className="absolute inset-0">
        {project.banner_url
          ? <img src={project.banner_url} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-40" />
          : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #0d1219)" }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to top, #0d1219 30%, rgba(13,18,25,0.6) 70%, transparent)" }} />
      </div>

      {/* Badges */}
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest"
          style={{ background: "rgba(34,211,238,0.15)", border: "1px solid rgba(34,211,238,0.4)", color: "#22d3ee" }}>
          <Flame size={10} /> FEATURED
        </span>
        <PhaseBadge phase={phase} />
      </div>

      {/* Content — bottom */}
      <div className="absolute bottom-0 left-0 right-0 p-6">
        <div className="flex items-end gap-4">
          {/* Logo */}
          <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ border: "3px solid rgba(255,255,255,0.1)", background: "#161d28" }}>
            {project.logo_url
              ? <img src={project.logo_url} alt={project.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-2xl font-bold" style={{ color: "#22d3ee" }}>{project.name[0]}</div>}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-extrabold mb-1 truncate" style={{ color: "#e6edf3" }}>{project.name}</h2>
            {project.description && (
              <p className="text-sm line-clamp-2 mb-3" style={{ color: "#9da7b3" }}>{project.description}</p>
            )}

            {/* Stats row */}
            <div className="flex items-center gap-4 flex-wrap">
              {[
                { label: "Price",  value: project.mint_price != null ? `${project.mint_price} USD` : "TBA" },
                { label: "Supply", value: project.max_supply?.toLocaleString() ?? "TBA" },
                phase === "upcoming" && target
                  ? { label: "Starts In", value: countdown || "Soon" }
                  : { label: "Status", value: phase === "live" ? "Minting Now" : phase.toUpperCase() },
              ].filter(Boolean).map(({ label, value }) => (
                <div key={label}>
                  <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>{label}</div>
                  <div className="text-sm font-mono font-bold" style={{ color: label === "Starts In" || label === "Status" ? "#22d3ee" : "#e6edf3" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={e => { e.stopPropagation(); onClick(project); }}
            className="flex-shrink-0 flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-bold transition-all"
            style={{ background: phase === "live" ? "#22d3ee" : "rgba(34,211,238,0.1)", color: phase === "live" ? "#0b0f14" : "#22d3ee", border: phase === "live" ? "none" : "1px solid rgba(34,211,238,0.3)", cursor: "pointer" }}>
            {phase === "live" ? "Mint Now" : phase === "allowlist" ? "Allowlist Mint" : "View Drop"}
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Project Card ─────────────────────────────────────────────────────────────
function ProjectCard({ project, onClick }) {
  const phase   = getPhase(project);
  const target  = mintTarget(project);
  const countdown = useCountdown(phase === "upcoming" && target ? target : null);
  const isLive  = phase === "live";

  return (
    <div onClick={() => onClick(project)}
      className="rounded-2xl overflow-hidden cursor-pointer group transition-all duration-200"
      style={{ background: "#0d1219", border: `1px solid ${isLive ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.06)"}` }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = "rgba(34,211,238,0.35)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = isLive ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.06)"; e.currentTarget.style.transform = "translateY(0)"; }}>

      {/* Banner */}
      <div className="relative h-36 overflow-hidden" style={{ background: "#161d28" }}>
        {project.banner_url
          ? <img src={project.banner_url} alt="" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105 opacity-70" />
          : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 50%, #0d1219)" }} />
        <div className="absolute top-3 right-3">
          <PhaseBadge phase={phase} />
        </div>
        {isLive && (
          <div className="absolute bottom-2 left-3 flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22C55E" }} />
            <span className="text-[10px] font-bold" style={{ color: "#22C55E" }}>MINTING NOW</span>
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 -mt-7 relative z-10"
            style={{ border: "2px solid #0d1219", background: "#161d28" }}>
            {project.logo_url
              ? <img src={project.logo_url} alt={project.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ color: "#22d3ee" }}>{project.name[0]}</div>}
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-extrabold text-sm truncate" style={{ color: "#e6edf3" }}>{project.name}</h3>
            <div className="flex items-center gap-2 mt-0.5">
              {project.twitter && (
                <a href={project.twitter} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                  style={{ color: "#9da7b3" }}><Twitter size={11} /></a>
              )}
              {project.website && (
                <a href={project.website} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                  style={{ color: "#9da7b3" }}><Globe size={11} /></a>
              )}
            </div>
          </div>
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs mb-3 line-clamp-2" style={{ color: "#9da7b3" }}>{project.description}</p>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl p-2.5" style={{ background: "#161d28" }}>
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Price</div>
            <div className="text-sm font-mono font-bold" style={{ color: "#22d3ee" }}>
              {project.mint_price != null ? `${project.mint_price} USD` : "TBA"}
            </div>
          </div>
          <div className="rounded-xl p-2.5" style={{ background: "#161d28" }}>
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>
              {phase === "upcoming" && target ? "Starts In" : "Supply"}
            </div>
            <div className="text-sm font-mono font-bold" style={{ color: phase === "upcoming" && target ? "#f59e0b" : "#e6edf3" }}>
              {phase === "upcoming" && target ? (countdown || "Soon") : (project.max_supply?.toLocaleString() ?? "TBA")}
            </div>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={e => { e.stopPropagation(); onClick(project); }}
          className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: isLive ? "#22d3ee" : "rgba(34,211,238,0.08)",
            color:      isLive ? "#0b0f14" : "#22d3ee",
            border:     isLive ? "none"    : "1px solid rgba(34,211,238,0.2)",
            cursor: "pointer",
          }}>
          {isLive ? "Mint Now" : phase === "allowlist" ? "Allowlist Mint" : "View Drop"}
          <ChevronRight size={12} />
        </button>
      </div>
    </div>
  );
}

// ─── Stats Banner ─────────────────────────────────────────────────────────────
function StatsBanner({ projects }) {
  const live     = projects.filter(p => getPhase(p) === "live").length;
  const upcoming = projects.filter(p => getPhase(p) === "upcoming").length;
  const total    = projects.length;

  return (
    <div className="grid grid-cols-3 gap-3 mb-8">
      {[
        { label: "Live Drops",     value: live,     color: "#22C55E", icon: Flame  },
        { label: "Upcoming",       value: upcoming,  color: "#f59e0b", icon: Clock  },
        { label: "Total Projects", value: total,     color: "#22d3ee", icon: Rocket },
      ].map(({ label, value, color, icon: Icon }) => (
        <div key={label} className="rounded-2xl p-4 flex items-center gap-3"
          style={{ background: "#0d1219", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${color}18` }}>
            <Icon size={16} style={{ color }} />
          </div>
          <div>
            <div className="font-mono text-xl font-bold" style={{ color }}>{value}</div>
            <div className="text-[10px] uppercase tracking-wider" style={{ color: "#9da7b3" }}>{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function EmptyState({ filter }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
        style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.12)" }}>
        <Rocket size={28} style={{ color: "rgba(34,211,238,0.4)" }} />
      </div>
      <p className="font-bold text-base mb-2" style={{ color: "#e6edf3" }}>
        No {filter !== "all" ? filter : ""} drops yet
      </p>
      <p className="text-sm" style={{ color: "#9da7b3" }}>
        Check back soon or apply to launch your collection.
      </p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
const FILTERS = [
  { id: "all",       label: "All Drops"  },
  { id: "live",      label: "🔴 Live"    },
  { id: "allowlist", label: "★ Allowlist" },
  { id: "upcoming",  label: "Upcoming"   },
  { id: "ended",     label: "Ended"      },
];

export default function LaunchpadPage() {
  const navigate = useNavigate();
  const { projects, isLoading, error } = useFeaturedProjects();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  function handleProjectClick(project) {
    navigate(`/launchpad/${project.id}`);
  }

  const featured = useMemo(() => projects.filter(p => p.status === "featured"), [projects]);

  const filtered = useMemo(() => {
    let list = projects.filter(p => featured.length === 0 || p.status !== "featured");
    if (filter !== "all") list = list.filter(p => getPhase(p) === filter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    return list;
  }, [projects, filter, featured, search]);

  return (
    <div className="fade-up px-4 sm:px-6 max-w-6xl mx-auto py-8" style={{ minHeight: "100vh" }}>

      {/* Header */}
<div className="mb-8">
  <div className="flex items-center justify-between">
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Rocket size={18} style={{ color: "#22c55e" }} /> {/* Changed to Green */}
        <span className="text-xs font-bold tracking-widest uppercase" style={{ color: "#22c55e" }}>Launchpad</span>
      </div>
      <h1 className="text-3xl font-extrabold mb-1" style={{ color: "#e6edf3" }}>NFT Drops</h1>
      <p className="text-sm" style={{ color: "#9da7b3" }}>Discover and mint collections launching on Tempo Chain.</p>
    </div>
    {/* Corrected path to /application and color to Green */}
    <button onClick={() => navigate("/application")}
      className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
      style={{ background: "rgba(34,197,94,0.08)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)", cursor: "pointer" }}>
      Apply to Launch <ArrowRight size={13} />
    </button>
  </div>
</div>

      {/* Error */}
      {error && (
        <div className="rounded-xl px-4 py-3 mb-6 text-sm"
          style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          Failed to load projects: {error}
        </div>
      )}

      {/* Stats */}
      {!isLoading && projects.length > 0 && <StatsBanner projects={projects} />}

      {/* Featured hero */}
      {!isLoading && featured.length > 0 && (
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <Star size={13} style={{ color: "#f59e0b" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9da7b3" }}>Featured Drops</span>
          </div>
          <div className="space-y-4">
            {featured.map(p => <FeaturedHero key={p.id} project={p} onClick={handleProjectClick} />)}
          </div>
        </div>
      )}

      {/* Filter + Search bar */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5 overflow-x-auto flex-1 min-w-0">
          {FILTERS.map(f => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className="h-8 px-3 rounded-full text-xs font-semibold whitespace-nowrap transition-colors"
              style={{
                background: filter === f.id ? "rgba(34,211,238,0.12)" : "#0d1219",
                color:      filter === f.id ? "#22d3ee" : "#9da7b3",
                border:     filter === f.id ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer",
              }}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative flex-shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" size={12} style={{ color: "#9da7b3" }} />
          <input type="text" placeholder="Search drops..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="h-8 pl-8 pr-3 rounded-full text-xs outline-none w-36"
            style={{ background: "#0d1219", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
            onFocus={e => e.target.style.borderColor = "#22d3ee"}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
        </div>
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
          {filtered.map(p => <ProjectCard key={p.id} project={p} onClick={handleProjectClick} />)}
        </div>
      )}

            {/* Bottom CTA */}
      {!isLoading && (
        <div className="mt-12 rounded-2xl p-8 text-center relative overflow-hidden"
          style={{ background: "#0d1219", border: "1px solid rgba(34,197,94,0.15)" }}>
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(34,197,94,0.06) 0%, transparent 70%)" }} />
          <Rocket size={32} className="mx-auto mb-3" style={{ color: "#22c55e" }} />
          <h3 className="font-extrabold text-lg mb-2" style={{ color: "#e6edf3" }}>Launch Your Collection</h3>
          <p className="text-sm mb-5 max-w-sm mx-auto" style={{ color: "#9da7b3" }}>
            Apply to list your NFT project on the Tempo Launchpad. Multi-phase minting, allowlist support, and more.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={() => navigate("/application")}
              className="h-10 px-6 rounded-xl text-sm font-bold"
              style={{ background: "#22c55e", color: "#0b0f14", border: "none", cursor: "pointer" }}>
              Apply Now
            </button>
            <button onClick={() => navigate("/launchpad/guide")}
              className="h-10 px-6 rounded-xl text-sm font-bold"
              style={{ background: "transparent", color: "#22c55e", border: "1px solid rgba(34,197,94,0.3)", cursor: "pointer" }}>
              Read the Guide
            </button>
          </div>
        </div>
      )}
    </div> 
  );  
}   
