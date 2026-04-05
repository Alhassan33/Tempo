import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl px-3 py-2 text-xs" style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.18)" }}>
      <p className="mb-1" style={{ color: "#9da7b3" }}>{label}</p>
      <p className="font-mono font-bold" style={{ color: "#22d3ee" }}>
        {Number(payload[0].value).toFixed(4)} ETH
      </p>
    </div>
  );
}

export default function PriceChart({ data = [] }) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center h-40 rounded-xl" style={{ background: "#0b0f14" }}>
        <p className="text-sm" style={{ color: "#9da7b3" }}>No price history</p>
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -20 }}>
        <defs>
          <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.22} />
            <stop offset="95%" stopColor="#22d3ee" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#9da7b3", fontSize: 10 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "#9da7b3", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="price"
          stroke="#22d3ee"
          strokeWidth={2}
          fill="url(#priceGrad)"
          dot={false}
          activeDot={{ r: 4, fill: "#22d3ee" }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
