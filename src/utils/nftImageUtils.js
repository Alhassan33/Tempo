/**
 * nftImageUtils.js
 * Utilities for resolving and optimising NFT image URLs.
 */

/** Convert IPFS URIs to a public gateway URL */
export function resolveIpfsUrl(uri) {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice(7)}`;
  }
  if (uri.startsWith("ipfs/")) {
    return `https://ipfs.io/ipfs/${uri.slice(5)}`;
  }
  return uri;
}

/** Extract image URL from NFT metadata (handles various schemas) */
export function extractImageUrl(metadata) {
  if (!metadata) return null;
  const raw =
    metadata.image ??
    metadata.image_url ??
    metadata.animation_url ??
    metadata.thumbnail_url ??
    null;
  return resolveIpfsUrl(raw);
}

/** Build a resized image URL via an image proxy (stub — swap with your proxy) */
export function resizeImageUrl(url, width = 400) {
  if (!url) return null;
  // Example: return `https://your-image-proxy.com/?url=${encodeURIComponent(url)}&w=${width}`;
  return url;
}

/** Check whether a URL looks like a video asset */
export function isVideoUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|ogv|mov)(\?.*)?$/i.test(url);
}
