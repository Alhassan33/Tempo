import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useCollections, useFeaturedProjects } from "../hooks/useSupabase";
import { useMarketplace } from "../hooks/useMarketplace";

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

// --- HERO CAROUSEL COMPONENT ---
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
          <div className="absolute inset-0 bg-gradient-to-t from-[#03080f] via-transparent to-black/20 z-20" />
          <img 
            src={c.banner_url || c.logo_url} 
            alt={c.name}
            className={`w-full h-full object-cover transition-transform duration-[10000ms] ${
              i === current ? "scale-100" : "scale-110"
            }`}
          />
          <div className="absolute bottom-16 left-6 md:left-12 z-30 fade-up">
            <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tighter uppercase italic text-white flex items-center gap-4">
              {c.name}
              {c.verified && (
                <span className="text-2xl not-italic bg-[#22d3ee] text-[#03080f] w-8 h-8 rounded-full flex items-center justify-center">✓</span>
              )}
            </h1>
            <div className="flex gap-0.5 p-1 glass-morph rounded-2xl inline-flex">
              <div className="px-6 py-4">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">Floor Price</p>
                <p className="text-xl font-bold" style={{ color: "#e6edf3" }}>
                  {c.floor_price ? `${c.floor_price.toFixed(2)}` : "—"} <span className="text-[#22d3ee]">USD</span>
                </p>
              </div>
              <div className="px-6 py-4 border-l border-white/10">
                <p className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mb-1">Total Volume</p>
                <p className="text-xl font-bold" style={{ color: "#e6edf3" }}>
                  {c.volume_total ? `${c.volume_total.toLocaleString()}` : "—"} <span className="text-[#22d3ee]">USD</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-40 flex gap-2">
        {featured.map((_, i) => (
          <div key={i} className={`hero-indicator ${i === current ? 'hero-indicator-active' : 'w-2'}`} />
        ))}
      </div>
    </section>
  );
}

