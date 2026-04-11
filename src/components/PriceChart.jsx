// components/PriceChart.jsx
// Reads from the marketplace_analytics Supabase view (already ÷1e6)
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import {
  ResponsiveContainer, AreaChart, Area,
  XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar
} from "recharts";

const ACCENT = "#22d3ee";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs shadow-xl"
      style={{ background: "#0d1219", border: "1px solid rgba(34,211,238,0.2)" }}>
      <p className="mb-1 font-bold" style={{ color: "#9da7b3" }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-mono font-bold" style={{ color: p.color || ACCENT }}>
          {p.name}: {p.name === "Sales" ? p.value : `$${Number(p.value).toFixed(2)}`}
        </p>
      ))}
    </div>
  );
}

function useAnalytics(nftContract) {
  const [data, setData]       = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nftContract) return;
    setLoading(true);
    supabase
      .from("marketplace_analytics")
      .select("day, daily_volume, floor_price, sales_count")
      .order("day", { ascending: true })
      .then(({ data: rows, error }) => {
        if (error) { console.error("[PriceChart]", error.message); setData([]); }
        else {
          setData((rows || []).map(r => ({
            date:   new Date(r.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            volume: Number(r.daily_volume || 0),
            floor:  Number(r.floor_price  || 0),
            sales:  Number(r.sales_count  || 0),
          })));
        }
        setLoading(false);
      });
  }, [nftContract]);

  return { data, loading };
}

export default function PriceChart({ nftContract }) {
  const { data, loading } = useAnalytics(nftContract);
  const [tab, setTab]     = useState("volume");

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: ACCENT, borderTopColor: "transparent" }} />
    </div>
  );

  if (!data.length) return (
    <div className="flex flex-col items-center justify-center h-48 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.02)", border: "1px dashed rgba(255,255,255,0.06)" }}>
      <div className="text-3xl mb-2">📊</div>
      <p className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>No trading activity yet</p>
      <p className="text-xs" style={{ color: "#9da7b3" }}>Charts appear once NFTs are bought and sold.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl w-fit"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
        {[{ id: "volume", label: "Volume" }, { id: "floor", label: "Floor" }, { id: "sales", label: "Sales" }]
          .map(({ id, label }) => (
            <button key={id} onClick={() => setTab(id)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: tab === id ? "rgba(34,211,238,0.15)" : "transparent",
                color:      tab === id ? ACCENT : "#9da7b3",
                border:     tab === id ? "1px solid rgba(34,211,238,0.3)" : "1px solid transparent",
                cursor: "pointer",
              }}>{label}</button>
          ))}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Volume", value: `$${data.reduce((s, d) => s + d.volume, 0).toFixed(2)}` },
          { label: "Total Sales",  value: data.reduce((s, d) => s + d.sales, 0) },
          { label: "Latest Floor", value: `$${(data[data.length - 1]?.floor || 0).toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl p-3"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>{label}</div>
            <div className="font-mono font-bold text-sm" style={{ color: "#e6edf3" }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Volume */}
      {tab === "volume" && (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={ACCENT} stopOpacity={0.25} />
                <stop offset="95%" stopColor={ACCENT} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#9da7b3", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#9da7b3", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="volume" name="Volume" stroke={ACCENT} strokeWidth={2}
              fill="url(#volGrad)" dot={false} activeDot={{ r: 4, fill: ACCENT }} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Floor */}
      {tab === "floor" && (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="floorGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#9da7b3", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#9da7b3", fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="floor" name="Floor Price" stroke="#a78bfa" strokeWidth={2}
              fill="url(#floorGrad)" dot={false} activeDot={{ r: 4, fill: "#a78bfa" }} />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {/* Sales */}
      {tab === "sales" && (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="date" tick={{ fill: "#9da7b3", fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "#9da7b3", fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="sales" name="Sales" fill={ACCENT} radius={[4, 4, 0, 0]} fillOpacity={0.8} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
