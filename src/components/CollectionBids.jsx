import { useState } from "react";
import { useWallet } from "@/hooks/useWallet.js";

export default function CollectionBids({ collectionId }) {
  const { isConnected, connect } = useWallet();
  const [bidAmount, setBidAmount] = useState("");
  const [status, setStatus] = useState(null);

  const sampleBids = [
    { rank: 1, price: "0.2200", bidder: "0xabc1…ef23", qty: 3 },
    { rank: 2, price: "0.2180", bidder: "0xdef4…cd56", qty: 1 },
    { rank: 3, price: "0.2150", bidder: "0x1234…ab78", qty: 5 },
  ];

  async function placeBid() {
    if (!isConnected) { connect(); return; }
    if (!bidAmount || isNaN(bidAmount)) return;
    setStatus("pending");
    // TODO: call marketplaceABI.placeBid via wagmi writeContract
    setTimeout(() => setStatus("success"), 1500);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Bid form */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type="number"
            placeholder="0.0000"
            value={bidAmount}
            onChange={(e) => setBidAmount(e.target.value)}
            className="w-full h-10 rounded-lg px-3 pr-14 text-sm outline-none"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", fontFamily: "Space Mono, monospace" }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: "#9da7b3" }}>ETH</span>
        </div>
        <button
          onClick={placeBid}
          className="h-10 px-5 rounded-lg text-sm font-bold transition-colors"
          style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
        >
          {status === "pending" ? "Placing…" : status === "success" ? "Done!" : "Bid"}
        </button>
      </div>

      {/* Bids table */}
      <table className="w-full text-sm">
        <thead>
          <tr style={{ color: "#9da7b3", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <th className="text-left py-2 font-semibold text-xs">#</th>
            <th className="text-left py-2 font-semibold text-xs">Price</th>
            <th className="text-left py-2 font-semibold text-xs hidden sm:table-cell">Bidder</th>
            <th className="text-right py-2 font-semibold text-xs">Qty</th>
          </tr>
        </thead>
        <tbody>
          {sampleBids.map((b) => (
            <tr key={b.rank} style={{ borderBottom: "1px solid rgba(255,255,255,0.025)" }}>
              <td className="py-3 font-mono text-xs" style={{ color: "#9da7b3" }}>{b.rank}</td>
              <td className="py-3 font-mono text-sm" style={{ color: "#22d3ee" }}>{b.price} ETH</td>
              <td className="py-3 font-mono text-xs hidden sm:table-cell" style={{ color: "#9da7b3" }}>{b.bidder}</td>
              <td className="py-3 text-right text-sm" style={{ color: "#e6edf3" }}>{b.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
