import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCollections, useFeaturedProjects, useCollectionStats } from "../hooks/useSupabase";
import { TrendingUp, TrendingDown, Flame } from "lucide-react";

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
    <div 
      className={`flex items-center justify-center ${className}`}
      style={{ background: "linear-gradient(135deg, #1F7A7A, #0A0F14)" }}
    >
      <span className="font-bold text-2xl" style={{ color: "#00E6A8" }}>{initials}</span>
    </div>
  );
}

function Stat({ label, value, small, trend }) {
  return (
    <div>
      <div 
        className="text-[10px] font-medium uppercase tracking-wide mb-0.5" 
        style={{ color: "#9CA3AF" }}
      >
        {label}
      </div>
      <div 
        className={`font-mono-web3 ${small ? "text-xs" : "text-sm"} flex items-center gap-1`} 
        style={{ color: "#EDEDED" }}
      >
        {value ?? "—"}
        {trend && (
          trend > 0 
            ? <TrendingUp size={12} style={{ color: "#00E6A8" }} />
            : <TrendingDown size={12} style={{ color: "#EF4444" }} />
        )}
      </div>
    </div>
  );
}

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

// Real-time stats component for hero
function HeroStats({ contractAddress }) {
  const { stats, isLoading } = useCollectionStats(contractAddress);
  
  if (isLoading) {
    return (
      <div className="flex gap-0.5 p-1 rounded-2xl inline-flex" style={{ background: "rgba(17, 22, 29, 0.8)" }}>
        <div className="px-6 py-4">
          <div className="h-3 w-16 rounded animate-pulse mb-2" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div className="h-6 w-24 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
        </div>
        <div className="px-6 py-4 border-l" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="h-3 w-16 rounded animate-pulse mb-2" style={{ background: "rgba(255,255,255,0.1)" }} />
          <div className="h-6 w-24 rounded animate-pulse" style={{ background: "rgba(255,255,255,0.1)" }} />
        </div>
      </div>
    );
  }

  // Convert raw units to display USD (divide by 1e6)
  const floorPrice = stats.floorPrice > 0 ? (Number(stats.floorPrice) / 1e6).toFixed(2) : null;
  const totalSupply = stats.totalSupply > 0 ? stats.totalSupply.toLocaleString() : null;

  return (
    <div className="flex gap-0.5 p-1 rounded-2xl inline-flex" style={{ background: "rgba(17, 22, 29, 0.8)" }}>
      <div className="px-6 py-4">
        <p 
          className="text-[10px] uppercase font-medium tracking-widest mb-1" 
          style={{ color: "#9CA3AF" }}
        >
          Floor Price
        </p>
        <p className="text-xl font-bold font-mono-web3" style={{ color: "#EDEDED" }}>
          {floorPrice ? `${floorPrice}` : "—"} <span style={{ color: "#00E6A8" }}>USD</span>
        </p>
      </div>
      <div className="px-6 py-4 border-l" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <p 
          className="text-[10px] uppercase font-medium tracking-widest mb-1" 
          style={{ color: "#9CA3AF" }}
        >
          Items
        </p>
        <p className="text-xl font-bold font-mono-web3" style={{ color: "#EDEDED" }}>
          {totalSupply || "—"}
        </p>
      </div>
    </div>
  );
}

