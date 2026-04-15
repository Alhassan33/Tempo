/**
 * api/cron/sync.js
 *
 * PRICE CONVENTION:
 *   DB → RAW 6-decimal units  e.g. 25000000 = $25.00 pathUSD
 *   UI → divide by 1e6 for display
 *
 * Indexes:
 *   1. Marketplace events  → listings, sales tables
 *   2. NFT Transfer events → nfts table (ownership)
 *   3. Factory CollectionCreated → collections table (auto-register Studio drops)
 *   4. Collection Minted events → update total_minted + collection stats
 *
 * KEY FIXES:
 *   1. Transfer TO marketplace = listing custody — do NOT deactivate
 *   2. Transfer AWAY from marketplace = sale/cancel — deactivate
 *   3. Listed event force-sets active=true after upsert (race condition fix)
 *   4. Duplicate listing cleanup every run
 *   5. CollectionCreated: auto-registers any new Studio collection in DB
 *   6. Minted: keeps total_minted in sync for launchpad progress bars
 *
 * Schedule: every minute
 *   vercel.json → { "path": "/api/cron/sync", "schedule": "* * * * *" }
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

// ─── Addresses ────────────────────────────────────────────────────────────────
const MARKETPLACE_ADDRESS = "0x218AB916fe8d7A1Ca87d7cD5Dfb1d44684Ab926b";
const LAUNCHPAD_FACTORY   = "0x0451929d3c5012978127A2e347d207Aa8b67f14d";
const MARKETPLACE_LOWER   = MARKETPLACE_ADDRESS.toLowerCase();
const CHUNK_SIZE           = 2000n;
const ZERO_ADDRESS         = "0x0000000000000000000000000000000000000000";
const MIN_PRICE_RAW        = 10_000n;           // $0.01
const MAX_PRICE_RAW        = 1_000_000_000_000n; // $1,000,000

// ─── Minimal read ABI for on-chain collection data ────────────────────────────
const COLLECTION_READ_ABI = [
  { name: "name",         type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string"  }] },
  { name: "symbol",       type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string"  }] },
  { name: "maxSupply",    type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalMinted",  type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "creator",      type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
];

function getDb() {
  return createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function storePrice(rawBigInt) { return Number(rawBigInt); }

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
      const chunk = await publicClient.getLogs({
        address,
        event: parseAbiItem(event),
        fromBlock: from,
        toBlock: chunkTo,
      });
      logs.push(...chunk);
    } catch (e) {
      console.error(`[sync] getLogs ${from}-${chunkTo}:`, e.message);
    }
    from = chunkTo + 1n;
  }
  return logs;
}

// ─── Ensure collection row exists ─────────────────────────────────────────────
async function ensureCollection(db, contractAddress) {
  const addr = contractAddress.toLowerCase();
  const { data } = await db
    .from("collections")
    .select("id")
    .eq("contract_address", addr)
    .single();

  if (!data) {
    await db.from("collections").insert({
      contract_address: addr,
      name:             `Collection ${addr.slice(0, 8)}`,
      slug:             addr.slice(2, 10),
      verified:         false,
      floor_price:      0,
      volume_total:     0,
      volume_24h:       0,
      total_sales:      0,
    });
  }
}

async function deactivateTokenListings(db, nftContract, tokenId) {
  await db
    .from("listings")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("nft_contract", nftContract.toLowerCase())
    .eq("token_id", Number(tokenId))
    .eq("active", true);
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

  const { data: sales24h } = await db.from("sales").select("price")
    .eq("nft_contract", addr).gte("sold_at", since24h);
  const volume24h     = sales24h?.reduce((s, r) => s + (Number(r.price) || 0), 0) ?? 0;
  const salesCount24h = sales24h?.length ?? 0;

  const { count: owners } = await db.from("nfts")
    .select("*", { count: "exact", head: true })
    .eq("contract_address", addr)
    .neq("owner_address", ZERO_ADDRESS)
    .neq("owner_address", MARKETPLACE_LOWER);

  const { data: colRow } = await db.from("collections")
    .select("total_supply").eq("contract_address", addr).single();
  const marketCap = floorPrice && colRow?.total_supply
    ? Number(floorPrice) * colRow.total_supply : 0;

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
    const { from, to, tokenId } = log.args;
    const toAddr   = to.toLowerCase();
    const fromAddr = from.toLowerCase();

    // Only deactivate when token leaves the marketplace (sale/cancel)
    // NOT when it enters the marketplace (listing deposit)
    if (fromAddr === MARKETPLACE_LOWER && toAddr !== MARKETPLACE_LOWER) {
      await deactivateTokenListings(db, contractAddress, tokenId);
    }

    const { error } = await db.from("nfts").upsert({
      contract_address:   addr,
      token_id:           Number(tokenId),
      owner_address:      toAddr,
      last_updated_block: Number(log.blockNumber),
      updated_at:         new Date().toISOString(),
    }, { onConflict: "contract_address,token_id" });

    if (!error) count++;
  }
  return count;
}

async function cleanDuplicateListings(db) {
  const { data: rows } = await db.from("listings")
    .select("id, listing_id, nft_contract, token_id")
    .eq("active", true).order("listing_id", { ascending: false });
  if (!rows?.length) return;

  const seen = new Set();
  const toDeactivate = [];
  for (const row of rows) {
    const key = `${row.nft_contract}:${row.token_id}`;
    if (seen.has(key)) toDeactivate.push(row.listing_id);
    else seen.add(key);
  }

  if (toDeactivate.length > 0) {
    console.log(`[sync] Deactivating ${toDeactivate.length} duplicate listings`);
    await db.from("listings")
      .update({ active: false, updated_at: new Date().toISOString() })
      .in("listing_id", toDeactivate);
  }
}

// ─── NEW: Sync CollectionCreated events from the factory ─────────────────────
// Auto-registers any new Studio-deployed collection into the collections table.
// This means the marketplace, portfolio, and indexer all pick it up immediately
// without any manual admin step.
async function syncFactoryCollections(db, fromBlock, toBlock) {
  const logs = await getLogs({
    fromBlock, toBlock,
    address: LAUNCHPAD_FACTORY,
    event: "event CollectionCreated(address indexed collection, address indexed creator, string name, string symbol)",
  });

  if (!logs.length) return 0;
  console.log(`[sync] ${logs.length} new collection(s) from factory`);

  let count = 0;
  for (const log of logs) {
    const { collection, creator, name, symbol } = log.args;
    const addr = collection.toLowerCase();

    // Check if already in DB (could have been added by StudioPage directly)
    const { data: existing } = await db.from("collections")
      .select("id").eq("contract_address", addr).single();

    if (existing) {
      console.log(`[sync] collection ${addr} already registered, skipping`);
      continue;
    }

    // Read on-chain data for the new collection
    let maxSupply = 0;
    let totalMinted = 0;
    try {
      const [ms, tm] = await Promise.all([
        publicClient.readContract({ address: collection, abi: COLLECTION_READ_ABI, functionName: "maxSupply" }),
        publicClient.readContract({ address: collection, abi: COLLECTION_READ_ABI, functionName: "totalMinted" }),
      ]);
      maxSupply   = Number(ms);
      totalMinted = Number(tm);
    } catch (e) {
      console.warn(`[sync] couldn't read chain data for ${addr}:`, e.message);
    }

    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      + "-" + addr.slice(2, 8);

    // Insert into collections (marketplace visible)
    await db.from("collections").insert({
      contract_address:  addr,
      name,
      slug,
      verified:          false,
      floor_price:       0,
      volume_total:      0,
      volume_24h:        0,
      total_sales:       0,
      total_supply:      maxSupply,
      total_minted:      totalMinted,
      metadata_base_uri: "",
      creator_name:      creator.slice(0, 6) + "…" + creator.slice(-4),
    });

    // Also create a projects row if one doesn't exist yet
    // (handles the case where someone deploys via a script, not the Studio UI)
    const { data: existingProject } = await db.from("projects")
      .select("id").eq("contract_address", addr).single();

    if (!existingProject) {
      await db.from("projects").insert({
        name,
        symbol,
        contract_address: addr,
        creator_wallet:   creator.toLowerCase(),
        max_supply:       maxSupply,
        status:           "draft",
        created_at:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      });
    }

    console.log(`[sync] registered new collection: ${name} (${addr})`);
    count++;
  }

  return count;
}

// ─── NEW: Sync Minted events for all known collections ────────────────────────
// Keeps total_minted accurate so mint progress bars show live data.
// Also updates owner count since mints create new NFT owners.
async function syncMintedEvents(db, collections, fromBlock, toBlock) {
  let count = 0;

  for (const col of collections) {
    const addr = col.contract_address.toLowerCase();

    const logs = await getLogs({
      fromBlock, toBlock,
      address: col.contract_address,
      event: "event Minted(address indexed to, uint256 phaseId, uint256 quantity, uint256 totalPaid)",
    });

    if (!logs.length) continue;

    console.log(`[sync] ${logs.length} Minted events for ${addr}`);

    // Read current totalMinted from chain (most accurate)
    let newTotalMinted = null;
    try {
      const tm = await publicClient.readContract({
        address: col.contract_address,
        abi: COLLECTION_READ_ABI,
        functionName: "totalMinted",
      });
      newTotalMinted = Number(tm);
    } catch {}

    if (newTotalMinted !== null) {
      await db.from("collections")
        .update({ total_minted: newTotalMinted })
        .eq("contract_address", addr);
    }

    // Also update the projects table so MintPage progress bar is accurate
    await db.from("projects")
      .update({ total_minted: newTotalMinted })
      .eq("contract_address", addr);

    // Update NFT ownership for each mint (Transfer from 0x0 is handled by
    // syncNFTOwnership, but we update stats here specifically for mint volume)
    await updateCollectionStats(db, addr);

    count += logs.length;
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
      await cleanDuplicateListings(db);
      return res.status(200).json({ ok: true, synced: 0, block: latestBlock.toString(), msg: "up to date" });
    }

    const safeFrom = lastBlock === 0n ? latestBlock - 5000n : lastBlock + 1n;
    console.log(`[sync] scanning ${safeFrom} → ${latestBlock}`);
    let synced = 0, skipped = 0;

    // ── 1. Factory: auto-register new Studio collections ─────────────────
    const newCollections = await syncFactoryCollections(db, safeFrom, latestBlock);
    synced += newCollections;

    // ── 2. Marketplace: Listed ────────────────────────────────────────────
    const listedLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock,
      address: MARKETPLACE_ADDRESS,
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

      if (!error) {
        // Force active=true — prevents Transfer race condition
        await db.from("listings")
          .update({ active: true, updated_at: new Date().toISOString() })
          .eq("listing_id", Number(listingId));
        await updateCollectionStats(db, nftContract);
        synced++;
      }
    }

    // ── 3. Marketplace: Sale ──────────────────────────────────────────────
    const saleLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock,
      address: MARKETPLACE_ADDRESS,
      event: "event Sale(uint256 indexed listingId, address indexed buyer, uint256 price)",
    });

    for (const log of saleLogs) {
      const { listingId, buyer, price } = log.args;
      if (!isPriceValid(price)) { skipped++; continue; }

      const { data: listing } = await db.from("listings")
        .select("seller, nft_contract, token_id").eq("listing_id", Number(listingId)).single();

      if (listing) {
        await deactivateTokenListings(db, listing.nft_contract, listing.token_id);
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
      } else {
        await db.from("listings")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("listing_id", Number(listingId));
      }
    }

    // ── 4. Marketplace: Cancelled ─────────────────────────────────────────
    const cancelLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock,
      address: MARKETPLACE_ADDRESS,
      event: "event Cancelled(uint256 indexed listingId)",
    });

    for (const log of cancelLogs) {
      const listingId = Number(log.args.listingId);
      const { data: listing } = await db.from("listings")
        .select("nft_contract, token_id").eq("listing_id", listingId).single();

      if (listing) {
        await deactivateTokenListings(db, listing.nft_contract, listing.token_id);
        await updateCollectionStats(db, listing.nft_contract);
      } else {
        await db.from("listings")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("listing_id", listingId);
      }
      synced++;
    }

    // ── 5. Marketplace: PriceUpdated ──────────────────────────────────────
    const priceLogs = await getLogs({
      fromBlock: safeFrom, toBlock: latestBlock,
      address: MARKETPLACE_ADDRESS,
      event: "event PriceUpdated(uint256 indexed listingId, uint256 newPrice)",
    });

    for (const log of priceLogs) {
      if (!isPriceValid(log.args.newPrice)) { skipped++; continue; }
      await db.from("listings")
        .update({ price: storePrice(log.args.newPrice), updated_at: new Date().toISOString() })
        .eq("listing_id", Number(log.args.listingId));
      synced++;
    }

    // ── 6. NFT Transfers → ownership (all known collections) ─────────────
    const { data: collections } = await db.from("collections").select("contract_address");

    for (const col of collections || []) {
      const n = await syncNFTOwnership(db, col.contract_address, safeFrom, latestBlock);
      synced += n;
      if (n > 0) await updateCollectionStats(db, col.contract_address);
    }

    // ── 7. Minted events → keep total_minted + stats current ─────────────
    const mintedCount = await syncMintedEvents(db, collections || [], safeFrom, latestBlock);
    synced += mintedCount;

    // ── 8. Duplicate listing cleanup ──────────────────────────────────────
    await cleanDuplicateListings(db);

    // ── 9. Save progress ──────────────────────────────────────────────────
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
