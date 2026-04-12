// ─── DROP-IN REPLACEMENT for useListings in useSupabase.ts ──────────────────
// The bug: .eq("nft_contract", nftContract.toLowerCase()) fails when Supabase
// stores the address in checksummed form (mixed case). Use ilike instead.
//
// Also fixes useRealtimeListings realtime filter the same way.

export function useListings(nftContract: string) {
  const [listings, setListings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nftContract || nftContract === "undefined" || nftContract === "null") {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function fetch() {
      setIsLoading(true);
      setError(null);
      try {
        // ✅ ilike = case-insensitive — works regardless of how address was stored
        const { data, error: dbErr } = await supabase
          .from("listings")
          .select("*")
          .ilike("nft_contract", nftContract)  // ← was .eq(...toLowerCase())
          .eq("active", true)
          .order("price", { ascending: true });

        if (dbErr) throw dbErr;
        if (!cancelled) {
          setListings(
            (data || []).map((item: any) => ({
              ...item,
              // price stored as raw 6-decimal units — divide for display
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

// ─── useRealtimeListings — same ilike fix on the realtime channel ─────────────
export function useRealtimeListings(nftContract: string) {
  const { listings, isLoading, error } = useListings(nftContract);
  const [liveListings, setLiveListings] = useState<any[]>([]);

  useEffect(() => {
    setLiveListings(listings);
  }, [listings]);

  useEffect(() => {
    if (!nftContract) return;

    // Realtime channel — listens to ALL listing changes, then re-fetches
    // (filter on channel is unreliable with mixed case, so we filter client-side)
    const channel = supabase
      .channel(`listings:${nftContract.toLowerCase()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listings",
        },
        (payload) => {
          const row = payload.new as any;
          // Client-side filter — only care about our contract
          if (row?.nft_contract?.toLowerCase() !== nftContract?.toLowerCase()) return;

          if (payload.eventType === "INSERT" && row.active) {
            setLiveListings(prev => {
              // Don't duplicate
              const exists = prev.some(l => l.listing_id === row.listing_id);
              if (exists) return prev;
              const enriched = { ...row, displayPrice: (Number(row.price) / 1e6).toFixed(2) };
              return [...prev, enriched].sort((a, b) => Number(a.price) - Number(b.price));
            });
          }

          if (payload.eventType === "UPDATE") {
            setLiveListings(prev =>
              prev
                .map(l => l.listing_id === row.listing_id
                  ? { ...row, displayPrice: (Number(row.price) / 1e6).toFixed(2) }
                  : l
                )
                .filter(l => l.active) // remove if deactivated
                .sort((a, b) => Number(a.price) - Number(b.price))
            );
          }

          if (payload.eventType === "DELETE") {
            setLiveListings(prev => prev.filter(l => l.listing_id !== (payload.old as any).listing_id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [nftContract]);

  return { listings: liveListings, isLoading, error };
}
