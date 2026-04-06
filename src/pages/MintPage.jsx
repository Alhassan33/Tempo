import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { useAccount } from "wagmi";
import { ShieldCheck, Users, Info, ChevronRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCollection } from "@/hooks/useSupabase";

const SCHEDULE = [
  { id: 'vault', name: 'VAULT', price: '0.00', limit: 99 },
  { id: 'priority', name: 'PRIORITY GTD', price: '0.00', limit: 1 },
  { id: 'gtd', name: 'GTD', price: '0.00', limit: 1 },
  { id: 'public', name: 'PUBLIC', price: '0.05', limit: 4629 },
];

export default function MintPage() {
  const { slug } = useParams();
  const { address } = useAccount();
  const { collection, isLoading } = useCollection(slug || "");
  const [eligibility, setEligibility] = useState({}); // { vault: true, gtd: false ... }

  // Check CSV-based allowlist in Supabase
  useEffect(() => {
    if (!address || !collection) return;
    const checkAllowlist = async () => {
      const { data } = await supabase
        .from('allowlists')
        .select('phase')
        .eq('wallet', address.toLowerCase());
      
      const status = {};
      data?.forEach(row => status[row.phase] = true);
      setEligibility(status);
    };
    checkAllowlist();
  }, [address, collection]);

  if (isLoading) return <div className="p-20 text-center animate-pulse text-[#22d3ee]">Loading Drop...</div>;

  return (
    <div className="min-h-screen bg-[#0b0f14] text-[#e6edf3] font-sans">
      {/* Hero Section */}
      <div className="max-w-xl mx-auto px-4 pt-8">
        <div className="flex justify-between items-end mb-4">
            <h1 className="text-2xl font-black">{collection?.name}</h1>
            <p className="text-sm font-mono text-[#9da7b3]">
                {collection?.total_supply?.toLocaleString()} / {collection?.total_supply?.toLocaleString()}
            </p>
        </div>
        <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden mb-6">
            <div className="h-full bg-[#22d3ee] w-full" /> {/* Progress Bar */}
        </div>

        <div className="rounded-2xl overflow-hidden border border-white/5 aspect-square mb-8">
            <img src={collection?.banner_url} alt="NFT" className="w-full h-full object-cover" />
        </div>

        {/* Action Card */}
        <div className="bg-[#121821] rounded-2xl p-6 border border-white/5 mb-10">
            <h2 className="text-lg font-bold mb-1">VAULT</h2>
            <p className="text-sm font-bold text-[#ef4444] mb-6">SOLD OUT</p>
            <button className="w-full h-12 bg-[#22d3ee] text-[#0b0f14] font-bold rounded-xl hover:opacity-90 transition-all">
                View items
            </button>
        </div>

        {/* MINT SCHEDULE Section (Matches Screenshot) */}
        <div className="flex justify-between items-center mb-6">
            <h3 className="text-[10px] font-black tracking-[0.2em] text-[#9da7b3]">MINT SCHEDULE</h3>
            <button className="text-[10px] font-bold px-3 py-1 bg-white/5 rounded-lg border border-white/10">
                View eligibility
            </button>
        </div>

        <div className="space-y-8 mb-12">
            {SCHEDULE.map((phase) => (
                <div key={phase.id} className="flex gap-4 items-start opacity-80">
                    <div className="mt-1">
                        {eligibility[phase.id] ? (
                            <CheckCircle2 size={20} className="text-[#22c55e]" />
                        ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-white/10" />
                        )}
                    </div>
                    <div className="flex-1">
                        <div className="flex justify-between items-start">
                            <div>
                                <h4 className="font-bold text-sm text-white">{phase.name}</h4>
                                <p className="text-[10px] text-[#9da7b3] mt-0.5">Started: February 9 at 4:20 PM GMT+1</p>
                                <p className="text-[10px] text-[#9da7b3] mt-0.5 font-mono">
                                    {phase.price} ETH | LIMIT {phase.limit} PER WALLET
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        {/* LIVE MINTS Feed (Matches Screenshot) */}
        <div className="flex items-center gap-2 mb-6">
            <h3 className="text-[10px] font-black tracking-[0.2em] text-[#9da7b3]">LIVE MINTS</h3>
            <Users size={12} className="text-[#9da7b3]" />
        </div>

        <div className="space-y-4 pb-20">
            {[1, 2].map((m) => (
                <div key={m} className="flex items-center justify-between py-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-yellow-500" />
                        <span className="text-sm font-mono font-bold">72c00e</span>
                    </div>
                    <div className="flex items-center gap-8">
                        <span className="text-[#9da7b3]">—</span>
                        <span className="text-sm font-bold">1</span>
                        <span className="text-[10px] text-[#9da7b3]">2mo ago</span>
                    </div>
                </div>
            ))}
        </div>
      </div>
    </div>
  );
}
