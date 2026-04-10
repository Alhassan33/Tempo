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
  // hooks/useCollections.js — MODE 1 fixed
if (fetchListings && slug) {
  const isAddress = slug.startsWith('0x');
  
  let contractAddress;
  
  if (isAddress) {
    contractAddress = slug.toLowerCase();
  } else {
    // Need to resolve slug to address first
    const { data: collection } = await supabase
      .from('collections')
      .select('contract_address')
      .eq('slug', slug)
      .single();
    
    if (!collection) {
      setCollections([]);
      setLoading(false);
      return;
    }
    
    contractAddress = collection.contract_address.toLowerCase();
  }

  // Now call RPC and filter by resolved address
  const { data, error: rpcError } = await supabase
    .rpc('get_active_listings_with_nfts');

  if (rpcError) throw rpcError;
  
  if (!cancelled && data && Array.isArray(data)) {
    const filtered = data.filter(item => 
      item.nft_contract?.toLowerCase() === contractAddress
    );
    
    const transformed = filtered.map(item => ({
      // ... mapping
    }));
    
    setCollections(transformed);
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
