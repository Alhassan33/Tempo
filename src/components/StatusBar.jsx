import { useAccount, useChainId } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";

const CHAIN_LABELS = {
  [mainnet.id]: "Ethereum",
  [sepolia.id]: "Sepolia",
};

export default function StatusBar() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const chainLabel = CHAIN_LABELS[chainId] ?? `Chain ${chainId}`;

  return (
    <div
      className="w-full flex items-center justify-between px-4 py-1.5 text-[11px]"
      style={{ background: "#0b0f14", borderTop: "1px solid rgba(255,255,255,0.04)", color: "#9da7b3" }}
    >
      <div className="flex items-center gap-2">
        <span className="live-dot" style={{ color: isConnected ? "#22c55e" : "#9da7b3" }} />
        {isConnected ? "Connected" : "Disconnected"}
      </div>
      {isConnected && (
        <div className="flex items-center gap-3">
          <span style={{ fontFamily: "Space Mono, monospace" }}>
            {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ""}
          </span>
          <span
            className="px-1.5 py-0.5 rounded-md"
            style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee" }}
          >
            {chainLabel}
          </span>
        </div>
      )}
    </div>
  );
}
