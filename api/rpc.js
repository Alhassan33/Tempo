import { createPublicClient, http, parseAbiItem } from "viem";
import { defineChain } from "viem";

// ─── Tempo Testnet ────────────────────────────────────────────────────────────
export const tempoTestnet = defineChain({
  id: 42431,
  name: "Tempo Testnet",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.moderato.tempo.xyz"] },
  },
});

// ─── Public client ────────────────────────────────────────────────────────────
export const publicClient = createPublicClient({
  chain: tempoTestnet,
  transport: http("https://rpc.moderato.tempo.xyz"),
});

// ─── Marketplace contract ─────────────────────────────────────────────────────
export const MARKETPLACE_ADDRESS =
  "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b";

export const MARKETPLACE_ABI = [
  {
    type: "event",
    name: "Listed",
    inputs: [
      { name: "listingId",   type: "uint256", indexed: true  },
      { name: "seller",      type: "address", indexed: true  },
      { name: "nftContract", type: "address", indexed: true  },
      { name: "tokenId",     type: "uint256", indexed: false },
      { name: "price",       type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Sale",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true  },
      { name: "buyer",     type: "address", indexed: true  },
      { name: "price",     type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Cancelled",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "PriceUpdated",
    inputs: [
      { name: "listingId", type: "uint256", indexed: true  },
      { name: "newPrice",  type: "uint256", indexed: false },
    ],
  },
  {
    type: "function",
    name: "getListing",
    stateMutability: "view",
    inputs: [{ name: "listingId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "seller",      type: "address" },
          { name: "nftContract", type: "address" },
          { name: "tokenId",     type: "uint256" },
          { name: "price",       type: "uint256" },
          { name: "active",      type: "bool"    },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "totalListings",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Get current block number
export async function getLatestBlock() {
  return await publicClient.getBlockNumber();
}

// Fetch logs in safe chunks (Tempo RPC may limit range)
export async function getLogs({ fromBlock, toBlock, address, event }) {
  const CHUNK = 2000n;
  const logs = [];
  let from = BigInt(fromBlock);
  const to = BigInt(toBlock);

  while (from <= to) {
    const chunkTo = from + CHUNK - 1n < to ? from + CHUNK - 1n : to;
    try {
      const chunk = await publicClient.getLogs({
        address,
        event: parseAbiItem(event),
        fromBlock: from,
        toBlock: chunkTo,
      });
      logs.push(...chunk);
    } catch (e) {
      console.error(`[rpc] getLogs error ${from}-${chunkTo}:`, e.message);
    }
    from = chunkTo + 1n;
  }
  return logs;
}

// Format price from wei (18 decimals) to USD string
export function formatPrice(raw) {
  return Number(raw) / 1e6; // pathUSD uses 6 decimals
}
