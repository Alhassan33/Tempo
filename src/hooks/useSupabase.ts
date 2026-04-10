import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface Collection {
  id: string;
  contract_address: string;
  name: string;
  slug: string;
  description: string;
  logo_url: string;
  banner_url: string;
  verified: boolean;
  floor_price: number;
  volume_total: number;
  volume_24h: number;
  total_sales: number;
  total_supply: number;
  owners: number;
}

export interface Project {
  id: string;
  name: string;
  contract_address: string;
  description: string;
  logo_url: string;
  banner_url: string;
  website: string;
  twitter: string;
  discord: string;
  mint_price: number;
  max_supply: number;
  mint_start_time: string;
  allowlist_active: boolean;
  allowlist_price: number;
  allowlist_start_time: string;
  payment_token: string;
  status: string;
  featured_order: number;
}

export interface Listing {
  id: string;
  listing_id: number;
  seller: string;
  nft_contract: string;
  token_id: number;
  price: number;
  active: boolean;
  created_at: string;
}

/ ─── NEW: Collection Stats Type ───────────────────────────────────────────────
export interface CollectionStats {
  totalSupply: number;
  uniqueOwners: number;
  floorPrice: number;
  listedCount: number;
}

// ─── 1. useCollections ────────────────────────────────────────────────────────
// Fetch all collections for the marketplace table
export function useCollections(sortBy: string = "volume_total") {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .order(sortBy, { ascending: false });

      if (error) setError(error.message);
      else setCollections(data || []);
      setIsLoading(false);
    }
    fetch();
  }, [sortBy]);

  return { collections, isLoading, error };
}

// ─── 2. useCollection ─────────────────────────────────────────────────────────
// Fetch a single collection by slug or contract address
export function useCollection(slugOrAddress: string) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugOrAddress) return;
    async function fetch() {
      setIsLoading(true);
      const isAddress = slugOrAddress.startsWith("0x");
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq(isAddress ? "contract_address" : "slug", slugOrAddress)
        .single();

      if (error) setError(error.message);
      else setCollection(data);
      setIsLoading(false);
    }
    fetch();
  }, [slugOrAddress]);

  return { collection, isLoading, error };
}

// ─── 3: useCollectionStats ──────────────────────────────────────────────────
// Fetch real-time stats (supply, owners, floor, listed) from RPC
export function useCollectionStats(contractAddress: string) {
  const [stats, setStats] = useState<CollectionStats>({
    totalSupply: 0,
    uniqueOwners: 0,
    floorPrice: 0,
    listedCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Safety check for invalid addresses
    if (!contractAddress || contractAddress === 'undefined' || contractAddress === 'null') {
      setIsLoading(false);
      return;
    }
    
    async function fetch() {
      setIsLoading(true);
      setError(null);
      
      try {
        const { data, error: rpcError } = await supabase
          .rpc('get_collection_stats', {
            // Force lowercase for consistent matching
            collection_address: contractAddress.toLowerCase()
          });
        
        if (rpcError) {
          throw new Error(rpcError.message);
        }
        
        // RPC returns an array, grab first row
        if (data && Array.isArray(data) && data.length > 0) {
          const row = data[0];
          setStats({
            totalSupply: Number(row.total_supply) || 0,
            uniqueOwners: Number(row.unique_owners) || 0,
            floorPrice: Number(row.floor_price) || 0,
            listedCount: Number(row.listed_count) || 0
          });
        } else {
          // No data found — reset to zeros
          setStats({
            totalSupply: 0,
            uniqueOwners: 0,
            floorPrice: 0,
            listedCount: 0
          });
        }
      } catch (err: any) {
        console.error('[useCollectionStats] Error:', err);
        setError(err.message || 'Failed to fetch collection stats');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetch();
  }, [contractAddress]);

  return { stats, isLoading, error };
}

// ─── 4. useFeaturedProjects ───────────────────────────────────────────────────
// Fetch featured/live projects for the launchpad page
export function useFeaturedProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .in("status", ["featured", "live", "approved"])
        .order("featured_order", { ascending: true });

      if (error) setError(error.message);
      else setProjects(data || []);
      setIsLoading(false);
    }
    fetch();
  }, []);

  return { projects, isLoading, error };
}

