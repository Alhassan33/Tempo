/**
 * pages/CollectionManagerPage.jsx
 *
 * Creator's private dashboard for managing their deployed collection.
 * Route: /studio/manage/:contractAddress
 *
 * Features:
 *   - Phase management (add/edit OG, Whitelist, Public)
 *   - CSV allowlist upload → generates Merkle root → pushes to contract
 *   - Reveal collection (set baseURI on-chain + update Supabase)
 *   - Withdraw earnings
 *   - Live mint stats
 *
 * Access: only the collection's `creator` address can manage it.
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount, usePublicClient, useWriteContract, useChainId } from "wagmi";
import {
  Settings, Zap, Upload, Globe, ArrowLeft,
  CheckCircle2, AlertCircle, ToggleLeft, ToggleRight,
  ExternalLink, Copy, Check, RefreshCw, Users,
  DollarSign, Eye, Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { parseCSV, buildAllowlist } from "@/utils/merkleUtils";

// ─── Constants ────────────────────────────────────────────────────────────────
const TEMPO_CHAIN_ID = 4217;
const EXPLORER_BASE  = "https://explore.tempo.xyz";
const ZERO_BYTES32   = "0x0000000000000000000000000000000000000000000000000000000000000000";

// ─── Collection ABI ───────────────────────────────────────────────────────────
const COLLECTION_ABI = [
  // Read
  { name: "totalMinted",     type: "function", stateMutability: "view",       inputs: [],                                                                               outputs: [{ type: "uint256" }] },
  { name: "maxSupply",       type: "function", stateMutability: "view",       inputs: [],                                                                               outputs: [{ type: "uint256" }] },
  { name: "totalPhases",     type: "function", stateMutability: "view",       inputs: [],                                                                               outputs: [{ type: "uint256" }] },
  { name: "creator",         type: "function", stateMutability: "view",       inputs: [],                                                                               outputs: [{ type: "address" }] },
  { name: "getFeeConfig",    type: "function", stateMutability: "view",       inputs: [],                                                                               outputs: [{ name: "", type: "tuple", components: [{ name: "minterFeeBps", type: "uint256" }, { name: "creatorFeeBps", type: "uint256" }, { name: "perMintFlatFee", type: "uint256" }, { name: "royaltyBps", type: "uint256" }] }] },
  {
    name: "getPhase", type: "function", stateMutability: "view",
    inputs: [{ name: "phaseId", type: "uint256" }],
    outputs: [{ name: "", type: "tuple", components: [
      { name: "name",         type: "string"  },
      { name: "startTime",    type: "uint256" },
      { name: "endTime",      type: "uint256" },
      { name: "price",        type: "uint256" },
      { name: "maxSupply",    type: "uint256" },
      { name: "maxPerWallet", type: "uint256" },
      { name: "merkleRoot",   type: "bytes32" },
      { name: "active",       type: "bool"    },
      { name: "minted",       type: "uint256" },
    ]}],
  },
  // Write
  { name: "addPhase",        type: "function", stateMutability: "nonpayable", inputs: [{ name: "name_", type: "string" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }, { name: "price", type: "uint256" }, { name: "maxSupply_", type: "uint256" }, { name: "maxPerWallet", type: "uint256" }, { name: "merkleRoot", type: "bytes32" }], outputs: [] },
  { name: "updatePhase",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "phaseId", type: "uint256" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }, { name: "price", type: "uint256" }, { name: "maxPerWallet", type: "uint256" }, { name: "merkleRoot", type: "bytes32" }, { name: "active", type: "bool" }], outputs: [] },
  { name: "reveal",          type: "function", stateMutability: "nonpayable", inputs: [{ name: "baseURI", type: "string" }],                                            outputs: [] },
  { name: "withdraw",        type: "function", stateMutability: "nonpayable", inputs: [],                                                                               outputs: [] },
  { name: "updateFeeConfig", type: "function", stateMutability: "nonpayable", inputs: [{ name: "_minterFeeBps", type: "uint256" }, { name: "_creatorFeeBps", type: "uint256" }, { name: "_perMintFlatFee", type: "uint256" }], outputs: [] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt6   = (v)   => v != null ? (Number(v) / 1e6).toFixed(2) : "0.00";
const toRaw  = (usd) => BigInt(Math.round(Number(usd) * 1_000_000));
const toTs   = (dt)  => dt ? BigInt(Math.floor(new Date(dt).getTime() / 1000)) : 0n;
const fromTs = (ts)  => ts && Number(ts) > 0 ? new Date(Number(ts) * 1000).toISOString().slice(0, 16) : "";

const PHASE_NAMES  = ["OG", "Whitelist", "Public"];
const PHASE_COLORS = ["#f59e0b", "#a78bfa", "#22d3ee"];

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const c = { success: "#22C55E", error: "#EF4444", info: "#22d3ee" };
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2"
      style={{ background: "#121821", border: "1px solid " + (c[type] || c.info), color: c[type] || c.info, backdropFilter: "blur(12px)" }}>
      {type === "success" ? <CheckCircle2 size={15} /> : type === "error" ? <AlertCircle size={15} /> : <RefreshCw size={15} />}
      {msg}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, accent = "#22d3ee", children }) {
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center gap-2.5 px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(34,211,238,0.08)" }}>
          <Icon size={13} style={{ color: accent }} />
        </div>
        <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Phase editor ─────────────────────────────────────────────────────────────
function PhaseEditor({ phaseId, phase, contractAddress, onSaved, onToast }) {
  const publicClient       = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const isNew = !phase;
  const name  = phase?.name || PHASE_NAMES[phaseId] || "Phase " + phaseId;
  const color = PHASE_COLORS[phaseId] || "#22d3ee";

  const [form, setForm] = useState({
    price:        fmt6(phase?.price ?? 0),
    maxPerWallet: Number(phase?.maxPerWallet ?? 0).toString(),
    startTime:    fromTs(phase?.startTime),
    endTime:      fromTs(phase?.endTime),
    merkleRoot:   phase?.merkleRoot || ZERO_BYTES32,
    active:       phase?.active ?? true,
  });

  const [saving,         setSaving]         = useState(false);
  const [csvUploading,   setCsvUploading]   = useState(false);
  const [allowlistCount, setAllowlistCount] = useState(0);

  const isPublicPhase = !form.merkleRoot || form.merkleRoot === ZERO_BYTES32;

  // ── CSV → Merkle → contract ──────────────────────────────────────────────
  async function handleCSV(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvUploading(true);
    onToast("Parsing CSV and generating Merkle root…", "info");

    try {
      const text = await file.text();
      const addresses = parseCSV(text);

      if (addresses.length === 0) {
        onToast("No valid addresses found in CSV", "error");
        setCsvUploading(false);
        return;
      }

      const allowlist = await buildAllowlist(addresses);
      setAllowlistCount(allowlist.count);
      setForm(f => ({ ...f, merkleRoot: allowlist.root }));

      // Save proofs to Supabase so the mint page can look them up
      await supabase.from("allowlists").upsert({
        contract_address: contractAddress.toLowerCase(),
        phase_id:         phaseId,
        merkle_root:      allowlist.root,
        addresses:        allowlist.addresses,
        proofs:           allowlist.proofs,
        count:            allowlist.count,
        updated_at:       new Date().toISOString(),
      }, { onConflict: "contract_address,phase_id" });

      onToast(`✓ ${allowlist.count} addresses loaded. Root: ${allowlist.root.slice(0, 12)}…`, "success");
    } catch (err) {
      onToast("CSV error: " + (err.message || "unknown"), "error");
    } finally {
      setCsvUploading(false);
      e.target.value = "";
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const args = [
        toTs(form.startTime),
        toTs(form.endTime),
        toRaw(form.price),
        BigInt(form.maxPerWallet || 0),
        form.merkleRoot || ZERO_BYTES32,
        form.active,
      ];

      let hash;
      if (isNew) {
        hash = await writeContractAsync({
          address: contractAddress, abi: COLLECTION_ABI, functionName: "addPhase",
          args: [name, args[0], args[1], args[2], 0n, args[3], args[4]],
        });
      } else {
        hash = await writeContractAsync({
          address: contractAddress, abi: COLLECTION_ABI, functionName: "updatePhase",
          args: [BigInt(phaseId), ...args],
        });
      }

      onToast("Waiting for confirmation…", "info");
      await publicClient.waitForTransactionReceipt({ hash });
      onToast(name + " phase saved!", "success");
      onSaved?.();
    } catch (e) {
      onToast(e?.shortMessage || "Transaction failed", "error");
    } finally { setSaving(false); }
  }

  return (
    <div className="rounded-xl p-4 space-y-4" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Phase header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="font-bold text-sm" style={{ color: "#e6edf3" }}>{name}</span>
          {!isNew && <span className="text-[10px] px-2 py-0.5 rounded-md font-bold" style={{ background: "rgba(255,255,255,0.06)", color: "#9da7b3" }}>Phase #{phaseId}</span>}
          {!isPublicPhase && allowlistCount > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold" style={{ background: "rgba(167,139,250,0.12)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
              {allowlistCount} wallets
            </span>
          )}
        </div>
        <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}
          style={{ background: "none", border: "none", cursor: "pointer", color: form.active ? "#22C55E" : "#9da7b3" }}
          className="flex items-center gap-1.5 text-xs font-bold">
          {form.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {form.active ? "Active" : "Inactive"}
        </button>
      </div>

      {/* Stats for existing phases */}
      {!isNew && phase && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2.5" style={{ background: "#0b0f14" }}>
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Minted</div>
            <div className="font-mono font-bold text-sm" style={{ color: "#e6edf3" }}>{Number(phase.minted).toLocaleString()}</div>
          </div>
          <div className="rounded-lg p-2.5" style={{ background: "#0b0f14" }}>
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Type</div>
            <div className="font-mono font-bold text-sm" style={{ color: isPublicPhase ? "#22d3ee" : "#a78bfa" }}>
              {isPublicPhase ? "Public" : "Allowlist"}
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>Mint Price (USD)</label>
          <input type="number" step="0.01" placeholder="0.00" value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm outline-none font-mono"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>Max Per Wallet</label>
          <input type="number" placeholder="0 = unlimited" value={form.maxPerWallet}
            onChange={e => setForm(f => ({ ...f, maxPerWallet: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm outline-none font-mono"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>Start Time</label>
          <input type="datetime-local" value={form.startTime}
            onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm outline-none"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", colorScheme: "dark" }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>End Time <span style={{ color: "#6b7280" }}>(blank = no end)</span></label>
          <input type="datetime-local" value={form.endTime}
            onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm outline-none"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", colorScheme: "dark" }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"} />
        </div>
      </div>

      {/* Allowlist upload (OG + Whitelist only) */}
      {phaseId < 2 && (
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-2" style={{ color: "#9da7b3" }}>
            Allowlist (CSV/TXT)
          </label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 h-10 px-4 rounded-lg text-xs font-bold cursor-pointer"
              style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.2)" }}>
              {csvUploading
                ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Parsing…</>
                : <><Upload size={13} /> Upload CSV</>
              }
              <input type="file" accept=".csv,.txt" className="hidden" onChange={handleCSV} disabled={csvUploading} />
            </label>
            {!isPublicPhase && (
              <span className="text-xs" style={{ color: "#9da7b3" }}>
                Root: <code className="font-mono text-[10px]" style={{ color: "#a78bfa" }}>{form.merkleRoot.slice(0, 14)}…</code>
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[10px]" style={{ color: "#6b7280" }}>
            One address per line, or comma-separated. Generates Merkle root automatically.
          </p>
        </div>
      )}

      {/* Save */}
      <button onClick={handleSave} disabled={saving}
        className="w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
        style={{ background: saving ? "#161d28" : color, color: saving ? "#9da7b3" : "#0b0f14", border: "none", cursor: saving ? "not-allowed" : "pointer" }}>
        {saving && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
        {saving ? "Pushing to chain…" : isNew ? "Add Phase On-Chain" : "Save Phase On-Chain"}
      </button>
    </div>
  );
}

// ─── Main CollectionManagerPage ───────────────────────────────────────────────
export default function CollectionManagerPage() {
  const { contractAddress }      = useParams();
  const navigate                 = useNavigate();
  const { address, isConnected } = useAccount();
  const chainId                  = useChainId();
  const publicClient             = usePublicClient();
  const { writeContractAsync }   = useWriteContract();

  const [project,     setProject]     = useState(null);
  const [chainData,   setChainData]   = useState(null);
  const [phases,      setPhases]      = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [authorized,  setAuthorized]  = useState(false);
  const [toast,       setToast]       = useState({ msg: "", type: "info" });
  const [revealUri,   setRevealUri]   = useState("");
  const [revealing,   setRevealing]   = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [copied,      setCopied]      = useState(false);

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "info" }), 4000);
  }

  const loadChain = useCallback(async () => {
    if (!contractAddress || !publicClient) return;
    try {
      const [minted, max, totalP, fees, onchainCreator] = await Promise.all([
        publicClient.readContract({ address: contractAddress, abi: COLLECTION_ABI, functionName: "totalMinted" }).catch(() => 0n),
        publicClient.readContract({ address: contractAddress, abi: COLLECTION_ABI, functionName: "maxSupply" }).catch(() => 0n),
        publicClient.readContract({ address: contractAddress, abi: COLLECTION_ABI, functionName: "totalPhases" }).catch(() => 0n),
        publicClient.readContract({ address: contractAddress, abi: COLLECTION_ABI, functionName: "getFeeConfig" }).catch(() => null),
        // ✅ creator() may not exist on all contracts — catch and return null
        publicClient.readContract({ address: contractAddress, abi: COLLECTION_ABI, functionName: "creator" }).catch(() => null),
      ]);

      setChainData({ minted, max, fees, creator: onchainCreator });

      // ✅ Authorization: check on-chain creator first, then fall back to Supabase creator_wallet
      if (address) {
        if (onchainCreator && onchainCreator.toLowerCase() === address.toLowerCase()) {
          setAuthorized(true);
        }
        // Fallback: check projects table for creator_wallet match
        // (handles contracts that don't expose creator(), or were deployed externally)
        else {
          const { data: proj } = await supabase
            .from("projects")
            .select("creator_wallet, creator_address")
            .eq("contract_address", contractAddress.toLowerCase())
            .maybeSingle();
          const storedCreator = (proj?.creator_wallet || proj?.creator_address || "").toLowerCase();
          if (storedCreator && storedCreator === address.toLowerCase()) {
            setAuthorized(true);
          }
        }
      }

      const count   = Number(totalP);
      const fetched = count > 0
        ? await Promise.all(
            Array.from({ length: count }, (_, i) =>
              publicClient.readContract({ address: contractAddress, abi: COLLECTION_ABI, functionName: "getPhase", args: [BigInt(i)] })
                .then(p => ({ id: i, ...p })).catch(() => null)
            )
          )
        : [];
      setPhases(fetched.filter(Boolean));
    } catch (e) {
      console.error("[CollectionManager] loadChain:", e);
    }
  }, [contractAddress, publicClient, address]);

  const loadProject = useCallback(async () => {
    if (!contractAddress) return;
    const { data } = await supabase.from("projects")
      .select("*").eq("contract_address", contractAddress.toLowerCase()).single();
    setProject(data);
  }, [contractAddress]);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadChain(), loadProject()]).finally(() => setLoading(false));
  }, [loadChain, loadProject]);

  async function handleReveal() {
    if (!revealUri) return showToast("Enter a URI first", "error");
    setRevealing(true);
    try {
      const hash = await writeContractAsync({ address: contractAddress, abi: COLLECTION_ABI, functionName: "reveal", args: [revealUri] });
      showToast("Waiting for reveal…", "info");
      await publicClient.waitForTransactionReceipt({ hash });

      // Update Supabase
      await supabase.from("collections").update({ metadata_base_uri: revealUri }).eq("contract_address", contractAddress.toLowerCase());
      await supabase.from("projects").update({ base_uri: revealUri, status: "live" }).eq("contract_address", contractAddress.toLowerCase());

      showToast("Collection revealed! Images will appear shortly.", "success");
      loadProject();
    } catch (e) { showToast(e?.shortMessage || "Reveal failed", "error"); }
    finally { setRevealing(false); }
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    try {
      const hash = await writeContractAsync({ address: contractAddress, abi: COLLECTION_ABI, functionName: "withdraw", args: [] });
      showToast("Withdrawing…", "info");
      await publicClient.waitForTransactionReceipt({ hash });
      showToast("Funds withdrawn to your wallet!", "success");
    } catch (e) { showToast(e?.shortMessage || "Withdraw failed", "error"); }
    finally { setWithdrawing(false); }
  }

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center min-h-[70vh]">
      <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#22d3ee" }} />
    </div>
  );

  // ─── Not connected ─────────────────────────────────────────────────────────
  if (!isConnected) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 fade-up">
      <AlertCircle size={40} style={{ color: "#9da7b3" }} />
      <div className="text-center">
        <h1 className="text-xl font-extrabold mb-2" style={{ color: "#e6edf3" }}>Connect Your Wallet</h1>
        <p className="text-sm" style={{ color: "#9da7b3" }}>Connect the wallet that deployed this collection to manage it.</p>
      </div>
    </div>
  );

  // ─── Not authorized ────────────────────────────────────────────────────────
  // Only shown after loading is complete AND wallet is connected
  if (!authorized) return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 fade-up">
      <AlertCircle size={40} style={{ color: "#EF4444" }} />
      <div className="text-center">
        <h1 className="text-xl font-extrabold mb-2" style={{ color: "#e6edf3" }}>Access Denied</h1>
        <p className="text-sm mb-1" style={{ color: "#9da7b3" }}>Only the collection creator can manage this dashboard.</p>
        {chainData?.creator && (
          <p className="text-xs font-mono mt-2" style={{ color: "#6b7280" }}>
            Expected: {chainData.creator.slice(0, 10)}…{chainData.creator.slice(-6)}
          </p>
        )}
        <p className="text-xs font-mono mt-1" style={{ color: "#6b7280" }}>
          Connected: {address?.slice(0, 10)}…{address?.slice(-6)}
        </p>
        <button onClick={() => navigate("/studio")}
          className="mt-4 h-9 px-4 rounded-xl text-sm font-bold"
          style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)", cursor: "pointer" }}>
          Back to Studio
        </button>
      </div>
    </div>
  );

  const mintProgress = chainData ? (Number(chainData.minted) / Number(chainData.max)) * 100 : 0;

  return (
    <div className="min-h-screen pb-20 fade-up" style={{ background: "#0b0f14" }}>
      <Toast msg={toast.msg} type={toast.type} />

      <div className="max-w-3xl mx-auto px-4 py-10">

        {/* Back */}
        <button onClick={() => navigate("/studio")}
          className="flex items-center gap-2 text-sm mb-6"
          style={{ background: "none", border: "none", cursor: "pointer", color: "#9da7b3" }}>
          <ArrowLeft size={14} /> Back to Studio
        </button>

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          {project?.logo_url && (
            <img src={project.logo_url} alt="" className="w-16 h-16 rounded-2xl object-cover flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Settings size={14} style={{ color: "#22d3ee" }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee", fontFamily: "Syne, sans-serif" }}>Collection Manager</span>
            </div>
            <h1 className="text-2xl font-extrabold truncate" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
              {project?.name || "Your Collection"}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs font-mono" style={{ color: "#9da7b3" }}>
                {contractAddress?.slice(0, 10)}…{contractAddress?.slice(-6)}
              </code>
              <button onClick={() => { navigator.clipboard.writeText(contractAddress); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#22d3ee" : "#9da7b3" }}>
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
              <a href={`${EXPLORER_BASE}/address/${contractAddress}`} target="_blank" rel="noreferrer"
                style={{ color: "#9da7b3" }}><ExternalLink size={12} /></a>
            </div>
          </div>
          <button onClick={() => { loadChain(); loadProject(); }}
            className="h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: "#9da7b3" }}>
            <RefreshCw size={13} />
          </button>
        </div>

        {/* Stats */}
        {chainData && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Minted",      value: Number(chainData.minted).toLocaleString(),    icon: Zap },
              { label: "Supply",      value: Number(chainData.max).toLocaleString(),        icon: Layers },
              { label: "Phases",      value: phases.length,                                icon: Users },
              { label: "Flat Fee",    value: chainData.fees ? "$" + fmt6(chainData.fees.perMintFlatFee) + "/mint" : "—", icon: DollarSign },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl p-4" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon size={11} style={{ color: "#9da7b3" }} />
                  <div className="text-[10px] uppercase tracking-wide" style={{ color: "#9da7b3" }}>{label}</div>
                </div>
                <div className="font-mono font-bold text-lg" style={{ color: "#e6edf3" }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Mint progress */}
        {chainData && (
          <div className="rounded-2xl p-4 mb-6" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex justify-between text-xs mb-2">
              <span style={{ color: "#9da7b3" }}>Mint Progress</span>
              <span className="font-mono font-bold" style={{ color: "#e6edf3" }}>
                {Number(chainData.minted).toLocaleString()} / {Number(chainData.max).toLocaleString()} ({mintProgress.toFixed(1)}%)
              </span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: mintProgress + "%", background: "linear-gradient(90deg, #22d3ee, #a78bfa)" }} />
            </div>
          </div>
        )}

        <div className="space-y-5">

          {/* ── Phase Management ── */}
          <Section title="Mint Phases" icon={Zap}>
            <p className="text-xs mb-4" style={{ color: "#9da7b3" }}>
              Set up to 3 phases: OG (allowlist), Whitelist (allowlist), Public (open). Upload a CSV for allowlist phases.
            </p>
            <div className="space-y-4">
              {phases.map(p => (
                <PhaseEditor key={p.id} phaseId={p.id} phase={p}
                  contractAddress={contractAddress} onSaved={loadChain} onToast={showToast} />
              ))}
              {phases.length < 3 && (
                <div className="rounded-xl p-3" style={{ border: "1px dashed rgba(34,211,238,0.2)" }}>
                  <p className="text-xs text-center mb-3" style={{ color: "#9da7b3" }}>
                    {phases.length === 0 ? "Add your first phase — OG → Whitelist → Public" : "Add " + PHASE_NAMES[phases.length] + " phase"}
                  </p>
                  <PhaseEditor phaseId={phases.length} phase={null}
                    contractAddress={contractAddress} onSaved={loadChain} onToast={showToast} />
                </div>
              )}
            </div>
          </Section>

          {/* ── Reveal ── */}
          <Section title="Reveal Collection" icon={Eye} accent="#f59e0b">
            <p className="text-xs mb-4" style={{ color: "#9da7b3" }}>
              Once your art is uploaded to IPFS, set the base URI to reveal metadata to holders. This also updates the marketplace.
            </p>
            <div className="space-y-3">
              <input type="text" placeholder="ipfs://Qm... or https://gateway.lighthouse.storage/ipfs/..."
                value={revealUri} onChange={e => setRevealUri(e.target.value)}
                className="w-full h-11 rounded-xl px-4 text-sm font-mono outline-none"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
                onFocus={e => e.target.style.borderColor = "#f59e0b"}
                onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"} />
              <button onClick={handleReveal} disabled={revealing || !revealUri}
                className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{ background: revealing || !revealUri ? "#161d28" : "#f59e0b", color: revealing || !revealUri ? "#9da7b3" : "#0b0f14", border: "none", cursor: revealing || !revealUri ? "not-allowed" : "pointer" }}>
                {revealing && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {revealing ? "Revealing…" : "Push Reveal On-Chain"}
              </button>
            </div>
          </Section>

          {/* ── Withdraw ── */}
          <Section title="Withdraw Earnings" icon={DollarSign} accent="#22C55E">
            <p className="text-xs mb-4" style={{ color: "#9da7b3" }}>
              Withdraw accumulated pathUSD from your contract. Funds are sent to your creator wallet.
            </p>
            <button onClick={handleWithdraw} disabled={withdrawing}
              className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
              style={{ background: withdrawing ? "#161d28" : "rgba(34,197,94,0.12)", color: withdrawing ? "#9da7b3" : "#22C55E", border: withdrawing ? "none" : "1px solid rgba(34,197,94,0.25)", cursor: withdrawing ? "not-allowed" : "pointer" }}>
              {withdrawing && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
              {withdrawing ? "Withdrawing…" : "Withdraw to Creator Wallet"}
            </button>
          </Section>

        </div>
      </div>
    </div>
  );
}
