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
  floor_price: number;   // raw 6-decimal units e.g. 25000000 = $25.00
  volume_total: number;  // raw 6-decimal units
  volume_24h: number;    // raw 6-decimal units
  total_sales: number;
  total_supply: number;
  owners: number;
  listed_count: number;
  market_cap: number;
  top_offer: number;
  royalty_bps: number;
  creator_name: string;
  twitter_url: string;
  website_url: string;
  metadata_base_uri: string;
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
  price: number;         // raw 6-decimal units e.g. 25000000 = $25.00
  active: boolean;
  created_at: string;
  name?: string;
  image?: string;
  displayPrice?: string; // computed: price / 1e6
}

export interface CollectionStats {
  totalSupply: number;
  uniqueOwners: number;
  floorPrice: number;    // raw 6-decimal units
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
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .order(sortBy, { ascending: false });
      if (error) setError(error.message);
      else setCollections(data || []);
      setIsLoading(false);
    }
    load();
  }, [sortBy]);

  return { collections, isLoading, error };
}

// ─── 2. useCollection ─────────────────────────────────────────────────────────
// Accepts slug or 0x address. Forces lowercase on address lookups.
export function useCollection(slugOrAddress: string) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugOrAddress) return;
    async function load() {
      setIsLoading(true);
      const isAddress = slugOrAddress.startsWith("0x");
      // ✅ Always lowercase contract address before querying
      const value = isAddress ? slugOrAddress.toLowerCase() : slugOrAddress;
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq(isAddress ? "contract_address" : "slug", value)
        .single();
      if (error) setError(error.message);
      else setCollection(data);
      setIsLoading(false);
    }
    load();
  }, [slugOrAddress]);

  return { collection, isLoading, error };
}

