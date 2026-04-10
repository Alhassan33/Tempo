// ─── REPLACEMENT for useListings in useSupabase.ts ───────────────────────────
// Replace the entire useListings function (lines ~213-252) with this.
// Removes the broken get_active_listings_with_nfts RPC call.
// Queries the listings table directly — simple, reliable, no Supabase function needed.

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
              displayPrice: Number(item.price).toFixed(2),
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
