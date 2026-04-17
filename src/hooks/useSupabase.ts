/**
 * hooks/useSupabase.ts
 * 
 * FIXED VERSION - Addresses:
 * 1. Proper Supabase .or() syntax for multiple column filters
 * 2. Added total_minted to queries
 * 3. Better error handling
 */

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
  floor_price: number;        // raw 6-decimal units e.g. 25000000 = $25.00
  volume_total: number;       // raw 6-decimal units
  volume_24h: number;         // raw 6-decimal units
  total_sales: number;
  total_supply: number;
  total_minted: number;
  owners: number;
  listed_count: number;
  market_cap: number;
  top_offer: number;
  royalty_bps: number;
  creator_name: string;
  creator_wallet: string;
  twitter_url: string;
  website_url: string;
  metadata_base_uri: string;
}

export interface Project {
  id: string;
  name: string;
  symbol: string;
  contract_address: string;
  description: string;
  logo_url: string;
  banner_url: string;
  website: string;
  twitter: string;
  discord: string;
  mint_price: number;
  max_supply: number;
  total_minted: number;
  mint_start_time: string;
  allowlist_active: boolean;
  allowlist_price: number;
  allowlist_start_time: string;
  payment_token: string;
  status: string;
  featured_order: number;
  creator_wallet: string;
  creator_address: string;
  base_uri: string;
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
  name?: string;
  image?: string;
  displayPrice?: string;
}

export interface CollectionStats {
  totalSupply: number;
  uniqueOwners: number;
  floorPrice: number;
  listedCount: number;
  volume24h: number;
  royalties: number;
  volumeTotal: number;
}

// ─── 1. useCollections ────────────────────────────────────────────────────────
export function useCollections(sortBy: string = "volume_total") {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const { data, error: dbError } = await supabase
          .from("collections")
          .select("*")
          .order(sortBy, { ascending: false });
        
        if (dbError) throw dbError;
        setCollections(data || []);
      } catch (err: any) {
        setError(err.message || "Failed to fetch collections");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [sortBy]);

  return { collections, isLoading, error };
}

// ─── 2. useCollection ─────────────────────────────────────────────────────────
export function useCollection(slugOrAddress: string) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugOrAddress) {
      setIsLoading(false);
      return;
    }
    
    async function load() {
      setIsLoading(true);
      try {
        const isAddress = slugOrAddress.startsWith("0x");
        const value = isAddress ? slugOrAddress.toLowerCase() : slugOrAddress;
        
        const { data, error: dbError } = await supabase
          .from("collections")
          .select("*")
          .eq(isAddress ? "contract_address" : "slug", value)
          .single();
        
        if (dbError) throw dbError;
        setCollection(data);
      } catch (err: any) {
        setError(err.message || "Failed to fetch collection");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [slugOrAddress]);

  return { collection, isLoading, error };
}

