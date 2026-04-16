// hooks/useCollectionStats.ts
// Reads live stats from Supabase: floor from listings, volume from sales.
// This is what populates the stats cards on CollectionPage.

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface CollectionStats {
  floorPrice:    number | null;
  totalVolume:   number;
  volume24h:     number;
  totalSales:    number;
  sales24h:      number;
  listedCount:   number;
  owners:        number;
  totalSupply:   number;
  marketCap:     number | null;
}

const EMPTY: CollectionStats = {
  floorPrice: null, totalVolume: 0, volume24h: 0,
  totalSales: 0, sales24h: 0, listedCount: 0,
  owners: 0, totalSupply: 0, marketCap: null,
};

export function useCollectionStats(nftContract: string) {
  const [stats,   setStats]   = useState<CollectionStats>(EMPTY);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!nftContract) return;
    let cancelled = false;
    setLoading(true);

    async function load() {
      try {
        const since24h = new Date(Date.now() - 86_400_000).toISOString();

        // Run all queries in parallel
        const [
          { data: floorRow },
          { count: listed },
          { data: allSales },
          { data: sales24hData },
          { count: ownerCount },
          { data: colRow },
        ] = await Promise.all([
          // Floor price = lowest active listing
          supabase.from("listings")
            .select("price")
            .ilike("nft_contract", nftContract)
            .eq("active", true)
            .order("price", { ascending: true })
            .limit(1),

          // Listed count
          supabase.from("listings")
            .select("*", { count: "exact", head: true })
            .ilike("nft_contract", nftContract)
            .eq("active", true),

          // All sales (for total volume)
          supabase.from("sales")
            .select("price")
            .ilike("nft_contract", nftContract),

          // 24h sales
          supabase.from("sales")
            .select("price")
            .ilike("nft_contract", nftContract)
            .gte("sold_at", since24h),

          // Unique owners
          supabase.from("nfts")
            .select("owner_address", { count: "exact", head: true })
            .ilike("contract_address", nftContract)
            .neq("owner_address", "0x0000000000000000000000000000000000000000"),

          // Collection metadata
          supabase.from("collections")
            .select("total_supply, floor_price")
            .ilike("contract_address", nftContract)
            .single(),
        ]);

        const floorRaw    = floorRow?.[0]?.price ?? null;
        const totalVolRaw = (allSales || []).reduce((s, r) => s + Number(r.price || 0), 0);
        const vol24hRaw   = (sales24hData || []).reduce((s, r) => s + Number(r.price || 0), 0);
        const supply      = colRow?.total_supply || 0;
        const marketCap   = floorRaw && supply ? Number(floorRaw) * supply : null;

        if (!cancelled) {
          setStats({
            floorPrice:  floorRaw,
            totalVolume: totalVolRaw,
            volume24h:   vol24hRaw,
            totalSales:  (allSales || []).length,
            sales24h:    (sales24hData || []).length,
            listedCount: listed || 0,
            owners:      ownerCount || 0,
            totalSupply: supply,
            marketCap,
          });
        }
      } catch (e) {
        console.error("[useCollectionStats]", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [nftContract]);

  return { stats, loading };
}
