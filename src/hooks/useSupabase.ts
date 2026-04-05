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

// ─── 3. useFeaturedProjects ───────────────────────────────────────────────────
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

// ─── 4. useListings ──────────────────────────────────────────────────────────
// Fetch active listings for a specific NFT contract
export function useListings(nftContract: string) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nftContract) return;
    async function fetch() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("listings")
        .select("*")
        .eq("nft_contract", nftContract)
        .eq("active", true)
        .order("price", { ascending: true });

      if (error) setError(error.message);
      else setListings(data || []);
      setIsLoading(false);
    }
    fetch();
  }, [nftContract]);

  return { listings, isLoading, error };
}

// ─── 5. useSubmitProject ──────────────────────────────────────────────────────
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

// ─── 6. useAdminProjects ─────────────────────────────────────────────────────
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

// ─── 7. useRealtimeListings ───────────────────────────────────────────────────
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
