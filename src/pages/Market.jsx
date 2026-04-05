import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// ─── Mock data (replace with real API calls once indexer is ready) ─────────────
const FEATURED = [
  { id: 1, name: "Cosmic Tides Genesis", emoji: "🌊", grad: "from-[#0e2233] to-[#031220]", floor: 2.40, volume: 14820, change: 18.4,  verified: true  },
  { id: 2, name: "Void Protocol",        emoji: "🔮", grad: "from-[#1a0e33] to-[#0d0b1e]", floor: 1.85, volume: 10240, change: 12.1,  verified: false },
  { id: 3, name: "NeoForest DAO",        emoji: "🌿", grad: "from-[#0e2818] to-[#051a0d]", floor: 0.95, volume: 5940,  change: -3.2,  verified: false },
  { id: 4, name: "Ember Relics",         emoji: "🔥", grad: "from-[#331a0e] to-[#1e0b05]", floor: 3.10, volume: 8650,  change: 7.8,   verified: true  },
  { id: 5, name: "Static Machines",      emoji: "⚡", grad: "from-[#1a1a0e] to-[#101005]", floor: 0.62, volume: 7200,  change: 22.0,  verified: false },
];

const MINTS = [
  { id: 1, name: "Quantum Drift",  emoji: "🌀", grad: "from-[#0e2233] to-[#031220]", price: "0.50",  supply: "5,000",  seconds: 5050  },
  { id: 2, name: "Neon Ghosts",    emoji: "👻", grad: "from-[#1a0e33] to-[#0d0b1e]", price: "0.20",  supply: "10,000", seconds: 11444 },
  { id: 3, name: "Terra Nodes",    emoji: "🌍", grad: "from-[#0e2818] to-[#051a0d]", price: "1.00",  supply: "2,500",  seconds: 2528  },
  { id: 4, name: "Phantom Cells",  emoji: "🔬", grad: "from-[#331a0e] to-[#1e0b05]", price: "0.80",  supply: "7,500",  seconds: 21330 },
  { id: 5, name: "Solar Drift",    emoji: "☀️", grad: "from-[#1a1a0e] to-[#101005]", price: "0.35",  supply: "8,000",  seconds: 8335  },
  { id: 6, name: "Crypto Skulls",  emoji: "💀", grad: "from-[#0e2233] to-[#031220]", price: "1.50",  supply: "3,333",  seconds: 562   },
  { id: 7, name: "Rift Keepers",   emoji: "🗝️", grad: "from-[#1a0e33] to-[#0d0b1e]", price: "0.90",  supply: "4,444",  seconds: 16320 },
];

