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
  try {
    const addr = nftAddress.toLowerCase();

    // 1. Fetch current collection settings from DB (Supply, Royalties, etc.)
    const { data: colData } = await supabase
      .from('collections')
      .select('total_supply, royalties')
      .eq('contract_address', addr)
      .single();

    if (!colData) return;

    // 2. Get live Floor Price
    const { data: floorData } = await supabase
      .from('listings')
      .select('price')
      .eq('contract_address', addr)
      .eq('status', 'active')
      .order('price', { ascending: true })
      .limit(1);

    const floor = floorData?.[0]?.price || 0;

    // 3. Calculate Unique Owners
    const { data: ownerData } = await supabase
      .from('nfts')
      .select('owner_address')
      .eq('contract_address', addr);
    
    const uniqueOwners = new Set(ownerData?.map(o => o.owner_address)).size;

    // 4. Update Supabase using the settings found in the DB
    await supabase
      .from('collections')
      .update({ 
        floor_price: floor, 
        owners: uniqueOwners,
        // We keep royalties and supply synced with what's already in the DB
        royalties: colData.royalties,
        total_supply: colData.total_supply 
      })
      .eq('contract_address', addr);
      
    console.log(`✅ ${addr} | Floor: ${floor} | Owners: ${uniqueOwners} | Supply: ${colData.total_supply}`);
  } catch (err) {
    console.error("❌ Stats Error:", err.message);
  }
}

async function syncEvents() {
  try {
    const currentBlock = await provider.getBlockNumber();
    const fromBlock = currentBlock - 15;
    console.log(`🔎 Scanning blocks ${fromBlock} to ${currentBlock}...`);

    const { data: allCollections } = await supabase.from('collections').select('contract_address');
    
    if (!allCollections) return;

    for (const col of allCollections) {
      const addr = col.contract_address.toLowerCase();
      const nftContract = new ethers.Contract(addr, NFT_ABI, provider);

      const transfers = await nftContract.queryFilter("Transfer", fromBlock, currentBlock);
      if (transfers.length > 0) {
        for (const log of transfers) {
          await supabase.from('nfts').upsert({
            contract_address: addr,
            token_id: log.args.tokenId.toString(),
            owner_address: log.args.to.toLowerCase()
          });
        }
        await updateCollectionStats(addr);
      }
    }

    const listings = await market.queryFilter("ItemListed", fromBlock, currentBlock);
    if (listings.length > 0) {
      for (const log of listings) {
        const nftAddr = log.args.nftAddress.toLowerCase();
        await supabase.from('listings').upsert({
          contract_address: nftAddr,
          token_id: log.args.tokenId.toString(),
          price: ethers.formatEther(log.args.price),
          status: 'active'
        });
        await updateCollectionStats(nftAddr);
      }
    }
  } catch (err) {
    console.error("❌ Sync Error:", err.message);
  }
}

console.log("🚀 Multi-Collection Dynamic Indexer Online");
setInterval(syncEvents, 10000);
