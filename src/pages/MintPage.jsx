// pages/MintPage.jsx
import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount, useChainId } from "wagmi";
import {
  ArrowLeft, Globe, Twitter, ExternalLink, CheckCircle2,
  Clock, Minus, Plus, Zap, AlertCircle, Rocket, ShieldCheck,
  Lock, Users, Globe2
} from "lucide-react";
import { useFeaturedProjects } from "@/hooks/useSupabase";
import {
  usePhases, useWalletMintState, useMint, useQuoteMintCost,
  usePathUSDBalance, phaseStatus, isPublicPhase, formatPrice,
  PHASE_OG, PHASE_WHITELIST, PHASE_PUBLIC, PHASE_META,
  PLATFORM_FEE_RAW,
} from "@/hooks/useMint";

const EXPLORER_BASE = "https://explore.tempo.xyz";
const TEMPO_CHAIN_ID = 4217;

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(targetSec) {
  const [display, setDisplay] = useState("");
  useEffect(() => {
    function tick() {
      const diff = Number(targetSec) * 1000 - Date.now();
      if (diff <= 0) { setDisplay("Started"); return; }
      const d = Math.floor(diff / 86_400_000);
      const h = Math.floor((diff % 86_400_000) / 3_600_000);
      const m = Math.floor((diff % 3_600_000) / 60_000);
      const s = Math.floor((diff % 60_000) / 1_000);
      if (d > 0) setDisplay(d + "d " + h + "h " + m + "m");
      else if (h > 0) setDisplay(h + "h " + m + "m " + s + "s");
      else setDisplay(m + "m " + s + "s");
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetSec]);
  return display;
}

// ─── Phase Badge ──────────────────────────────────────────────────────────────
function PhaseBadge({ status }) {
  const cfg = {
    live:     { label: "● LIVE",     color: "#22C55E", bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)"   },
    upcoming: { label: "◎ UPCOMING", color: "#9da7b3", bg: "rgba(157,167,179,0.08)",  border: "rgba(157,167,179,0.2)"  },
    ended:    { label: "✕ ENDED",    color: "#6b7280", bg: "rgba(107,114,128,0.08)",  border: "rgba(107,114,128,0.2)"  },
    inactive: { label: "— OFF",      color: "#6b7280", bg: "rgba(107,114,128,0.06)",  border: "rgba(107,114,128,0.15)" },
  }[status] || { label: status.toUpperCase(), color: "#9da7b3", bg: "transparent", border: "rgba(255,255,255,0.1)" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest"
      style={{ color: cfg.color, background: cfg.bg, border: "1px solid " + cfg.border }}>
      {cfg.label}
    </span>
  );
}

// ─── Mint Progress Bar ────────────────────────────────────────────────────────
function MintProgress({ minted, max }) {
  const pct = max > 0n ? Number((minted * 100n) / max) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span style={{ color: "#9da7b3" }}>Minted</span>
        <span className="font-mono font-bold" style={{ color: "#e6edf3" }}>
          {Number(minted).toLocaleString()}
          <span style={{ color: "#9da7b3" }}> / {Number(max).toLocaleString()}</span>
        </span>
      </div>
      <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: "#161d28" }}>
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: pct + "%", background: pct >= 100 ? "#9da7b3" : "linear-gradient(90deg, #22C55E, #16a34a)" }} />
      </div>
      <div className="text-[10px] mt-1 text-right font-mono" style={{ color: "#9da7b3" }}>{pct}% minted</div>
    </div>
  );
}