// ─── 3. useCollectionStats ────────────────────────────────────────────────────
export function useCollectionStats(contractAddress: string) {
  const [stats, setStats] = useState<CollectionStats>({
    totalSupply: 0,
    uniqueOwners: 0,
    floorPrice: 0,
    listedCount: 0,
    volume24h: 0,
    royalties: 0,
    volumeTotal: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractAddress || contractAddress === "undefined" || contractAddress === "null") {
      setIsLoading(false);
      return;
    }

    async function load() {
      setIsLoading(true);
      setError(null);

      try {
        // Try RPC first
        const { data: rpcData, error: rpcError } = await supabase
          .rpc("get_collection_stats", { collection_address: contractAddress.toLowerCase() });

        if (!rpcError && rpcData && Array.isArray(rpcData) && rpcData.length > 0) {
          const row = rpcData[0];
          setStats({
            totalSupply: Number(row.total_supply) || 0,
            uniqueOwners: Number(row.unique_owners) || 0,
            floorPrice: Number(row.floor_price) || 0,
            listedCount: Number(row.listed_count) || 0,
            volume24h: Number(row.volume_24h) || 0,
            royalties: Number(row.royalty_bps) || 0,
            volumeTotal: Number(row.volume_total) || 0,
          });
          setIsLoading(false);
          return;
        }
      } catch {
        // RPC failed, continue to fallback
      }

      // Fallback: direct table read
      try {
        const { data: col, error: colErr } = await supabase
          .from("collections")
          .select("total_supply, owners, floor_price, listed_count, volume_24h, royalty_bps, volume_total, total_minted")
          .eq("contract_address", contractAddress.toLowerCase())
          .single();

        if (colErr) throw colErr;

        setStats({
          totalSupply: Number(col?.total_supply) || 0,
          uniqueOwners: Number(col?.owners) || 0,
          floorPrice: Number(col?.floor_price) || 0,
          listedCount: Number(col?.listed_count) || 0,
          volume24h: Number(col?.volume_24h) || 0,
          royalties: Number(col?.royalty_bps) || 0,
          volumeTotal: Number(col?.volume_total) || 0,
        });
      } catch (err: any) {
        console.error("[useCollectionStats] fallback error:", err);
        setError(err.message || "Failed to fetch collection stats");
      } finally {
        setIsLoading(false);
      }
    }

    load();
  }, [contractAddress]);

  return { stats, isLoading, error };
}

// ─── 4. useFeaturedProjects ───────────────────────────────────────────────────
export function useFeaturedProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const { data, error: dbError } = await supabase
          .from("projects")
          .select("*")
          .in("status", ["featured", "live", "approved"])
          .order("featured_order", { ascending: true });
        
        if (dbError) throw dbError;
        setProjects(data || []);
      } catch (err: any) {
        setError(err.message || "Failed to fetch featured projects");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  return { projects, isLoading, error };
}

// ─── 5. useListings ──────────────────────────────────────────────────────────
export function useListings(nftContract: string) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!nftContract || nftContract === "undefined" || nftContract === "null") {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
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

    load();
    return () => { cancelled = true; };
  }, [nftContract]);

  return { listings, isLoading, error };
}

// ─── 6. useSubmitProject ──────────────────────────────────────────────────────
export function useSubmitProject() {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (form: Partial<Project>) => {
    setIsLoading(true);
    setError(null);
    setIsSuccess(false);
    
    try {
      const { error: dbError } = await supabase
        .from("projects")
        .insert([{ ...form, status: "pending" }]);
      
      if (dbError) throw dbError;
      setIsSuccess(true);
    } catch (err: any) {
      setError(err.message || "Failed to submit project");
    } finally {
      setIsLoading(false);
    }
  };

  return { submit, isLoading, isSuccess, error };
}

