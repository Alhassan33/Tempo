import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronUp, ChevronDown } from "lucide-react";
import NFTImage from "./NFTImage.jsx";

function formatEth(v) {
  if (!v) return "—";
  return `${Number(v).toFixed(4)} ETH`;
}

export default function CollectionCard({ collection, rank }) {
  const navigate = useNavigate();
  const isPos = (collection.change24h ?? 0) >= 0;

  return (
    <tr
      className="cursor-pointer transition-colors"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.025)" }}
      onClick={() => navigate(`/collection/${collection.id ?? collection.address}`)}
      onMouseOver={(e) => (e.currentTarget.style.background = "rgba(34,211,238,0.03)")}
      onMouseOut={(e) => (e.currentTarget.style.background = "")}
    >
      {/* Rank */}
      <td className="py-3.5 px-4">
        <span className="font-mono text-xs" style={{ color: "#9da7b3" }}>{rank}</span>
      </td>

      {/* Collection */}
      <td className="py-3.5 px-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden">
            <NFTImage
              src={collection.image}
              alt={collection.name}
              gradient={collection.gradient}
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold" style={{ color: "#e6edf3" }}>{collection.name}</span>
              {collection.verified && <CheckCircle2 size={13} color="#22d3ee" />}
            </div>
            <span className="text-[11px]" style={{ color: "#9da7b3" }}>
              {(collection.itemCount ?? collection.supply ?? 0).toLocaleString()} items
            </span>
          </div>
        </div>
      </td>

      <td className="py-3.5 px-4 text-right">
        <span className="font-mono text-sm" style={{ color: "#e6edf3" }}>
          {formatEth(collection.floor ?? collection.floorPrice)}
        </span>
      </td>

      <td className="py-3.5 px-4 text-right hidden md:table-cell">
        <span className="font-mono text-sm" style={{ color: "#9da7b3" }}>
          {formatEth(collection.topOffer)}
        </span>
      </td>

      <td className="py-3.5 px-4 text-right">
        <span
          className="font-mono text-sm inline-flex items-center gap-0.5"
          style={{ color: isPos ? "#22c55e" : "#ef4444" }}
        >
          {isPos ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {Math.abs(collection.change24h ?? 0).toFixed(2)}%
        </span>
      </td>

      <td className="py-3.5 px-4 text-right hidden lg:table-cell">
        <span className="font-mono text-sm" style={{ color: "#e6edf3" }}>
          {collection.volume?.toFixed(1) ?? "—"} ETH
        </span>
      </td>
    </tr>
  );
}
