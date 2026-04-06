import { useEffect } from "react";
import { Rocket, Clock, ShieldCheck } from "lucide-react";
import { useFeaturedProjects } from "@/hooks/useSupabase"; // Use the hook we built
import { useCountdown } from "@/hooks/useCountdown.js";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import NFTImage from "@/components/NFTImage.jsx";
import { useAccount } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

function DropCard({ drop }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  
  // Use the actual mint_start_time from your SQL schema
  const countdown = useCountdown(drop.mint_start_time);
  
  // Progress calculation based on your schema fields
  const minted = drop.minted_count || 0; // Ensure your indexer updates this
  const supply = drop.max_supply || 1;
  const pct = Math.round((minted / supply) * 100);
  
  const isLive = drop.status === "live";
  const isSoldOut = minted >= supply;

  return (
    <div
      className="rounded-2xl overflow-hidden card-hover flex flex-col h-full"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div className="aspect-video relative overflow-hidden bg-[#161d28]">
        <NFTImage 
          src={drop.banner_url || drop.logo_url} 
          alt={drop.name} 
          style={{ width: "100%", height: "100%", objectCover: "cover" }} 
        />
        <div className="absolute top-3 left-3 flex gap-2">
          <span
            className="text-[10px] font-bold uppercase px-2 py-1 rounded-lg flex items-center gap-1"
            style={{ 
              background: isLive ? "rgba(34,211,238,0.15)" : "rgba(255,255,255,0.05)", 
              color: isLive ? "#22d3ee" : "#9da7b3" 
            }}
          >
            {isLive ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-[#22d3ee] animate-pulse" /> Live</>
            ) : "Upcoming"}
          </span>
          {drop.status === "featured" && (
            <span className="bg-amber-500/10 text-amber-500 text-[10px] font-bold px-2 py-1 rounded-lg border border-amber-500/20">
              Featured
            </span>
          )}
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow gap-4">
        <div>
          <div className="flex items-center gap-1.5">
             <h3 className="text-base font-bold truncate" style={{ color: "#e6edf3" }}>{drop.name}</h3>
             <ShieldCheck size={14} className="text-[#22d3ee]" />
          </div>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: "#9da7b3" }}>
            {drop.description || "No description provided."}
          </p>
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-mono" style={{ color: "#9da7b3" }}>
            <span>{pct}% Minted</span>
            <span>{minted.toLocaleString()} / {supply.toLocaleString()}</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{ width: `${pct}%`, background: isSoldOut ? "#22c55e" : "#22d3ee" }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between mt-auto pt-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider" style={{ color: "#9da7b3" }}>Price</p>
            <p className="font-mono text-sm font-bold" style={{ color: "#e6edf3" }}>
              {drop.mint_price > 0 ? `${drop.mint_price} USD` : "FREE"}
            </p>
          </div>
          {!isLive && !isSoldOut && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider flex items-center gap-1 justify-end" style={{ color: "#9da7b3" }}>
                <Clock size={10} /> Starts in
              </p>
              <p className="font-mono text-sm font-bold" style={{ color: "#22d3ee" }}>{countdown}</p>
            </div>
          )}
        </div>

        <button
          onClick={() => !isConnected ? openConnectModal() : console.log("Trigger Mint Logic")}
          disabled={isSoldOut}
          className="w-full h-11 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{
            background: isSoldOut ? "#161d28" : "#22d3ee",
            color: isSoldOut ? "#9da7b3" : "#0b0f14",
            border: "none",
            cursor: isSoldOut ? "not-allowed" : "pointer",
            fontFamily: "Syne, sans-serif",
          }}
        >
          {isSoldOut ? "Sold Out" : isConnected ? "Mint Now" : "Connect to Mint"}
        </button>
      </div>
    </div>
  );
}

export default function LaunchpadPage() {
  const { projects, isLoading, error } = useFeaturedProjects();

  return (
    <div className="px-6 py-12 max-w-7xl mx-auto fade-up">
      <div className="mb-12">
        <div className="flex items-center gap-2 mb-3">
          <Rocket size={14} className="text-[#22d3ee]" />
          <span className="text-xs font-bold uppercase tracking-[0.2em]" style={{ color: "#22d3ee" }}>Primary Market</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight" style={{ color: "#e6edf3" }}>Launchpad</h1>
        <p className="mt-3 text-base max-w-2xl" style={{ color: "#9da7b3" }}>
          Discover the next generation of digital assets. Exclusive NFT drops on Tempo Chain.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : error ? (
        <div className="text-center py-20 bg-[#121821] rounded-3xl border border-white/5">
          <p className="text-[#ef4444]">Failed to load drops: {error}</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 bg-[#121821] rounded-3xl border border-white/5">
          <p style={{ color: "#9da7b3" }}>No active drops at the moment. Check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {projects.map((project) => (
            <DropCard key={project.id} drop={project} />
          ))}
        </div>
      )}
    </div>
  );
}
