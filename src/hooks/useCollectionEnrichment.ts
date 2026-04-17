// hooks/useCollectionEnrichment.ts
import { usePublicClient } from "wagmi";
import { supabase } from "@/lib/supabase";

const ERC721_ABI = [
  { name: "name", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "symbol", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { name: "totalSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "tokenURI", type: "function", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "string" }] },
  { name: "supportsInterface", type: "function", stateMutability: "view", inputs: [{ type: "bytes4" }], outputs: [{ type: "bool" }] },
];

const ERC721_ENUMERABLE_INTERFACE = "0x780e9d63";

export async function enrichCollection(contractAddress: string) {
  const publicClient = usePublicClient(); // Or pass it in
  
  try {
    // 1. Read basic info
    const [name, symbol, totalSupply] = await Promise.all([
      publicClient.readContract({ address: contractAddress, abi: ERC721_ABI, functionName: "name" }),
      publicClient.readContract({ address: contractAddress, abi: ERC721_ABI, functionName: "symbol" }),
      publicClient.readContract({ address: contractAddress, abi: ERC721_ABI, functionName: "totalSupply" }).catch(() => 0n),
    ]);

    // 2. Check if Enumerable (has tokenByIndex)
    const isEnumerable = await publicClient.readContract({
      address: contractAddress,
      abi: ERC721_ABI,
      functionName: "supportsInterface",
      args: [ERC721_ENUMERABLE_INTERFACE],
    }).catch(() => false);

    // 3. Get token #1 metadata to extract logo/image
    let logoUrl = null;
    let bannerUrl = null;
    let description = null;
    
    if (totalSupply > 0n) {
      const tokenURI = await publicClient.readContract({
        address: contractAddress,
        abi: ERC721_ABI,
        functionName: "tokenURI",
        args: [1n],
      });
      
      // Fetch metadata JSON
      const metadataUrl = tokenURI.replace("ipfs://", "https://ipfs.io/ipfs/");
      const metadata = await fetch(metadataUrl).then(r => r.json()).catch(() => null);
      
      logoUrl = metadata?.image?.replace("ipfs://", "https://ipfs.io/ipfs/") || null;
      description = metadata?.description || null;
      // banner usually isn't in metadata, but you could check animation_url or other fields
    }

    // 4. Insert into your collections table
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + contractAddress.slice(2, 6);
    
    const { error } = await supabase.from("collections").upsert({
      contract_address: contractAddress.toLowerCase(),
      name,
      symbol,
      slug,
      description,
      logo_url: logoUrl,
      total_supply: Number(totalSupply),
      total_minted: Number(totalSupply), // If you can't enumerate, assume all minted
      verified: false,
      creator_name: "Unknown", // Could try to derive from first minter event
      metadata_base_uri: "", // Could derive from tokenURI pattern
    }, { onConflict: "contract_address" });

    return { success: !error, error };
  } catch (e) {
    console.error("Enrichment failed:", e);
    return { success: false, error: e };
  }
}
