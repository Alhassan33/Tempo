import { useState, useEffect } from "react";
import { API_BASE } from "@/config/index.js";
import { cacheGet, cacheSet } from "@/utils/persistentCache.js";

export function useCollections() {
  const [collections, setCollections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cached = cacheGet("collections");
    if (cached) { setCollections(cached); setLoading(false); return; }

    fetch(`${API_BASE}/collections`)
      .then((r) => r.json())
      .then((data) => { cacheSet("collections", data); setCollections(data); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  return { collections, loading, error };
}

export function useCollection(id) {
  const [collection, setCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;
    const key = `collection_${id}`;
    const cached = cacheGet(key);
    if (cached) { setCollection(cached); setLoading(false); return; }

    fetch(`${API_BASE}/collections?id=${id}`)
      .then((r) => r.json())
      .then((data) => { cacheSet(key, data); setCollection(data); })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  return { collection, loading, error };
}
