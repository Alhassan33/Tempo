import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http, parseAbiItem, defineChain } from "viem";

// ─── Tempo Mainnet ────────────────────────────────────────────────────────────
const tempoMainnet = defineChain({
  id: 4217,
  name: "Tempo",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.tempo.xyz"] } },
  blockExplorers: { default: { name: "Tempo Explorer", url: "https://explore.tempo.xyz" } },
  testnet: false,
});

const publicClient = createPublicClient({
  chain: tempoMainnet,
  transport: http("https://rpc.tempo.xyz"),
});

// ─── Constants ────────────────────────────────────────────────────────────────
const MARKETPLACE_ADDRESS = "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b";
const LAUNCHPAD_ADDRESS   = "0x0451929d3c5012978127A2e347d207Aa8b67f14d";
const CHUNK_SIZE = 2000n;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function formatPrice(raw) {
  return Number(raw) / 1e6; // Adjust if Tempo uses different decimals
}

// Updated getLogs to accept an optional address
async function getLogs({ fromBlock, toBlock, event, address = MARKETPLACE_ADDRESS }) {
  const logs = [];
  let from = BigInt(fromBlock);
  const to = BigInt(toBlock);

  while (from <= to) {
    const chunkTo = from + CHUNK_SIZE - 1n < to ? from + CHUNK_SIZE - 1n : to;
    try {
      const chunk = await publicClient.getLogs({
        address: address,
        event: parseAbiItem(event),
        fromBlock: from,
        toBlock: chunkTo,
      });
      logs.push(...chunk);
    } catch (e) {
      console.error(`[sync] getLogs error ${from}-${chunkTo}:`, e.message);
    }
    from = chunkTo + 1n;
  }
  return logs;
}

// ... (ensureCollection and updateCollectionStats remain the same) ...

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  
  const db = getDb();
  console.log("[sync] starting indexer...");

  try {
    // 1. Setup Sync State
    const { data: stateRow } = await db.from("indexer_state").select("last_block").eq("contract", MARKETPLACE_ADDRESS).single();
    const lastBlock = BigInt(stateRow?.last_block || 0);
    const latestBlock = await publicClient.getBlockNumber();

    if (lastBlock >= latestBlock) return res.status(200).json({ ok: true, msg: "Synced" });

    const safeFrom = lastBlock === 0n ? latestBlock - 5000n : lastBlock + 1n;
    let synced = 0;

    // 2. MARKETPLACE EVENTS (Listed, Sale, Cancelled, PriceUpdated)
    // [Keep your existing loops for these, just ensure getLogs uses MARKETPLACE_ADDRESS]

    // 3. LAUNCHPAD EVENTS (Minted)
    const mintLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock: latestBlock,
      address: LAUNCHPAD_ADDRESS, // Targeted address
      event: "event Minted(address indexed minter, address indexed collection, uint256 quantity, uint256 pricePaid)",
    });

    for (const log of mintLogs) {
      const { minter, collection, quantity, pricePaid } = log.args;
      // You might want a 'mints' table, or just update collection supply
      await ensureCollection(db, collection.toLowerCase());
      await updateCollectionStats(db, collection.toLowerCase());
      synced++;
    }

    // 4. Save progress
    await db.from("indexer_state").upsert({
      contract: MARKETPLACE_ADDRESS,
      last_block: Number(latestBlock),
      updated_at: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, synced, block: latestBlock.toString() });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
