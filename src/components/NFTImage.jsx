import { useState } from "react";

export default function NFTImage({ src, alt = "", className = "", style = {}, gradient }) {
  const [failed, setFailed] = useState(false);

  // ─── Robust Resolution Logic ──────────────────────────────────────────
  const resolveURL = (url) => {
    if (!url) return null;
    if (url.startsWith("http")) return url;
    if (url.startsWith("ipfs://")) {
      return `https://ipfs.io/ipfs/${url.slice(7)}`;
    }
    // If it's just a CID or a path like "1.png"
    return `https://ipfs.io/ipfs/${url}`;
  };

  const resolved = resolveURL(src);

  if (failed || !resolved) {
    return (
      <div
        className={`${className} flex items-center justify-center`}
        style={{ 
          background: gradient ?? "linear-gradient(135deg,#121821,#0b0f14)", 
          border: "1px solid rgba(255,255,255,0.05)",
          ...style 
        }}
      >
        <span className="text-[10px] text-gray-600 font-mono">NO_IMG</span>
      </div>
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