// ─── 7. useAdminProjects ─────────────────────────────────────────────────────
export function useAdminProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const { data, error: dbError } = await supabase
          .from("projects")
          .select("*")
          .order("submitted_at", { ascending: false });
        
        if (dbError) throw dbError;
        setProjects(data || []);
      } catch (err: any) {
        setError(err.message || "Failed to fetch admin projects");
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const updateStatus = async (id: string, status: string, notes?: string) => {
    try {
      const { error: dbError } = await supabase
        .from("projects")
        .update({ status, notes, reviewed_at: new Date().toISOString() })
        .eq("id", id);
      
      if (dbError) throw dbError;
      
      setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  const featureProject = async (id: string, order: number) => {
    try {
      const { error: dbError } = await supabase
        .from("projects")
        .update({ status: "featured", featured_order: order })
        .eq("id", id);
      
      if (dbError) throw dbError;
      
      setProjects(prev => prev.map(p => 
        p.id === id ? { ...p, status: "featured", featured_order: order } : p
      ));
      return { error: null };
    } catch (err: any) {
      return { error: err };
    }
  };

  return { projects, isLoading, error, updateStatus, featureProject };
}

// ─── 8. useRealtimeListings ───────────────────────────────────────────────────
export function useRealtimeListings(nftContract: string) {
  const { listings, isLoading, error } = useListings(nftContract);
  const [liveListings, setLiveListings] = useState<Listing[]>([]);

  useEffect(() => {
    setLiveListings(listings);
  }, [listings]);

  useEffect(() => {
    if (!nftContract || nftContract === "undefined" || nftContract === "null") return;
    const addr = nftContract.toLowerCase();

    const channel = supabase
      .channel(`listings:${addr}`)
      .on("postgres_changes", {
        event: "*", 
        schema: "public", 
        table: "listings",
        filter: `nft_contract=eq.${addr}`,
      }, (payload) => {
        const row = payload.new as any;
        const enriched = row ? {
          ...row,
          displayPrice: (Number(row.price) / 1e6).toFixed(2),
        } : null;

        if (payload.eventType === "INSERT" && enriched?.active) {
          setLiveListings(prev => [enriched, ...prev]);
        }

        if (payload.eventType === "UPDATE") {
          setLiveListings(prev => {
            if (!enriched?.active) {
              return prev.filter(l => l.listing_id !== enriched.listing_id);
            }
            const exists = prev.some(l => l.listing_id === enriched.listing_id);
            return exists
              ? prev.map(l => l.listing_id === enriched.listing_id ? enriched : l)
              : [enriched, ...prev];
          });
        }

        if (payload.eventType === "DELETE") {
          const old = payload.old as any;
          if (old?.listing_id) {
            setLiveListings(prev => prev.filter(l => l.listing_id !== old.listing_id));
          }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [nftContract]);

  return { listings: liveListings, isLoading, error };
}

// ─── 9. useCreatorCollections ─────────────────────────────────────────────────
// FIXED: Proper Supabase .or() syntax and added total_minted
export function useCreatorCollections(walletAddress: string | undefined) {
  const [collections, setCollections] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

        // FIXED: Use proper PostgREST or syntax - comma separated, no spaces around commas
        // Format: column.ilike.value,column2.ilike.value2
        const { data: projectRows, error: projectError } = await supabase
          .from("projects")
          .select("id, name, symbol, contract_address, status, logo_url, banner_url, max_supply, mint_price, description, created_at, total_minted, creator_wallet")
          .or(`creator_wallet.ilike.${addr},creator_address.ilike.${addr}`)
          .order("created_at", { ascending: false });

        if (projectError) {
          console.error("[useCreatorCollections] Project query error:", projectError);
          throw projectError;
        }

        const contractsFromProjects = (projectRows || [])
          .map(p => p.contract_address?.toLowerCase())
          .filter(Boolean);

        // 2. For each deployed contract, fetch live stats from collections table
        let collectionRows: any[] = [];
        if (contractsFromProjects.length > 0) {
          const { data, error: colError } = await supabase
            .from("collections")
            .select("contract_address, name, slug, floor_price, listed_count, total_supply, total_minted, logo_url, banner_url, verified")
            .in("contract_address", contractsFromProjects);
          
          if (colError) {
            console.error("[useCreatorCollections] Collection query error:", colError);
          }
          collectionRows = data || [];
        }

        // Build a lookup map by contract address
        const colMap: Record<string, any> = {};
        collectionRows.forEach(c => {
          colMap[c.contract_address?.toLowerCase()] = c;
        });

        // 3. Merge — project is source of truth for metadata,
        //    collections table provides live marketplace stats
        const merged = (projectRows || []).map(proj => {
          const contractLower = proj.contract_address?.toLowerCase();
          const col = colMap[contractLower] || {};
          
          return {
            ...proj,
            contract_address: contractLower,
            slug: col.slug || contractLower?.slice(0, 12) || "",
            floor_price: col.floor_price || 0,
            listed_count: col.listed_count || 0,
            total_supply: col.total_supply || proj.max_supply || 0,
            total_minted: col.total_minted || proj.total_minted || 0,
            verified: col.verified || false,
            logo_url: proj.logo_url || col.logo_url || null,
            banner_url: proj.banner_url || col.banner_url || null,
            isDeployed: !!contractLower,
          };
        });

        if (!cancelled) setCollections(merged);
      } catch (e: any) {
        console.error("[useCreatorCollections] Error:", e);
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
