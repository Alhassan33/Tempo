// hooks/useListings.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Fetch active listings, optionally filtered by contract or seller.
 *
 * Usage:
 *   const { listings, loading, error } = useListings();
 *   const { listings, loading, error } = useListings({ nftContract: '0x...' });
 *   const { listings, loading, error } = useListings({ seller: '0x...' });
 *   const { listings, loading, error } = useListings({ nftContract: '0x...', activeOnly: false });
 */
export function useListings({ nftContract, seller, activeOnly = true, limit = 50 } = {}) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from('listings')
          .select(`
            id,
            listing_id,
            seller,
            nft_contract,
            token_id,
            price,
            active,
            tx_hash,
            block_number,
            created_at,
            updated_at
          `)
          .order('created_at', { ascending: false })
          .limit(limit);

        if (activeOnly) {
          query = query.eq('active', true);
        }

        if (nftContract) {
          query = query.eq('nft_contract', nftContract.toLowerCase());
        }

        if (seller) {
          query = query.eq('seller', seller.toLowerCase());
        }

        const { data, error: sbError } = await query;

        if (sbError) throw sbError;
        if (!cancelled) setListings(data ?? []);
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Failed to load listings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [nftContract, seller, activeOnly, limit]);

  return { listings, loading, error };
}