const COLLECTIONS = [
  { id: "cosmic-tides",   name: "Cosmic Tides Genesis", emoji: "🌊", items: "10,000", floor: 2.40, offer: 2.31, change: 18.4,  volume: 14820, sales: 342 },
  { id: "void-protocol",  name: "Void Protocol",        emoji: "🔮", items: "5,000",  floor: 1.85, offer: 1.72, change: 12.1,  volume: 10240, sales: 218 },
  { id: "ember-relics",   name: "Ember Relics",         emoji: "🔥", items: "3,333",  floor: 3.10, offer: 2.98, change: 7.8,   volume: 8650,  sales: 189 },
  { id: "static-machine", name: "Static Machines",      emoji: "⚡", items: "8,888",  floor: 0.62, offer: 0.58, change: 22.0,  volume: 7200,  sales: 410 },
  { id: "neoforest",      name: "NeoForest DAO",        emoji: "🌿", items: "6,000",  floor: 0.95, offer: 0.88, change: -3.2,  volume: 5940,  sales: 127 },
  { id: "phantom-cells",  name: "Phantom Cells",        emoji: "🔬", items: "7,500",  floor: 0.80, offer: 0.74, change: -1.5,  volume: 4100,  sales: 98  },
  { id: "rift-keepers",   name: "Rift Keepers",         emoji: "🗝️", items: "4,444",  floor: 0.90, offer: 0.85, change: 5.3,   volume: 3720,  sales: 86  },
  { id: "solar-drift",    name: "Solar Drift",          emoji: "☀️", items: "8,000",  floor: 0.35, offer: 0.32, change: 9.1,   volume: 2980,  sales: 203 },
  { id: "quantum-drift",  name: "Quantum Drift",        emoji: "🌀", items: "5,000",  floor: 0.50, offer: 0.47, change: -6.4,  volume: 2310,  sales: 74  },
  { id: "neon-ghosts",    name: "Neon Ghosts",          emoji: "👻", items: "10,000", floor: 0.20, offer: 0.18, change: 14.2,  volume: 1820,  sales: 317 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(secs) {
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GradImg({ grad, emoji, className = "" }) {
  return (
    <div className={`bg-gradient-to-br ${grad} flex items-center justify-center ${className}`}>
      <span className="text-4xl">{emoji}</span>
    </div>
  );
}

function ChangeCell({ value }) {
  const pos = value >= 0;
  return (
    <span
      className="font-mono text-sm"
      style={{ color: pos ? "#22C55E" : "#EF4444" }}
    >
      {pos ? "+" : ""}{value}%
    </span>
  );
}

// ─── Countdown hook ───────────────────────────────────────────────────────────
function useCountdowns(initialMints) {
  const [times, setTimes] = useState(() => initialMints.map((m) => m.seconds));

  useEffect(() => {
    const id = setInterval(() => {
      setTimes((prev) => prev.map((s) => (s > 0 ? s - 1 : 0)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return times;
}

// ─── Featured Collections ─────────────────────────────────────────────────────
function FeaturedCollections({ navigate }) {
  const [tab, setTab] = useState("trending");

  const sorted = [...FEATURED].sort((a, b) =>
    tab === "trending" ? b.volume - a.volume : b.change - a.change
  );

  const [hero, ...rest] = sorted;

  return (
    <section className="px-6 pt-8 pb-6 fade-up">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold tracking-tight" style={{ color: "#e6edf3" }}>
          Featured Collections
        </h2>
        <div
          className="flex overflow-hidden rounded-lg"
          style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}
        >
          {["trending", "movers"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-1.5 text-xs font-semibold transition-colors"
              style={{
                color: tab === t ? "#22d3ee" : "#9da7b3",
                background: tab === t ? "rgba(34,211,238,0.08)" : "transparent",
                border: "none",
                cursor: "pointer",
                fontFamily: "Syne, sans-serif",
              }}
            >
              {t === "trending" ? "Trending" : "Top Movers"}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-4 gap-4" style={{ gridTemplateRows: "auto auto" }}>
        {/* Hero card — spans 2 cols × 2 rows */}
        <div
          className="col-span-2 row-span-2 rounded-2xl overflow-hidden cursor-pointer card-hover"
          style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
          onClick={() => navigate(`/collection/${hero.id}`)}
        >
          <GradImg grad={hero.grad} emoji={hero.emoji} className="h-72 w-full text-6xl" />
          <div className="p-4">
            {hero.verified && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded mb-2"
                style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.2)", color: "#22d3ee" }}
              >
                ✓ Verified
              </span>
            )}
            <div className="font-bold text-lg mb-3" style={{ color: "#e6edf3" }}>{hero.name}</div>
            <div className="flex gap-5">
              <Stat label="Floor" value={`${hero.floor.toFixed(2)} USD`} />
              <Stat label="Volume" value={`${hero.volume.toLocaleString()}`} />
              <StatChange label="24h" value={hero.change} />
            </div>
          </div>
        </div>

        {/* Small cards */}
        {rest.map((c, i) => (
          <div
            key={c.id}
            className="rounded-2xl overflow-hidden cursor-pointer card-hover"
            style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
            onClick={() => navigate(`/collection/${c.id}`)}
          >
            <div className="relative">
              <GradImg grad={c.grad} emoji={c.emoji} className="h-36 w-full text-4xl" />
              <span
                className="absolute top-2 left-2 text-xs font-mono px-2 py-0.5 rounded"
                style={{ background: "rgba(11,15,20,0.75)", backdropFilter: "blur(8px)", border: "1px solid rgba(255,255,255,0.06)", color: "#22d3ee" }}
              >
                #{i + 2}
              </span>
            </div>
            <div className="p-3">
              <div className="font-bold text-sm mb-2 truncate" style={{ color: "#e6edf3" }}>{c.name}</div>
              <div className="flex gap-4">
                <Stat label="Floor" value={c.floor.toFixed(2)} small />
                <StatChange label="24h" value={c.change} small />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, small }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>{label}</div>
      <div className={`font-mono ${small ? "text-xs" : "text-sm"}`} style={{ color: "#e6edf3" }}>{value}</div>
    </div>
  );
}

function StatChange({ label, value, small }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>{label}</div>
      <div className={`font-mono ${small ? "text-xs" : "text-sm"}`} style={{ color: value >= 0 ? "#22C55E" : "#EF4444" }}>
        {value >= 0 ? "+" : ""}{value}%
      </div>
    </div>
  );
}

// ─── Live Mints Strip ─────────────────────────────────────────────────────────
function LiveMints({ navigate }) {
  const times = useCountdowns(MINTS);

  return (
    <section className="px-6 pb-6 fade-up-d1">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold tracking-tight" style={{ color: "#e6edf3" }}>Live Mints</h2>
        <button
          onClick={() => navigate("/launchpad")}
          className="text-xs font-semibold"
          style={{ color: "#22d3ee", background: "none", border: "none", cursor: "pointer" }}
        >
          View all →
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
        {MINTS.map((m, i) => (
          <div
            key={m.id}
            className="flex-shrink-0 w-48 rounded-2xl overflow-hidden cursor-pointer card-hover"
            style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
            onClick={() => navigate("/launchpad")}
          >
            <div className="relative">
              <GradImg grad={m.grad} emoji={m.emoji} className="h-28 w-full text-4xl" />
              <span
                className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded"
                style={{ background: "#EF4444", color: "white" }}
              >
                <span className="live-dot" style={{ color: "white" }} />
                LIVE
              </span>
            </div>
            <div className="p-3">
              <div className="font-bold text-xs mb-2 truncate" style={{ color: "#e6edf3" }}>{m.name}</div>
              <div className="flex justify-between mb-2">
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "#9da7b3" }}>Price</div>
                  <div className="font-mono text-xs" style={{ color: "#e6edf3" }}>{m.price} USD</div>
                </div>
                <div>
                  <div className="text-[9px] font-semibold uppercase tracking-wide" style={{ color: "#9da7b3" }}>Supply</div>
                  <div className="font-mono text-xs" style={{ color: "#e6edf3" }}>{m.supply}</div>
                </div>
              </div>
              <div className="font-mono text-xs text-center mb-2" style={{ color: "#22d3ee" }}>
                {fmtTime(times[i])}
              </div>
              <button
                className="w-full h-7 rounded-lg text-xs font-bold transition-colors"
                style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
                onClick={(e) => { e.stopPropagation(); navigate("/launchpad"); }}
              >
                Mint
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Collections Table ────────────────────────────────────────────────────────
function CollectionsTable({ navigate }) {
  const [sortKey, setSortKey]   = useState("volume");
  const [sortDir, setSortDir]   = useState("desc");

  const sorted = [...COLLECTIONS].sort((a, b) => {
    const mul = sortDir === "desc" ? -1 : 1;
    return (a[sortKey] - b[sortKey]) * mul;
  });

  function handleSort(key) {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const cols = [
    { key: "floor",  label: "Floor Price" },
    { key: "offer",  label: "Top Offer"   },
    { key: "change", label: "24h Change"  },
    { key: "volume", label: "Volume"      },
    { key: "sales",  label: "Sales"       },
  ];

  const gradKeys = ["from-[#0e2233] to-[#031220]", "from-[#1a0e33] to-[#0d0b1e]", "from-[#0e2818] to-[#051a0d]", "from-[#331a0e] to-[#1e0b05]", "from-[#1a1a0e] to-[#101005]"];

  return (
    <section className="px-6 pb-16 fade-up-d2">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold tracking-tight" style={{ color: "#e6edf3" }}>Collections</h2>
        <span className="text-xs" style={{ color: "#9da7b3" }}>
          Sorted by {sortKey} {sortDir === "desc" ? "↓" : "↑"}
        </span>
      </div>

      <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9da7b3", width: 36 }}>#</th>
              <th className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-wide" style={{ color: "#9da7b3" }}>Collection</th>
              {cols.map((c) => (
                <th
                  key={c.key}
                  className="text-right px-4 py-3 text-[11px] font-bold uppercase tracking-wide cursor-pointer select-none transition-colors"
                  style={{ color: sortKey === c.key ? "#22d3ee" : "#9da7b3" }}
                  onClick={() => handleSort(c.key)}
                >
                  {c.label} {sortKey === c.key ? (sortDir === "desc" ? "↓" : "↑") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((c, i) => (
              <tr
                key={c.id}
                className="cursor-pointer transition-colors"
                style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(34,211,238,0.04)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                onClick={() => navigate(`/collection/${c.id}`)}
              >
                <td className="px-4 py-3">
                  <span className="font-mono text-xs" style={{ color: "#9da7b3" }}>{i + 1}</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl bg-gradient-to-br ${gradKeys[i % 5]}`}>
                      {c.emoji}
                    </div>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{c.name}</div>
                      <div className="text-xs" style={{ color: "#9da7b3" }}>{c.items} items</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: "#e6edf3" }}>{c.floor.toFixed(2)} USD</td>
                <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: "#9da7b3" }}>{c.offer.toFixed(2)} USD</td>
                <td className="px-4 py-3 text-right">
                  <ChangeCell value={c.change} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: "#e6edf3" }}>{c.volume.toLocaleString()} USD</td>
                <td className="px-4 py-3 text-right font-mono text-sm" style={{ color: "#9da7b3" }}>{c.sales}</td>
              </tr>
            ))}
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
