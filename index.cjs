const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const provider = new ethers.JsonRpcProvider(process.env.TEMPO_RPC);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const MARKET_ABI = [
  "event ItemListed(address indexed seller, address indexed nftAddress, uint256 indexed tokenId, uint256 price)",
  "event ItemSold(address indexed buyer, address indexed nftAddress, uint256 indexed tokenId, uint256 price)"
];

const NFT_ABI = [
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"
];

const market = new ethers.Contract(process.env.MARKET_ADDRESS, MARKET_ABI, provider);

async function updateCollectionStats(nftAddress) {
  // Get live Floor Price
  const { data: floorData } = await supabase
    .from('listings')
    .select('price')
    .eq('contract_address', nftAddress.toLowerCase())
    .eq('status', 'active')
    .order('price', { ascending: true })
    .limit(1);

  const floor = floorData?.[0]?.price || 0;

  // Calculate Unique Owners
  const { data: ownerData } = await supabase
    .from('nfts')
    .select('owner_address')
    .eq('contract_address', nftAddress.toLowerCase());
  
  const uniqueOwners = new Set(ownerData?.map(o => o.owner_address)).size;

  // Update Supabase (Market Cap updates automatically via SQL)
  await supabase
    .from('collections')
    .update({ 
      floor_price: floor, 
      owners: uniqueOwners
    })
    .eq('contract_address', nftAddress.toLowerCase());
}

async function syncEvents() {
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 15; // Slightly wider window for safety

    // 1. Fetch all collection addresses we are tracking from Supabase
    const { data: allCollections } = await supabase.from('collections').select('contract_address');
    
    for (const col of allCollections) {
      const addr = col.contract_address.toLowerCase();
      const nftContract = new ethers.Contract(addr, NFT_ABI, provider);

      // Watch Transfers for this specific collection
      const transfers = await nftContract.queryFilter("Transfer", fromBlock, currentBlock);
      for (const log of transfers) {
        await supabase.from('nfts').upsert({
          contract_address: addr,
          token_id: log.args.tokenId.toString(),
          owner_address: log.args.to.toLowerCase()
        });
        await updateCollectionStats(addr);
      }
    }

    // 2. Watch Marketplace Listings (Works for all collections automatically)
    const listings = await market.queryFilter("ItemListed", fromBlock, currentBlock);
    for (const log of listings) {
      const { nftAddress, tokenId, price } = log.args;
      await supabase.from('listings').upsert({
        contract_address: nftAddress.toLowerCase(),
        token_id: tokenId.toString(),
        price: ethers.formatEther(price),
        status: 'active'
      });
      await updateCollectionStats(nftAddress.toLowerCase());
    }
  } catch (err) {
    console.error("Sync Error:", err.message);
  }
}

console.log("🚀 Multi-Collection Indexer Active for Temponyan & Others...");
setInterval(syncEvents, 10000);