// ─── 5. useListings ──────────────────────────────────────────────────────────
// Fetch active listings WITH NFT metadata via our custom RPC
export function useListings(nftContract: string) {
  const [listings, setListings] = useState<any[]>([]); 
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nftContract || nftContract === 'undefined') return;
    
    async function fetch() {
      setIsLoading(true);
      try {
        // Use the RPC we built to join Listings + NFTs
        const { data, error: rpcError } = await supabase
          .rpc('get_active_listings_with_nfts');

        if (rpcError) throw rpcError;

        if (data) {
          // Filter by contract in the frontend (solves the case-sensitivity issue)
          const filtered = data.filter((item: any) => 
            item.nft_contract?.toLowerCase() === nftContract.toLowerCase()
          ).map((item: any) => ({
            ...item,
            nftAddress: item.nft_contract, // Consistency map
            displayPrice: (Number(item.price) / 1e6).toFixed(2),
          }));
            
          setListings(filtered);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }
    fetch();
  }, [nftContract]);

  return { listings, isLoading, error };
}

// ─── 6. useSubmitProject ──────────────────────────────────────────────────────
// Submit a launchpad application
export function useSubmitProject() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (form: Partial<Project>) => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);

    const { error } = await supabase
      .from("projects")
      .insert([{ ...form, status: "pending" }]);

    if (error) setError(error.message);
    else setIsSuccess(true);
    setIsLoading(false);
  };

  return { submit, isLoading, isSuccess, error };
}

// ─── 7. useAdminProjects ─────────────────────────────────────────────────────
// Fetch ALL projects for the admin/manage page (pending + all statuses)
export function useAdminProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetch() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("submitted_at", { ascending: false });

      if (error) setError(error.message);
      else setProjects(data || []);
      setIsLoading(false);
    }
    fetch();
  }, []);

  const updateStatus = async (
    id: string,
    status: string,
    notes?: string
  ) => {
    const { error } = await supabase
      .from("projects")
      .update({ status, notes, reviewed_at: new Date().toISOString() })
      .eq("id", id);

    if (!error) {
      setProjects((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status } : p))
      );
    }
    return { error };
  };

  const featureProject = async (id: string, order: number) => {
    const { error } = await supabase
      .from("projects")
      .update({ status: "featured", featured_order: order })
      .eq("id", id);

    if (!error) {
      setProjects((prev) =>
        prev.map((p) =>
          p.id === id ? { ...p, status: "featured", featured_order: order } : p
        )
      );
    }
    return { error };
  };

  return { projects, isLoading, error, updateStatus, featureProject };
}

// ─── 8. useRealtimeListings ───────────────────────────────────────────────────
// Subscribe to real-time listing updates for a collection
export function useRealtimeListings(nftContract: string) {
  const { listings, isLoading, error } = useListings(nftContract);
  const [liveListings, setLiveListings] = useState<Listing[]>([]);

  useEffect(() => {
    setLiveListings(listings);
  }, [listings]);

  useEffect(() => {
    if (!nftContract) return;

    const channel = supabase
      .channel(`listings:${nftContract}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "listings",
          filter: `nft_contract=eq.${nftContract}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLiveListings((prev) => [payload.new as Listing, ...prev]);
          }
          if (payload.eventType === "UPDATE") {
            setLiveListings((prev) =>
              prev.map((l) =>
                l.listing_id === (payload.new as Listing).listing_id
                  ? (payload.new as Listing)
                  : l
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [nftContract]);

  return { listings: liveListings, isLoading, error };
}