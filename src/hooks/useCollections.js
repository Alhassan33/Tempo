import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { Collection } from "./useSupabase"; // Importing the interface we defined earlier

export function useCollections(sortBy: string = "volume_total") {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      setLoading(true);
      const { data, error: sbError } = await supabase
        .from("collections")
        .select("*")
        .order(sortBy, { ascending: false });

      if (sbError) {
        setError(sbError.message);
      } else {
        setCollections(data || []);
      }
      setLoading(false);
    }
    fetchAll();
  }, [sortBy]);

  return { collections, loading, error };
}

export function useCollection(slugOrAddress: string) {
  const [collection, setCollection] = useState<Collection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugOrAddress) return;

    async function fetchOne() {
      setLoading(true);
      
      // Determine if the input is a contract address or a URL slug
      const isAddress = slugOrAddress.startsWith("0x");
      const column = isAddress ? "contract_address" : "slug";

      const { data, error: sbError } = await supabase
        .from("collections")
        .select("*")
        .eq(column, slugOrAddress)
        .single();

      if (sbError) {
        setError(sbError.message);
      } else {
        setCollection(data);
      }
      setLoading(false);
    }

    fetchOne();
  }, [slugOrAddress]);

  return { collection, loading, error };
}