// ─── Phase Card ───────────────────────────────────────────────────────────────
function PhaseCard({ phase, phaseId, selected, onSelect }) {
  const status   = phaseStatus(phase);
  const meta     = PHASE_META[phaseId] || {};
  const isPublic = isPublicPhase(phase);
  const countdown = useCountdown(status === "upcoming" ? phase.startTime : 0n);

  return (
    <div
      onClick={() => status === "live" && onSelect(phaseId)}
      className="rounded-xl p-4 transition-all duration-200"
      style={{
        background: selected ? "rgba(34,197,94,0.06)" : "#161d28",
        border: selected
          ? "1px solid rgba(34,197,94,0.4)"
          : status === "live"
          ? "1px solid rgba(34,197,94,0.15)"
          : "1px solid rgba(255,255,255,0.06)",
        cursor: status === "live" ? "pointer" : "default",
        opacity: status === "ended" || status === "inactive" ? 0.45 : 1,
      }}>

      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            {/* Phase type icon */}
            {isPublic
              ? <Globe2 size={13} style={{ color: meta.color || "#22C55E" }} />
              : <Lock size={13} style={{ color: meta.color || "#9da7b3" }} />}
            <span className="font-bold text-sm" style={{ color: "#e6edf3" }}>
              {phase.name || meta.name || ("Phase " + phaseId)}
            </span>
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "#9da7b3" }}>
            {isPublic ? "Open to everyone" : "Allowlist required"}
            {phase.maxPerWallet > 0n && " · Max " + Number(phase.maxPerWallet) + " per wallet"}
          </div>
        </div>
        <PhaseBadge status={status} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <div className="rounded-lg p-2" style={{ background: "#0b0f14" }}>
          <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Price</div>
          <div className="text-sm font-mono font-bold" style={{ color: "#22C55E" }}>
            {Number(phase.price) === 0 ? "FREE" : formatPrice(phase.price) + " USD"}
          </div>
        </div>
        <div className="rounded-lg p-2" style={{ background: "#0b0f14" }}>
          <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Minted</div>
          <div className="text-sm font-mono font-bold" style={{ color: "#e6edf3" }}>
            {Number(phase.minted).toLocaleString()}
            {phase.maxSupply > 0n && (
              <span style={{ color: "#9da7b3" }}> / {Number(phase.maxSupply).toLocaleString()}</span>
            )}
          </div>
        </div>
      </div>

      {status === "upcoming" && phase.startTime > 0n && (
        <div className="flex items-center gap-1.5 text-xs mt-1" style={{ color: "#9da7b3" }}>
          <Clock size={11} />
          Starts in <span className="font-mono font-bold" style={{ color: "#22C55E" }}>{countdown}</span>
        </div>
      )}
    </div>
  );
}

