import { useState } from "react";
import { resolveIpfsUrl, isVideoUrl } from "@/utils/nftImageUtils.js";

/**
 * NFTImage
 * Handles IPFS URIs, videos, and graceful error fallback.
 */
export default function NFTImage({ src, alt = "", className = "", style = {}, gradient }) {
  const [failed, setFailed] = useState(false);
  const resolved = resolveIpfsUrl(src);

  if (failed || !resolved) {
    return (
      <div
        className={className}
        style={{ background: gradient ?? "linear-gradient(135deg,#0e2233,#031220)", ...style }}
        aria-label={alt}
      />
    );
  }

  if (isVideoUrl(resolved)) {
    return (
      <video
        className={className}
        style={{ objectFit: "cover", ...style }}
        src={resolved}
        autoPlay
        muted
        loop
        playsInline
      />
    );
  }

  return (
    <img
      className={className}
      style={{ objectFit: "cover", ...style }}
      src={resolved}
      alt={alt}
      onError={() => setFailed(true)}
    />
  );
}
