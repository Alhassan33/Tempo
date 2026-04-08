import { useNavigate } from "react-router-dom";
import { useCollections } from "../hooks/useSupabase";

function Stat({ label, value }) {
  return (
    <div className="px-6 py-4">
      <p className="text-[10px] uppercase font-bold text-gray-500 tracking-widest mb-1">{label}</p>
      <p className="text-xl font-black text-[#e6edf3]">{value} <span className="text-[#22d3ee]">USD</span></p>
    </div>
  );
}

export default function Market() {
  const navigate = useNavigate();
  const { collections, isLoading } = useCollections("volume_total");
  const temponyan = collections?.find(c => c.slug === 'temponyan') || collections?.[0];

  if (isLoading) return <div className="min-h-screen bg-[#03080f] animate-pulse" />;

  return (
    <div className="min-h-screen bg-[#03080f] pb-24">
      {/* --- HERO GRID --- */}
      {temponyan && (
        <section className="relative px-6 py-12 md:px-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center max-w-7xl mx-auto">
            <div className="order-2 md:order-1">
              <h1 className="text-6xl md:text-8xl font-black mb-6 tracking-tighter uppercase italic text-white leading-tight">
                {temponyan.name}
                <span className="text-[#22d3ee] ml-4 not-italic inline-flex border-2 border-[#22d3ee] rounded-full w-12 h-12 items-center justify-center text-2xl">✓</span>
              </h1>
              
              <div className="bg-white/5 border border-white/10 rounded-2xl flex flex-wrap md:inline-flex mb-8">
                <Stat label="Floor Price" value={temponyan.floor_price?.toFixed(2) || "0.00"} />
                <div className="hidden md:block w-px bg-white/10 my-4" />
                <Stat label="Total Volume" value={temponyan.volume_total?.toLocaleString() || "0"} />
              </div>

              <button onClick={() => navigate(`/collection/${temponyan.slug}`)} className="w-full md:w-auto px-12 py-5 bg-[#e6edf3] text-[#03080f] font-black rounded-2xl uppercase italic text-xl hover:scale-105 transition-transform">
                Enter Collection
              </button>
            </div>

            <div className="order-1 md:order-2 relative rounded-3xl overflow-hidden border border-white/10 aspect-square shadow-2xl shadow-cyan-500/10">
              <img src={temponyan.banner_url || temponyan.logo_url} className="w-full h-full object-cover" alt="Hero" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#03080f] via-transparent to-transparent opacity-60" />
            </div>
          </div>
        </section>
      )}

      {/* --- MARKET RANKINGS --- */}
      <section className="px-6 max-w-7xl mx-auto mt-12">
        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-white mb-8">Market Rankings</h2>
        <div className="space-y-3">
          {collections?.map((c, i) => (
            <div key={c.id} onClick={() => navigate(`/collection/${c.slug}`)} className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-[#22d3ee]/50 transition-all cursor-pointer">
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-gray-600">{i + 1}</span>
                <img src={c.logo_url} className="w-12 h-12 rounded-xl object-cover" alt={c.name} />
                <h3 className="font-bold text-[#e6edf3]">{c.name} {c.verified && <span className="text-[#22d3ee]">✓</span>}</h3>
              </div>
              <div className="text-right">
                <p className="text-sm font-black text-[#e6edf3]">{c.floor_price?.toFixed(2)} USD</p>
                <p className="text-[10px] text-gray-500 uppercase font-bold">Floor</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
