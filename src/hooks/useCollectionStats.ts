// hooks/useCollectionStats.ts
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export interface CollectionStats {
  totalSupply: number;
  uniqueOwners: number;
  floorPrice: number;
  listedCount: number;
}

export function useCollectionStats(contractAddress: string) {
  const [stats, setStats] = useState<CollectionStats>({
    totalSupply: 0,
    uniqueOwners: 0,
    floorPrice: 0,
    listedCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 1. Safety check for the address
    if (!contractAddress || contractAddress === 'undefined' || contractAddress === 'null') {
      setLoading(false);
      return;
    }
    
    async function fetch() {
      setLoading(true);
      setError(null);
      
      try {
        const { data, error: rpcError } = await supabase
          .rpc('get_collection_stats', {
            // 2. Force lowercase to match the DB rows exactly
            collection_address: contractAddress.toLowerCase()
          });
        
        if (rpcError) {
          throw new Error(rpcError.message);
        }
        
        // 3. RPC returns an array, so we grab data[0]
        if (data && Array.isArray(data) && data.length > 0) {
          const row = data[0];
          setStats({
            totalSupply: Number(row.total_supply) || 0,
            uniqueOwners: Number(row.unique_owners) || 0,
            floorPrice: Number(row.floor_price) || 0,
            listedCount: Number(row.listed_count) || 0
          });
        } else {
          // No data found — collection might not exist
          setStats({
            totalSupply: 0,
            uniqueOwners: 0,
            floorPrice: 0,
            listedCount: 0
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
