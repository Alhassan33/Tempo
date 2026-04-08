import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCollections, useFeaturedProjects } from "../hooks/useSupabase";

// Helper for countdowns
function fmtTime(secs) {
  const h = String(Math.floor(secs / 3600)).padStart(2, "0");
  const m = String(Math.floor((secs % 3600) / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function Stat({ label, value }) {
  return (
    <div className="px-6 py-4">
      <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1">{label}</p>
      <p className="text-xl font-black text-[#e6edf3]">
        {value} <span className="text-[#22d3ee]">USD</span>
      </p>
    </div>
  );
}

export default function Market() {
  const navigate = useNavigate();
  const { collections, isLoading } = useCollections("volume_total");
  
  // Specifically grab Temponyan from your collection list
  const temponyan = collections?.find(c => c.slug === 'temponyan') || collections?.[0];

  return (
    <div className="min-h-screen bg-[#03080f]">
      {/* --- LOGO & NAV SECTION --- */}
      <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#03080f]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <img 
            src="/attached_assets/1001940886.jpg" 
            className="w-10 h-10 rounded-xl border border-white/10 shadow-cyan-500/20 shadow-lg" 
            alt="Nyan Logo" 
          />
          <span className="font-black text-lg tracking-tighter uppercase text-white">
            TEMPO<span className="text-[#22d3ee]">NYAN</span>
          </span>
        </div>
        <button className="bg-[#22d3ee] text-[#03080f] px-4 py-2 rounded-full font-bold text-xs uppercase tracking-tight">
          Connect Wallet
        </button>
      </div>

      {/* --- SINGLE COLLECTION HERO (GRID VIEW) --- */}
      {isLoading ? (
        <div className="w-full h-[60vh] bg-[#0b121d] animate-pulse" />
      ) : temponyan && (
        <section className="relative px-6 py-8 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            
            {/* Left: Branding & Stats */}
            <div className="order-2 md:order-1 fade-up">
              <div className="flex items-center gap-2 mb-4">
                <span className="bg-[#22d3ee]/10 text-[#22d3ee] text-[10px] font-black px-3 py-1 rounded-full border border-[#22d3ee]/20">
                  FEATURED COLLECTION
                </span>
              </div>
              <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter uppercase italic text-white leading-none">
                {temponyan.name}
                <span className="text-[#22d3ee] ml-2 not-italic inline-block border-2 border-[#22d3ee] rounded-full w-10 h-10 text-center text-2xl leading-9">✓</span>
              </h1>
              
              <div className="glass-morph rounded-2xl flex flex-wrap md:inline-flex mb-8">
                <Stat label="Floor Price" value={temponyan.floor_price?.toFixed(2) || "—"} />
                <div className="hidden md:block w-px bg-white/10 my-4" />
                <Stat label="Total Volume" value={temponyan.volume_total?.toLocaleString() || "—"} />
              </div>

              <div>
                <button 
                  onClick={() => navigate(`/collection/${temponyan.slug}`)}
                  className="w-full md:w-auto px-12 py-5 bg-[#e6edf3] text-[#03080f] font-black rounded-2xl hover:scale-105 transition-transform uppercase tracking-tighter italic text-xl"
                >
                  View Collection
                </button>
              </div>
            </div>

            {/* Right: The Grid/Image Focus */}
            <div className="order-1 md:order-2 relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-[#22d3ee] to-purple-600 rounded-3xl blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
              <div className="relative rounded-3xl overflow-hidden border border-white/10 shadow-2xl aspect-square md:aspect-auto md:h-[500px]">
                <img 
                  src={temponyan.banner_url || temponyan.logo_url} 
                  className="w-full h-full object-cover transform transition-transform duration-700 group-hover:scale-110"
                  alt="Temponyan Preview" 
                />
                {/* Visual "Grid" Overlay for tech-aesthetic */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-20 pointer-events-none" />
              </div>
            </div>

          </div>
        </section>
      )}

      {/* --- MARKET RANKINGS (SIMPLIFIED LIST) --- */}
      <section className="px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white">Market Rankings</h2>
          <div className="h-px flex-1 bg-white/5 ml-6" />
        </div>

        <div className="space-y-3">
          {collections?.map((c, i) => (
            <div 
              key={c.id}
              onClick={() => navigate(`/collection/${c.slug}`)}
              className="flex items-center justify-between p-4 rounded-2xl bg-[#0b121d] border border-white/5 hover:border-[#22d3ee]/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-gray-600 w-4">{i + 1}</span>
                <img src={c.logo_url} className="w-12 h-12 rounded-xl object-cover" alt={c.name} />
                <div>
                  <h3 className="font-bold text-[#e6edf3] group-hover:text-[#22d3ee] transition-colors">{c.name}</h3>
                  <p className="text-[10px] text-gray-500 uppercase font-bold">{c.total_supply} Assets</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-[#e6edf3]">{c.floor_price?.toFixed(2)} <span className="text-[#22d3ee]">USD</span></p>
                <p className="text-[10px] text-gray-500 uppercase font-bold">Floor</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
