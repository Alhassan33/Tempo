import { useState, useEffect } from "react";

/**
 * ─── Resolve URL ────────────────────────────────────────────────────────────
 * Transforms ipfs:// or bare CIDs into a viewable HTTP URL using a gateway.
 */
export function resolveUrl(raw, fallbackBase = "") {
  if (!raw) return null;
  
  // 1. If it's already a full HTTP link, return it
  if (raw.startsWith("http")) return raw;
  
  // 2. If it uses the ipfs:// protocol, use a public gateway
  if (raw.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${raw.slice(7)}`;
  }
  
  // 3. If it's a bare CID or a relative path, append to the provided base
  const base = fallbackBase.startsWith("ipfs://") 
    ? fallbackBase.replace("ipfs://", "https://ipfs.io/ipfs/")
    : fallbackBase;
    
  return `${base}${raw}`;
}

/**
 * ─── Fetch Metadata ─────────────────────────────────────────────────────────
 * Fetches JSON for a specific token ID using the collection's base URI.
 */
export async function fetchTokenMetadata(tokenId, baseUri) {
  if (!baseUri || !tokenId) return null;

  // Ensure baseUri ends with a slash
  let cleanBase = baseUri.startsWith("ipfs://")
    ? baseUri.replace("ipfs://", "https://ipfs.io/ipfs/")
    : baseUri;
  if (!cleanBase.endsWith("/")) cleanBase += "/";

  try {
    const res = await fetch(`${cleanBase}${tokenId}.json`, { cache: "force-cache" });
    if (!res.ok) throw new Error("Metadata not found");
    const json = await res.json();

    // Determine image source
    const imageRaw = json.image || json.image_url || json.image_data;

    return {
      tokenId:     Number(tokenId),
      name:        json.name || `#${tokenId}`,
      description: json.description || "",
      image:       resolveUrl(imageRaw, cleanBase), // Uses cleanBase as fallback for relative paths
      attributes:  Array.isArray(json.attributes) ? json.attributes : [],
      raw:         json,
    };
  } catch (err) {
    console.error(`Error fetching metadata for token ${tokenId}:`, err);
    return {
      tokenId:     Number(tokenId),
      name:        `#${tokenId}`,
      description: "",
      image:       "",
      attributes:  [],
      raw:         {},
    };
  }
}

/**
 * ─── useNFTMetadata (Single Token) ──────────────────────────────────────────
 */
export function useNFTMetadata(contractAddress, tokenId, baseUri) {
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Only fetch if we have a valid ID and a URI to fetch from
    if (!tokenId || !baseUri) return;

    let cancelled = false;
    setLoading(true);

    fetchTokenMetadata(tokenId, baseUri)
      .then((data) => {
        if (!cancelled) {
          setMetadata(data);
          setLoading(false);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [contractAddress, tokenId, baseUri]);

  return { metadata, loading, error };
}

// ─── Trait Helpers ────────────────────────────────────────────────────────────

export function formatTraits(attributes) {
  if (!attributes) return [];
  return attributes.map((attr) => ({
    type:  attr.trait_type  || "Property",
    value: String(attr.value ?? ""),
    displayType: attr.display_type || null,
  }));
}

const TRAIT_COLORS = [
  { color: "#22d3ee", bg: "rgba(34,211,238,0.10)",  border: "rgba(34,211,238,0.25)"  },
  { color: "#a78bfa", bg: "rgba(167,139,250,0.10)", border: "rgba(167,139,250,0.25)" },
  { color: "#34d399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.25)"  },
  { color: "#fb923c", bg: "rgba(251,146,60,0.10)",  border: "rgba(251,146,60,0.25)"  },
];

export function traitColor(index) {
  return TRAIT_COLORS[index % TRAIT_COLORS.length];
}
