// pages/MintPage.jsx
// Accessible without wallet. Works for any project status (draft/live/featured).
// Looks up by contract address OR project id — no status filter blocking display.

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount, useChainId } from "wagmi";
import {
  ArrowLeft, Globe, Twitter, ExternalLink, CheckCircle2,
  Clock, Minus, Plus, Zap, AlertCircle, Rocket, ShieldCheck,
  Lock, Globe2, MessageCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  usePhases, useWalletMintState, useMint, useQuoteMintCost,
  usePathUSDBalance, phaseStatus, isPublicPhase, formatPrice,
  PHASE_META, PLATFORM_FEE_RAW,
} from "@/hooks/useMint";

const EXPLORER_BASE  = "https://explore.tempo.xyz";
const TEMPO_CHAIN_ID = 4217;
const GREEN          = "#22C55E";
const FONT           = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// ─── Direct project lookup — NO status filter, NO external hook ───────────────
// Queries projects table first, then falls back to collections table.
// This is the root fix: useFeaturedProjects was filtering out "draft" projects.
function useProject(slugOrAddress) {
  const [project,  setProject]  = useState(null);
  const [loading,  setLoading]  = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slugOrAddress) { setLoading(false); setNotFound(true); return; }
    let cancelled = false;

    async function load() {
      setLoading(true);
      setNotFound(false);
      const val   = slugOrAddress.toLowerCase();
      const isAddr = val.startsWith("0x");

      // 1. Try projects table — match by contract_address (primary) or id
      const { data: rows, error: projErr } = await supabase
        .from("projects")
        .select("*")
        .or(isAddr ? `contract_address.ilike.${val}` : `id.eq.${slugOrAddress},contract_address.ilike.${val}`)
        .limit(1);

      if (projErr) console.warn("[MintPage] projects lookup:", projErr.message);

      if (!cancelled && rows?.[0]) {
        setProject(rows[0]);
        setLoading(false);
        return;
      }

      // 2. Fall back to collections table (externally added collections)
      const { data: cols, error: colErr } = await supabase
        .from("collections")
        .select("*")
        .or(isAddr ? `contract_address.ilike.${val}` : `slug.eq.${slugOrAddress},contract_address.ilike.${val}`)
        .limit(1);

      if (colErr) console.warn("[MintPage] collections lookup:", colErr.message);

      if (!cancelled && cols?.[0]) {
        const c = cols[0];
        // Map collection row to project shape
        setProject({
          id:               c.slug || c.contract_address,
          name:             c.name,
          description:      c.description || "",
          logo_url:         c.logo_url    || null,
          banner_url:       c.banner_url  || null,
          contract_address: c.contract_address,
          max_supply:       c.total_supply || 0,
          mint_price:       null,
          website:          c.website_url || null,
          twitter:          c.twitter_url || null,
          discord:          c.discord_url || null,
          status:           "live",
        });
        setLoading(false);
        return;
      }

      if (!cancelled) { setNotFound(true); setLoading(false); }
    }

    load();
    return () => { cancelled = true; };
  }, [slugOrAddress]);

  return { project, loading, notFound };
}

// ─── Countdown ────────────────────────────────────────────────────────────────
function useCountdown(targetSec) {
  const [display, setDisplay] = useState("");
  useEffect(() => {
    if (!targetSec || Number(targetSec) === 0) return;
    function tick() {
      const diff = Number(targetSec) * 1000 - Date.now();
      if (diff <= 0) { setDisplay("Live"); return; }
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
    live:     { label: "● LIVE",     color: GREEN,     bg: "rgba(34,197,94,0.12)",   border: "rgba(34,197,94,0.3)"   },
    upcoming: { label: "◎ UPCOMING", color: "#f59e0b", bg: "rgba(245,158,11,0.1)",   border: "rgba(245,158,11,0.3)"  },
    ended:    { label: "✕ ENDED",    color: "#6b7280", bg: "rgba(107,114,128,0.08)", border: "rgba(107,114,128,0.2)" },
    inactive: { label: "— OFF",      color: "#6b7280", bg: "rgba(107,114,128,0.06)", border: "rgba(107,114,128,0.15)"},
  }[status] || { label: status?.toUpperCase() || "—", color: "#9da7b3", bg: "transparent", border: "rgba(255,255,255,0.1)" };
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold tracking-widest"
      style={{ color: cfg.color, background: cfg.bg, border: "1px solid " + cfg.border, fontFamily: FONT }}>
      {cfg.label}
    </span>
  );
}

// ─── Mint Progress ────────────────────────────────────────────────────────────
function MintProgress({ minted, max }) {
  const pct = max > 0n ? Math.min(100, Math.round(Number(minted * 100n / max))) : 0;
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
          style={{ width: pct + "%", background: "linear-gradient(90deg, " + GREEN + ", #16a34a)" }} />
      </div>
      <div className="text-[10px] mt-1 text-right font-mono" style={{ color: "#9da7b3" }}>{pct}% minted</div>
    </div>
  );
}

