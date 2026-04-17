const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

const TEMPO_RPC = "https://rpc.tempo.xyz";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const provider = new ethers.providers.JsonRpcProvider(TEMPO_RPC);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fixMetadata() {
  try {
    // 1. Grab 10 NFTs that have owners but no names/images yet
    const { data: broken, error } = await supabase
      .from('nfts')
      .select('contract_address, token_id')
      .is('name', null)
      .limit(10);

    if (error) throw error;
    if (!broken || broken.length === 0) {
      console.log("��� No null metadata found. Checking again in 15s...");
      return setTimeout(fixMetadata, 15000);
    }

    for (const nft of broken) {
      const contract = new ethers.Contract(nft.contract_address, [
        "function name() view returns (string)",
        "function tokenURI(uint256) view returns (string)"
      ], provider);

      // 2. Call the blockchain for this specific token
      const [rawName, uri] = await Promise.all([
        contract.name().catch(() => "Collection"),
        contract.tokenURI(nft.token_id).catch(() => "")
      ]);

      const cleanName = `${rawName} #${nft.token_id}`;
      
      // 3. Universal Gateway Logic:
      // Converts ipfs:// to a working web link (Lighthouse or Irys)
      let displayImage = uri.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
      
      // Update the DB so the market ranking looks professional
      await supabase.from('nfts').update({ 
        name: cleanName, 
        image: displayImage 
      })
      .match({ 
        contract_address: nft.contract_address.toLowerCase(), 
        token_id: nft.token_id 
      });

      console.log(`🛠️ REPAIRED: ${cleanName}`);
    }

    setTimeout(fixMetadata, 1000);
  } catch (err) { 
    console.error("���️ Fixer Error:", err.message); 
    setTimeout(fixMetadata, 5000); 
  }
}

console.log("��� Fixer (v5) watching for all marketplace collections...");
fixMetadata();
