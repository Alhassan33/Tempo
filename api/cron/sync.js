import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http, parseAbiItem, defineChain } from "viem";

// ─── Tempo Mainnet Configuration ─────────────────────────────────────────────
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
const CHUNK_SIZE = 2000n; // Limits RPC strain per request

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
    await db.from("collections").insert({ 
      contract_address: address.toLowerCase(), 
      name: "Unknown Collection", 
      verified: false 
    });
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  
  const db = getDb();
  console.log("[sync] starting full indexer run...");

  try {
    // 1. Check Sync State
    const { data: stateRow } = await db.from("indexer_state")
      .select("last_block")
      .eq("contract", MARKETPLACE_ADDRESS)
      .single();
    
    const lastBlock = BigInt(stateRow?.last_block || 0);
    const latestBlock = await publicClient.getBlockNumber();

    if (lastBlock >= latestBlock) {
      return res.status(200).json({ ok: true, msg: "Chain is already synced." });
    }

    // CRITICAL: If lastBlock is 0, we scan from block 0 to find all 33 existing NFTs.
    const safeFrom = lastBlock === 0n ? 0n : lastBlock + 1n;
    let syncedCount = 0;

    // 2. Fetch all collections we need to track
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
      const { collection } = log.args;
      await ensureCollection(db, collection.toLowerCase());
      syncedCount++;
    }

    // 5. OWNERSHIP: Transfer Events (The 33 NFT Fix)
    if (collectionAddrs.length > 0) {
      const transferLogs = await getLogs({
        fromBlock: safeFrom,
        toBlock: latestBlock,
        address: collectionAddrs,
        event: "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
      });

      for (const log of transferLogs) {
        const { to, tokenId } = log.args;
        // This updates the 'nfts' table so the Portfolio page knows you own it
        await db.from("nfts").upsert({
          contract_address: log.address.toLowerCase(),
          token_id: Number(tokenId),
          owner_address: to.toLowerCase(),
          last_updated_block: Number(log.blockNumber)
        }, { onConflict: 'contract_address, token_id' });
        
        syncedCount++;
      }
    }

    // 6. Save Progress to DB
    await db.from("indexer_state").upsert({
      contract: MARKETPLACE_ADDRESS,
      last_block: Number(latestBlock),
      updated_at: new Date().toISOString(),
    });

    console.log(`[sync] Success. Synced ${syncedCount} events up to block ${latestBlock}`);
    return res.status(200).json({ 
      ok: true, 
      synced: syncedCount, 
      latest_block: latestBlock.toString() 
    });

  } catch (err) {
    console.error("[sync] Critical Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
