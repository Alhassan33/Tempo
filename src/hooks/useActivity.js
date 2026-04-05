import { useState, useEffect } from "react";
import { API_BASE } from "@/config/index.js";

export function useActivity({ collectionId, address, limit = 20 } = {}) {
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams({ limit });
    if (collectionId) params.set("collection", collectionId);
    if (address) params.set("address", address);

    fetch(`${API_BASE}/activity?${params}`)
      .then((r) => r.json())
      .then((data) => setActivity(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [collectionId, address, limit]);

  return { activity, loading, error };
}
