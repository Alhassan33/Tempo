import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http, parseAbiItem, defineChain } from "viem";

const tempoMainnet = defineChain({
  id: 4217,
  name: "Tempo",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.tempo.xyz"] } },
  testnet: false,
});

const publicClient = createPublicClient({
  chain: tempoMainnet,
  transport: http("https://rpc.tempo.xyz"),
});

const NFT_CONTRACT = "0x1Ee82CC5946EdBD88eaf90D6d3C2B5baA4f9966C";
const CHUNK_SIZE = 25000n; // How many blocks to check per RPC call
const WINDOW_SIZE = 400000n; // Total blocks to scan before stopping (to prevent Vercel timeout)

export default async function handler(req, res) {
  // 1. Check Security
  const secret = process.env.BACKFILL_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const contractAddr = NFT_CONTRACT.toLowerCase();
  const startTime = Date.now();

  try {
    // 2. Resume from where we last stopped
    const { data: stateRow } = await db.from("indexer_state")
      .select("last_block")
      .eq("contract", `backfill_${contractAddr}`)
      .single();

    const latestBlock = await publicClient.getBlockNumber();
    let from = BigInt(stateRow?.last_block || 0);
    
    // We only scan a set window (e.g., 100k blocks) per request to avoid Vercel 10s kill
    const targetEnd = from + WINDOW_SIZE > latestBlock ? latestBlock : from + WINDOW_SIZE;

    console.log(`[backfill] Syncing ${contractAddr} from ${from} to ${targetEnd}...`);

    let totalIndexed = 0;
    let errors = 0;

    while (from <= targetEnd) {
      const to = from + CHUNK_SIZE - 1n < targetEnd ? from + CHUNK_SIZE - 1n : targetEnd;

      try {
        const logs = await publicClient.getLogs({
          address: NFT_CONTRACT,
          event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
          fromBlock: from,
          toBlock: to,
        });

        if (logs.length > 0) {
          // Sort ascending so the most recent transfer in the chunk is the one that stays in DB
          logs.sort((a, b) => Number(a.blockNumber) - Number(b.blockNumber));

          for (const log of logs) {
            const { to: toAddr, tokenId } = log.args;
            const { error: upsertError } = await db.from("nfts").upsert({
              contract_address: contractAddr,
              token_id: Number(tokenId),
              owner_address: toAddr.toLowerCase(),
              last_updated_block: Number(log.blockNumber),
              updated_at: new Date().toISOString(),
            }, { onConflict: "contract_address,token_id" });

            if (upsertError) errors++;
            else totalIndexed++;
          }
        }
      } catch (e) {
        console.error(`[backfill] Chunk error at ${from}:`, e.message);
        errors++;
      }

      from = to + 1n;
    }

    // 3. Save progress to indexer_state so the next click continues from targetEnd
    await db.from("indexer_state").upsert({
      contract: `backfill_${contractAddr}`,
      last_block: Number(targetEnd),
      updated_at: new Date().toISOString(),
    });

    // 4. If we reached the end, update the total owner count in collections
    if (targetEnd === latestBlock) {
      const { count: owners } = await db
        .from("nfts")
        .select("*", { count: "exact", head: true })
        .eq("contract_address", contractAddr)
        .neq("owner_address", "0x0000000000000000000000000000000000000000");

      await db.from("collections")
        .update({ owners: owners || 0 })
        .eq("contract_address", contractAddr);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    return res.status(200).json({
      ok: true,
      status: targetEnd === latestBlock ? "COMPLETE" : "IN_PROGRESS",
      nfts_indexed: totalIndexed,
      synced_to_block: targetEnd.toString(),
      remaining_blocks: (latestBlock - targetEnd).toString(),
      duration_s: duration
    });

  } catch (err) {
    console.error("[backfill] fatal:", err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