function HeroCarousel({ collections, navigate }) {
  const [current, setCurrent] = useState(0);
  const featured = collections.slice(0, 5);

  useEffect(() => {
    if (featured.length === 0) return;
    const timer = setInterval(() => {
      setCurrent((prev) => (prev === featured.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(timer);
  }, [featured.length]);

  if (featured.length === 0) return null;

  return (
    <section className="relative w-full h-[65vh] min-h-[500px] overflow-hidden">
      {featured.map((c, i) => (
        <div
          key={c.id}
          className={`absolute inset-0 transition-opacity duration-1000 ease-in-out cursor-pointer ${
            i === current ? "opacity-100 z-10" : "opacity-0 z-0"
          }`}
          onClick={() => navigate(`/collection/${c.slug}`)}
        >
          <div 
            className="absolute inset-0 z-20" 
            style={{ background: "linear-gradient(to top, #0A0F14, transparent 60%, rgba(0,0,0,0.3))" }}
          />
          <img 
            src={c.banner_url || c.logo_url} 
            alt={c.name}
            className={`w-full h-full object-cover transition-transform duration-[10000ms] ${
              i === current ? "scale-100" : "scale-110"
            }`}
          />
          <div className="absolute bottom-16 left-6 md:left-12 z-30 fade-up">
            <h1 
              className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-white flex items-center gap-4"
            >
              {c.name}
              {c.verified && (
                <span 
                  className="text-xl w-8 h-8 rounded-full flex items-center justify-center"
                  style={{ background: "#00E6A8", color: "#0A0F14" }}
                >
                  ✓
                </span>
              )}
            </h1>
            <HeroStats contractAddress={c.contract_address} />
          </div>
        </div>
      ))}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex gap-2">
        {featured.map((_, i) => (
          <div 
            key={i} 
            className={`hero-indicator ${i === current ? 'hero-indicator-active w-8' : 'w-2'}`} 
          />
        ))}
      </div>
    </section>
  );
}

function MintCard({ project, navigate }) {
  const countdown = useCountdown(project.mint_start_time);
  const isLive = project.status === "live";

  return (
    <div 
      className="flex-shrink-0 w-48 rounded-2xl overflow-hidden cursor-pointer nyan-card"
      onClick={() => navigate("/launchpad")}
    >
      <div className="relative">
        <CollectionImg 
          logoUrl={project.banner_url || project.logo_url} 
          name={project.name} 
          className="h-28 w-full" 
        />
        <span 
          className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-lg"
          style={{ 
            background: isLive ? "#EF4444" : "#00E6A8", 
            color: isLive ? "white" : "#0A0F14" 
          }}
        >
          {isLive && <Flame size={10} />}
          {isLive ? "LIVE" : "SOON"}
        </span>
      </div>
      <div className="p-3">
        <div 
          className="font-bold text-xs mb-2 truncate" 
          style={{ color: "#EDEDED" }}
        >
          {project.name}
        </div>
        <div className="flex justify-between mb-2">
          <div>
            <div 
              className="text-[9px] font-medium uppercase tracking-wide" 
              style={{ color: "#9CA3AF" }}
            >
              Price
            </div>
            <div 
              className="font-mono-web3 text-xs" 
              style={{ color: "#EDEDED" }}
            >
              {project.mint_price ? `${project.mint_price} USD` : "Free"}
            </div>
          </div>
          <div>
            <div 
              className="text-[9px] font-medium uppercase tracking-wide" 
              style={{ color: "#9CA3AF" }}
            >
              Supply
            </div>
            <div 
              className="font-mono-web3 text-xs" 
              style={{ color: "#EDEDED" }}
            >
              {project.max_supply?.toLocaleString() || "—"}
            </div>
          </div>
        </div>
        <div 
          className="font-mono-web3 text-xs text-center mb-2" 
          style={{ color: "#00E6A8" }}
        >
          {isLive ? "Minting now" : countdown}
        </div>
        <button 
          className="w-full h-8 rounded-lg text-xs font-semibold transition-all duration-200"
          style={{ 
            background: "#00E6A8", 
            color: "#0A0F14", 
            border: "none", 
            cursor: "pointer" 
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "#00FFC6";
            e.currentTarget.style.boxShadow = "0 0 16px rgba(0, 230, 168, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "#00E6A8";
            e.currentTarget.style.boxShadow = "none";
          }}
        >
          {isLive ? "Mint" : "View"}
        </button>
      </div>
    </div>
  );
}

function LiveMints({ navigate }) {
  const { projects, isLoading } = useFeaturedProjects();

  if (isLoading) return (
    <section className="px-6 py-12">
      <div 
        className="h-5 w-32 rounded animate-pulse mb-6" 
        style={{ background: "rgba(255,255,255,0.05)" }} 
      />
      <div className="flex gap-4">
        {[1,2,3,4].map((i) => (
          <div 
            key={i} 
            className="flex-shrink-0 w-48 h-64 rounded-2xl animate-pulse" 
            style={{ background: "rgba(255,255,255,0.03)" }} 
          />
        ))}
      </div>
    </section>
  );

  if (!projects.length) return null;

  return (
    <section className="px-6 py-12 fade-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight" style={{ color: "#EDEDED" }}>
          Live Mints
        </h2>
        <button 
          onClick={() => navigate("/launchpad")} 
          className="text-xs font-medium uppercase tracking-widest transition-colors"
          style={{ color: "#00E6A8", background: "none", border: "none", cursor: "pointer" }}
          onMouseEnter={(e) => e.currentTarget.style.color = "#00FFC6"}
          onMouseLeave={(e) => e.currentTarget.style.color = "#00E6A8"}
        >
          View all Launchpads →
        </button>
      </div>
      <div 
        className="flex gap-4 overflow-x-auto pb-4" 
        style={{ scrollbarWidth: "none" }}
      >
        {projects.map((p) => <MintCard key={p.id} project={p} navigate={navigate} />)}
      </div>
    </section>
  );
}

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

  // Format price with proper decimal conversion
  const formatPrice = (price) => {
    if (!price || price === 0) return "—";
    return `${(Number(price) / 1e6).toFixed(2)} USD`;
  };

  // Format volume with proper decimal conversion
  const formatVolume = (volume) => {
    if (!volume || volume === 0) return "—";
    const usd = Number(volume) / 1e6;
    if (usd >= 1000000) return `${(usd / 1000000).toFixed(2)}M USD`;
    if (usd >= 1000) return `${(usd / 1000).toFixed(2)}K USD`;
    return `${usd.toFixed(2)} USD`;
  };

  return (
    <section className="px-6 pb-24 fade-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight" style={{ color: "#EDEDED" }}>
          Market Rankings
        </h2>
      </div>
      <div 
        className="rounded-2xl overflow-hidden" 
        style={{ background: "#11161D", border: "1px solid rgba(255,255,255,0.05)" }}
      >
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <th 
                className="text-left px-6 py-4 text-[11px] font-medium uppercase tracking-widest" 
                style={{ width: 60, color: "#6B7280" }}
              >
                #
              </th>
              <th 
                className="text-left px-6 py-4 text-[11px] font-medium uppercase tracking-widest" 
                style={{ color: "#6B7280" }}
              >
                Collection
              </th>
              {cols.map((c) => (
                <th 
                  key={c.key}
                  className="text-right px-6 py-4 text-[11px] font-medium uppercase tracking-widest cursor-pointer select-none transition-colors"
                  style={{ color: sortKey === c.key ? "#00E6A8" : "#6B7280" }}
                  onClick={() => handleSort(c.key)}
                  onMouseEnter={(e) => {
                    if (sortKey !== c.key) e.currentTarget.style.color = "#9CA3AF";
                  }}
                  onMouseLeave={(e) => {
                    if (sortKey !== c.key) e.currentTarget.style.color = "#6B7280";
                  }}
                >
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
                    <td key={j} className="px-6 py-4">
                      <div 
                        className="h-4 rounded animate-pulse" 
                        style={{ 
                          background: "rgba(255,255,255,0.05)", 
                          width: j === 1 ? "160px" : "80px" 
                        }} 
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              sorted.map((c, i) => (
                <tr 
                  key={c.id}
                  className="cursor-pointer transition-colors"
                  style={{ 
                    borderBottom: "1px solid rgba(255,255,255,0.03)" 
                  }}
                  onClick={() => navigate(`/collection/${c.slug}`)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(255,255,255,0.02)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <td 
                    className="px-6 py-4 font-mono-web3 text-xs" 
                    style={{ color: "#6B7280" }}
                  >
                    {i + 1}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div 
                        className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, #1F7A7A, #0A0F14)" }}
                      >
                        {c.logo_url ? (
                          <img 
                            src={c.logo_url} 
                            alt={c.name} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ color: "#00E6A8" }}>
                            {c.name?.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div 
                          className="text-sm font-bold flex items-center gap-1.5" 
                          style={{ color: "#EDEDED" }}
                        >
                          {c.name}
                          {c.verified && (
                            <span style={{ color: "#00E6A8" }}>✓</span>
                          )}
                        </div>
                        <div 
                          className="text-[11px] font-medium uppercase tracking-tighter" 
                          style={{ color: "#6B7280" }}
                        >
                          {c.total_supply?.toLocaleString() || "—"} Assets
                        </div>
                      </div>
                    </div>
                  </td>
                  <td 
                    className="px-6 py-4 text-right font-bold text-sm font-mono-web3" 
                    style={{ color: "#EDEDED" }}
                  >
                    {formatPrice(c.floor_price)}
                  </td>
                  <td 
                    className="px-6 py-4 text-right font-medium text-sm font-mono-web3" 
                    style={{ color: "#9CA3AF" }}
                  >
                    {formatVolume(c.volume_24h)}
                  </td>
                  <td 
                    className="px-6 py-4 text-right font-bold text-sm font-mono-web3" 
                    style={{ color: "#EDEDED" }}
                  >
                    {formatVolume(c.volume_total)}
                  </td>
                  <td 
                    className="px-6 py-4 text-right font-medium text-sm font-mono-web3" 
                    style={{ color: "#9CA3AF" }}
                  >
                    {c.total_sales?.toLocaleString() || "—"}
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

// ─── MAIN MARKET PAGE ─────────────────────────────────────────────────────────
export default function Market() {
  const navigate = useNavigate();
  const { collections, isLoading: collectionsLoading } = useCollections("volume_total");

  return (
    <div className="min-h-screen" style={{ background: "#0A0F14" }}>
      {collectionsLoading ? (
        <div 
          className="w-full h-[65vh] flex items-center justify-center"
          style={{ background: "#11161D" }}
        >
          <div 
            className="font-bold text-2xl animate-pulse"
            style={{ color: "#00E6A8" }}
          >
            TEMPO<span style={{ color: "#EDEDED" }}>NYAN</span>
          </div>
        </div>
      ) : (
        <HeroCarousel collections={collections} navigate={navigate} />
      )}

      <LiveMints navigate={navigate} />

      <CollectionsTable navigate={navigate} />
    </div>
  );
}
