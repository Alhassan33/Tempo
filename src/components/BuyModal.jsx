import React, { useState, useEffect } from 'react';
import { X, ShieldCheck, AlertCircle, Loader2 } from 'lucide-react';
import { useBuyNFT } from '@/hooks/useMarketplace';
import NFTImage from './NFTImage';

export default function BuyModal({ isOpen, onClose, listing }) {
  const { buyNFT, loading, txStatus, clearStatus } = useBuyNFT();
  const [step, setStep] = useState('idle'); // idle, quoting, ready

  if (!isOpen || !listing) return null;

  const handlePurchase = async () => {
    try {
      await buyNFT(listing);
      // If success, you might want to close after a delay
    } catch (err) {
      console.error("Purchase error", err);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#0b0f14] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <h3 className="text-xl font-bold italic uppercase tracking-tight text-[#e6edf3]">Complete Checkout</h3>
          <button onClick={() => { clearStatus(); onClose(); }} className="text-[#9da7b3] hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* NFT Preview Mini */}
          <div className="flex gap-4 p-4 rounded-2xl bg-white/5 border border-white/5">
            <div className="w-20 h-20 rounded-xl overflow-hidden">
              <NFTImage src={listing.image} className="w-full h-full object-cover" />
            </div>
            <div className="flex flex-col justify-center">
              <div className="text-[10px] font-bold text-[#22d3ee] uppercase tracking-widest">{listing.name?.split('#')[0] || 'Collection'}</div>
              <div className="text-lg font-black italic text-[#e6edf3]">#{listing.tokenId}</div>
            </div>
          </div>

          {/* Pricing Breakdown */}
          <div className="space-y-3 px-1">
            <div className="flex justify-between text-sm">
              <span className="text-[#9da7b3]">List Price</span>
              <span className="font-mono font-bold text-[#e6edf3]">${listing.displayPrice}</span>
            </div>
            {/* Note: In a full version, you could display royalties here fetched from the quote */}
            <div className="pt-3 border-t border-white/5 flex justify-between items-baseline">
              <span className="text-base font-bold text-[#e6edf3]">Total Cost</span>
              <div className="text-right">
                <div className="text-2xl font-black text-[#22d3ee]">${listing.displayPrice}</div>
                <div className="text-[10px] text-[#9da7b3] uppercase font-bold">Paid in pathUSD</div>
              </div>
            </div>
          </div>

          {/* Status Messages */}
          {txStatus && (
            <div className={`p-4 rounded-xl flex gap-3 text-sm ${
              txStatus.type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 
              'bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/20'
            }`}>
              {txStatus.type === 'error' ? <AlertCircle size={18} /> : <Loader2 size={18} className="animate-spin" />}
              <p className="font-medium">{txStatus.msg}</p>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handlePurchase}
            disabled={loading}
            className={`w-full py-4 rounded-2xl font-black italic uppercase tracking-widest transition-all ${
              loading 
              ? 'bg-white/5 text-[#9da7b3] cursor-not-allowed' 
              : 'bg-[#22d3ee] text-black hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_20px_rgba(34,211,238,0.3)]'
            }`}
          >
            {loading ? 'Processing...' : 'Confirm Purchase'}
          </button>

          <div className="flex items-center justify-center gap-2 text-[10px] text-[#9da7b3] font-bold uppercase tracking-widest">
            <ShieldCheck size={14} className="text-[#22d3ee]" />
            Secured by Tempo Marketplace V2
          </div>
        </div>
      </div>
    </div>
  );
}