// ─── 3. useCollectionStats ────────────────────────────────────────────────────
// Reads directly from collections table — no RPC dependency.
// Falls back gracefully if get_collection_stats RPC doesn't exist.
export function useCollectionStats(contractAddress: string) {
  const [stats, setStats] = useState<CollectionStats>({
    totalSupply:  0,
    uniqueOwners: 0,
    floorPrice:   0,
    listedCount:  0,
    volume24h:    0,
    royalties:    0,
    volumeTotal:  0,
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

      // First try the RPC if it exists, fall back to direct table read
      try {
        const { data, error: rpcError } = await supabase
          .rpc("get_collection_stats", {
            collection_address: contractAddress.toLowerCase(),
          });

        if (!rpcError && data && Array.isArray(data) && data.length > 0) {
          const row = data[0];
          setStats({
            totalSupply:  Number(row.total_supply)  || 0,
            uniqueOwners: Number(row.unique_owners) || 0,
            floorPrice:   Number(row.floor_price)   || 0,
            listedCount:  Number(row.listed_count)  || 0,
            volume24h:    Number(row.volume_24h)     || 0,
            royalties:    Number(row.royalty_bps)    || 0,
            volumeTotal:  Number(row.volume_total)   || 0,
          });
          setIsLoading(false);
          return;
        }
      } catch {}

      // Fallback: read directly from collections table
      try {
        const { data: col, error: colErr } = await supabase
          .from("collections")
          .select("total_supply, owners, floor_price, listed_count, volume_24h, royalty_bps, volume_total")
          .eq("contract_address", contractAddress.toLowerCase())
          .single();

        if (colErr) throw colErr;

        setStats({
          totalSupply:  Number(col?.total_supply)  || 0,
          uniqueOwners: Number(col?.owners)         || 0,
          floorPrice:   Number(col?.floor_price)    || 0,
          listedCount:  Number(col?.listed_count)   || 0,
          volume24h:    Number(col?.volume_24h)     || 0,
          royalties:    Number(col?.royalty_bps)    || 0,
          volumeTotal:  Number(col?.volume_total)   || 0,
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
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .in("status", ["featured", "live", "approved"])
        .order("featured_order", { ascending: true });
      if (error) setError(error.message);
      else setProjects(data || []);
      setIsLoading(false);
    }
    load();
  }, []);

  return { projects, isLoading, error };
}

// ─── 5. useListings ──────────────────────────────────────────────────────────
// ✅ FIXED: Direct table query — no broken get_active_listings_with_nfts RPC.
// ✅ FIXED: Forces nftContract to lowercase before querying.
// ✅ FIXED: Adds displayPrice (price ÷ 1e6) to every row.
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
          .eq("nft_contract", nftContract.toLowerCase())  // ✅ lowercase
          .eq("active", true)
          .order("price", { ascending: true });           // cheapest first

        if (dbErr) throw dbErr;

        if (!cancelled) {
          setListings(
            (data || []).map((item: any) => ({
              ...item,
              // ✅ displayPrice: raw 6-decimal units → human USD
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
export function useAdminProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (error) setError(error.message);
      else setProjects(data || []);
      setIsLoading(false);
    }
    load();
  }, []);

  const updateStatus = async (id: string, status: string, notes?: string) => {
    const { error } = await supabase
      .from("projects")
      .update({ status, notes, reviewed_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) setProjects(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    return { error };
  };

  const featureProject = async (id: string, order: number) => {
    const { error } = await supabase
      .from("projects")
      .update({ status: "featured", featured_order: order })
      .eq("id", id);
    if (!error) setProjects(prev => prev.map(p => p.id === id ? { ...p, status: "featured", featured_order: order } : p));
    return { error };
  };

  return { projects, isLoading, error, updateStatus, featureProject };
}

// ─── 8. useRealtimeListings ───────────────────────────────────────────────────
// Wraps useListings + Supabase realtime for live updates.
// ✅ FIXED: channel filter uses lowercased address to match DB.
// ✅ FIXED: realtime INSERT/UPDATE adds displayPrice before merging.
// ✅ FIXED: DELETE / active=false updates remove listing from state.
export function useRealtimeListings(nftContract: string) {
  const { listings, isLoading, error } = useListings(nftContract);
  const [liveListings, setLiveListings] = useState<Listing[]>([]);

  // Sync initial fetch into live state
  useEffect(() => {
    setLiveListings(listings);
  }, [listings]);

  // Subscribe to changes
  useEffect(() => {
    if (!nftContract || nftContract === "undefined" || nftContract === "null") return;

    const addr = nftContract.toLowerCase(); // ✅ lowercase for filter

    const channel = supabase
      .channel(`listings:${addr}`)
      .on(
        "postgres_changes",
        {
          event:  "*",
          schema: "public",
          table:  "listings",
          filter: `nft_contract=eq.${addr}`,
        },
        (payload) => {
          const row = payload.new as any;
          const enriched = row ? {
            ...row,
            displayPrice: (Number(row.price) / 1e6).toFixed(2),
          } : null;

          if (payload.eventType === "INSERT") {
            // Only add if active
            if (enriched?.active) {
              setLiveListings(prev => [enriched, ...prev]);
            }
          }

          if (payload.eventType === "UPDATE") {
            setLiveListings(prev => {
              if (!enriched?.active) {
                // Listing was cancelled/sold — remove from list
                return prev.filter(l => l.listing_id !== enriched.listing_id);
              }
              // Price update or other change
              const exists = prev.some(l => l.listing_id === enriched.listing_id);
              if (exists) {
                return prev.map(l => l.listing_id === enriched.listing_id ? enriched : l);
              }
              return [enriched, ...prev];
            });
          }

          if (payload.eventType === "DELETE") {
            const old = payload.old as any;
            if (old?.listing_id) {
              setLiveListings(prev => prev.filter(l => l.listing_id !== old.listing_id));
            }
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [nftContract]);

  return { listings: liveListings, isLoading, error };
}

// ─── 9. useCreatorCollections ─────────────────────────────────────────────────
// Fetches all collections/projects belonging to a wallet address.
// Used on StudioPage to show the creator's deployed collections.
export function useCreatorCollections(walletAddress: string | undefined) {
  const [collections, setCollections] = useState<any[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!walletAddress) { setCollections([]); return; }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      try {
        const addr = walletAddress.toLowerCase();

        // ✅ FIXED: correct Supabase .or() syntax — no escaped parens
        const { data: projectRows } = await supabase
          .from("projects")
          .select("id, name, symbol, contract_address, status, logo_url, banner_url, max_supply, mint_price, description, created_at, total_minted")
          .or(`creator_wallet.ilike.${addr},creator_address.ilike.${addr}`)
          .order("created_at", { ascending: false });

        const contracts = (projectRows || [])
          .map(p => p.contract_address?.toLowerCase())
          .filter(Boolean);

        let colMap: Record<string, any> = {};
        if (contracts.length > 0) {
          const { data: colRows } = await supabase
            .from("collections")
            .select("contract_address, slug, floor_price, listed_count, total_supply, total_minted, logo_url, banner_url, verified")
            .in("contract_address", contracts);
          (colRows || []).forEach(c => { colMap[c.contract_address?.toLowerCase()] = c; });
        }

        const merged = (projectRows || []).map(proj => {
          const cl  = proj.contract_address?.toLowerCase();
          const col = colMap[cl] || {};
          return {
            ...proj,
            contract_address: cl,
            slug:          col.slug         || cl,
            floor_price:   col.floor_price  || 0,
            listed_count:  col.listed_count || 0,
            total_supply:  col.total_supply || proj.max_supply || 0,
            total_minted:  col.total_minted || proj.total_minted || 0,
            verified:      col.verified     || false,
            // Project logo takes priority; fall back to collection logo
            logo_url:      proj.logo_url    || col.logo_url   || null,
            banner_url:    proj.banner_url  || col.banner_url || null,
            isDeployed:    !!cl,
          };
        });

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
