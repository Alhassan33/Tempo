import { useState } from "react";
import { X } from "lucide-react";
import { useWallet } from "@/hooks/useWallet.js";

export default function ListModal({ nft, onClose }) {
  const { isConnected, connect } = useWallet();
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("7");
  const [status, setStatus] = useState("idle"); // idle | pending | success | error

  async function handleList() {
    if (!isConnected) { connect(); return; }
    if (!price || isNaN(price) || Number(price) <= 0) return;
    setStatus("pending");
    // TODO: call marketplaceABI.listItem via wagmi writeContract
    setTimeout(() => setStatus("success"), 2000);
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-6 flex flex-col gap-5"
        style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.12)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold" style={{ color: "#e6edf3" }}>List for Sale</h2>
          <button onClick={onClose} style={{ color: "#9da7b3", background: "none", border: "none", cursor: "pointer" }}>
            <X size={20} />
          </button>
        </div>

        {/* NFT info */}
        {nft && (
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "#0b0f14" }}>
            <div className="w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden" style={{ background: "#161d28" }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{nft.name ?? `#${nft.tokenId}`}</p>
              <p className="text-xs" style={{ color: "#9da7b3" }}>{nft.collection}</p>
            </div>
          </div>
        )}

        {/* Price */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9da7b3" }}>Price (ETH)</label>
          <div className="relative">
            <input
              type="number"
              placeholder="0.0000"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full h-11 rounded-lg px-3 pr-14 text-base outline-none"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", fontFamily: "Space Mono, monospace" }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "#9da7b3" }}>ETH</span>
          </div>
        </div>

        {/* Duration */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9da7b3" }}>Duration</label>
          <select
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            className="w-full h-11 rounded-lg px-3 outline-none"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", fontFamily: "Syne, sans-serif" }}
          >
            <option value="1">1 day</option>
            <option value="7">7 days</option>
            <option value="14">14 days</option>
            <option value="30">30 days</option>
          </select>
        </div>

        {/* Fee row */}
        <div className="flex justify-between text-sm">
          <span style={{ color: "#9da7b3" }}>Marketplace fee</span>
          <span style={{ color: "#e6edf3" }}>2.5%</span>
        </div>

        {/* CTA */}
        {status === "success" ? (
          <div className="h-11 rounded-xl flex items-center justify-center font-bold text-sm" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
            Listed successfully!
          </div>
        ) : (
          <button
            onClick={handleList}
            disabled={status === "pending"}
            className="h-11 rounded-xl font-bold text-sm transition-opacity"
            style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", opacity: status === "pending" ? 0.7 : 1, fontFamily: "Syne, sans-serif" }}
          >
            {status === "pending" ? "Confirming…" : isConnected ? "List NFT" : "Connect Wallet"}
          </button>
        )}
      </div>
    </div>
  );
}
