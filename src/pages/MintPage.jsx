// pages/MintPage.jsx — mainnet explorer: explore.tempo.xyz
// Full file: same as previous version but with EXPLORER_BASE = "https://explore.tempo.xyz"
// All instances of explorer.moderato.tempo.xyz replaced with explore.tempo.xyz

import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount } from "wagmi";
import { ArrowLeft, Globe, Twitter, ExternalLink, CheckCircle2, Clock, Minus, Plus, Zap, AlertCircle, Rocket } from "lucide-react";
import { useFeaturedProjects } from "@/hooks/useSupabase";
import { usePhases, useWalletMintState, useMint, formatPrice, isPublicPhase } from "@/hooks/useMint";

const EXPLORER_BASE = "https://explore.tempo.xyz"; // ✅ Mainnet

function formatCountdown(targetSec) {
  const diff = Number(targetSec) * 1000 - Date.now();
  if (diff <= 0) return "Started";
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

function phaseStatus(phase) {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (!phase.active) return "inactive";
  if (now < phase.startTime) return "upcoming";
  if (phase.endTime > 0n && now > phase.endTime) return "ended";
  return "live";
}

function PhaseBadge({ status }) {
  const config = {
    live:     { label: "● LIVE",     color: "#22d3ee", bg: "rgba(34,211,238,0.12)",  border: "rgba(34,211,238,0.3)"  },
    upcoming: { label: "◎ UPCOMING", color: "#9da7b3", bg: "rgba(157,167,179,0.08)", border: "rgba(157,167,179,0.2)" },
    ended:    { label: "✕ ENDED",    color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)" },
    inactive: { label: "— INACTIVE", color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)" },
  }[status] ?? { label: status.toUpperCase(), color: "#9da7b3", bg: "transparent", border: "rgba(255,255,255,0.1)" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}`, fontFamily: "Syne, sans-serif" }}>
      {config.label}
    </span>
  );
}

function MintProgress({ minted, max }) {
  const pct = max > 0n ? Number((minted * 100n) / max) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span style={{ color: "#9da7b3" }}>Minted</span>
        <span className="font-mono font-bold" style={{ color: "#e6edf3" }}>
          {minted.toLocaleString()} <span style={{ color: "#9da7b3" }}>/ {max.toLocaleString()}</span>
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#161d28" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: pct >= 100 ? "#9da7b3" : "linear-gradient(90deg, #22d3ee, #38bdf8)" }} />
      </div>
      <div className="text-[10px] mt-1 text-right font-mono" style={{ color: "#9da7b3" }}>{pct}% minted</div>
    </div>
  );
}

function PhaseCard({ phase, onSelect, selected }) {
  const status = phaseStatus(phase);
  const price  = formatPrice(phase.price);
  const pub    = isPublicPhase(phase);
  return (
    <div onClick={() => status === "live" && onSelect(phase)}
      className="rounded-xl p-4 transition-all duration-200"
      style={{
        background: selected ? "rgba(34,211,238,0.06)" : "#161d28",
        border: selected ? "1px solid rgba(34,211,238,0.4)" : status === "live" ? "1px solid rgba(34,211,238,0.15)" : "1px solid rgba(255,255,255,0.06)",
        cursor: status === "live" ? "pointer" : "default",
        opacity: status === "ended" || status === "inactive" ? 0.5 : 1,
      }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-bold text-sm" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>{phase.name || `Phase ${phase.id}`}</div>
          <div className="text-[10px] mt-0.5" style={{ color: "#9da7b3" }}>{pub ? "Public" : "Allowlist"} · Max {Number(phase.maxPerWallet)} per wallet</div>
        </div>
        <PhaseBadge status={status} />
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg p-2" style={{ background: "#0b0f14" }}>
          <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Price</div>
          <div className="text-sm font-mono font-bold" style={{ color: "#22d3ee" }}>{Number(phase.price) === 0 ? "FREE" : `${price} USD`}</div>
        </div>
        <div className="rounded-lg p-2" style={{ background: "#0b0f14" }}>
          <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Minted</div>
          <div className="text-sm font-mono font-bold" style={{ color: "#e6edf3" }}>
            {Number(phase.minted).toLocaleString()}
            {phase.maxSupply > 0n && <span style={{ color: "#9da7b3" }}> / {Number(phase.maxSupply).toLocaleString()}</span>}
          </div>
        </div>
      </div>
      {status === "upcoming" && phase.startTime > 0n && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#9da7b3" }}>
          <Clock size={11} /> Starts in <span className="font-mono font-bold" style={{ color: "#22d3ee" }}>{formatCountdown(phase.startTime)}</span>
        </div>
      )}
    </div>
  );
}

function MintWidget({ phase, nftContract, onSuccess }) {
  const { address, isConnected } = useAccount();
  const { mint, step, error, txHash, reset } = useMint(nftContract);
  const { mintedByWallet } = useWalletMintState(nftContract, phase?.id);
  const [quantity, setQuantity] = useState(1);
  if (!phase) return null;
  const pub = isPublicPhase(phase);
  const status = phaseStatus(phase);
  const price = phase.price;
  const maxPerWallet = Number(phase.maxPerWallet);
  const alreadyMinted = Number(mintedByWallet);
  const remaining = Math.max(0, maxPerWallet - alreadyMinted);
  const maxQty = Math.min(remaining, 10);
  const totalCost = price * BigInt(quantity);
  const isFree = Number(price) === 0;
  const isSoldOut = phase.maxSupply > 0n && phase.minted >= phase.maxSupply;

  async function handleMint() {
    if (!pub) return;
    await mint({ phaseId: phase.id, quantity, pricePerToken: price, merkleProof: [] });
    if (step === "done") onSuccess?.();
  }

  if (step === "done") {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.2)" }}>
        <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: "#22d3ee" }} />
        <h3 className="font-extrabold text-base mb-1" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>Minted!</h3>
        <p className="text-xs mb-4" style={{ color: "#9da7b3" }}>{quantity} NFT{quantity > 1 ? "s" : ""} minted successfully.</p>
        {txHash && (
          <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold mb-4" style={{ color: "#22d3ee" }}>
            View transaction <ExternalLink size={11} />
          </a>
        )}
        <button onClick={reset} className="w-full h-9 rounded-xl text-sm font-bold"
          style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
          Mint More
        </button>
      </div>
    );
  }

  const btnDisabled = !isConnected || status !== "live" || isSoldOut || remaining === 0 || step === "approving" || step === "minting" || !pub;
  const btnLabel = !isConnected ? "Connect Wallet" : isSoldOut ? "Sold Out" : remaining === 0 ? "Wallet Limit Reached" : !pub ? "Allowlist Only" : step === "approving" ? "Approving USD..." : step === "minting" ? "Minting..." : isFree ? "Mint Free" : `Mint · ${formatPrice(totalCost)} USD`;

  return (
    <div className="rounded-2xl p-5" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>{phase.name || `Phase ${phase.id}`}</span>
        <PhaseBadge status={status} />
      </div>
      {maxQty > 1 && status === "live" && !isSoldOut && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs" style={{ color: "#9da7b3" }}>Quantity</span>
          <div className="flex items-center gap-3">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", cursor: "pointer" }}><Minus size={12} /></button>
            <span className="font-mono font-bold w-6 text-center" style={{ color: "#e6edf3" }}>{quantity}</span>
            <button onClick={() => setQuantity(q => Math.min(maxQty, q + 1))} className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", cursor: "pointer" }}><Plus size={12} /></button>
          </div>
        </div>
      )}
      {!isFree && status === "live" && (
        <div className="rounded-xl p-3 mb-4" style={{ background: "#0b0f14" }}>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: "#9da7b3" }}>{quantity} × {formatPrice(price)} USD</span>
            <span className="font-mono font-bold" style={{ color: "#e6edf3" }}>{formatPrice(totalCost)} USD</span>
          </div>
          {alreadyMinted > 0 && (
            <div className="flex justify-between text-xs">
              <span style={{ color: "#9da7b3" }}>Minted this phase</span>
              <span className="font-mono" style={{ color: "#9da7b3" }}>{alreadyMinted} / {maxPerWallet}</span>
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 mb-4 text-xs"
          style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {!pub && status === "live" && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 mb-4 text-xs"
          style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> This phase requires an allowlist proof.
        </div>
      )}
      <button onClick={handleMint} disabled={btnDisabled}
        className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity"
        style={{ background: btnDisabled ? "#161d28" : "#22d3ee", color: btnDisabled ? "#6b7280" : "#0b0f14", border: btnDisabled ? "1px solid rgba(255,255,255,0.06)" : "none", cursor: btnDisabled ? "not-allowed" : "pointer", fontFamily: "Syne, sans-serif" }}>
        {(step === "approving" || step === "minting") && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
        {btnLabel}
      </button>
    </div>
  );
}

export default function MintPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { projects, isLoading: projectsLoading } = useFeaturedProjects();
  const project = useMemo(() => projects.find(p => p.id === slug || p.contract_address?.toLowerCase() === slug?.toLowerCase()), [projects, slug]);
  const nftContract = project?.contract_address;
  const { phases, activePhaseId, totalMinted, maxSupply, loading: phasesLoading, error: phasesError, reload } = usePhases(nftContract);
  const [selectedPhase, setSelectedPhase] = useState(null);
  const activePhase = useMemo(() => {
    if (activePhaseId == null || activePhaseId < 0n) return null;
    return phases.find(p => p.id === Number(activePhaseId)) ?? null;
  }, [phases, activePhaseId]);
  const displayPhase = selectedPhase ?? activePhase;
  const soldOut = maxSupply > 0n && totalMinted >= maxSupply;

  if (projectsLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "#22d3ee" }} />
    </div>
  );

  if (!project) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <Rocket size={40} className="mb-4" style={{ color: "rgba(34,211,238,0.3)" }} />
      <p className="font-bold" style={{ color: "#e6edf3" }}>Project not found</p>
      <button onClick={() => navigate("/launchpad")} className="mt-4 text-sm" style={{ color: "#22d3ee" }}>← Back to Launchpad</button>
    </div>
  );

  return (
    <div className="fade-up px-4 sm:px-6 max-w-5xl mx-auto py-8">
      <button onClick={() => navigate("/launchpad")} className="flex items-center gap-2 text-sm mb-6 hover:opacity-80 transition-opacity"
        style={{ color: "#9da7b3", background: "none", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
        <ArrowLeft size={14} /> Launchpad
      </button>
      <div className="relative h-48 rounded-2xl overflow-hidden mb-6" style={{ background: "linear-gradient(135deg, #0e2233 0%, #031220 100%)" }}>
        {project.banner_url && <img src={project.banner_url} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #0b0f14 100%)" }} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 space-y-5">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0" style={{ border: "3px solid #0b0f14", background: "#161d28" }}>
              {project.logo_url ? <img src={project.logo_url} alt={project.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: "#22d3ee" }}>{project.name[0]}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>{project.name}</h1>
                {soldOut && <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: "rgba(107,114,128,0.15)", color: "#6b7280", border: "1px solid rgba(107,114,128,0.3)" }}>SOLD OUT</span>}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {project.twitter && <a href={project.twitter} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}><Twitter size={11} /></a>}
                {project.website && <a href={project.website} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}><Globe size={11} /></a>}
                {nftContract && <a href={`${EXPLORER_BASE}/address/${nftContract}`} target="_blank" rel="noreferrer" className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}><ExternalLink size={11} /></a>}
              </div>
            </div>
          </div>
          {project.description && <p className="text-sm leading-relaxed" style={{ color: "#9da7b3" }}>{project.description}</p>}
          {nftContract && maxSupply > 0n && (
            <div className="rounded-2xl p-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <MintProgress minted={totalMinted} max={maxSupply} />
            </div>
          )}
          <div>
            <h2 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#9da7b3", fontFamily: "Syne, sans-serif" }}>Mint Phases</h2>
            {phasesLoading ? <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "#161d28" }} />)}</div>
              : phasesError ? <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>{phasesError}</div>
              : phases.length === 0 ? <div className="rounded-xl px-4 py-4 text-sm text-center" style={{ color: "#9da7b3", background: "#161d28" }}>No phases configured yet.</div>
              : <div className="space-y-3">{phases.map(phase => <PhaseCard key={phase.id} phase={phase} selected={displayPhase?.id === phase.id} onSelect={setSelectedPhase} />)}</div>}
          </div>
        </div>
        <div className="lg:col-span-2">
          <div className="sticky top-6 space-y-4">
            {nftContract && displayPhase ? <MintWidget phase={displayPhase} nftContract={nftContract} onSuccess={reload} />
              : nftContract && !phasesLoading && phases.length > 0 ? <div className="rounded-2xl p-5 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}><p className="text-sm" style={{ color: "#9da7b3" }}>Select a live phase to mint.</p></div>
              : !nftContract ? <div className="rounded-2xl p-5 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}><Zap size={28} className="mx-auto mb-3" style={{ color: "rgba(34,211,238,0.3)" }} /><p className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>Contract Not Deployed</p><p className="text-xs" style={{ color: "#9da7b3" }}>This project hasn't deployed its contract yet.</p></div>
              : null}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9da7b3", fontFamily: "Syne, sans-serif" }}>Details</h3>
              {[
                { label: "Max Supply", value: project.max_supply?.toLocaleString() ?? "—" },
                { label: "Mint Price", value: project.mint_price != null ? `${project.mint_price} USD` : "See phases" },
                { label: "Payment",    value: "pathUSD (ERC-20)" },
                { label: "Blockchain", value: "Tempo Chain" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span style={{ color: "#9da7b3" }}>{label}</span>
                  <span className="font-mono font-semibold" style={{ color: "#e6edf3" }}>{value}</span>
                </div>
              ))}
              {nftContract && (
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "#9da7b3" }}>Contract</span>
                  <a href={`${EXPLORER_BASE}/address/${nftContract}`} target="_blank" rel="noreferrer" className="font-mono flex items-center gap-1" style={{ color: "#22d3ee" }}>
                    {nftContract.slice(0,6)}…{nftContract.slice(-4)} <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
  return "live";
}

function PhaseBadge({ status }) {
  const config = {
    live:     { label: "● LIVE",     color: "#22d3ee", bg: "rgba(34,211,238,0.12)",  border: "rgba(34,211,238,0.3)"  },
    upcoming: { label: "◎ UPCOMING", color: "#9da7b3", bg: "rgba(157,167,179,0.08)", border: "rgba(157,167,179,0.2)" },
    ended:    { label: "✕ ENDED",    color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)" },
    inactive: { label: "— INACTIVE", color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)" },
  }[status] ?? { label: status.toUpperCase(), color: "#9da7b3", bg: "transparent", border: "rgba(255,255,255,0.1)" };

  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest"
      style={{ color: config.color, background: config.bg, border: `1px solid ${config.border}`, fontFamily: "Syne, sans-serif" }}>
      {config.label}
    </span>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function MintProgress({ minted, max }) {
  const pct = max > 0n ? Number((minted * 100n) / max) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span style={{ color: "#9da7b3" }}>Minted</span>
        <span className="font-mono font-bold" style={{ color: "#e6edf3" }}>
          {minted.toLocaleString()} <span style={{ color: "#9da7b3" }}>/ {max.toLocaleString()}</span>
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#161d28" }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: pct >= 100 ? "#9da7b3" : "linear-gradient(90deg, #22d3ee, #38bdf8)",
          }}
        />
      </div>
      <div className="text-[10px] mt-1 text-right font-mono" style={{ color: "#9da7b3" }}>{pct}% minted</div>
    </div>
  );
}

// ─── Phase Card ───────────────────────────────────────────────────────────────
function PhaseCard({ phase, isActive, onSelect, selected }) {
  const status = phaseStatus(phase);
  const price  = formatPrice(phase.price);
  const pub    = isPublicPhase(phase);

  return (
    <div
      onClick={() => isActive && status === "live" && onSelect(phase)}
      className="rounded-xl p-4 transition-all duration-200"
      style={{
        background:  selected ? "rgba(34,211,238,0.06)" : "#161d28",
        border:      selected
          ? "1px solid rgba(34,211,238,0.4)"
          : isActive && status === "live"
            ? "1px solid rgba(34,211,238,0.15)"
            : "1px solid rgba(255,255,255,0.06)",
        cursor: isActive && status === "live" ? "pointer" : "default",
        opacity: status === "ended" || status === "inactive" ? 0.5 : 1,
      }}>
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-bold text-sm" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
            {phase.name || `Phase ${phase.id}`}
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "#9da7b3" }}>
            {pub ? "Public" : "Allowlist"} · Max {Number(phase.maxPerWallet)} per wallet
          </div>
        </div>
        <PhaseBadge status={status} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg p-2" style={{ background: "#0b0f14" }}>
          <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Price</div>
          <div className="text-sm font-mono font-bold" style={{ color: "#22d3ee" }}>
            {Number(phase.price) === 0 ? "FREE" : `${price} USD`}
          </div>
        </div>
        <div className="rounded-lg p-2" style={{ background: "#0b0f14" }}>
          <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Minted</div>
          <div className="text-sm font-mono font-bold" style={{ color: "#e6edf3" }}>
            {Number(phase.minted).toLocaleString()}
            {phase.maxSupply > 0n && <span style={{ color: "#9da7b3" }}> / {Number(phase.maxSupply).toLocaleString()}</span>}
          </div>
        </div>
      </div>

      {status === "upcoming" && phase.startTime > 0n && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: "#9da7b3" }}>
          <Clock size={11} />
          Starts in <span className="font-mono font-bold" style={{ color: "#22d3ee" }}>{formatCountdown(phase.startTime)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Mint Widget ──────────────────────────────────────────────────────────────
function MintWidget({ phase, nftContract, onSuccess }) {
  const { address, isConnected } = useAccount();
  const { mint, step, error, txHash, reset } = useMint(nftContract);
  const { mintedByWallet } = useWalletMintState(nftContract, phase?.id);
  const [quantity, setQuantity] = useState(1);

  if (!phase) return null;

  const pub          = isPublicPhase(phase);
  const status       = phaseStatus(phase);
  const price        = phase.price;
  const maxPerWallet = Number(phase.maxPerWallet);
  const alreadyMinted = Number(mintedByWallet);
  const remaining    = Math.max(0, maxPerWallet - alreadyMinted);
  const maxQty       = Math.min(remaining, 10); // cap UI at 10
  const totalCost    = price * BigInt(quantity);
  const isFree       = Number(price) === 0;
  const isSoldOut    = phase.maxSupply > 0n && phase.minted >= phase.maxSupply;

  async function handleMint() {
    if (!pub) return; // allowlist: user would need to supply proof
    await mint({
      phaseId:      phase.id,
      quantity,
      pricePerToken: price,
      merkleProof:  [],
    });
    if (step === "done") onSuccess?.();
  }

  if (step === "done") {
    return (
      <div className="rounded-2xl p-6 text-center" style={{ background: "#121821", border: "1px solid rgba(34,211,238,0.2)" }}>
        <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: "#22d3ee" }} />
        <h3 className="font-extrabold text-base mb-1" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
          Minted!
        </h3>
        <p className="text-xs mb-4" style={{ color: "#9da7b3" }}>
          {quantity} NFT{quantity > 1 ? "s" : ""} minted successfully.
        </p>
        {txHash && (
          <a
            href={`https://explorer.moderato.tempo.xyz/tx/${txHash}`}
            target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold mb-4"
            style={{ color: "#22d3ee" }}>
            View transaction <ExternalLink size={11} />
          </a>
        )}
        <button
          onClick={reset}
          className="w-full h-9 rounded-xl text-sm font-bold"
          style={{ background: "rgba(34,211,238,0.1)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.3)", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
          Mint More
        </button>
      </div>
    );
  }

  const btnDisabled = !isConnected || status !== "live" || isSoldOut || remaining === 0
    || step === "approving" || step === "minting" || (!pub);

  const btnLabel = !isConnected
    ? "Connect Wallet"
    : isSoldOut
      ? "Sold Out"
      : remaining === 0
        ? "Wallet Limit Reached"
        : !pub
          ? "Allowlist Only"
          : step === "approving"
            ? "Approving USD..."
            : step === "minting"
              ? "Minting..."
              : isFree
                ? "Mint Free"
                : `Mint · ${formatPrice(totalCost)} USD`;

  return (
    <div className="rounded-2xl p-5" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-bold" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
          {phase.name || `Phase ${phase.id}`}
        </span>
        <PhaseBadge status={status} />
      </div>

      {/* Quantity picker */}
      {maxQty > 1 && status === "live" && !isSoldOut && (
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs" style={{ color: "#9da7b3" }}>Quantity</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", cursor: "pointer" }}>
              <Minus size={12} />
            </button>
            <span className="font-mono font-bold w-6 text-center" style={{ color: "#e6edf3" }}>{quantity}</span>
            <button
              onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", cursor: "pointer" }}>
              <Plus size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Cost breakdown */}
      {!isFree && status === "live" && (
        <div className="rounded-xl p-3 mb-4" style={{ background: "#0b0f14" }}>
          <div className="flex justify-between text-xs mb-1">
            <span style={{ color: "#9da7b3" }}>{quantity} × {formatPrice(price)} USD</span>
            <span className="font-mono font-bold" style={{ color: "#e6edf3" }}>{formatPrice(totalCost)} USD</span>
          </div>
          {alreadyMinted > 0 && (
            <div className="flex justify-between text-xs">
              <span style={{ color: "#9da7b3" }}>Minted this phase</span>
              <span className="font-mono" style={{ color: "#9da7b3" }}>{alreadyMinted} / {maxPerWallet}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 mb-4 text-xs"
          style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.25)" }}>
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {!pub && status === "live" && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 mb-4 text-xs"
          style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          This phase requires an allowlist proof. Make sure your wallet is eligible.
        </div>
      )}

      <button
        onClick={handleMint}
        disabled={btnDisabled}
        className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-opacity"
        style={{
          background:  btnDisabled ? "#161d28" : "#22d3ee",
          color:       btnDisabled ? "#6b7280" : "#0b0f14",
          border:      btnDisabled ? "1px solid rgba(255,255,255,0.06)" : "none",
          cursor:      btnDisabled ? "not-allowed" : "pointer",
          fontFamily:  "Syne, sans-serif",
        }}>
        {(step === "approving" || step === "minting") && (
          <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {btnLabel}
      </button>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MintPage() {
  const { slug }    = useParams();
  const navigate    = useNavigate();
  const { projects, isLoading: projectsLoading } = useFeaturedProjects();

  const project = useMemo(
    () => projects.find(p => p.id === slug || p.contract_address?.toLowerCase() === slug?.toLowerCase()),
    [projects, slug]
  );

  const nftContract = project?.contract_address;

  const {
    phases, activePhaseId, totalMinted, maxSupply,
    loading: phasesLoading, error: phasesError, reload,
  } = usePhases(nftContract);

  const [selectedPhase, setSelectedPhase] = useState(null);

  // Auto-select the active phase
  const activePhase = useMemo(() => {
    if (activePhaseId == null || activePhaseId < 0n) return null;
    return phases.find(p => p.id === Number(activePhaseId)) ?? null;
  }, [phases, activePhaseId]);

  const displayPhase = selectedPhase ?? activePhase;
  const soldOut      = maxSupply > 0n && totalMinted >= maxSupply;

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "#22d3ee" }} />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
        <Rocket size={40} className="mb-4" style={{ color: "rgba(34,211,238,0.3)" }} />
        <p className="font-bold" style={{ color: "#e6edf3" }}>Project not found</p>
        <button onClick={() => navigate("/launchpad")} className="mt-4 text-sm" style={{ color: "#22d3ee" }}>
          ← Back to Launchpad
        </button>
      </div>
    );
  }

  return (
    <div className="fade-up px-4 sm:px-6 max-w-5xl mx-auto py-8">

      {/* Back */}
      <button
        onClick={() => navigate("/launchpad")}
        className="flex items-center gap-2 text-sm mb-6 hover:opacity-80 transition-opacity"
        style={{ color: "#9da7b3", background: "none", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
        <ArrowLeft size={14} /> Launchpad
      </button>

      {/* Banner */}
      <div className="relative h-48 rounded-2xl overflow-hidden mb-6"
        style={{ background: "linear-gradient(135deg, #0e2233 0%, #031220 100%)" }}>
        {project.banner_url && (
          <img src={project.banner_url} alt="" className="w-full h-full object-cover" />
        )}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #0b0f14 100%)" }} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left: Project Info ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
              style={{ border: "3px solid #0b0f14", background: "#161d28" }}>
              {project.logo_url
                ? <img src={project.logo_url} alt={project.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: "#22d3ee" }}>{project.name[0]}</div>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>{project.name}</h1>
                {soldOut && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: "rgba(107,114,128,0.15)", color: "#6b7280", border: "1px solid rgba(107,114,128,0.3)" }}>
                    SOLD OUT
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {project.twitter && (
                  <a href={project.twitter} target="_blank" rel="noreferrer"
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}>
                    <Twitter size={11} />
                  </a>
                )}
                {project.website && (
                  <a href={project.website} target="_blank" rel="noreferrer"
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}>
                    <Globe size={11} />
                  </a>
                )}
                {nftContract && (
                  <a href={`https://explorer.moderato.tempo.xyz/address/${nftContract}`} target="_blank" rel="noreferrer"
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#9da7b3" }}>
                    <ExternalLink size={11} />
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          {project.description && (
            <p className="text-sm leading-relaxed" style={{ color: "#9da7b3" }}>{project.description}</p>
          )}

          {/* Global progress */}
          {nftContract && maxSupply > 0n && (
            <div className="rounded-2xl p-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <MintProgress minted={totalMinted} max={maxSupply} />
            </div>
          )}

          {/* Phases */}
          <div>
            <h2 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#9da7b3", fontFamily: "Syne, sans-serif" }}>
              Mint Phases
            </h2>

            {phasesLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => (
                  <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "#161d28" }} />
                ))}
              </div>
            ) : phasesError ? (
              <div className="rounded-xl px-4 py-3 text-xs" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                {phasesError}
              </div>
            ) : phases.length === 0 ? (
              <div className="rounded-xl px-4 py-4 text-sm text-center" style={{ color: "#9da7b3", background: "#161d28" }}>
                No phases configured yet.
              </div>
            ) : (
              <div className="space-y-3">
                {phases.map(phase => (
                  <PhaseCard
                    key={phase.id}
                    phase={phase}
                    isActive={true}
                    selected={displayPhase?.id === phase.id}
                    onSelect={setSelectedPhase}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right: Mint Widget ── */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 space-y-4">
            {nftContract && displayPhase ? (
              <MintWidget
                phase={displayPhase}
                nftContract={nftContract}
                onSuccess={reload}
              />
            ) : nftContract && !phasesLoading && phases.length > 0 ? (
              <div className="rounded-2xl p-5 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-sm" style={{ color: "#9da7b3" }}>Select a live phase to mint.</p>
              </div>
            ) : !nftContract ? (
              <div className="rounded-2xl p-5 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Zap size={28} className="mx-auto mb-3" style={{ color: "rgba(34,211,238,0.3)" }} />
                <p className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>Contract Not Deployed</p>
                <p className="text-xs" style={{ color: "#9da7b3" }}>This project hasn't deployed its contract yet.</p>
              </div>
            ) : null}

            {/* Project details card */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9da7b3", fontFamily: "Syne, sans-serif" }}>Details</h3>
              {[
                { label: "Max Supply",   value: project.max_supply?.toLocaleString() ?? "—" },
                { label: "Mint Price",   value: project.mint_price != null ? `${project.mint_price} USD` : "See phases" },
                { label: "Payment",      value: "pathUSD (ERC-20)" },
                { label: "Blockchain",   value: "Tempo Chain" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span style={{ color: "#9da7b3" }}>{label}</span>
                  <span className="font-mono font-semibold" style={{ color: "#e6edf3" }}>{value}</span>
                </div>
              ))}
              {nftContract && (
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "#9da7b3" }}>Contract</span>
                  <a
                    href={`https://explorer.moderato.tempo.xyz/address/${nftContract}`}
                    target="_blank" rel="noreferrer"
                    className="font-mono flex items-center gap-1"
                    style={{ color: "#22d3ee" }}>
                    {nftContract.slice(0, 6)}…{nftContract.slice(-4)} <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
