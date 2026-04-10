import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

// 1. Updated Interface to include Volume and Royalties
export interface CollectionStats {
  totalSupply: number;
  uniqueOwners: number;
  floorPrice: number;
  listedCount: number;
  volume24h: number;    // Added
  volumeTotal: number;  // Added
  royaltyBps: number;   // Added
}

export function useCollectionStats(contractAddress: string) {
  const [stats, setStats] = useState<CollectionStats>({
    totalSupply: 0,
    uniqueOwners: 0,
    floorPrice: 0,
    listedCount: 0,
    volume24h: 0,
    volumeTotal: 0,
    royaltyBps: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractAddress || contractAddress === 'undefined' || contractAddress === 'null') {
      setLoading(false);
      return;
    }
    
    async function fetch() {
      setLoading(true);
      setError(null);
      
      try {
        // 2. The RPC call stays the same, but we will now map more fields from the response
        const { data, error: rpcError } = await supabase
          .rpc('get_collection_stats', {
            collection_address: contractAddress.toLowerCase()
          });
        
        if (rpcError) {
          throw new Error(rpcError.message);
        }
        
        if (data && Array.isArray(data) && data.length > 0) {
          const row = data[0];
          
          setStats({
            totalSupply: Number(row.total_supply) || 0,
            uniqueOwners: Number(row.unique_owners) || 0,
            floorPrice: Number(row.floor_price) || 0,
            listedCount: Number(row.listed_count) || 0,
            // 3. Map the volume and royalty fields from your Supabase table columns
            volume24h: Number(row.volume_24h) || 0,
            volumeTotal: Number(row.volume_total) || 0,
            royaltyBps: Number(row.royalty_bps) || 0
          });
        } else {
          setStats({
            totalSupply: 0,
            uniqueOwners: 0,
            floorPrice: 0,
            listedCount: 0,
            volume24h: 0,
            volumeTotal: 0,
            royaltyBps: 0
          });
        }
      } catch (err: any) {
        console.error('[useCollectionStats] Error:', err);
        setError(err.message || 'Failed to fetch collection stats');
      } finally {
        setLoading(false);
      }
    }
    
    fetch();
  }, [contractAddress]);

  return { stats, loading, error };
}
