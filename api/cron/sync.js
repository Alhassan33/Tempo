/**
 * api/cron/sync.js
 * Vercel cron job — indexes marketplace events from Tempo chain into Supabase.
 * Runs every hour. Add to vercel.json:
 *   "crons": [{ "path": "/api/cron/sync", "schedule": "0 * * * *" }]
 */

import { getDb } from "../lib/db.js";
import {
  publicClient,
  MARKETPLACE_ADDRESS,
  MARKETPLACE_ABI,
  getLatestBlock,
  getLogs,
  formatPrice,
} from "../lib/rpc.js";

const CONTRACT = MARKETPLACE_ADDRESS.toLowerCase();

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();

  // ─── AUTH CHECK ───
  // Vercel sends the secret in the Authorization header as a Bearer token
  const authHeader = req.headers['authorization'] || req.headers['Authorization'];
  
  // Use CRON_KEY to match your environment variable setting
  if (authHeader !== `Bearer ${process.env.CRON_KEY}`) {
    console.error("[sync] Unauthorized: Secret mismatch or missing");
    return res.status(401).json({ error: "Unauthorized" });
  }

  console.log("[sync] starting at", new Date().toISOString());
  const db = getDb();
  // ... rest of your code

    let synced = 0;

    // ── 2. Index Listed events ────────────────────────────────────────────────
    const listedLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock: latestBlock,
      address: MARKETPLACE_ADDRESS,
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

      // Ensure collection exists in DB
      await ensureCollection(db, nftContract.toLowerCase());
    }

    // ── 3. Index Sale events ──────────────────────────────────────────────────
    const saleLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock: latestBlock,
      address: MARKETPLACE_ADDRESS,
      event: "event Sale(uint256 indexed listingId, address indexed buyer, uint256 price)",
    });

    for (const log of saleLogs) {
      const { listingId, buyer, price } = log.args;

      // Get listing details
      const { data: listing } = await db
        .from("listings")
        .select("*")
        .eq("listing_id", Number(listingId))
        .single();

      if (listing) {
        // Mark listing inactive
        await db.from("listings")
          .update({ active: false, updated_at: new Date().toISOString() })
          .eq("listing_id", Number(listingId));

        // Insert sale record
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

        // Update collection stats
        await updateCollectionStats(db, listing.nft_contract);
        synced++;
      }
    }

    // ── 4. Index Cancelled events ─────────────────────────────────────────────
    const cancelLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock: latestBlock,
      address: MARKETPLACE_ADDRESS,
      event: "event Cancelled(uint256 indexed listingId)",
    });

    for (const log of cancelLogs) {
      const { listingId } = log.args;
      await db.from("listings")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("listing_id", Number(listingId));
      synced++;
    }

    // ── 5. Index PriceUpdated events ──────────────────────────────────────────
    const priceLogs = await getLogs({
      fromBlock: safeFrom,
      toBlock: latestBlock,
      address: MARKETPLACE_ADDRESS,
      event: "event PriceUpdated(uint256 indexed listingId, uint256 newPrice)",
    });

    for (const log of priceLogs) {
      const { listingId, newPrice } = log.args;
      await db.from("listings")
        .update({ price: formatPrice(newPrice), updated_at: new Date().toISOString() })
        .eq("listing_id", Number(listingId));
      synced++;
    }

    // ── 6. Update floor prices for all active collections ─────────────────────
    const { data: collections } = await db.from("collections").select("contract_address");
    for (const col of collections || []) {
      await updateCollectionStats(db, col.contract_address);
    }

    // ── 7. Save last synced block ─────────────────────────────────────────────
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function ensureCollection(db, contractAddress) {
  const { data } = await db
    .from("collections")
    .select("id")
    .eq("contract_address", contractAddress)
    .single();

  if (!data) {
    // Auto-create a placeholder collection entry
    const slug = contractAddress.slice(0, 8).toLowerCase();
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
  // Floor price = lowest active listing price
  const { data: floorData } = await db
    .from("listings")
    .select("price")
    .eq("nft_contract", contractAddress)
    .eq("active", true)
    .order("price", { ascending: true })
    .limit(1);

  const floorPrice = floorData?.[0]?.price || 0;

  // Total volume
  const { data: volumeData } = await db
    .from("sales")
    .select("price")
    .eq("nft_contract", contractAddress);

  const volumeTotal = volumeData?.reduce((sum, s) => sum + (s.price || 0), 0) || 0;

  // 24h volume
  const since24h = new Date(Date.now() - 86400000).toISOString();
  const { data: volume24hData } = await db
    .from("sales")
    .select("price")
    .eq("nft_contract", contractAddress)
    .gte("sold_at", since24h);

  const volume24h = volume24hData?.reduce((sum, s) => sum + (s.price || 0), 0) || 0;

  // Total sales count
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
