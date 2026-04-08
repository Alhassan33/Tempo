import { useNavigate } from "react-router-dom";
import NFTImage from "./NFTImage.jsx";

export default function NFTCard({ nft, compact }) {
  const navigate = useNavigate();

  // Standardized USD formatting for Tempo
  const price = nft.price ? `$${Number(nft.price).toLocaleString()}` : "Not Listed";

  return (
    <div 
      onClick={() => navigate(`/item/${nft.token_id}`)}
      className="group cursor-pointer p-2.5 rounded-2xl transition-all duration-300 hover:scale-[1.02]"
      style={{ 
        background: "#121821", 
        border: "1px solid rgba(255,255,255,0.06)" 
      }}
    >
      {/* Aspect Ratio Box for Image */}
      <div className="relative aspect-square rounded-xl overflow-hidden mb-3">
        <NFTImage 
          src={nft.image_url || nft.image} 
          alt={nft.name} 
          className="w-full h-full transform transition-transform duration-500 group-hover:scale-110"
        />
        
        {/* Token ID Badge */}
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md border border-white/5">
          <span className="text-[9px] font-mono text-cyan-400">#{nft.token_id}</span>
        </div>
      </div>

      {/* Info Section */}
      <div className="px-1 pb-1">
        <h3 className={`font-black uppercase italic tracking-tighter text-white truncate ${compact ? 'text-xs' : 'text-sm'}`}>
          {nft.name || `Nyan #${nft.token_id}`}
        </h3>
        
        <div className="flex justify-between items-end mt-2">
          <div>
            <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest">Price</p>
            <p className="font-mono text-xs font-bold text-white">{price}</p>
          </div>
          
          <button className="h-7 px-3 rounded-lg bg-cyan-400 text-black text-[9px] font-black uppercase italic tracking-tighter hover:brightness-110 transition-all">
            View
          </button>
        </div>
      </div>
    </div>
  );
}
