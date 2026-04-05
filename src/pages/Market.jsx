import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { useCollections } from "@/hooks/useCollections.js";
import CollectionCard from "@/components/CollectionCard.jsx";
import { CollectionRowSkeleton } from "@/components/Skeleton.jsx";

const TABS = ["All", "Art", "Gaming", "PFP", "Music"];

const DEMO = [
  { id: "1", name: "TempoFelines", verified: true, image: null, gradient: "linear-gradient(135deg,#0d2137,#071424)", itemCount: 5000, floor: "0.2800", topOffer: "0.2600", change24h: 8.4, volume: 142.5 },
  { id: "2", name: "NyanPunks",    verified: true, image: null, gradient: "linear-gradient(135deg,#1a0d2b,#0b0618)", itemCount: 10000, floor: "0.1240", topOffer: "0.1150", change24h: -3.1, volume: 98.2 },
  { id: "3", name: "ChronoBeasts", verified: false, image: null, gradient: "linear-gradient(135deg,#0d1f2b,#071624)", itemCount: 3333, floor: "0.0880", topOffer: "0.0820", change24h: 21.7, volume: 67.8 },
  { id: "4", name: "TempoAngels",  verified: true, image: null, gradient: "linear-gradient(135deg,#1f0d1e,#0d061b)", itemCount: 8888, floor: "0.0430", topOffer: "0.0400", change24h: -1.5, volume: 34.1 },
  { id: "5", name: "CipherCats",   verified: false, image: null, gradient: "linear-gradient(135deg,#0d1d10,#06110a)", itemCount: 1111, floor: "0.3750", topOffer: "0.3600", change24h: 5.6, volume: 210.3 },
];

export default function Market() {
  const [tab, setTab] = useState("All");
  const { collections, loading } = useCollections();
  const data = collections.length ? collections : DEMO;

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto fade-up">
      {/* Hero */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp size={14} style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Top Collections</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold" style={{ color: "#e6edf3" }}>
          Discover NFTs
        </h1>
        <p className="mt-2 text-sm" style={{ color: "#9da7b3" }}>
          Browse, collect, and trade on the Tempo Chain marketplace.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="h-8 px-4 rounded-lg text-sm font-semibold transition-colors"
            style={{
              background: tab === t ? "rgba(34,211,238,0.12)" : "#161d28",
              color: tab === t ? "#22d3ee" : "#9da7b3",
              border: "none",
              cursor: "pointer",
              fontFamily: "Syne, sans-serif",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
        <table className="w-full">
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {["#", "Collection", "Floor", "Top Offer", "24h %", "Volume"].map((h) => (
                <th
                  key={h}
                  className={`py-3.5 px-4 text-left text-xs font-semibold uppercase tracking-wider ${h === "Top Offer" ? "hidden md:table-cell" : ""} ${h === "Volume" ? "hidden lg:table-cell" : ""}`}
                  style={{ color: "#9da7b3" }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 5 }).map((_, i) => <CollectionRowSkeleton key={i} />)
              : data.map((col, i) => <CollectionCard key={col.id ?? i} collection={col} rank={i + 1} />)
            }
          </tbody>
        </table>
      </div>
    </div>
  );
}
