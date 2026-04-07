/**
 * api/cron/sync.js
 * Vercel cron job — indexes marketplace events from Tempo chain into Supabase.
 * Schedule in vercel.json:
 *   "crons": [{ "path": "/api/cron/sync", "schedule": "0 * * * *" }]
 */

import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http, parseAbiItem, defineChain } from "viem";

// ─── Tempo Mainnet ────────────────────────────────────────────────────────────
const tempoMainnet = defineChain({
  id: 4217,
  name: "Tempo",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.tempo.xyz"] },
  },
  blockExplorers: {
    default: { name: "Tempo Explorer", url: "https://explore.tempo.xyz" },
  },
  testnet: false,
});

const publicClient = createPublicClient({
  chain:     tempoMainnet,
  transport: http("https://rpc.tempo.xyz"),
});

// ─── Constants ────────────────────────────────────────────────────────────────
const MARKETPLACE_ADDRESS = "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b";
const CHUNK_SIZE = 2000n;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function formatPrice(raw) {
  return Number(raw) / 1e6;
}

async function getLogs({ fromBlock, toBlock, event }) {
  const logs = [];
  let from = BigInt(fromBlock);
  const to = BigInt(toBlock);

  while (from <= to) {
    const chunkTo = from + CHUNK_SIZE - 1n < to ? from + CHUNK_SIZE - 1n : to;
    try {
      const chunk = await publicClient.getLogs({
        address: MARKETPLACE_ADDRESS,
        event:   parseAbiItem(event),
        fromBlock: from,
        toBlock:   chunkTo,
      });
      logs.push(...chunk);
    } catch (e) {
      console.error(`[sync] getLogs error ${from}-${chunkTo}:`, e.message);
    }
    from = chunkTo + 1n;
  }
  return logs;
}

async function ensureCollection(db, contractAddress) {
  const { data } = await db
    .from("collections")
    .select("id")
    .eq("contract_address", contractAddress)
    .single();

  if (!data) {
    const slug = contractAddress.slice(2, 10).toLowerCase();
    await db.from("collections").insert({
      contract_address: contractAddress,
      name:             `Collection ${contractAddress.slice(0, 6)}`,
      slug:             slug,
      verified:         false,
      floor_price:      0,
      volume_total:     0,
      volume_24h:       0,
      total_sales:      0,
    });
  }
}

async function updateCollectionStats(db, contractAddress) {
  const { data: floorData } = await db
    .from("listings")
    .select("price")
    .eq("nft_contract", contractAddress)
    .eq("active", true)
    .order("price", { ascending: true })
    .limit(1);

  const floorPrice = floorData?.[0]?.price || 0;

  const { data: volumeData } = await db
    .from("sales")
    .select("price")
    .eq("nft_contract", contractAddress);

  const volumeTotal = volumeData?.reduce((sum, s) => sum + (s.price || 0), 0) || 0;

  const since24h = new Date(Date.now() - 86400000).toISOString();
  const { data: volume24hData } = await db
    .from("sales")
    .select("price")
    .eq("nft_contract", contractAddress)
    .gte("sold_at", since24h);

  const volume24h = volume24hData?.reduce((sum, s) => sum + (s.price || 0), 0) || 0;

  const { count } = await db
    .from("sales")
    .select("*", { count: "exact", head: true })
    .eq("nft_contract", contractAddress);

  await db.from("collections").update({
    floor_price:  floorPrice,
    volume_total: volumeTotal,
    volume_24h:   volume24h,
    total_sales:  count || 0,
  }).eq("contract_address", contractAddress);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  console.log("[sync] starting at", new Date().toISOString());

  try {
    const db = getDb();

    // 1. Get last synced block
    const { data: stateRow } = await db
      .from("indexer_state")
      .select("last_block")
      .eq("contract", MARKETPLACE_ADDRESS)
      .single();

    const lastBlock   = BigInt(stateRow?.last_block || 0);
    const latestBlock = await publicClient.getBlockNumber();

    if (lastBlock >= latestBlock) {
      console.log("[sync] already up to date at block", latestBlock);
      return res.status(200).json({ ok: true, synced: 0, block: latestBlock.toString() });
    }

    const fromBlock = lastBlock === 0n
      ? latestBlock - 10000n
      : lastBlock + 1n;
    const safeFrom = fromBlock < 0n ? 0n : fromBlock;

    console.log(`[sync] scanning blocks ${safeFrom} → ${latestBlock}`);
    let synced = 0;

    // 2. Listed events
    const listedLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock:   latestBlock,
      event: "event Listed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price)",
    });

    for (const log of listedLogs) {
      const { listingId, seller, nftContract, tokenId, price } = log.args;
      const { error } = await db.from("listings").upsert({
        listing_id:   Number(listingId),
        seller:       seller.toLowerCase(),
        nft_contract: nftContract.toLowerCase(),
        token_id:     Number(tokenId),
        price:        formatPrice(price),
        active:       true,
        tx_hash:      log.transactionHash,
        block_number: Number(log.blockNumber),
      }, { onConflict: "listing_id" });

      if (error) console.error("[sync] listed upsert error:", error.message);
      else synced++;

      await ensureCollection(db, nftContract.toLowerCase());
    }

    // 3. Sale events
    const saleLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock:   latestBlock,
      event: "event Sale(uint256 indexed listingId, address indexed buyer, uint256 price)",
    });

    for (const log of saleLogs) {
      const { listingId, buyer, price } = log.args;

      const { data: listing } = await db
        .from("listings")
        .select("*")
        .eq("listing_id", Number(listingId))
        .single();

      if (listing) {
        await db.from("listings")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("listing_id", Number(listingId));

        await db.from("sales").insert({
          listing_id:   Number(listingId),
          buyer:        buyer.toLowerCase(),
          seller:       listing.seller,
          nft_contract: listing.nft_contract,
          token_id:     listing.token_id,
          price:        formatPrice(price),
          tx_hash:      log.transactionHash,
          block_number: Number(log.blockNumber),
        });

        await updateCollectionStats(db, listing.nft_contract);
        synced++;
      }
    }

    // 4. Cancelled events
    const cancelLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock:   latestBlock,
      event: "event Cancelled(uint256 indexed listingId)",
    });

    for (const log of cancelLogs) {
      const { listingId } = log.args;
      await db.from("listings")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("listing_id", Number(listingId));
      synced++;
    }

    // 5. PriceUpdated events
    const priceLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock:   latestBlock,
      event: "event PriceUpdated(uint256 indexed listingId, uint256 newPrice)",
    });

    for (const log of priceLogs) {
      const { listingId, newPrice } = log.args;
      await db.from("listings")
        .update({ price: formatPrice(newPrice), updated_at: new Date().toISOString() })
        .eq("listing_id", Number(listingId));
      synced++;
    }

    // 6. Update all collection stats
    const { data: collections } = await db
      .from("collections")
      .select("contract_address");

    for (const col of collections || []) {
      await updateCollectionStats(db, col.contract_address);
    }

    // 7. Save progress
    await db.from("indexer_state").upsert({
      contract:   MARKETPLACE_ADDRESS,
      last_block: Number(latestBlock),
      updated_at: new Date().toISOString(),
    }, { onConflict: "contract" });

    console.log(`[sync] done — ${synced} events, block ${latestBlock}`);
    return res.status(200).json({ ok: true, synced, block: latestBlock.toString() });

  } catch (err) {
    console.error("[sync] fatal error:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
