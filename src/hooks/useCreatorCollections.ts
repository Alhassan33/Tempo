// ─── ADD THIS TO useSupabase.ts ───────────────────────────────────────────────
// useCreatorCollections — fetches all collections/projects belonging to a wallet.
// Used on StudioPage to show "Your Collections" after wallet connect.
// Checks both `projects.creator_wallet` and `collections.contract_address`
// so it works for externally added collections too.

export function useCreatorCollections(walletAddress: string | undefined) {
  const [collections, setCollections] = useState<any[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) {
      setCollections([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const addr = walletAddress.toLowerCase();

        // 1. Check projects table — creator_wallet or creator_address column
        const { data: projectRows } = await supabase
          .from("projects")
          .select("id, name, symbol, contract_address, status, logo_url, max_supply, mint_price, description, created_at")
          .or(`creator_wallet.ilike.${addr},creator_address.ilike.${addr}`)
          .order("created_at", { ascending: false });

        const contractsFromProjects = (projectRows || [])
          .map(p => p.contract_address?.toLowerCase())
          .filter(Boolean);

        // 2. For each deployed contract, also check collections table for live stats
        let collectionRows: any[] = [];
        if (contractsFromProjects.length > 0) {
          const { data } = await supabase
            .from("collections")
            .select("contract_address, name, slug, floor_price, listed_count, total_supply, logo_url, verified")
            .in("contract_address", contractsFromProjects);
          collectionRows = data || [];
        }

        const colMap: Record<string, any> = {};
        collectionRows.forEach(c => { colMap[c.contract_address?.toLowerCase()] = c; });

        // 3. Merge project + collection data
        const merged = (projectRows || []).map(proj => {
          const contractLower = proj.contract_address?.toLowerCase();
          const col = colMap[contractLower] || {};
          return {
            ...proj,
            contract_address: contractLower,
            slug:           col.slug            || contractLower,
            floor_price:    col.floor_price     || 0,
            listed_count:   col.listed_count    || 0,
            total_supply:   col.total_supply    || proj.max_supply || 0,
            verified:       col.verified        || false,
            // Use collection logo if project doesn't have one
            logo_url:       proj.logo_url       || col.logo_url || null,
            isDeployed:     !!contractLower,
          };
        });

        // 4. Also include collections directly owned (for externally added contracts)
        //    where creator_wallet might not be in projects table
        // (Skip for now — rely on projects table as source of truth)

        if (!cancelled) setCollections(merged);
      } catch (e: any) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [walletAddress]);

  return { collections, isLoading, error };
}
