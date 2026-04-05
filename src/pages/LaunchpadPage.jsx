import { useEffect } from "react";
import { Rocket, Clock } from "lucide-react";
import { useLaunchpad } from "@/context/LaunchpadContext.jsx";
import { useCountdown } from "@/hooks/useCountdown.js";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import NFTImage from "@/components/NFTImage.jsx";
import { useWallet } from "@/hooks/useWallet.js";

const DEMO_DROPS = [
  { id: "1", name: "TempoFelines: Genesis", supply: 5000, minted: 2340, price: "0.05", endsAt: Date.now() + 3 * 3600000, gradient: "linear-gradient(135deg,#0d2137,#071424)", phase: "Whitelist" },
  { id: "2", name: "ChronoBeasts S2",       supply: 3333, minted: 3333, price: "0.08", endsAt: Date.now() - 1, gradient: "linear-gradient(135deg,#0d1f2b,#071624)", phase: "Ended" },
  { id: "3", name: "NyanPunks Origins",     supply: 10000, minted: 450, price: "0.03", endsAt: Date.now() + 24 * 3600000, gradient: "linear-gradient(135deg,#1a0d2b,#0b0618)", phase: "Public" },
];

function DropCard({ drop }) {
  const { isConnected, connect } = useWallet();
  const countdown = useCountdown(drop.endsAt);
  const pct = Math.round((drop.minted / drop.supply) * 100);
  const ended = Date.now() > drop.endsAt;
  const soldOut = drop.minted >= drop.supply;

  return (
    <div
      className="rounded-2xl overflow-hidden card-hover"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="aspect-video relative overflow-hidden" style={{ background: drop.gradient }}>
        <NFTImage src={drop.image} alt={drop.name} gradient={drop.gradient} style={{ width: "100%", height: "100%" }} />
        <span
          className="absolute top-3 left-3 text-[10px] font-bold uppercase px-2 py-1 rounded-lg"
          style={{ background: ended ? "rgba(239,68,68,0.15)" : "rgba(34,211,238,0.15)", color: ended ? "#ef4444" : "#22d3ee" }}
        >
          {ended ? "Ended" : drop.phase}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div>
          <h3 className="text-base font-bold" style={{ color: "#e6edf3" }}>{drop.name}</h3>
          <p className="text-xs mt-0.5 font-mono" style={{ color: "#9da7b3" }}>
            {drop.minted.toLocaleString()} / {drop.supply.toLocaleString()} minted
          </p>
        </div>

        {/* Progress bar */}
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: soldOut ? "#22c55e" : "#22d3ee" }}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "#9da7b3" }}>Price</p>
            <p className="font-mono text-sm font-bold" style={{ color: "#e6edf3" }}>{drop.price} ETH</p>
          </div>
          {!ended && !soldOut && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider flex items-center gap-1 justify-end" style={{ color: "#9da7b3" }}>
                <Clock size={10} /> Ends in
              </p>
              <p className="font-mono text-sm font-bold" style={{ color: "#22d3ee" }}>{countdown}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => !isConnected && connect()}
          disabled={ended || soldOut}
          className="w-full h-10 rounded-xl text-sm font-bold transition-opacity"
          style={{
            background: soldOut ? "rgba(255,255,255,0.06)" : "#22d3ee",
            color: soldOut ? "#9da7b3" : "#0b0f14",
            border: "none",
            cursor: ended || soldOut ? "not-allowed" : "pointer",
            opacity: ended && !soldOut ? 0.5 : 1,
            fontFamily: "Syne, sans-serif",
          }}
        >
          {soldOut ? "Sold Out" : ended ? "Ended" : isConnected ? "Mint Now" : "Connect to Mint"}
        </button>
      </div>
    </div>
  );
}

export default function LaunchpadPage() {
  const { drops, loading, fetchDrops } = useLaunchpad();

  useEffect(() => { fetchDrops(); }, [fetchDrops]);

  const data = drops.length ? drops : DEMO_DROPS;

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto fade-up">
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-3">
          <Rocket size={14} style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Launchpad</span>
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold" style={{ color: "#e6edf3" }}>NFT Drops</h1>
        <p className="mt-2 text-sm" style={{ color: "#9da7b3" }}>Upcoming and live mints on Tempo Chain.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 3 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.map((drop) => <DropCard key={drop.id} drop={drop} />)}
        </div>
      )}
    </div>
  );
}
