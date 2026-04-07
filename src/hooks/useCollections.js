// hooks/useCollections.js
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * Fetch all collections, or a single collection by slug.
 *
 * Usage:
 *   const { collections, loading, error } = useCollections();
 *   const { collections, loading, error } = useCollections({ slug: 'temponyaw' });
 */
export function useCollections({ slug } = {}) {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState(null);

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
          .order('volume_total', { ascending: false });

        if (slug) {
          query = query.eq('slug', slug).single();
        }

        const { data, error: sbError } = await query;

        if (sbError) throw sbError;
        if (!cancelled) {
          // .single() returns an object, not an array
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
  }, [slug]);

  return { collections, loading, error };
}
