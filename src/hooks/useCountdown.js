import { useState, useEffect } from "react";

export function useCountdown(endsAt) {
  const [remaining, setRemaining] = useState(endsAt - Date.now());

  useEffect(() => {
    const id = setInterval(() => setRemaining(endsAt - Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);

  const total = Math.max(0, remaining);
  const h = Math.floor(total / 3600000);
  const m = Math.floor((total % 3600000) / 60000);
  const s = Math.floor((total % 60000) / 1000);

  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}
