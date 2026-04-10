// hooks/useCollections.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useCollections({ 
  slug, 
  sortBy = 'created_at',
  fetchListings = false 
} = {}) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        // ─── MODE 1: Fetch active listings via RPC (for Items tab) ────────────
        if (fetchListings && slug) {
          const isAddress = slug.startsWith('0x');
          
          // Call RPC with NO parameters (function returns all active listings)
          const { data, error: rpcError } = await supabase
            .rpc('get_active_listings_with_nfts'); // ← NO arguments!

          if (rpcError) throw rpcError;
          
          if (!cancelled && data && Array.isArray(data)) {
            // Filter in JavaScript by matching address (case-insensitive)
            const normalizedSlug = isAddress ? slug.toLowerCase() : slug;
            
            const filtered = data.filter(item => {
              if (isAddress) {
                return item.nft_contract?.toLowerCase() === normalizedSlug;
              }
              // If you have collection_slug in the RPC result, filter by that
              // Otherwise, you'd need to join with collections table
              return item.collection_slug === normalizedSlug;
            });

            // Transform to match your UI expectations
            const transformed = filtered.map(item => ({
              id: item.id,
              listingId: String(item.listing_id),
              seller: item.seller,
              nftAddress: item.nft_contract,
              tokenId: String(item.token_id),
              price: String(item.price),
              displayPrice: (Number(item.price) / 1e6).toFixed(2),
              active: item.active,
              name: item.name,
              image: item.image,
              metadata: item.metadata,
              rarityRank: item.rarity_rank,
              createdAt: item.created_at
            }));
            
            setCollections(transformed);
          } else {
            setCollections([]);
          }
        } 
        // ─── MODE 2: Fetch collections table (for dashboard/grid) ───────────
        else {
          let query = supabase
            .from('collections')
            .select(`
              id,
              contract_address,
              name,
              slug,
              description,
              logo_url,
              banner_url,
              verified,
              floor_price,
              volume_total,
              volume_24h,
              total_sales,
              total_supply,
              owners,
              created_at
            `)
            .order(sortBy, { ascending: false });

          // Case-insensitive slug/address lookup
          if (slug) {
            const isAddress = slug.startsWith('0x');
            if (isAddress) {
              query = query.ilike('contract_address', slug);
            } else {
              query = query.eq('slug', slug);
            }
            query = query.single();
          }

          const { data, error: sbError } = await query;

          if (sbError) throw sbError;
          if (!cancelled) {
            setCollections(slug ? (data ? [data] : []) : (data ?? []));
          }
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Failed to load collections');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [slug, sortBy, fetchListings]);

  return { collections, loading, error };
}
