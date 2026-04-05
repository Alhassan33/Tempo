import { Clock } from "lucide-react";
import { useAccount } from "wagmi";
import ActivityFeed from "@/components/ActivityFeed.jsx";
import { useWallet } from "@/hooks/useWallet.js";

export default function History() {
  const { address } = useAccount();
  const { isConnected, connect } = useWallet();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 fade-up">
        <Clock size={40} style={{ color: "#9da7b3" }} />
        <p className="text-lg font-semibold" style={{ color: "#e6edf3" }}>Connect your wallet</p>
        <p className="text-sm" style={{ color: "#9da7b3" }}>to view your transaction history.</p>
        <button
          onClick={connect}
          className="h-10 px-6 rounded-xl text-sm font-bold"
          style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto fade-up">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>History</span>
        </div>
        <h1 className="text-3xl font-extrabold" style={{ color: "#e6edf3" }}>My Activity</h1>
        <p className="mt-1 text-sm" style={{ color: "#9da7b3" }}>All your sales, purchases, bids, and transfers.</p>
      </div>

      <div className="rounded-2xl p-6" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
        <ActivityFeed address={address} limit={50} />
      </div>
    </div>
  );
}
