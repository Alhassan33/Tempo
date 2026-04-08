const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(process.env.TEMPO_RPC);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MARKET_ABI = [
  "event ItemListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 price)",
  "event ItemSold(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 price)"
];

const market = new ethers.Contract(process.env.MARKET_ADDRESS, MARKET_ABI, provider);

async function syncEvents() {
  try {
    const currentBlock = await provider.getBlockNumber();
    // We check the last 10 blocks every 10 seconds to be safe
    const fromBlock = currentBlock - 10; 

    console.log(`Checking blocks ${fromBlock} to ${currentBlock}...`);

    const listings = await market.queryFilter("ItemListed", fromBlock, currentBlock);
    for (const log of listings) {
      const { seller, nftAddress, tokenId, price } = log.args;
      const p = ethers.formatEther(price);
      console.log(`[LISTED] #${tokenId} for ${p} USD`);
      await supabase.from('listings').upsert({
        contract_address: nftAddress.toLowerCase(),
        token_id: tokenId.toString(),
        seller: seller.toLowerCase(),
        price: p,
        status: 'active'
      });
    }

    const sales = await market.queryFilter("ItemSold", fromBlock, currentBlock);
    for (const log of sales) {
      const { nftAddress, tokenId, price } = log.args;
      console.log(`[SOLD] #${tokenId}`);
      await supabase.from('listings').update({ status: 'sold' })
        .match({ contract_address: nftAddress.toLowerCase(), token_id: tokenId.toString() });
    }

  } catch (err) {
    console.error("Polling Error:", err.message);
  }
}

console.log("🚀 Tempo Indexer (Stable Mode) Started...");
// Run every 10 seconds
setInterval(syncEvents, 10000);
