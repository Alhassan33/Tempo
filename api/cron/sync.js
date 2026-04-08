import { createClient } from "@supabase/supabase-js";
import { createPublicClient, http, defineChain, parseAbiItem } from "viem";

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

// The standard ERC721 ABI for ownerOf
const ABI = [{ 
  name: 'ownerOf', 
  type: 'function', 
  inputs: [{ name: 'tokenId', type: 'uint256' }], 
  outputs: [{ name: 'owner', type: 'address' }] 
}];

export default async function handler(req, res) {
  // Only allow GET requests (or whatever you use for your Cron/Manual hit)
  if (req.method !== "GET") return res.status(405).end();
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Missing Supabase Environment Variables" });
  }

  const db = createClient(supabaseUrl, supabaseServiceKey);
  console.log("[sync] starting direct contract ownership scan...");

  try {
    // 1. Fetch collections from Supabase
    // Make sure 'TEMPONYAW' (0x1ee82cc5946edbd88eaf90d6d3c2b5baa4f9966c) is in this table!
    const { data: collections, error: colError } = await db
      .from("collections")
      .select("contract_address");
    
    if (colError) throw colError;
    if (!collections || collections.length === 0) {
      return res.status(200).json({ ok: true, msg: "No collections found in Supabase. Add them to the 'collections' table first." });
    }

    let totalUpdated = 0;
    const errors = [];

    // 2. Loop through each collection in your DB
    for (const col of collections) {
      const contractAddr = col.contract_address.toLowerCase();
      console.log(`[sync] Scanning collection: ${contractAddr}`);

      // 3. Scan Token IDs 1 to 2000 (standard for Temponyan collections)
      // We use a simple loop. If it hits an ID that doesn't exist, it breaks to next collection.
      for (let tokenId = 1; tokenId <= 2000; tokenId++) {
        try {
          const owner = await publicClient.readContract({
            address: contractAddr,
            abi: ABI,
            functionName: 'ownerOf',
            args: [BigInt(tokenId)],
          });

          if (owner) {
            // Upsert the owner into the 'nfts' table
            const { error: upsertError } = await db.from("nfts").upsert({
              contract_address: contractAddr,
              token_id: tokenId,
              owner_address: owner.toLowerCase(),
              last_updated_block: 0 // Tagged as manual scan
            }, { 
              onConflict: 'contract_address, token_id' 
            });

            if (upsertError) console.error(`[sync] Upsert error for ID ${tokenId}:`, upsertError.message);
            else totalUpdated++;
          }
        } catch (e) {
          // ownerOf usually reverts if the token doesn't exist yet. 
          // We log it and move to the next collection to save time.
          console.log(`[sync] Reached end of minted tokens for ${contractAddr} at ID ${tokenId}`);
          break; 
        }
      }
    }

    // 4. Final Response
    return res.status(200).json({ 
      ok: true, 
      msg: `Scan complete. Found and updated ${totalUpdated} NFTs in Supabase.`,
      collections_scanned: collections.length
    });

  } catch (err) {
    console.error("[sync] Critical failure:", err.message);
    return res.status(500).json({ error: err.message });
  }
}
