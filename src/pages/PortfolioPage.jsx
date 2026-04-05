import { useEffect } from "react";
import { Briefcase } from "lucide-react";
import { useAccount } from "wagmi";
import { usePortfolio } from "@/context/PortfolioContext.jsx";
import { useWallet } from "@/hooks/useWallet.js";
import { CardSkeleton } from "@/components/Skeleton.jsx";
import ListModal from "@/components/ListModal.jsx";
import NFTImage from "@/components/NFTImage.jsx";
import { useState } from "react";

const DEMO_ITEMS = [
  { id: "1", name: "TempoFeline #0042", collection: "TempoFelines", price: "0.2800", gradient: "linear-gradient(135deg,#0d2137,#071424)" },
  { id: "2", name: "NyanPunk #1337",    collection: "NyanPunks",    price: "0.1240", gradient: "linear-gradient(135deg,#1a0d2b,#0b0618)" },
  { id: "3", name: "CipherCat #0007",   collection: "CipherCats",   price: "0.3750", gradient: "linear-gradient(135deg,#0d1d10,#06110a)" },
];

export default function PortfolioPage() {
  const { address } = useAccount();
  const { items, loading, fetchPortfolio } = usePortfolio();
  const { isConnected, connect } = useWallet();
  const [listModal, setListModal] = useState(null);

  useEffect(() => { if (address) fetchPortfolio(address); }, [address, fetchPortfolio]);

  const data = items.length ? items : DEMO_ITEMS;

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 fade-up">
        <Briefcase size={40} style={{ color: "#9da7b3" }} />
        <p className="text-lg font-semibold" style={{ color: "#e6edf3" }}>Connect your wallet</p>
        <p className="text-sm" style={{ color: "#9da7b3" }}>to view your NFT portfolio.</p>
        <button
          onClick={connect}
          className="h-10 px-6 rounded-xl text-sm font-bold"
          style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  return (
    <div className="px-6 py-8 max-w-6xl mx-auto fade-up">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Briefcase size={14} style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Portfolio</span>
        </div>
        <h1 className="text-3xl font-extrabold" style={{ color: "#e6edf3" }}>My NFTs</h1>
        <p className="mt-1 text-sm" style={{ color: "#9da7b3" }}>{data.length} items</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {data.map((item) => (
            <div
              key={item.id}
              className="card-hover rounded-2xl overflow-hidden cursor-pointer"
              style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
            >
              <div className="aspect-square" style={{ background: item.gradient }}>
                <NFTImage src={item.image} alt={item.name} gradient={item.gradient} style={{ width: "100%", height: "100%" }} />
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold truncate" style={{ color: "#e6edf3" }}>{item.name}</p>
                <p className="text-xs mt-0.5 truncate" style={{ color: "#9da7b3" }}>{item.collection}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="font-mono text-sm" style={{ color: "#22d3ee" }}>{item.price} ETH</span>
                  <button
                    onClick={() => setListModal(item)}
                    className="text-xs px-2.5 py-1 rounded-lg font-bold transition-colors"
                    style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "none", cursor: "pointer" }}
                  >
                    List
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {listModal && <ListModal nft={listModal} onClose={() => setListModal(null)} />}
    </div>
  );
}
