import { createContext, useContext, useState, useCallback } from "react";
import { API_BASE } from "@/config/index.js";

const PortfolioContext = createContext(null);

export function PortfolioProvider({ children }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPortfolio = useCallback(async (address) => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/owners?address=${address}`);
      if (!res.ok) throw new Error("Failed to fetch portfolio");
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <PortfolioContext.Provider value={{ items, loading, error, fetchPortfolio }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) throw new Error("usePortfolio must be used inside PortfolioProvider");
  return ctx;
}
