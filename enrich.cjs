// enrich.cjs
const { ethers } = require("ethers");
const { createClient } = require("@supabase/supabase-js");

const TEMPO_RPC = "https://rpc.tempo.xyz";
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_KEY env vars");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(TEMPO_RPC);
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Minimal ERC-721 ABI
const ERC721_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function tokenURI(uint256) view returns (string)",
  "function owner() view returns (address)",
];

function ipfsToHttp(uri) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return uri.replace("ipfs://", "https://gateway.lighthouse.storage/ipfs/");
  }
  return uri;
}

async function enrichCollection(contractAddress) {
  const addr = contractAddress.toLowerCase();
  
  try {
    // Check if already exists
    const { data: existing } = await supabase
      .from("collections")
      .select("contract_address")
      .eq("contract_address", addr)
      .single();
    
    if (existing) {
      console.log(`⚠️ ${addr} already in collections`);
      return;
    }

    const contract = new ethers.Contract(addr, ERC721_ABI, provider);

    // Read on-chain basics
    const [name, symbol, totalSupply] = await Promise.all([
      contract.name().catch(() => "Unknown Collection"),
      contract.symbol().catch(() => "NFT"),
      contract.totalSupply().catch(() => 0),
    ]);

    // Fetch token #1 metadata for logo/description
    let logoUrl = null;
    let description = null;
    let metadataBaseUri = "";
    
    if (Number(totalSupply) > 0) {
      try {
        const tokenURI = await contract.tokenURI(1);
        const httpUri = ipfsToHttp(tokenURI);
        
        // Derive base URI (e.g. ipfs://Qm.../1.json → ipfs://Qm.../)
        metadataBaseUri = tokenURI.replace(/\/\d+\.json$/, "/").replace(/1\.json$/, "");
        
        if (httpUri) {
          const metadata = await fetch(httpUri).then(r => r.json()).catch(() => null);
          if (metadata) {
            logoUrl = ipfsToHttp(metadata.image) || null;
            description = metadata.description || null;
          }
        }
      } catch (e) {
        console.log(`⚠️ No metadata for ${addr}`);
      }
    }

    // Try to get owner/creator
    let creatorWallet = null;
    try {
      creatorWallet = (await contract.owner()).toLowerCase();
    } catch (e) {
      // No owner() function
    }

    // Generate slug
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") + "-" + addr.slice(2, 6);

    // Insert into collections
    const { error } = await supabase.from("collections").insert({
      contract_address: addr,
      name: name.slice(0, 100),
      symbol: symbol.slice(0, 20),
      slug,
      description: description?.slice(0, 500) || null,
      logo_url: logoUrl,
      banner_url: null, // Usually not on-chain, manual upload later
      total_supply: Number(totalSupply),
      total_minted: Number(totalSupply),
      verified: false,
      floor_price: 0,
      volume_total: 0,
      volume_24h: 0,
      total_sales: 0,
      owners: 0,
      listed_count: 0,
      creator_wallet: creatorWallet,
      creator_name: creatorWallet 
        ? creatorWallet.slice(0, 6) + "…" + creatorWallet.slice(-4) 
        : "Unknown",
      metadata_base_uri: metadataBaseUri,
    });

    if (error) throw error;
    
    console.log(`✅ Enriched: ${name} (${symbol}) — ${addr}`);
    console.log(`   Logo: ${logoUrl || "none"}`);
    console.log(`   Base URI: ${metadataBaseUri || "none"}`);
    console.log(`   Supply: ${totalSupply}`);

  } catch (err) {
    console.error(`❌ Failed ${addr}:`, err.message);
  }
}

// CLI Usage
const args = process.argv.slice(2);

if (args.length === 0) {
  console.log("Usage: node enrich.cjs 0xContractAddress [0xAddress2 ...]");
  process.exit(1);
}

(async () => {
  for (const addr of args) {
    if (!addr.match(/^0x[a-fA-F0-9]{40}$/)) {
      console.error(`❌ Invalid address: ${addr}`);
      continue;
    }
    await enrichCollection(addr);
  }
  console.log("🏁 Done");
  process.exit(0);
})();
