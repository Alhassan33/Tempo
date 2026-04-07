// hooks/useNFTMetadata.js
import { useState, useEffect, useCallback } from "react";

// ─── Config ───────────────────────────────────────────────────────────────────
const IPFS_BASE =
  "https://gateway.lighthouse.storage/ipfs/bafybeiaksg5cena4ucpfjyqghnox73cflc6c4du2g3sn4qtovgzl67inpu/";

// Fallback gateway if Lighthouse is slow
const FALLBACK_BASE =
  "https://gateway.pinata.cloud/ipfs/bafybeiaksg5cena4ucpfjyqghnox73cflc6c4du2g3sn4qtovgzl67inpu/";

// ─── Resolve image URL (handles ipfs://, http, and bare CID) ─────────────────
export function resolveImage(raw) {
  if (!raw) return null;
  if (raw.startsWith("ipfs://")) {
    return `https://gateway.lighthouse.storage/ipfs/${raw.slice(7)}`;
  }
  if (raw.startsWith("http")) return raw;
  return `${IPFS_BASE}${raw}`;
}

// ─── Fetch a single token's metadata JSON ────────────────────────────────────
export async function fetchTokenMetadata(tokenId, useFallback = false) {
  const base = useFallback ? FALLBACK_BASE : IPFS_BASE;
  try {
    const res = await fetch(`${base}${tokenId}.json`, { cache: "force-cache" });
    if (!res.ok) throw new Error("not ok");
    const json = await res.json();

    const imageRaw =
      json.image ||
      json.image_url ||
      json.image_data ||
      `${IPFS_BASE}${tokenId}.png`;

    return {
      tokenId:    Number(tokenId),
      name:       json.name        || `TEMPONYAW #${tokenId}`,
      description:json.description || "",
      image:      resolveImage(imageRaw),
      attributes: Array.isArray(json.attributes) ? json.attributes : [],
      raw:        json,
    };
  } catch {
    // Try fallback once
    if (!useFallback) return fetchTokenMetadata(tokenId, true);
    return {
      tokenId:     Number(tokenId),
      name:        `TEMPONYAW #${tokenId}`,
      description: "",
      image:       `${IPFS_BASE}${tokenId}.png`,
      attributes:  [],
      raw:         {},
    };
  }
}

// ─── useNFTMetadata — single token ───────────────────────────────────────────
export function useNFTMetadata(tokenId) {
  const [metadata, setMetadata] = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState(null);

  useEffect(() => {
    if (tokenId == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchTokenMetadata(tokenId).then((data) => {
      if (!cancelled) {
        setMetadata(data);
        setLoading(false);
      }
    }).catch((e) => {
      if (!cancelled) {
        setError(e.message);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [tokenId]);

  return { metadata, loading, error };
}

// ─── useNFTBatch — paginated batch fetch with concurrency control ─────────────
// Fetches `tokenIds[]` in parallel, capped at `concurrency` at a time.
export function useNFTBatch(tokenIds = [], concurrency = 8) {
  const [tokens,  setTokens]  = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (!tokenIds.length) {
      setTokens([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setTokens([]);

    async function run() {
      const results = new Array(tokenIds.length);

      // Process in chunks of `concurrency`
      for (let i = 0; i < tokenIds.length; i += concurrency) {
        if (cancelled) break;
        const chunk = tokenIds.slice(i, i + concurrency);
        const chunkResults = await Promise.all(
          chunk.map((id) => fetchTokenMetadata(id))
        );
        if (cancelled) break;
        chunkResults.forEach((r, j) => { results[i + j] = r; });
        // Stream results in as they arrive
        setTokens(results.filter(Boolean));
      }

      if (!cancelled) setLoading(false);
    }

    run().catch((e) => {
      if (!cancelled) {
        setError(e.message);
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [JSON.stringify(tokenIds)]);

  return { tokens, loading, error };
}

// ─── Trait helpers ────────────────────────────────────────────────────────────

// Group attributes into { traitType: [values...] }
export function groupTraits(attributesArray) {
  return attributesArray.reduce((acc, attr) => {
    const key = attr.trait_type || "Property";
    if (!acc[key]) acc[key] = [];
    if (!acc[key].includes(attr.value)) acc[key].push(String(attr.value));
    return acc;
  }, {});
}

// Given a single token's attributes, return a display-friendly list
export function formatTraits(attributes) {
  return attributes.map((attr) => ({
    type:  attr.trait_type  || "Property",
    value: String(attr.value ?? ""),
    // display_type is used for numeric traits (number, boost_percentage, etc.)
    displayType: attr.display_type || null,
  }));
}

// Trait type → accent color (cycles through palette)
const TRAIT_COLORS = [
  { color: "#22d3ee", bg: "rgba(34,211,238,0.10)",  border: "rgba(34,211,238,0.25)"  },
  { color: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.25)" },
  { color: "#34d399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.25)"  },
  { color: "#fb923c", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.25)"  },
  { color: "#f472b6", bg: "rgba(244,114,182,0.10)", border: "rgba(244,114,182,0.25)" },
  { color: "#facc15", bg: "rgba(250,204,21,0.10)",  border: "rgba(250,204,21,0.25)"  },
];

export function traitColor(index) {
  return TRAIT_COLORS[index % TRAIT_COLORS.length];
}
