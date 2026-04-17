const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

const TEMPO_RPC = "https://rpc.tempo.xyz";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const provider = new ethers.providers.JsonRpcProvider(TEMPO_RPC);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const CHUNK_SIZE = 50000;
const START_BLOCK = 10101321; 

async function sync() {
  try {
    const currentBlock = await provider.getBlockNumber();
    
    // Find the highest block already in your DB to avoid rescanning
    const { data: lastNft } = await supabase.from("nfts")
      .select("last_updated_block")
      .order("last_updated_block", { ascending: false })
      .limit(1);
    
    let startBlock = (lastNft && lastNft[0] && lastNft[0].last_updated_block) 
      ? parseInt(lastNft[0].last_updated_block) 
      : START_BLOCK;

    if (startBlock >= currentBlock) {
      console.log("��� All collections synced. Checking for new blocks...");
      return setTimeout(sync, 30000);
    }

    let targetBlock = Math.min(startBlock + CHUNK_SIZE, currentBlock);
    console.log(`🔎 SCANNING ALL: ${startBlock} -> ${targetBlock}`);

    // Fetch every collection in your marketplace
    const { data: cols } = await supabase.from('collections').select('contract_address');
    
    if (cols) {
      for (const col of cols) {
        const addr = col.contract_address.toLowerCase();
        const contract = new ethers.Contract(addr, ["event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"], provider);
        
        const transfers = await contract.queryFilter("Transfer", startBlock, targetBlock);
        
        if (transfers.length > 0) {
          console.log(��� ${transfers.length} new events for ${addr});
          for (const log of transfers) {
            await supabase.from('nfts').upsert({
              contract_address: addr,
              token_id: log.args.tokenId.toString(),
              owner_address: log.args.to.toLowerCase(),
              last_updated_block: log.blockNumber 
            }, { onConflict: 'contract_address, token_id' });
          }
        }
      }
    }
    
    setTimeout(sync, 1000);
  } catch (err) { 
    console.error("❌ Indexer Error:", err.message); 
    setTimeout(sync, 5000); 
  }
}

console.log("��� index.cjs (v5) running for all collections from block 10101321");
sync();