// ─── Phase Card (clickable row) ───────────────────────────────────────────────
function PhaseCard({ phase, phaseId, selected, onSelect }) {
  const status   = phaseStatus(phase);
  const meta     = PHASE_META[phaseId] || {};
  const isPublic = isPublicPhase(phase);
  const countdown = useCountdown(status === "upcoming" ? phase.startTime : 0n);
  const COLORS   = ["#f59e0b", "#a78bfa", GREEN];
  const color    = COLORS[phaseId] ?? GREEN;

  return (
    <div
      onClick={() => (status === "live" || status === "upcoming") && onSelect(phaseId)}
      className="rounded-xl p-4 transition-all duration-200"
      style={{
        background: selected ? "rgba(34,197,94,0.06)" : "#161d28",
        border: selected ? "1px solid rgba(34,197,94,0.4)" : status === "live" ? "1px solid rgba(34,197,94,0.15)" : "1px solid rgba(255,255,255,0.06)",
        cursor: status === "live" || status === "upcoming" ? "pointer" : "default",
        opacity: status === "ended" || status === "inactive" ? 0.45 : 1,
        fontFamily: FONT,
      }}>

      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            {isPublic ? <Globe2 size={13} style={{ color }} /> : <Lock size={13} style={{ color }} />}
            <span className="font-bold text-sm" style={{ color: "#e6edf3" }}>
              {phase.name || meta.label || ("Phase " + phaseId)}
            </span>
          </div>
          <div className="text-[10px] mt-0.5" style={{ color: "#9da7b3" }}>
            {isPublic ? "Open to everyone" : "Allowlist required"}
            {phase.maxPerWallet > 0n && " · Max " + Number(phase.maxPerWallet) + "/wallet"}
          </div>
        </div>
        <PhaseBadge status={status} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg p-2" style={{ background: "#0b0f14" }}>
          <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Price</div>
          <div className="text-sm font-mono font-bold" style={{ color: GREEN }}>
            {Number(phase.price) === 0 ? "FREE" : formatPrice(phase.price) + " USD"}
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
        <div className="flex items-center gap-1.5 text-xs mt-2" style={{ color: "#9da7b3" }}>
          <Clock size={11} />
          Starts in <span className="font-mono font-bold" style={{ color: GREEN }}>{countdown}</span>
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

  const status        = phaseStatus(phase);
  const isPublic      = isPublicPhase(phase);
  const wrongNetwork  = chainId !== TEMPO_CHAIN_ID;
  const maxPerWallet  = Number(phase.maxPerWallet);
  const alreadyMinted = Number(mintedByWallet);
  const remaining     = maxPerWallet > 0 ? Math.max(0, maxPerWallet - alreadyMinted) : 10;
  const maxQty        = Math.min(remaining, 10);
  const isSoldOut     = phase.maxSupply > 0n && phase.minted >= phase.maxSupply;

  const { quote: quotedCost, loading: quoting } = useQuoteMintCost(nftContract, phaseId, quantity);
  const balance = usePathUSDBalance();

  const mintPrice    = phase.price * BigInt(quantity);
  const platformFee  = PLATFORM_FEE_RAW * BigInt(quantity);
  const totalDisplay = quotedCost ? formatPrice(quotedCost) : formatPrice(mintPrice + platformFee);
  const hasBalance   = balance == null ? true : quotedCost ? BigInt(balance) >= quotedCost : true;
  const busy         = step === "approving" || step === "minting";

  const canMint = isConnected && !wrongNetwork && !busy && status === "live"
    && !isSoldOut && (maxQty > 0 || maxPerWallet === 0) && hasBalance;

  const btnLabel =
    !isConnected          ? "Connect Wallet"        :
    wrongNetwork          ? "Switch to Tempo"        :
    isSoldOut             ? "Sold Out"               :
    step === "approving"  ? "Approving pathUSD..."   :
    step === "minting"    ? "Minting..."             :
    step === "done"       ? "Minted! 🎉 Mint More"   :
    status === "upcoming" ? "Not Live Yet"           :
    status === "ended"    ? "Phase Ended"            :
    !hasBalance           ? "Insufficient pathUSD"   :
    maxQty === 0          ? "Wallet Limit Reached"   :
    "Mint Now";

  async function handleMint() {
    if (!canMint) return;
    await mint({ phaseId, quantity, merkleProof: [], quotedCost });
    if (step !== "error") onSuccess?.();
  }

  return (
    <div className="rounded-2xl p-5 space-y-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)", fontFamily: FONT }}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: "#9da7b3" }}>
          {phase.name || PHASE_META[phaseId]?.label || "Mint"}
        </h3>
        <PhaseBadge status={status} />
      </div>

      {/* Quantity */}
      {(status === "live" || status === "upcoming") && !isSoldOut && (
        <div>
          <div className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "#9da7b3" }}>Quantity</div>
          <div className="flex items-center gap-3">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#e6edf3" }}>
              <Minus size={14} />
            </button>
            <span className="flex-1 text-center font-mono text-2xl font-bold" style={{ color: "#e6edf3" }}>{quantity}</span>
            <button onClick={() => setQuantity(q => Math.min(maxQty || 10, q + 1))}
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", cursor: "pointer", color: "#e6edf3" }}>
              <Plus size={14} />
            </button>
          </div>
          {maxPerWallet > 0 && (
            <div className="text-[10px] mt-1.5 text-center" style={{ color: "#9da7b3" }}>
              {alreadyMinted} / {maxPerWallet} minted by this wallet
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
          <span className="font-mono" style={{ color: "#9da7b3" }}>{formatPrice(platformFee)} USD</span>
        </div>
        <div className="border-t pt-2 flex justify-between items-baseline" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
          <span className="text-sm font-bold" style={{ color: "#e6edf3" }}>Total</span>
          {quoting
            ? <span className="text-xs" style={{ color: "#9da7b3" }}>Calculating…</span>
            : <span className="font-mono text-xl font-bold" style={{ color: GREEN }}>
                {totalDisplay} <span className="text-sm" style={{ color: "#9da7b3" }}>USD</span>
              </span>}
        </div>
      </div>

      {/* Balance */}
      {balance != null && (
        <div className="flex justify-between text-xs">
          <span style={{ color: "#9da7b3" }}>Your pathUSD</span>
          <span className="font-mono font-bold" style={{ color: hasBalance ? GREEN : "#EF4444" }}>
            {formatPrice(balance)} USD
          </span>
        </div>
      )}

      {/* Alerts */}
      {wrongNetwork && isConnected && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> Switch to Tempo Mainnet (Chain ID 4217).
        </div>
      )}
      {!isPublic && status === "live" && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2 text-xs"
          style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
          <Lock size={13} className="flex-shrink-0 mt-0.5" /> This phase requires an allowlist spot.
        </div>
      )}
      {step === "error" && error && (
        <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
          <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {step === "done" && (
        <div className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs"
          style={{ background: "rgba(34,197,94,0.08)", color: GREEN, border: "1px solid rgba(34,197,94,0.2)" }}>
          <CheckCircle2 size={13} /> Minted successfully! Check your wallet.
        </div>
      )}

      {/* Mint button */}
      <button
        onClick={step === "done" ? reset : handleMint}
        disabled={!canMint && step !== "done"}
        className="w-full h-14 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all"
        style={{
          background:  canMint || step === "done" ? GREEN     : "#161d28",
          color:       canMint || step === "done" ? "#0b0f14" : "#6b7280",
          border:      canMint || step === "done" ? "none"    : "1px solid rgba(255,255,255,0.06)",
          cursor:      canMint || step === "done" ? "pointer" : "not-allowed",
          boxShadow:   canMint ? "0 0 28px rgba(34,197,94,0.3)" : "none",
          fontFamily:  FONT,
          fontSize:    "15px",
        }}>
        {busy && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
        {btnLabel}
      </button>

      <div className="flex items-center justify-center gap-1.5 text-[10px]" style={{ color: "#9da7b3" }}>
        <ShieldCheck size={12} style={{ color: GREEN }} />
        Secured by Tempo · Payment in pathUSD
      </div>
    </div>
  );
}

// ─── Main MintPage ────────────────────────────────────────────────────────────
export default function MintPage() {
  const { slug }  = useParams();
  const navigate  = useNavigate();

  // ✅ Direct Supabase lookup — no status filter, no useFeaturedProjects wrapper
  const { project, loading: projectLoading, notFound } = useProject(slug);

  const nftContract = project?.contract_address;
  const {
    phases, activePhaseId, totalMinted, maxSupply,
    loading: phasesLoading, error: phasesError, reload,
  } = usePhases(nftContract);

  const [selectedPhaseId, setSelectedPhaseId] = useState(null);

  useEffect(() => {
    if (!phases.length) return;
    if (activePhaseId != null && Number(activePhaseId) >= 0) {
      setSelectedPhaseId(Number(activePhaseId));
    } else {
      const liveIdx = phases.findIndex(p => phaseStatus(p) === "live");
      setSelectedPhaseId(liveIdx >= 0 ? liveIdx : 0);
    }
  }, [phases, activePhaseId]);

  const displayPhaseId = selectedPhaseId ?? 0;
  const displayPhase   = phases[displayPhaseId] ?? null;
  const soldOut        = maxSupply > 0n && totalMinted >= maxSupply;

  // ── Loading ──────────────────────────────────────────────────────────────────
  if (projectLoading) return (
    <div className="flex items-center justify-center min-h-[70vh]" style={{ fontFamily: FONT }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: GREEN }} />
        <span className="text-sm" style={{ color: "#9da7b3" }}>Loading mint page…</span>
      </div>
    </div>
  );

   // ── Not found ─────────────────────────────────────────────────────────────────
  if (notFound || !project) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6 gap-5" style={{ fontFamily: FONT }}>
      <Rocket size={48} style={{ color: "rgba(34,197,94,0.2)" }} />
      <div>
        <p className="font-extrabold text-xl mb-1" style={{ color: "#e6edf3" }}>Mint Not Found</p>
        <p className="text-sm" style={{ color: "#9da7b3" }}>
          No project found for{" "}
          <code className="font-mono text-xs px-2 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.06)", color: GREEN }}>
            {slug || "this URL"}
          </code>
        </p>
        <p className="text-xs mt-2" style={{ color: "#6b7280" }}>
          Try going from Launchpad, or use the full contract address in the URL.
        </p>
      </div>
      <div className="flex gap-3">
        <button onClick={() => navigate("/launchpad")}
          className="h-10 px-5 rounded-xl text-sm font-bold"
          style={{ background: "rgba(34,197,94,0.1)", color: GREEN, border: "1px solid rgba(34,197,94,0.2)", cursor: "pointer" }}>
          Launchpad
        </button>
        <button onClick={() => navigate("/")}
          className="h-10 px-5 rounded-xl text-sm font-bold"
          style={{ background: "#161d28", color: "#9da7b3", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
          Market
        </button>
      </div>
    </div>
  );

  // ── Full page ─────────────────────────────────────────────────────────────────
  return (
    <div className="fade-up pb-20" style={{ background: "#0b0f14", fontFamily: FONT, minHeight: "100vh" }}>

      {/* Banner */}
      <div className="relative h-52 w-full overflow-hidden">
        {project.banner_url
          ? <img src={project.banner_url} alt="" className="w-full h-full object-cover" />
          : <div className="w-full h-full" style={{ background: "linear-gradient(135deg, #0e2233, #031220)" }} />}
        <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, #0b0f14)" }} />
        {/* Back button on banner */}
        <button onClick={() => navigate("/launchpad")}
          className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-bold backdrop-blur-sm"
          style={{ background: "rgba(11,15,20,0.7)", color: "#9da7b3", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
          <ArrowLeft size={13} /> Launchpad
        </button>
      </div>

      <div className="px-4 sm:px-6 max-w-5xl mx-auto -mt-16 relative z-10">

        {/* Header */}
        <div className="flex items-end gap-4 mb-8">
          <div className="w-24 h-24 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ border: "4px solid #0b0f14", background: "#161d28" }}>
            {project.logo_url
              ? <img src={project.logo_url} alt={project.name} className="w-full h-full object-cover" />
              : <div className="w-full h-full flex items-center justify-center text-3xl font-extrabold" style={{ color: GREEN }}>
                  {(project.name || "?")[0].toUpperCase()}
                </div>}
          </div>
          <div className="flex-1 pb-1">
            <h1 className="text-2xl font-extrabold mb-1" style={{ color: "#e6edf3" }}>{project.name}</h1>
            <div className="flex items-center gap-3">
              {project.twitter && (
                <a href={project.twitter} target="_blank" rel="noreferrer"
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#9da7b3" }}>
                  <Twitter size={12} />
                </a>
              )}
              {project.discord && (
                <a href={project.discord} target="_blank" rel="noreferrer"
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#9da7b3" }}>
                  <MessageCircle size={12} />
                </a>
              )}
              {project.website && (
                <a href={project.website} target="_blank" rel="noreferrer"
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#9da7b3" }}>
                  <Globe size={12} />
                </a>
              )}
              {nftContract && (
                <a href={EXPLORER_BASE + "/address/" + nftContract} target="_blank" rel="noreferrer"
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#9da7b3" }}>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left: info + phases ── */}
          <div className="lg:col-span-3 space-y-6">

            {project.description && (
              <p className="text-sm leading-relaxed" style={{ color: "#9da7b3" }}>{project.description}</p>
            )}

            {/* Mint progress */}
            {nftContract && maxSupply > 0n && (
              <div className="rounded-2xl p-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                <MintProgress minted={totalMinted} max={maxSupply} />
              </div>
            )}

            {/* Phase list */}
            <div>
              <h2 className="text-xs font-bold tracking-widest uppercase mb-3" style={{ color: "#9da7b3" }}>
                Mint Phases
              </h2>
              {!nftContract ? (
                <div className="rounded-xl px-4 py-6 text-center text-sm" style={{ color: "#9da7b3", background: "#121821" }}>
                  Contract not deployed yet.
                </div>
              ) : phasesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: "#161d28" }} />
                  ))}
                </div>
              ) : phasesError ? (
                <div className="rounded-xl px-4 py-3 text-xs"
                  style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)" }}>
                  {phasesError}
                </div>
              ) : phases.length === 0 ? (
                <div className="rounded-xl px-4 py-6 text-center text-sm" style={{ color: "#9da7b3", background: "#121821" }}>
                  No mint phases configured yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {phases.map((phase, i) => (
                    <PhaseCard key={i} phase={phase} phaseId={i}
                      selected={displayPhaseId === i}
                      onSelect={setSelectedPhaseId} />
                  ))}
                </div>
              )}
            </div>

            {/* Details */}
            <div className="rounded-2xl p-4 space-y-3" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#9da7b3" }}>Collection Info</h3>
              {[
                ["Max Supply",   project.max_supply ? Number(project.max_supply).toLocaleString() : "—"],
                ["Payment",      "pathUSD (ERC-20)"],
                ["Platform Fee", "$0.05 per mint"],
                ["Blockchain",   "Tempo Chain"],
              ].map(([l, v]) => (
                <div key={l} className="flex items-center justify-between text-xs">
                  <span style={{ color: "#9da7b3" }}>{l}</span>
                  <span className="font-mono font-semibold" style={{ color: "#e6edf3" }}>{v}</span>
                </div>
              ))}
              {nftContract && (
                <div className="flex items-center justify-between text-xs">
                  <span style={{ color: "#9da7b3" }}>Contract</span>
                  <a href={EXPLORER_BASE + "/address/" + nftContract} target="_blank" rel="noreferrer"
                    className="font-mono flex items-center gap-1" style={{ color: GREEN }}>
                    {nftContract.slice(0, 6)}…{nftContract.slice(-4)} <ExternalLink size={10} />
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: sticky mint widget ── */}
          <div className="lg:col-span-2">
            <div className="sticky top-6">
              {nftContract && displayPhase ? (
                <MintWidget
                  phase={displayPhase}
                  phaseId={displayPhaseId}
                  nftContract={nftContract}
                  onSuccess={reload}
                />
              ) : nftContract && !phasesLoading ? (
                <div className="rounded-2xl p-6 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Zap size={28} className="mx-auto mb-3" style={{ color: "rgba(34,197,94,0.3)" }} />
                  <p className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>No Active Phase</p>
                  <p className="text-xs" style={{ color: "#9da7b3" }}>Mint phases haven't been configured yet.</p>
                </div>
              ) : !nftContract ? (
                <div className="rounded-2xl p-6 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <Rocket size={28} className="mx-auto mb-3" style={{ color: "rgba(34,197,94,0.2)" }} />
                  <p className="text-sm font-bold mb-1" style={{ color: "#e6edf3" }}>Coming Soon</p>
                  <p className="text-xs" style={{ color: "#9da7b3" }}>Contract not yet deployed.</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}