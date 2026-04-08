import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronUp, ChevronDown } from "lucide-react";
import NFTImage from "./NFTImage.jsx";

// Updated helper to handle USD or ETH based on your chain's pricing
function formatPrice(v) {
  if (v === undefined || v === null) return "—";
  return `${Number(v).toLocaleString()}`; 
}

export default function CollectionCard({ collection, rank }) {
  const navigate = useNavigate();
  
  // Logic check for 24h performance
  const change = collection.change_24h ?? 0;
  const isPos = change >= 0;

  return (
    <tr
      className="group cursor-pointer transition-all border-b border-white/5 hover:bg-cyan-400/[0.03]"
      onClick={() => navigate(`/collection/${collection.slug}`)}
    >
      {/* Rank Column */}
      <td className="py-4 px-4">
        <span className="font-mono text-xs text-gray-500">{rank}</span>
      </td>

      {/* Collection Identity */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-[#161d28] border border-white/5">
            <NFTImage
              src={collection.image_url}
              alt={collection.name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold text-white uppercase italic tracking-tighter">
                {collection.name}
              </span>
              {collection.verified && <CheckCircle2 size={13} className="text-cyan-400" />}
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-600">
              {collection.total_supply?.toLocaleString()} items
            </span>
          </div>
        </div>
      </td>

      {/* Floor Price */}
      <td className="py-4 px-4 text-right">
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm font-bold text-white">
            {formatPrice(collection.floor_price)}
          </span>
          <span className="text-[9px] font-bold text-gray-600 uppercase">FLOOR</span>
        </div>
      </td>

      {/* 24h Change */}
      <td className="py-4 px-4 text-right">
        <span
          className={`font-mono text-sm font-bold inline-flex items-center gap-0.5 ${
            isPos ? "text-green-400" : "text-red-400"
          }`}
        >
          {isPos ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {Math.abs(change).toFixed(2)}%
        </span>
      </td>

      {/* Volume (Hidden on smaller screens) */}
      <td className="py-4 px-4 text-right hidden lg:table-cell">
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm font-bold text-white">
            {formatPrice(collection.volume_all_time)}
          </span>
          <span className="text-[9px] font-bold text-gray-600 uppercase">VOLUME</span>
        </div>
      </td>
    </tr>
  );
}