// ─── Mint Widget ──────────────────────────────────────────────────────────────
function MintWidget({ phase, phaseId, nftContract, onSuccess }) {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { mint, step, error, txHash, reset } = useMint(nftContract);
  const { mintedByWallet } = useWalletMintState(nftContract, phaseId);
  const [quantity, setQuantity] = useState(1);

  const status         = phaseStatus(phase);
  const isPublic       = isPublicPhase(phase);
  const wrongNetwork   = chainId !== TEMPO_CHAIN_ID;
  const maxPerWallet   = Number(phase.maxPerWallet);
  const alreadyMinted  = Number(mintedByWallet);
  const remaining      = maxPerWallet > 0 ? Math.max(0, maxPerWallet - alreadyMinted) : 10;
  const maxQty         = Math.min(remaining, 10);
  const isSoldOut      = phase.maxSupply > 0n && phase.minted >= phase.maxSupply;

  // Live cost quote from contract (includes platform fee)
  const { quote: quotedCost, loading: quoting } = useQuoteMintCost(nftContract, phaseId, quantity);
  const balance = usePathUSDBalance();

  // Price breakdown
  const mintPrice    = phase.price * BigInt(quantity);           // creator price × qty
  const platformFee  = PLATFORM_FEE_RAW * BigInt(quantity);     // $0.05 × qty
  const totalDisplay = quotedCost
    ? formatPrice(quotedCost)
    : formatPrice(mintPrice + platformFee);

  const hasEnoughBalance = balance == null
    ? true
    : quotedCost
    ? BigInt(balance) >= quotedCost
    : true;

  const busy = step === "approving" || step === "minting";

  const canMint = isConnected && !wrongNetwork && !busy
    && status === "live" && !isSoldOut
    && (maxQty > 0 || maxPerWallet === 0)
    && hasEnoughBalance;

  const btnLabel =
    !isConnected   ? "Connect Wallet" :
    wrongNetwork   ? "Wrong Network"  :
    isSoldOut      ? "Sold Out"       :
    step === "approving" ? "Approving pathUSD..." :
    step === "minting"   ? "Minting..."           :
    step === "done"      ? "Minted! 🎉"           :
    status === "upcoming"? "Not Live Yet"         :
    status === "ended"   ? "Phase Ended"          :
    !hasEnoughBalance    ? "Insufficient pathUSD" :
    maxQty === 0         ? "Wallet Limit Reached" :
    "Mint Now";

  async function handleMint() {
    if (!canMint) return;
    const proof = isPublic ? [] : [];  // TODO: pass merkle proof for allowlist
    await mint({ phaseId, quantity, merkleProof: proof, quotedCost });
    if (step !== "error") onSuccess?.();
  }

  if (!phase) return null;

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#9da7b3" }}>
          {phase.name || PHASE_META[phaseId]?.name || "Mint"}
        </h3>
        <PhaseBadge status={status} />
      </div>

      {/* Quantity selector */}
      {status === "live" && !isSoldOut && (
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#9da7b3" }}>Quantity</div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: "#e6edf3" }}>
              <Minus size={14} />
            </button>
            <span className="flex-1 text-center font-mono text-xl font-bold" style={{ color: "#e6edf3" }}>{quantity}</span>
            <button
              onClick={() => setQuantity(q => Math.min(maxQty || 10, q + 1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: "#e6edf3" }}>
              <Plus size={14} />
            </button>
          </div>
          {maxPerWallet > 0 && (
            <div className="text-[10px] mt-1.5 text-center" style={{ color: "#9da7b3" }}>
              {alreadyMinted} / {maxPerWallet} minted this wallet
            </div>
          )}
        </div>
      )}

      {/* Cost breakdown */}
      <div className="rounded-xl p-3 space-y-2" style={{ background: "#161d28" }}>
        <div className="flex justify-between text-xs">
          <span style={{ color: "#9da7b3" }}>Mint price ({quantity}×)</span>
          <span className="font-mono font-bold" style={{ color: "#e6edf3" }}>
            {Number(phase.price) === 0 ? "FREE" : formatPrice(mintPrice) + " USD"}
          </span>
        </div>
        <div className="flex justify-between text-xs">
          <span style={{ color: "#9da7b3" }}>Platform fee ({quantity}×$0.05)</span>
          <span className="font-mono" style={{ color: "#9da7b3" }}>
            {formatPrice(platformFee)} USD
          </span>
        </div>
        <div className="border-t pt-2 flex justify-between items-baseline" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>Total</span>
          <div className="text-right">
            {quoting ? (
              <span className="text-xs" style={{ color: "#9da7b3" }}>Calculating...</span>
            ) : (
              <span className="font-mono text-xl font-bold" style={{ color: "#22C55E" }}>
                {totalDisplay} <span className="text-sm" style={{ color: "#9da7b3" }}>USD</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Balance */}
      {balance != null && (
        <div className="flex justify-between text-xs">
          <span style={{ color: "#9da7b3" }}>Your pathUSD balance</span>
          <span className={"font-mono font-bold " + (!hasEnoughBalance ? "text-red-400" : "")}
            style={hasEnoughBalance ? { color: "#22C55E" } : {}}>
            {formatPrice(balance)} USD
          </span>
        </div>
      )}

      {/* Warnings */}
      {wrongNetwork && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
          Switch to Tempo Mainnet to continue.
        </div>
      )}
      {!isPublic && status === "live" && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
          style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
          <Lock size={13} className="flex-shrink-0 mt-0.5" />
          This phase requires an allowlist spot.
        </div>
      )}

      {/* Error */}
      {step === "error" && error && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}

      {/* Success */}
      {step === "done" && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: "rgba(34,197,94,0.08)", color: "#22C55E", border: "1px solid rgba(34,197,94,0.2)" }}>
          <CheckCircle2 size={13} />
          Minted successfully! Check your wallet.
        </div>
      )}

      {/* Mint button */}
      <button
        onClick={step === "done" ? reset : handleMint}
        disabled={!canMint && step !== "done"}
        className="w-full h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
        style={{
          background: canMint || step === "done" ? "#22C55E" : "#161d28",
          color:      canMint || step === "done" ? "#0b0f14" : "#6b7280",
          border:     canMint || step === "done" ? "none" : "1px solid rgba(255,255,255,0.06)",
          cursor:     canMint || step === "done" ? "pointer" : "not-allowed",
          boxShadow:  canMint ? "0 0 20px rgba(34,197,94,0.25)" : "none",
        }}>
        {busy && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
        {btnLabel}
      </button>

      <div className="flex items-center justify-center gap-1.5 text-[10px]" style={{ color: "#9da7b3" }}>
        <ShieldCheck size={12} style={{ color: "#22C55E" }} />
        Secured by Tempo Launchpad · Paid in pathUSD
      </div>
    </div>
  );
}

