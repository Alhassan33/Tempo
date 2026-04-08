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

async function getLogs({ fromBlock, toBlock, event, address }) {
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

async function ensureCollection(db, address) {
  const { data } = await db.from("collections").select("id").eq("contract_address", address.toLowerCase()).single();
  if (!data) {
    await db.from("collections").insert({ contract_address: address.toLowerCase(), name: "Unknown Collection", verified: false });
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  
  const db = getDb();
  console.log("[sync] starting indexer...");

  try {
    // 1. Setup Sync State
    const { data: stateRow } = await db.from("indexer_state").select("last_block").eq("contract", MARKETPLACE_ADDRESS).single();
    const lastBlock = BigInt(stateRow?.last_block || 0);
    const latestBlock = await publicClient.getBlockNumber();

    if (lastBlock >= latestBlock) return res.status(200).json({ ok: true, msg: "Already Synced" });

    // Stay within a safe range to avoid RPC timeouts
    const safeFrom = lastBlock === 0n ? latestBlock - 2000n : lastBlock + 1n;
    let syncedCount = 0;

    // 2. FETCH COLLECTIONS (We need these to track Transfers)
    const { data: collections } = await db.from("collections").select("contract_address");
    const collectionAddrs = collections?.map(c => c.contract_address.toLowerCase()) || [];

    // 3. MARKETPLACE: Sold Events
    const saleLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock: latestBlock,
      address: MARKETPLACE_ADDRESS,
      event: "event Sold(address indexed nft, uint256 indexed tokenId, address seller, address buyer, uint256 price)",
    });

    for (const log of saleLogs) {
      const { nft, tokenId, seller, buyer, price } = log.args;
      await db.from("sales").insert({
        nft_contract: nft.toLowerCase(),
        token_id: Number(tokenId),
        seller: seller.toLowerCase(),
        buyer: buyer.toLowerCase(),
        price: Number(price) / 1e6,
        tx_hash: log.transactionHash,
        block_number: Number(log.blockNumber)
      });
      syncedCount++;
    }

    // 4. LAUNCHPAD: Minted Events
    const mintLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock: latestBlock,
      address: LAUNCHPAD_ADDRESS,
      event: "event Minted(address indexed minter, address indexed collection, uint256 quantity, uint256 pricePaid)",
    });

    for (const log of mintLogs) {
      const { minter, collection } = log.args;
      await ensureCollection(db, collection.toLowerCase());
      syncedCount++;
    }

    // 5. OWNERSHIP: Transfer Events (The missing piece for your Portfolio)
    if (collectionAddrs.length > 0) {
      const transferLogs = await getLogs({
        fromBlock: safeFrom,
        toBlock: latestBlock,
        address: collectionAddrs,
        event: "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      });

      for (const log of transferLogs) {
        const { to, tokenId } = log.args;
        // Update the 'nfts' table so PortfolioPage knows who owns what
        await db.from("nfts").upsert({
          contract_address: log.address.toLowerCase(),
          token_id: Number(tokenId),
          owner_address: to.toLowerCase(),
          last_updated_block: Number(log.blockNumber)
        }, { onConflict: 'contract_address, token_id' });
        
        syncedCount++;
      }
    }

    // 6. Save Progress
    await db.from("indexer_state").upsert({
      contract: MARKETPLACE_ADDRESS,
      last_block: Number(latestBlock),
      updated_at: new Date().toISOString(),
    });

    return res.status(200).json({ 
      ok: true, 
      synced: syncedCount, 
      block: latestBlock.toString() 
    });

  } catch (err) {
    console.error("[sync] error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
