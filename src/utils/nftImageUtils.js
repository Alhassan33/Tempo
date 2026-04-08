/**
 * nftImageUtils.js
 * Utilities for resolving and optimising NFT image URLs.
 */

/** Convert IPFS URIs to a public gateway URL */
export function resolveIpfsUrl(uri) {
  if (!uri) return null;

  // If the URI is already a full HTTP link (like the ones in your JSON), return it
  if (uri.startsWith("http")) return uri;

  // Fallback for standard ipfs:// links
  if (uri.startsWith("ipfs://")) {
    const cid = uri.slice(7);
    // Use Lighthouse as the primary gateway for better performance with your current setup
    return `https://gateway.lighthouse.storage/ipfs/${cid}`;
  }
  
  if (uri.startsWith("ipfs/")) {
    return `https://gateway.lighthouse.storage/ipfs/${uri.slice(5)}`;
  }

  return uri;
}

/** Extract image URL from NFT metadata (handles various schemas) */
export function extractImageUrl(metadata) {
  if (!metadata) return null;
  
  // Your JSON uses "image", so this remains perfect
  const raw =
    metadata.image ??
    metadata.image_url ??
    metadata.animation_url ??
    metadata.thumbnail_url ??
    null;
    
  return resolveIpfsUrl(raw);
}

/** Build a resized image URL via an image proxy */
export function resizeImageUrl(url, width = 400) {
  if (!url) return null;
  return url;
}

/** Check whether a URL looks like a video asset */
export function isVideoUrl(url) {
  if (!url) return false;
  return /\.(mp4|webm|ogv|mov)(\?.*)?$/i.test(url);
}
