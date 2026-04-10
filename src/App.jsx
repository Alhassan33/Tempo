import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { CheckCircle2, ExternalLink, Twitter, Globe, TrendingDown, TrendingUp, LayoutGrid, List } from "lucide-react";
import Listings from "@/components/Listings.jsx";

export default function CollectionPage() {
  const { id } = useParams();
  const [tab, setTab] = useState("Items");

  // Keep your existing professional stats from the screenshots
  const stats = [
    { label: "FLOOR PRICE", value: "25.00 USD" },
    { label: "LISTED", value: "7", sub: "0.4% listed" },
    { label: "OWNERS", value: "469", sub: "23.4%" }, // Updated from your latest screenshot
    { label: "SUPPLY", value: "2,000" },
  ];

  return (
    <div className="min-h-screen text-white p-4 md:p-8" style={{ background: "#0b0f14" }}>
      {/* Collection Branding Section */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2 tracking-tight">TEMPONYAN</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium" style={{ color: "#22d3ee" }}>By Tempo Creator</span>
          <ExternalLink size={14} className="text-gray-500 cursor-pointer" />
        </div>
      </div>

      {/* Stats Dashboard - Glassmorphism style preserved */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
        {stats.map((s, i) => (
          <div key={i} className="p-5 rounded-2xl border transition-all" 
               style={{ background: "#121821", borderColor: "rgba(34,211,238,0.12)" }}>
            <div className="text-[10px] font-bold text-gray-400 mb-1 uppercase tracking-widest">{s.label}</div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            {s.sub && <div className="text-[10px] text-gray-500 mt-1 font-medium">{s.sub}</div>}
          </div>
        ))}
      </div>

      {/* Professional Tab Navigation with Glow Effect */}
      <div className="flex gap-8 border-b mb-8" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {["Items", "Listings", "Activity", "Bids", "Analytics"].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-4 text-[11px] font-bold uppercase tracking-[0.15em] transition-all relative ${
              tab === t ? "text-cyan-400" : "text-gray-500 hover:text-gray-300"
            }`}
          >
            {t}
            {tab === t && (
              <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-cyan-400 shadow-[0_0_12px_#22d3ee]" />
            )}
          </button>
        ))}
      </div>

      {/* Tab Content Integration */}
      <div className="mt-8">
        {tab === "Items" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-5">
            {/* Map your existing NFT items here */}
          </div>
        )}

        {tab === "Listings" && (
          <Listings 
            nftContract={id} 
            collectionName="TEMPONYAN" 
            slug={id} 
          />
        )}

        {/* Placeholder for other tabs to keep layout from breaking */}
        {["Activity", "Bids", "Analytics"].includes(tab) && (
          <div className="py-32 text-center rounded-3xl border border-dashed border-white/5 bg-white/[0.01]">
             <div className="text-gray-600 font-medium tracking-wide">Module Loading...</div>
          </div>
        )}
      </div>
    </div>
  );
}
