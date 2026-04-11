// useListings hook - FIXED VERSION
// Replace the entire useListings function in useSupabase.ts with this

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Fetches active listings for a specific NFT contract
 * Prices are returned in both raw units (for contract calls) and display format (for UI)
 * 
 * DB stores: 25000000 (raw 6-decimal units = $25.00)
 * UI shows:  "25.00 USD"
 */
export function useListings(nftContract: string) {
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nftContract || nftContract === 'undefined' || nftContract === 'null') {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      setError(null);
      try {
        const { data, error: dbErr } = await supabase
          .from("listings")
          .select("*")
          .eq("nft_contract", nftContract.toLowerCase())
          .eq("active", true)
          .order("price", { ascending: true });

        if (dbErr) throw dbErr;
        
        if (!cancelled) {
          setListings(
            (data || []).map((item: any) => ({
              ...item,
              // CRITICAL FIX: Divide by 1e6 to convert raw units to display USD
              // DB stores 25000000 (atomic units), UI shows 25.00 USD
              displayPrice: (Number(item.price) / 1e6).toFixed(2),
            }))
          );
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [nftContract]);

  return { listings, isLoading, error };
}
