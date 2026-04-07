import { createPublicClient, createWalletClient, http, custom, defineChain } from "viem";

// ─── Tempo Mainnet ────────────────────────────────────────────────────────────
export const tempoMainnet = defineChain({
  id: 4217,
  name: "Tempo",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: {
    default: {
      http:      ["https://rpc.tempo.xyz"],
      webSocket: ["wss://rpc.tempo.xyz"],
    },
  },
  blockExplorers: {
    default: {
      name: "Tempo Explorer",
      url:  "https://explore.tempo.xyz",
    },
  },
  testnet: false,
});

/** Read-only public client — use for all contract reads */
export const publicClient = createPublicClient({
  chain:     tempoMainnet,
  transport: http("https://rpc.tempo.xyz"),
});

/** Wallet client (browser wallet) — use for writes/transactions */
export function getWalletClient() {
  if (typeof window === "undefined" || !window.ethereum) return null;
  return createWalletClient({
    chain:     tempoMainnet,
    transport: custom(window.ethereum),
  });
}

// ─── The Missing Piece for useMarketplace ─────────────────────────────────────
/** * Returns a grouped object of clients. 
 * useMarketplace.ts calls this as: const clients = getClients(chainId)
 */
export function getClients(chainId) {
  // We use the same publicClient for all categories since they all hit Tempo
  return {
    balance:    publicClient,
    listings:   publicClient,
    history:    publicClient,
    collection: publicClient,
  };
}
