/**
 * api/cron/sync.js
 * Indexes:
 *   1. Marketplace events → listings + sales tables
 *   2. NFT Transfer events → nfts table (ownership tracking)
 *
 * Vercel cron schedule (vercel.json):
 *   { "path": "/api/cron/sync", "schedule": "* * * * *" }
 */

import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http, parseAbiItem, defineChain } from "viem";

const tempoMainnet = defineChain({
  id: 4217,
  name: "Tempo",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.tempo.xyz"] } },
  blockExplorers: { default: { name: "Tempo Explorer", url: "https://explore.tempo.xyz" } },
  testnet: false,
});

const publicClient = createPublicClient({
  chain:     tempoMainnet,
  transport: http("https://rpc.tempo.xyz"),
});

const MARKETPLACE_ADDRESS = "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b";
const CHUNK_SIZE          = 2000n;
const ZERO_ADDRESS        = "0x0000000000000000000000000000000000000000";

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function formatPrice(raw) {
  return Number(raw) / 1e6;
}

async function getLogs({ fromBlock, toBlock, event, address }) {
  const logs = [];
  let from   = BigInt(fromBlock);
  const to   = BigInt(toBlock);
  while (from <= to) {
    const chunkTo = from + CHUNK_SIZE - 1n < to ? from + CHUNK_SIZE - 1n : to;
    try {
      const chunk = await publicClient.getLogs({
        address, event: parseAbiItem(event), fromBlock: from, toBlock: chunkTo,
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
  const addr = contractAddress.toLowerCase();
  const { data } = await db.from("collections").select("id").eq("contract_address", addr).single();
  if (!data) {
    await db.from("collections").insert({
      contract_address: addr,
      name:    `Collection ${addr.slice(0, 8)}`,
      slug:    addr.slice(2, 10),
      verified: false,
      floor_price: 0, volume_total: 0, volume_24h: 0, total_sales: 0,
    });
  }
}

async function updateCollectionStats(db, contractAddress) {
  const addr     = contractAddress.toLowerCase();
  const since24h = new Date(Date.now() - 86_400_000).toISOString();

  const { data: floorRow } = await db.from("listings").select("price")
    .eq("nft_contract", addr).eq("active", true).order("price", { ascending: true }).limit(1);
  const floorPrice = floorRow?.[0]?.price ?? 0;

  const { data: topRow } = await db.from("listings").select("price")
    .eq("nft_contract", addr).eq("active", true).order("price", { ascending: false }).limit(1);
  const topOffer = topRow?.[0]?.price ?? 0;

  const { count: listedCount } = await db.from("listings")
    .select("*", { count: "exact", head: true }).eq("nft_contract", addr).eq("active", true);

  const { data: allSales } = await db.from("sales").select("price").eq("nft_contract", addr);
  const volumeTotal = allSales?.reduce((s, r) => s + (r.price || 0), 0) ?? 0;
  const totalSales  = allSales?.length ?? 0;

  const { data: sales24h } = await db.from("sales").select("price")
    .eq("nft_contract", addr).gte("sold_at", since24h);
  const volume24h  = sales24h?.reduce((s, r) => s + (r.price || 0), 0) ?? 0;
  const salesCount24h = sales24h?.length ?? 0;

  // Count unique owners from nfts table (exclude zero address)
  const { count: owners } = await db.from("nfts")
    .select("*", { count: "exact", head: true })
    .eq("contract_address", addr)
    .neq("owner_address", ZERO_ADDRESS);

  const { data: colRow } = await db.from("collections")
    .select("total_supply").eq("contract_address", addr).single();
  const marketCap = floorPrice && colRow?.total_supply
    ? floorPrice * colRow.total_supply : 0;

  await db.from("collections").update({
    floor_price:  floorPrice,
    top_offer:    topOffer    || null,
    volume_total: volumeTotal,
    volume_24h:   volume24h,
    total_sales:  totalSales,
    sales_24h:    salesCount24h,
    listed_count: listedCount  || 0,
    owners:       owners       || 0,
    market_cap:   marketCap    || null,
  }).eq("contract_address", addr);
}

// ─── Sync NFT ownership via ERC-721 Transfer events ───────────────────────────
async function syncNFTOwnership(db, contractAddress, fromBlock, toBlock) {
  const addr = contractAddress.toLowerCase();

  const logs = await getLogs({
    fromBlock, toBlock,
    address: contractAddress,
    event:   "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  });

  if (!logs.length) return 0;
  console.log(`[sync] ${logs.length} Transfer events for ${addr}`);

  let count = 0;
  for (const log of logs) {
    const { to, tokenId } = log.args;
    const { error } = await db.from("nfts").upsert({
      contract_address:   addr,
      token_id:           Number(tokenId),
      owner_address:      to.toLowerCase(),
      last_updated_block: Number(log.blockNumber),
      updated_at:         new Date().toISOString(),
    }, { onConflict: "contract_address,token_id" });

    if (error) console.error("[sync] nft upsert error:", error.message);
    else count++;
  }
  return count;
}

// ─── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  console.log("[sync] starting at", new Date().toISOString());

  try {
    const db          = getDb();
    const latestBlock = await publicClient.getBlockNumber();

    const { data: stateRow } = await db.from("indexer_state")
      .select("last_block").eq("contract", MARKETPLACE_ADDRESS).single();
    const lastBlock = BigInt(stateRow?.last_block || 0);

    if (lastBlock >= latestBlock) {
      return res.status(200).json({ ok: true, synced: 0, block: latestBlock.toString() });
    }

    const safeFrom = lastBlock === 0n ? latestBlock - 5000n : lastBlock + 1n;
    console.log(`[sync] scanning ${safeFrom} → ${latestBlock}`);
    let synced = 0;

    // ── Marketplace: Listed ───────────────────────────────────────────────
    const listedLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock,
      address:   MARKETPLACE_ADDRESS,
      event:     "event Listed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price)",
    });
    for (const log of listedLogs) {
      const { listingId, seller, nftContract, tokenId, price } = log.args;
      await ensureCollection(db, nftContract);
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
      if (!error) synced++;
    }

    // ── Marketplace: Sale ─────────────────────────────────────────────────
    const saleLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock,
      address:   MARKETPLACE_ADDRESS,
      event:     "event Sale(uint256 indexed listingId, address indexed buyer, uint256 price)",
    });
    for (const log of saleLogs) {
      const { listingId, buyer, price } = log.args;
      await db.from("listings")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("listing_id", Number(listingId));

      const { data: listing } = await db.from("listings")
        .select("seller, nft_contract, token_id").eq("listing_id", Number(listingId)).single();

      if (listing) {
        await db.from("sales").upsert({
          listing_id:   Number(listingId),
          buyer:        buyer.toLowerCase(),
          seller:       listing.seller,
          nft_contract: listing.nft_contract,
          token_id:     listing.token_id,
          price:        formatPrice(price),
          tx_hash:      log.transactionHash,
          block_number: Number(log.blockNumber),
        }, { onConflict: "listing_id" });
        await updateCollectionStats(db, listing.nft_contract);
        synced++;
      }
    }

    // ── Marketplace: Cancelled ────────────────────────────────────────────
    const cancelLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock,
      address:   MARKETPLACE_ADDRESS,
      event:     "event Cancelled(uint256 indexed listingId)",
    });
    for (const log of cancelLogs) {
      await db.from("listings")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("listing_id", Number(log.args.listingId));
      synced++;
    }

    // ── Marketplace: PriceUpdated ─────────────────────────────────────────
    const priceLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock,
      address:   MARKETPLACE_ADDRESS,
      event:     "event PriceUpdated(uint256 indexed listingId, uint256 newPrice)",
    });
    for (const log of priceLogs) {
      await db.from("listings")
        .update({ price: formatPrice(log.args.newPrice), updated_at: new Date().toISOString() })
        .eq("listing_id", Number(log.args.listingId));
      synced++;
    }

    // ── NFT Ownership: Transfer events for all known collections ──────────
    const { data: collections } = await db.from("collections").select("contract_address");
    for (const col of collections || []) {
      const n = await syncNFTOwnership(db, col.contract_address, safeFrom, latestBlock);
      synced += n;
      if (n > 0) await updateCollectionStats(db, col.contract_address);
    }

    // ── Save progress ─────────────────────────────────────────────────────
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
