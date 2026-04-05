import { useState, useEffect } from "react";
import { API_BASE } from "@/config/index.js";
import { cacheGet, cacheSet } from "@/utils/persistentCache.js";

export function useListings({ collectionId, limit = 20 } = {}) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const key = `listings_${collectionId ?? "all"}_${limit}`;
    const cached = cacheGet(key);
    if (cached) { setListings(cached); setLoading(false); return; }

    const params = new URLSearchParams({ limit });
    if (collectionId) params.set("collection", collectionId);

    fetch(`${API_BASE}/listings?${params}`)
      .then((r) => r.json())
      .then((data) => { cacheSet(key, data, 60_000); setListings(data); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [collectionId, limit]);

  return { listings, loading, error };
}
