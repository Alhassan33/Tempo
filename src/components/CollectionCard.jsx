import { useNavigate } from "react-router-dom";
import { CheckCircle2, ChevronUp, ChevronDown } from "lucide-react";
import NFTImage from "./NFTImage.jsx";

// Standardized USD formatter for Tempo
function formatUSD(v) {
  if (v === undefined || v === null) return "—";
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(v);
}

export default function CollectionCard({ collection, rank }) {
  const navigate = useNavigate();
  const change = collection.change24h ?? 0;
  const isPos = change >= 0;

  return (
    <tr
      className="group cursor-pointer transition-all border-b border-white/5 hover:bg-cyan-400/[0.03]"
      onClick={() => navigate(`/collection/${collection.slug || collection.id}`)}
    >
      {/* Rank */}
      <td className="py-4 px-4">
        <span className="font-mono text-xs text-gray-500">{rank}</span>
      </td>

      {/* Collection Info */}
      <td className="py-4 px-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl flex-shrink-0 overflow-hidden bg-[#161d28] border border-white/10">
            <NFTImage
              src={collection.image}
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
              {(collection.itemCount ?? collection.supply ?? 0).toLocaleString()} items
            </span>
          </div>
        </div>
      </td>

      {/* Floor Price in USD */}
      <td className="py-4 px-4 text-right">
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm font-bold text-white">
            {formatUSD(collection.floor || collection.floor_price)}
          </span>
          <span className="text-[9px] font-black text-gray-600 uppercase">Floor</span>
        </div>
      </td>

      {/* Top Offer in USD */}
      <td className="py-4 px-4 text-right hidden md:table-cell">
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm font-bold text-cyan-400">
            {formatUSD(collection.topOffer || collection.top_offer)}
          </span>
          <span className="text-[9px] font-black text-gray-600 uppercase">Top Offer</span>
        </div>
      </td>

      {/* 24h Change */}
      <td className="py-4 px-4 text-right">
        <span
          className={`font-mono text-xs font-bold inline-flex items-center gap-0.5 px-2 py-1 rounded-lg ${
            isPos ? "text-green-400 bg-green-400/10" : "text-red-400 bg-red-400/10"
          }`}
        >
          {isPos ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          {Math.abs(change).toFixed(2)}%
        </span>
      </td>

      {/* Volume in USD */}
      <td className="py-4 px-4 text-right hidden lg:table-cell">
        <div className="flex flex-col items-end">
          <span className="font-mono text-sm font-bold text-white">
            {formatUSD(collection.volume)}
          </span>
          <span className="text-[9px] font-black text-gray-600 uppercase">Volume</span>
        </div>
      </td>
    </tr>
  );
}