function MintCard({ project, navigate }) {
  const countdown = useCountdown(project.mint_start_time);
  const isLive = project.status === "live";

  return (
    <div className="flex-shrink-0 w-48 rounded-2xl overflow-hidden cursor-pointer nyan-card"
      onClick={() => navigate("/launchpad")}>
      <div className="relative">
        <CollectionImg logoUrl={project.banner_url || project.logo_url} name={project.name} className="h-28 w-full" />
        <span className="absolute top-2 right-2 flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded"
          style={{ background: isLive ? "#EF4444" : "#22d3ee", color: isLive ? "white" : "#0b0f14" }}>
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
            <div className="font-mono text-xs" style={{ color: "#e6edf3" }}>{project.max_supply?.toLocaleString() || "—"}</div>
          </div>
        </div>
        <div className="font-mono text-xs text-center mb-2" style={{ color: "#22d3ee" }}>
          {isLive ? "Minting now" : countdown}
        </div>
        <button className="w-full h-7 rounded-lg text-xs font-bold transition-colors"
          style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer" }}>
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
      <div className="h-5 w-32 rounded animate-pulse mb-6" style={{ background: "#161d28" }} />
      <div className="flex gap-4">
        {[1,2,3,4].map((i) => <div key={i} className="flex-shrink-0 w-48 h-64 rounded-2xl animate-pulse" style={{ background: "#121821" }} />)}
      </div>
    </section>
  );

  if (!projects.length) return null;

  return (
    <section className="px-6 py-12 fade-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>Live Mints</h2>
        <button onClick={() => navigate("/launchpad")} className="text-xs font-bold uppercase tracking-widest"
          style={{ color: "#22d3ee", background: "none", border: "none", cursor: "pointer" }}>
          View all Launchpads →
        </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollbarWidth: "none" }}>
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

  return (
    <section className="px-6 pb-24 fade-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>Market Rankings</h2>
      </div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "#0b121d", border: "1px solid rgba(255,255,255,0.05)" }}>
        <table className="w-full border-collapse">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
              <th className="text-left px-6 py-4 text-[11px] font-black uppercase tracking-widest text-gray-500" style={{ width: 60 }}>#</th>
              <th className="text-left px-6 py-4 text-[11px] font-black uppercase tracking-widest text-gray-500">Collection</th>
              {cols.map((c) => (
                <th key={c.key}
                  className="text-right px-6 py-4 text-[11px] font-black uppercase tracking-widest cursor-pointer select-none"
                  style={{ color: sortKey === c.key ? "#22d3ee" : "#6b7280" }}
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
                    <td key={j} className="px-6 py-4">
                      <div className="h-4 rounded animate-pulse" style={{ background: "#161d28", width: j === 1 ? "160px" : "80px" }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              sorted.map((c, i) => (
                <tr key={c.id}
                  className="cursor-pointer transition-colors hover:bg-white/[0.02]"
                  style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}
                  onClick={() => navigate(`/collection/${c.slug}`)}>
                  <td className="px-6 py-4 text-gray-500 font-mono text-xs">{i + 1}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br ${GRAD_KEYS[i % 5]}`}>
                        {c.logo_url
                          ? <img src={c.logo_url} alt={c.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center font-bold text-sm" style={{ color: "#22d3ee" }}>{c.name?.slice(0, 2).toUpperCase()}</div>
                        }
                      </div>
                      <div>
                        <div className="text-sm font-bold flex items-center gap-1.5" style={{ color: "#e6edf3" }}>
                          {c.name}{c.verified && <span className="text-[#22d3ee]">✓</span>}
                        </div>
                        <div className="text-[11px] font-medium text-gray-500 uppercase tracking-tighter">{c.total_supply?.toLocaleString() || "—"} Assets</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-sm" style={{ color: "#e6edf3" }}>
                    {c.floor_price ? `${c.floor_price.toFixed(2)} USD` : "—"}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-sm text-gray-400">
                    {c.volume_24h ? `${c.volume_24h.toFixed(2)} USD` : "—"}
                  </td>
                  <td className="px-6 py-4 text-right font-bold text-sm" style={{ color: "#e6edf3" }}>
                    {c.volume_total ? `${c.volume_total.toLocaleString()} USD` : "—"}
                  </td>
                  <td className="px-6 py-4 text-right font-medium text-sm text-gray-400">
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

// ─── NEW: Individual NFT Listing Card ─────────────────────────────────────────
function ListingCard({ nft, onBuy, isConnected, connectWallet }) {
  return (
    <div className="bg-[#0b121d] rounded-2xl p-4 border border-white/5 hover:border-cyan-400/30 transition-colors">
      {/* Dynamic Image from Supabase join */}
      <img 
        src={nft.image || "/placeholder-cat.png"} 
        alt={nft.name || `NFT #${nft.tokenId}`} 
        className="w-full aspect-square object-cover rounded-xl mb-3" 
      />
      
      {/* Dynamic Name */}
      <h3 className="text-white font-bold truncate mb-1">
        {nft.name || `Unidentified NFT #${nft.tokenId}`}
      </h3>
      
      {/* Collection hint (if available in metadata) */}
      {nft.metadata?.collection && (
        <p className="text-xs text-gray-500 truncate mb-2">
          {nft.metadata.collection}
        </p>
      )}
      
      <div className="flex justify-between items-center mt-3">
        {/* Dynamic Price - uses displayPrice for human readable */}
        <span className="text-cyan-400 font-mono font-bold">
          {nft.displayPrice} USD
        </span>
        
        <button 
          onClick={() => isConnected ? onBuy(nft) : connectWallet()}
          disabled={!isConnected}
          className="bg-cyan-500 hover:bg-cyan-400 text-black px-4 py-1.5 rounded-lg text-sm font-black transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isConnected ? 'BUY' : 'CONNECT'}
        </button>
      </div>
    </div>
  );
}

// ─── NEW: Recent Listings Section ─────────────────────────────────────────────
function RecentListings({ listings, loading, buyNFT, isConnected, connectWallet }) {
  if (loading) {
    return (
      <section className="px-6 py-12">
        <h2 className="text-xl font-bold text-white mb-6">Recent Listings</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="bg-[#0b121d] rounded-2xl h-72 animate-pulse border border-white/5" />
          ))}
        </div>
      </section>
    );
  }

  if (!listings.length) {
    return (
      <section className="px-6 py-12">
        <h2 className="text-xl font-bold text-white mb-6">Recent Listings</h2>
        <div className="text-center py-12 text-gray-500">
          No active listings found. Be the first to list an NFT!
        </div>
      </section>
    );
  }

  return (
    <section className="px-6 py-12 fade-up">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold tracking-tight" style={{ color: "#e6edf3" }}>
          Recent Listings
        </h2>
        <span className="text-sm text-gray-500">
          {listings.length} active
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {listings.map((nft) => (
          <ListingCard 
            key={nft.listingId} 
            nft={nft} 
            onBuy={buyNFT}
            isConnected={isConnected}
            connectWallet={connectWallet}
          />
        ))}
      </div>
    </section>
  );
}

// ─── MAIN MARKET PAGE ─────────────────────────────────────────────────────────
export default function Market() {
  const navigate = useNavigate();
  const { collections, isLoading: collectionsLoading } = useCollections("volume_total");
  const { 
    listings, 
    loading: listingsLoading, 
    buyNFT, 
    isConnected, 
    connectWallet 
  } = useMarketplace();

  return (
    <div className="min-h-screen bg-[#03080f]">
      {/* 1. HERO CAROUSEL */}
      {collectionsLoading ? (
        <div className="w-full h-[65vh] bg-[#0b121d] animate-pulse flex items-center justify-center">
          <div className="text-cyan-400 font-black text-2xl animate-bounce">NYAN</div>
        </div>
      ) : (
        <HeroCarousel collections={collections} navigate={navigate} />
      )}

      {/* 2. LIVE MINTS */}
      <LiveMints navigate={navigate} />

      {/* 3. RECENT LISTINGS - NEW: Uses useMarketplace */}
      <RecentListings 
        listings={listings}
        loading={listingsLoading}
        buyNFT={buyNFT}
        isConnected={isConnected}
        connectWallet={connectWallet}
      />

      {/* 4. COLLECTIONS TABLE */}
      <CollectionsTable navigate={navigate} />
    </div>
  );
}
