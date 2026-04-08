import { useState, useEffect } from "react";
import { useWallet } from "@/hooks/useWallet.js";
import { supabase } from "@/lib/supabase"; // Ensure your supabase client is exported here
import { RefreshCw, Gavel, ExternalLink } from "lucide-react";
import { useMarketplace } from "@/hooks/useMarketplace"; // Use your existing marketplace hook

export default function CollectionBids({ nftContract, tokenId, isOwner }) {
  const { isConnected, connect } = useWallet();
  const { placeBid: contractPlaceBid, acceptBid, loading: txLoading } = useMarketplace();
  
  const [bidAmount, setBidAmount] = useState("");
  const [bids, setBids] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  // ─── Fetch Live Bids ────────────────────────────────────────────────────────
  const fetchBids = async () => {
    try {
      const { data, error } = await supabase
        .from("bids")
        .select("*")
        .eq("nft_contract", nftContract)
        .eq("token_id", tokenId)
        .eq("active", true)
        .order("price", { ascending: false });

      if (error) throw error;
      setBids(data || []);
    } catch (err) {
      console.error("Error fetching bids:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!nftContract || !tokenId) return;
    
    fetchBids();

    // ─── Real-time Subscription ──────────────────────────────────────────────
    const channel = supabase
      .channel(`bids-${nftContract}-${tokenId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bids',
        filter: `nft_contract=eq.${nftContract}` 
      }, fetchBids)
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [nftContract, tokenId]);

  // ─── Place Bid Action ──────────────────────────────────────────────────────
  async function handlePlaceBid() {
    if (!isConnected) { connect(); return; }
    if (!bidAmount || isNaN(bidAmount)) return;

    setStatus("pending");
    try {
      // Call your marketplace hook to execute the Tempo chain transaction
      const success = await contractPlaceBid(nftContract, tokenId, bidAmount);
      if (success) {
        setStatus("success");
        setBidAmount("");
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus("error");
      }
    } catch (err) {
      setStatus("error");
      console.error(err);
    }
  }

  if (loading) return (
    <div className="flex justify-center py-10">
      <RefreshCw className="animate-spin text-cyan-400" size={24} />
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Bid Form */}
      {!isOwner && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="number"
              placeholder="0.00"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
              className="w-full h-12 rounded-xl px-4 pr-14 text-sm outline-none transition-all"
              style={{ 
                background: "#161d28", 
                border: "1px solid rgba(255,255,255,0.06)", 
                color: "#e6edf3", 
                fontFamily: "Space Mono, monospace" 
              }}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-500 uppercase">USD</span>
          </div>
          <button
            onClick={handlePlaceBid}
            disabled={status === "pending" || txLoading}
            className="h-12 px-6 rounded-xl text-sm font-black uppercase italic tracking-tighter transition-all"
            style={{ 
              background: "#22d3ee", 
              color: "#0b0f14", 
              border: "none", 
              cursor: "pointer",
              opacity: (status === "pending" || txLoading) ? 0.6 : 1
            }}
          >
            {status === "pending" ? "Syncing…" : status === "success" ? "Success!" : "Place Offer"}
          </button>
        </div>
      )}

      {/* Bids Table / List */}
      <div className="space-y-3">
        {bids.length > 0 ? (
          bids.map((b, i) => (
            <div 
              key={b.id} 
              className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 animate-in fade-in duration-500"
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">
                  #{i + 1} Offer
                </span>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold text-white">{b.price}</span>
                  <span className="text-[10px] font-bold text-gray-500 uppercase">USD</span>
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <span className="text-[10px] font-mono text-gray-500">
                  {b.bidder.slice(0, 6)}...{b.bidder.slice(-4)}
                </span>
                {isOwner && (
                  <button
                    onClick={() => acceptBid(b)}
                    className="px-4 py-1.5 rounded-xl bg-cyan-400 text-black text-[10px] font-black uppercase tracking-tighter hover:brightness-110 transition-all"
                  >
                    Accept
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="py-12 text-center border border-dashed border-white/5 rounded-3xl">
            <Gavel className="mx-auto mb-3 text-gray-800" size={32} />
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-600">No live offers found</p>
          </div>
        )}
      </div>
    </div>
  );
}