// ─── Main MintPage ────────────────────────────────────────────────────────────
export default function MintPage() {
  const { slug }      = useParams();
  const navigate      = useNavigate();
  const { projects, isLoading: projectsLoading } = useFeaturedProjects();

  const project = useMemo(() =>
    projects.find(p => p.id === slug || p.contract_address?.toLowerCase() === slug?.toLowerCase()),
  [projects, slug]);

  const nftContract = project?.contract_address;
  const { phases, activePhaseId, totalMinted, maxSupply, loading: phasesLoading, error: phasesError, reload } = usePhases(nftContract);

  // Default selected phase — prefer active, then highest live phase
  const [selectedPhaseId, setSelectedPhaseId] = useState(null);

  useEffect(() => {
    if (activePhaseId != null && Number(activePhaseId) >= 0) {
      setSelectedPhaseId(Number(activePhaseId));
    } else if (phases.length > 0) {
      // Find first live phase
      const live = phases.find((p, i) => phaseStatus(p) === "live");
      if (live) setSelectedPhaseId(phases.indexOf(live));
    }
  }, [phases, activePhaseId]);

  const displayPhaseId = selectedPhaseId ?? (activePhaseId != null ? Number(activePhaseId) : null);
  const displayPhase   = displayPhaseId != null ? phases[displayPhaseId] : null;
  const soldOut        = maxSupply > 0n && totalMinted >= maxSupply;

  if (projectsLoading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ color: "#22C55E" }} />
    </div>
  );

  if (!project) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
      <Rocket size={40} className="mb-4" style={{ color: "rgba(34,197,94,0.3)" }} />
      <p className="font-bold" style={{ color: "#e6edf3" }}>Project not found</p>
      <button onClick={() => navigate("/launchpad")} className="mt-4 text-sm" style={{ color: "#22C55E", background: "none", border: "none", cursor: "pointer" }}>
        ← Back to Launchpad
      </button>
    </div>
  );

  return (
    <div className="fade-up px-4 sm:px-6 max-w-5xl mx-auto py-8" style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}>
      {/* Back */}
      <button onClick={() => navigate("/launchpad")}
        className="flex items-center gap-2 text-sm mb-6 hover:opacity-80 transition-opacity"
        style={{ color: "#9da7b3", background: "none", border: "none", cursor: "pointer" }}>
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

        {/* ── Left column ── */}
        <div className="lg:col-span-3 space-y-5">

          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
              style={{ border: "3px solid #0b0f14", background: "#161d28" }}>
              {project.logo_url
                ? <img src={project.logo_url} alt={project.name} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center text-xl font-bold" style={{ color: "#22C55E" }}>{project.name[0]}</div>}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl font-extrabold" style={{ color: "#e6edf3" }}>{project.name}</h1>
                {soldOut && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                    style={{ background: "rgba(107,114,128,0.15)", color: "#6b7280", border: "1px solid rgba(107,114,128,0.3)" }}>
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
                  <a href={EXPLORER_BASE + "/address/" + nftContract} target="_blank" rel="noreferrer"
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

          {/* Mint progress */}
          {nftContract && maxSupply > 0n && (
            <div className="rounded-2xl p-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <MintProgress minted={totalMinted} max={maxSupply} />
            </div>
          )}

          {/* Phases */}
          <div>
            <h2 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#9da7b3" }}>
              Mint Phases
            </h2>
            {phasesLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 rounded-xl animate-pulse" style={{ background: "#161d28" }} />
                ))}
              </div>
            ) : phasesError ? (
              <div className="rounded-xl px-4 py-3 text-xs"
                style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                {phasesError}
              </div>
            ) : phases.length === 0 ? (
              <div className="rounded-xl px-4 py-4 text-sm text-center" style={{ color: "#9da7b3", background: "#161d28" }}>
                No phases configured yet.
              </div>
            ) : (
              <div className="space-y-3">
                {phases.map((phase, i) => (
                  <PhaseCard
                    key={i}
                    phase={phase}
                    phaseId={i}
                    selected={displayPhaseId === i}
                    onSelect={setSelectedPhaseId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right column — sticky mint widget ── */}
        <div className="lg:col-span-2">
          <div className="sticky top-6 space-y-4">

            {/* Mint widget */}
            {nftContract && displayPhase ? (
              <MintWidget
                phase={displayPhase}
                phaseId={displayPhaseId}
                nftContract={nftContract}
                onSuccess={reload}
              />
            ) : nftContract && !phasesLoading && phases.length > 0 ? (
              <div className="rounded-2xl p-5 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                <p className="text-sm" style={{ color: "#9da7b3" }}>Select a live phase to mint.</p>
              </div>
            ) : !nftContract ? (
              <div className="rounded-2xl p-5 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                <Zap size={28} className="mx-auto mb-3" style={{ color: "rgba(34,197,94,0.3)" }} />
                <p className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>Contract Not Deployed</p>
                <p className="text-xs" style={{ color: "#9da7b3" }}>This project hasn't deployed its contract yet.</p>
              </div>
            ) : null}

            {/* Details panel */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9da7b3" }}>Details</h3>
              {[
                { label: "Max Supply",    value: project.max_supply?.toLocaleString() ?? "—" },
                { label: "Mint Price",    value: project.mint_price != null ? project.mint_price + " USD" : "See phases" },
                { label: "Platform Fee",  value: "$0.05 per mint" },
                { label: "Payment",       value: "pathUSD (ERC-20)" },
                { label: "Blockchain",    value: "Tempo Chain" },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-xs">
                  <span style={{ color: "#9da7b3" }}>{label}</span>
                  <span className="font-mono font-semibold" style={{ color: "#e6edf3" }}>{value}</span>
                </div>
              ))}
              {nftContract && (
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "#9da7b3" }}>Contract</span>
                  <a href={EXPLORER_BASE + "/address/" + nftContract} target="_blank" rel="noreferrer"
                    className="font-mono flex items-center gap-1" style={{ color: "#22C55E" }}>
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
