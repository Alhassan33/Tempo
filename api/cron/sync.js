/**
 * api/cron/sync.js
 *
 * PRICE CONVENTION:
 *   DB → RAW 6-decimal units  e.g. 25000000 = $25.00 pathUSD
 *   UI → divide by 1e6 for display
 *   Never store 18-decimal ETH values. Filter them out.
 *
 * Schedule in vercel.json → run every minute for fast listing/sale sync:
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
  chain: tempoMainnet,
  transport: http("https://rpc.tempo.xyz"),
});

const MARKETPLACE_ADDRESS = "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b";
const CHUNK_SIZE          = 2000n;
const ZERO_ADDRESS        = "0x0000000000000000000000000000000000000000";

// Sanity guard: pathUSD prices must be $0.01–$1,000,000 in 6-decimal raw units
const MIN_PRICE_RAW = 10_000n;            // $0.01
const MAX_PRICE_RAW = 1_000_000_000_000n; // $1,000,000

function getDb() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
}

// Store raw int directly — 25000000 goes into DB as 25000000
function storePrice(rawBigInt) {
  return Number(rawBigInt);
}

function isPriceValid(rawBigInt) {
  const v = BigInt(rawBigInt);
  return v >= MIN_PRICE_RAW && v <= MAX_PRICE_RAW;
}

async function getLogs({ fromBlock, toBlock, event, address }) {
  const logs = [];
  let from = BigInt(fromBlock);
  const to = BigInt(toBlock);
  while (from <= to) {
    const chunkTo = from + CHUNK_SIZE - 1n < to ? from + CHUNK_SIZE - 1n : to;
    try {
      const chunk = await publicClient.getLogs({ address, event: parseAbiItem(event), fromBlock: from, toBlock: chunkTo });
      logs.push(...chunk);
    } catch (e) { console.error(`[sync] getLogs ${from}-${chunkTo}:`, e.message); }
    from = chunkTo + 1n;
  }
  return logs;
}

async function ensureCollection(db, contractAddress) {
  const addr = contractAddress.toLowerCase();
  const { data } = await db.from("collections").select("id").eq("contract_address", addr).single();
  if (!data) {
    await db.from("collections").insert({
      contract_address: addr, name: `Collection ${addr.slice(0, 8)}`,
      slug: addr.slice(2, 10), verified: false,
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

  const { count: listedCount } = await db.from("listings")
    .select("*", { count: "exact", head: true }).eq("nft_contract", addr).eq("active", true);

  const { data: allSales } = await db.from("sales").select("price").eq("nft_contract", addr);
  const volumeTotal = allSales?.reduce((s, r) => s + (Number(r.price) || 0), 0) ?? 0;
  const totalSales  = allSales?.length ?? 0;

  const { data: sales24h } = await db.from("sales").select("price").eq("nft_contract", addr).gte("sold_at", since24h);
  const volume24h     = sales24h?.reduce((s, r) => s + (Number(r.price) || 0), 0) ?? 0;
  const salesCount24h = sales24h?.length ?? 0;

  const { count: owners } = await db.from("nfts")
    .select("*", { count: "exact", head: true })
    .eq("contract_address", addr).neq("owner_address", ZERO_ADDRESS);

  const { data: colRow } = await db.from("collections").select("total_supply").eq("contract_address", addr).single();
  const marketCap = floorPrice && colRow?.total_supply ? Number(floorPrice) * colRow.total_supply : 0;

  await db.from("collections").update({
    floor_price:  floorPrice,
    volume_total: volumeTotal,
    volume_24h:   volume24h,
    total_sales:  totalSales,
    sales_24h:    salesCount24h,
    listed_count: listedCount || 0,
    owners:       owners || 0,
    market_cap:   marketCap || null,
  }).eq("contract_address", addr);
}

async function syncNFTOwnership(db, contractAddress, fromBlock, toBlock) {
  const addr = contractAddress.toLowerCase();
  const logs = await getLogs({
    fromBlock, toBlock, address: contractAddress,
    event: "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
  });
  if (!logs.length) return 0;

  let count = 0;
  for (const log of logs) {
    const { to, tokenId } = log.args;
    // When NFT moves, instantly delist it
    if (to.toLowerCase() !== ZERO_ADDRESS) {
      await db.from("listings")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("nft_contract", addr).eq("token_id", Number(tokenId)).eq("active", true);
    }
    const { error } = await db.from("nfts").upsert({
      contract_address:   addr,
      token_id:           Number(tokenId),
      owner_address:      to.toLowerCase(),
      last_updated_block: Number(log.blockNumber),
      updated_at:         new Date().toISOString(),
    }, { onConflict: "contract_address,token_id" });
    if (!error) count++;
  }
  return count;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  console.log("[sync] starting at", new Date().toISOString());

  try {
    const db = getDb();
    const latestBlock = await publicClient.getBlockNumber();

    const { data: stateRow } = await db.from("indexer_state")
      .select("last_block").eq("contract", MARKETPLACE_ADDRESS).single();
    const lastBlock = BigInt(stateRow?.last_block || 0);

    if (lastBlock >= latestBlock) {
      return res.status(200).json({ ok: true, synced: 0, block: latestBlock.toString(), msg: "up to date" });
    }

    const safeFrom = lastBlock === 0n ? latestBlock - 5000n : lastBlock + 1n;
    let synced = 0, skipped = 0;

    // Listed
    const listedLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock, address: MARKETPLACE_ADDRESS,
      event: "event Listed(uint256 indexed listingId, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price)",
    });
    for (const log of listedLogs) {
      const { listingId, seller, nftContract, tokenId, price } = log.args;
      if (!isPriceValid(price)) { skipped++; continue; }
      await ensureCollection(db, nftContract);
      const { error } = await db.from("listings").upsert({
        listing_id:   Number(listingId),
        seller:       seller.toLowerCase(),
        nft_contract: nftContract.toLowerCase(),
        token_id:     Number(tokenId),
        price:        storePrice(price),
        active:       true,
        tx_hash:      log.transactionHash,
        block_number: Number(log.blockNumber),
        updated_at:   new Date().toISOString(),
      }, { onConflict: "listing_id" });
      if (!error) synced++;
    }

    // Sale
    const saleLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock, address: MARKETPLACE_ADDRESS,
      event: "event Sale(uint256 indexed listingId, address indexed buyer, uint256 price)",
    });
    for (const log of saleLogs) {
      const { listingId, buyer, price } = log.args;
      if (!isPriceValid(price)) { skipped++; continue; }
      await db.from("listings").update({ active: false, updated_at: new Date().toISOString() })
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
          price:        storePrice(price),
          tx_hash:      log.transactionHash,
          block_number: Number(log.blockNumber),
          sold_at:      new Date().toISOString(),
        }, { onConflict: "listing_id" });
        await updateCollectionStats(db, listing.nft_contract);
        synced++;
      }
    }

    // Cancelled
    const cancelLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock, address: MARKETPLACE_ADDRESS,
      event: "event Cancelled(uint256 indexed listingId)",
    });
    for (const log of cancelLogs) {
      await db.from("listings").update({ active: false, updated_at: new Date().toISOString() })
        .eq("listing_id", Number(log.args.listingId));
      synced++;
    }

    // PriceUpdated
    const priceLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock, address: MARKETPLACE_ADDRESS,
      event: "event PriceUpdated(uint256 indexed listingId, uint256 newPrice)",
    });
    for (const log of priceLogs) {
      if (!isPriceValid(log.args.newPrice)) { skipped++; continue; }
      await db.from("listings")
        .update({ price: storePrice(log.args.newPrice), updated_at: new Date().toISOString() })
        .eq("listing_id", Number(log.args.listingId));
      synced++;
    }

    // NFT Transfers → ownership + auto-delist
    const { data: collections } = await db.from("collections").select("contract_address");
    for (const col of collections || []) {
      const n = await syncNFTOwnership(db, col.contract_address, safeFrom, latestBlock);
      synced += n;
      await updateCollectionStats(db, col.contract_address);
    }

    await db.from("indexer_state").upsert({
      contract:   MARKETPLACE_ADDRESS,
      last_block: Number(latestBlock),
      updated_at: new Date().toISOString(),
    }, { onConflict: "contract" });

    console.log(`[sync] done — ${synced} synced, ${skipped} skipped, block ${latestBlock}`);
    return res.status(200).json({ ok: true, synced, skipped, block: latestBlock.toString() });

  } catch (err) {
    console.error("[sync] fatal:", err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
