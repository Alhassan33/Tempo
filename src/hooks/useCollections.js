// hooks/useCollections.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

export function useCollections({ slug, sortBy = 'volume_total' } = {}) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function fetch() {
      setLoading(true);
      setError(null);

      try {
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

        if (slug) {
          query = query.eq('slug', slug).single();
        }

        const { data, error: sbError } = await query;

        if (sbError) throw sbError;
        if (!cancelled) {
          setCollections(slug ? (data ? [data] : []) : (data ?? []));
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Failed to load collections');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetch();
    return () => { cancelled = true; };
  }, [slug, sortBy]);

  return { collections, loading, error };
}
