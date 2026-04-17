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

const START_BLOCK = 10101321n; // Your oldest collection deployment block
const CHUNK_SIZE = 25000n;
const WINDOW_SIZE = 400000n; // Covers ~29 days of blocks in one run

export default async function handler(req, res) {
  const secret = process.env.BACKFILL_SECRET;
  if (secret && req.query.secret !== secret) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // ✅ DYNAMIC: Accept contract address from query
  const nftContract = req.query.address;
  if (!nftContract || !/^0x[a-fA-F0-9]{40}$/.test(nftContract)) {
    return res.status(400).json({ ok: false, error: "Missing or invalid ?address=0x..." });
  }

  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const contractAddr = nftContract.toLowerCase();
  const startTime = Date.now();

  try {
    const { data: stateRow } = await db.from("indexer_state")
      .select("last_block")
      .eq("contract", `backfill_${contractAddr}`)
      .single();

    const latestBlock = await publicClient.getBlockNumber();
    
    // ✅ If never scanned, start from your known oldest block
    let from = BigInt(stateRow?.last_block || 0);
    if (from === 0n) from = START_BLOCK;

    const targetEnd = from + WINDOW_SIZE > latestBlock ? latestBlock : from + WINDOW_SIZE;

    console.log(`[backfill] ${contractAddr} | Blocks ${from} → ${targetEnd}`);

    let totalIndexed = 0;
    let errors = 0;

    while (from <= targetEnd) {
      const to = from + CHUNK_SIZE - 1n < targetEnd ? from + CHUNK_SIZE - 1n : targetEnd;

      try {
        const logs = await publicClient.getLogs({
          address: nftContract, // Uses the dynamic address
          event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
          fromBlock: from,
          toBlock: to,
        });

        if (logs.length > 0) {
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
          console.log(`[backfill] ${contractAddr} | Chunk ${from}-${to}: ${logs.length} transfers`);
        }
      } catch (e) {
        console.error(`[backfill] ${contractAddr} | Chunk error ${from}:`, e.message);
        errors++;
      }

      from = to + 1n;
    }

    // Save progress
    await db.from("indexer_state").upsert({
      contract: `backfill_${contractAddr}`,
      last_block: Number(targetEnd),
      updated_at: new Date().toISOString(),
    });

    // Update collection stats if complete
    if (targetEnd === latestBlock) {
      const { count: owners } = await db
        .from("nfts")
        .select("*", { count: "exact", head: true })
        .eq("contract_address", contractAddr)
        .neq("owner_address", "0x0000000000000000000000000000000000000000");

      const { count: totalSupply } = await db
        .from("nfts")
        .select("*", { count: "exact", head: true })
        .eq("contract_address", contractAddr);

      await db.from("collections")
        .update({ 
          owners: owners || 0,
          total_supply: totalSupply || 0,
          total_minted: totalSupply || 0
        })
        .eq("contract_address", contractAddr);
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    
    return res.status(200).json({
      ok: true,
      contract: contractAddr,
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
