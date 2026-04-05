import { createContext, useContext, useState, useCallback } from "react";
import { API_BASE } from "@/config/index.js";

const LaunchpadContext = createContext(null);

export function LaunchpadProvider({ children }) {
  const [drops, setDrops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchDrops = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/collections?type=launchpad`);
      if (!res.ok) throw new Error("Failed to fetch drops");
      const data = await res.json();
      setDrops(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setDrops([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <LaunchpadContext.Provider value={{ drops, loading, error, fetchDrops }}>
      {children}
    </LaunchpadContext.Provider>
  );
}

export function useLaunchpad() {
  const ctx = useContext(LaunchpadContext);
  if (!ctx) throw new Error("useLaunchpad must be used inside LaunchpadProvider");
  return ctx;
}
