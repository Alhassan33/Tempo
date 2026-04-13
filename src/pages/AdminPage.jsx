// pages/AdminPage.jsx
// Wallet-gated admin dashboard for managing launchpad collections.
// Only the three admin wallets can access this page.

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import {
  Shield, Lock, RefreshCw, Plus, Save, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Zap, Database, Globe, Users, Clock,
  ExternalLink, Copy, Check, Trash2, ToggleLeft, ToggleRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const ADMIN_WALLETS = [
  "0x4f492db351b111676ec2b5937c0730af1e93d9b0",
  "0x8dd4561cf6fa3ca2024a55db36702ce559318d6c",
  "0x630964adaae799971115518352a0d805d479df51",
];

const EXPLORER_BASE  = "https://explore.tempo.xyz";
const PATHUSD        = "0x20c0000000000000000000000000000000000000";
const ZERO_BYTES32   = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Minimal ABIs
const COLLECTION_ABI = [
  { name: "totalPhases",  type: "function", stateMutability: "view",         inputs: [],                                                                                                                         outputs: [{ type: "uint256" }] },
  { name: "getPhase",     type: "function", stateMutability: "view",         inputs: [{ name: "phaseId", type: "uint256" }],                                                                                     outputs: [{ name: "", type: "tuple", components: [{ name: "name", type: "string" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }, { name: "price", type: "uint256" }, { name: "maxSupply", type: "uint256" }, { name: "maxPerWallet", type: "uint256" }, { name: "merkleRoot", type: "bytes32" }, { name: "active", type: "bool" }, { name: "minted", type: "uint256" }] }] },
  { name: "totalMinted",  type: "function", stateMutability: "view",         inputs: [],                                                                                                                         outputs: [{ type: "uint256" }] },
  { name: "maxSupply",    type: "function", stateMutability: "view",         inputs: [],                                                                                                                         outputs: [{ type: "uint256" }] },
  { name: "getFeeConfig", type: "function", stateMutability: "view",         inputs: [],                                                                                                                         outputs: [{ name: "", type: "tuple", components: [{ name: "minterFeeBps", type: "uint256" }, { name: "creatorFeeBps", type: "uint256" }, { name: "perMintFlatFee", type: "uint256" }, { name: "royaltyBps", type: "uint256" }] }] },
  { name: "addPhase",     type: "function", stateMutability: "nonpayable",   inputs: [{ name: "name_", type: "string" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }, { name: "price", type: "uint256" }, { name: "maxSupply_", type: "uint256" }, { name: "maxPerWallet", type: "uint256" }, { name: "merkleRoot", type: "bytes32" }],                                                       outputs: [] },
  { name: "updatePhase",  type: "function", stateMutability: "nonpayable",   inputs: [{ name: "phaseId", type: "uint256" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }, { name: "price", type: "uint256" }, { name: "maxPerWallet", type: "uint256" }, { name: "merkleRoot", type: "bytes32" }, { name: "active", type: "bool" }],                                                              outputs: [] },
  { name: "reveal",       type: "function", stateMutability: "nonpayable",   inputs: [{ name: "baseURI", type: "string" }],                                                                                     outputs: [] },
  { name: "withdraw",     type: "function", stateMutability: "nonpayable",   inputs: [],                                                                                                                         outputs: [] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt6 = (v) => v != null ? (Number(v) / 1e6).toFixed(2) : "0.00";
const toRaw = (usd) => BigInt(Math.round(Number(usd) * 1_000_000));
const toTs = (dt) => dt ? BigInt(Math.floor(new Date(dt).getTime() / 1000)) : 0n;
const fromTs = (ts) => ts && Number(ts) > 0 ? new Date(Number(ts) * 1000).toISOString().slice(0, 16) : "";

function shortenAddr(a) { return a ? a.slice(0, 6) + "…" + a.slice(-4) : "—"; }

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const colors = { success: "#22C55E", error: "#EF4444", info: "#22d3ee" };
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2"
      style={{ background: "#121821", border: "1px solid " + (colors[type] || colors.info), color: colors[type] || colors.info, backdropFilter: "blur(12px)" }}>
      {type === "success" ? <CheckCircle2 size={15} /> : type === "error" ? <AlertCircle size={15} /> : <Zap size={15} />}
      {msg}
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, accent = "#22d3ee" }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4"
        style={{ background: "none", border: "none", cursor: "pointer" }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(34,211,238,0.08)" }}>
            <Icon size={13} style={{ color: accent }} />
          </div>
          <span className="text-sm font-bold uppercase tracking-widest" style={{ color: "#e6edf3" }}>{title}</span>
        </div>
        {open ? <ChevronUp size={14} style={{ color: "#9da7b3" }} /> : <ChevronDown size={14} style={{ color: "#9da7b3" }} />}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
}

// ─── Phase Card ───────────────────────────────────────────────────────────────
function PhaseCard({ phaseId, phase, contract, onSaved, onToast }) {
  const publicClient         = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [form, setForm] = useState({
    startTime:    fromTs(phase?.startTime),
    endTime:      fromTs(phase?.endTime),
    price:        fmt6(phase?.price),
    maxPerWallet: Number(phase?.maxPerWallet ?? 0).toString(),
    merkleRoot:   phase?.merkleRoot || ZERO_BYTES32,
    active:       phase?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const isNew = !phase;

  const PHASE_NAMES = ["OG", "Whitelist", "Public"];
  const phaseName = phase?.name || PHASE_NAMES[phaseId] || "Phase " + phaseId;

  const PHASE_COLORS = ["#f59e0b", "#a78bfa", "#22d3ee"];
  const color = PHASE_COLORS[phaseId] || "#22d3ee";

  function isPublic() {
    return !form.merkleRoot || form.merkleRoot === ZERO_BYTES32;
  }

  async function handleSave() {
    if (!contract) return onToast("No contract selected", "error");
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
          address: contract,
          abi: COLLECTION_ABI,
          functionName: "addPhase",
          args: [phaseName, ...args.slice(0, 5), args[5]],
        });
      } else {
        hash = await writeContractAsync({
          address: contract,
          abi: COLLECTION_ABI,
          functionName: "updatePhase",
          args: [BigInt(phaseId), ...args],
        });
      }

      onToast("Waiting for confirmation...", "info");
      await publicClient.waitForTransactionReceipt({ hash });
      onToast("Phase " + phaseName + " saved on-chain!", "success");
      onSaved?.();
    } catch (e) {
      onToast(e?.shortMessage || e?.message?.slice(0, 80) || "Transaction failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl p-4 space-y-4" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="font-bold text-sm" style={{ color: "#e6edf3" }}>{phaseName}</span>
          {!isNew && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md" style={{ background: "rgba(255,255,255,0.06)", color: "#9da7b3" }}>
              Phase #{phaseId}
            </span>
          )}
        </div>
        {/* Active toggle */}
        <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}
          className="flex items-center gap-1.5 text-xs font-bold"
          style={{ background: "none", border: "none", cursor: "pointer", color: form.active ? "#22C55E" : "#9da7b3" }}>
          {form.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {form.active ? "Active" : "Inactive"}
        </button>
      </div>

      {/* Phase stats if exists */}
      {!isNew && phase && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2.5" style={{ background: "#0b0f14" }}>
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Minted</div>
            <div className="font-mono text-sm font-bold" style={{ color: "#e6edf3" }}>{Number(phase.minted).toLocaleString()}</div>
          </div>
          <div className="rounded-lg p-2.5" style={{ background: "#0b0f14" }}>
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>Type</div>
            <div className="font-mono text-sm font-bold" style={{ color: isPublic() ? "#22d3ee" : "#a78bfa" }}>
              {isPublic() ? "Public" : "Allowlist"}
            </div>
          </div>
        </div>
      )}

      {/* Form fields */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>
            Price (USD)
          </label>
          <input type="number" step="0.01" placeholder="0.00"
            value={form.price}
            onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm font-mono outline-none"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>
            Max Per Wallet
          </label>
          <input type="number" placeholder="0 = unlimited"
            value={form.maxPerWallet}
            onChange={e => setForm(f => ({ ...f, maxPerWallet: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm font-mono outline-none"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>
            Start Time
          </label>
          <input type="datetime-local"
            value={form.startTime}
            onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm outline-none"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", colorScheme: "dark" }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>
            End Time <span style={{ color: "#6b7280" }}>(0 = no end)</span>
          </label>
          <input type="datetime-local"
            value={form.endTime}
            onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm outline-none"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", colorScheme: "dark" }}
            onFocus={e => e.target.style.borderColor = color}
            onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
          />
        </div>
      </div>

      {/* Merkle root */}
      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>
          Merkle Root <span style={{ color: "#6b7280" }}>(leave 0x000...000 for public)</span>
        </label>
        <input type="text" placeholder={ZERO_BYTES32}
          value={form.merkleRoot}
          onChange={e => setForm(f => ({ ...f, merkleRoot: e.target.value }))}
          className="w-full h-10 rounded-lg px-3 text-xs font-mono outline-none"
          style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
          onFocus={e => e.target.style.borderColor = color}
          onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.08)"}
        />
        {form.merkleRoot && form.merkleRoot !== ZERO_BYTES32 && (
          <div className="mt-1 text-[10px] font-bold" style={{ color: "#a78bfa" }}>
            ★ Allowlist phase — only addresses with a valid proof can mint
          </div>
        )}
      </div>

      {/* Save button */}
      <button onClick={handleSave} disabled={saving}
        className="w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
        style={{
          background: saving ? "#161d28" : color,
          color:      saving ? "#9da7b3" : "#0b0f14",
          border:     "none",
          cursor:     saving ? "not-allowed" : "pointer",
        }}>
        {saving && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
        {saving ? "Pushing to chain..." : isNew ? "Add Phase On-Chain" : "Update Phase On-Chain"}
      </button>
    </div>
  );
}

// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const publicClient             = usePublicClient();
  const { writeContractAsync }   = useWriteContract();

  // ─── Auth check ───────────────────────────────────────────────────────────
  const isAdmin = isConnected && address &&
    ADMIN_WALLETS.includes(address.toLowerCase());

  // ─── State ────────────────────────────────────────────────────────────────
  const [projects,     setProjects]     = useState([]);
  const [selected,     setSelected]     = useState(null);   // full project row
  const [contract,     setContract]     = useState("");
  const [phases,       setPhases]       = useState([]);
  const [chainData,    setChainData]    = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [toast,        setToast]        = useState({ msg: "", type: "info" });
  const [revealUri,    setRevealUri]    = useState("");
  const [projectForm,  setProjectForm]  = useState({});
  const [saving,       setSaving]       = useState(false);
  const [withdrawing,  setWithdrawing]  = useState(false);
  const [copied,       setCopied]       = useState(false);

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "info" }), 4000);
  }

  // ─── Load all projects ────────────────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects(data || []);
  }, []);

  useEffect(() => { if (isAdmin) loadProjects(); }, [isAdmin, loadProjects]);

  // ─── Load chain data for selected contract ─────────────────────────────────
  const loadChainData = useCallback(async (addr) => {
    if (!addr || !publicClient) return;
    setLoading(true);
    setPhases([]);
    setChainData(null);
    try {
      const [minted, max, totalP, fees] = await Promise.all([
        publicClient.readContract({ address: addr, abi: COLLECTION_ABI, functionName: "totalMinted" }),
        publicClient.readContract({ address: addr, abi: COLLECTION_ABI, functionName: "maxSupply"   }),
        publicClient.readContract({ address: addr, abi: COLLECTION_ABI, functionName: "totalPhases" }),
        publicClient.readContract({ address: addr, abi: COLLECTION_ABI, functionName: "getFeeConfig" }).catch(() => null),
      ]);
      setChainData({ minted, max, fees });

      const count = Number(totalP);
      if (count > 0) {
        const fetched = await Promise.all(
          Array.from({ length: count }, (_, i) =>
            publicClient.readContract({ address: addr, abi: COLLECTION_ABI, functionName: "getPhase", args: [BigInt(i)] })
              .then(p => ({ id: i, ...p }))
              .catch(() => null)
          )
        );
        setPhases(fetched.filter(Boolean));
      }
    } catch (e) {
      showToast("Failed to load chain data: " + (e?.shortMessage || e?.message?.slice(0, 60)), "error");
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  function handleSelectProject(proj) {
    setSelected(proj);
    setContract(proj.contract_address || "");
    setProjectForm({
      name:        proj.name || "",
      description: proj.description || "",
      logo_url:    proj.logo_url || "",
      banner_url:  proj.banner_url || "",
      mint_price:  proj.mint_price || "",
      max_supply:  proj.max_supply || "",
      status:      proj.status || "pending",
      website:     proj.website || "",
      twitter:     proj.twitter || "",
    });
    if (proj.contract_address) loadChainData(proj.contract_address);
  }

  // ─── Save project metadata to Supabase ────────────────────────────────────
  async function saveProjectMeta() {
    if (!selected?.id) return showToast("No project selected", "error");
    setSaving(true);
    try {
      const { error } = await supabase
        .from("projects")
        .update({ ...projectForm, updated_at: new Date().toISOString() })
        .eq("id", selected.id);
      if (error) throw error;
      showToast("Project metadata saved!", "success");
      loadProjects();
    } catch (e) {
      showToast(e.message?.slice(0, 80) || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  // ─── Reveal collection ─────────────────────────────────────────────────────
  async function handleReveal() {
    if (!contract || !revealUri) return showToast("Enter the base URI first", "error");
    try {
      const hash = await writeContractAsync({
        address: contract,
        abi: COLLECTION_ABI,
        functionName: "reveal",
        args: [revealUri],
      });
      showToast("Waiting for reveal tx...", "info");
      await publicClient.waitForTransactionReceipt({ hash });
      showToast("Collection revealed!", "success");
    } catch (e) {
      showToast(e?.shortMessage || "Reveal failed", "error");
    }
  }

  // ─── Withdraw ─────────────────────────────────────────────────────────────
  async function handleWithdraw() {
    if (!contract) return showToast("No contract selected", "error");
    setWithdrawing(true);
    try {
      const hash = await writeContractAsync({
        address: contract,
        abi: COLLECTION_ABI,
        functionName: "withdraw",
        args: [],
      });
      showToast("Waiting for withdraw tx...", "info");
      await publicClient.waitForTransactionReceipt({ hash });
      showToast("Funds withdrawn!", "success");
    } catch (e) {
      showToast(e?.shortMessage || "Withdraw failed", "error");
    } finally {
      setWithdrawing(false);
    }
  }

  // ─── Force sync cron ──────────────────────────────────────────────────────
  async function triggerSync() {
    try {
      const res = await fetch("/api/cron/sync");
      const data = await res.json();
      showToast("Sync: " + data.synced + " events synced, block " + data.block, "success");
    } catch (e) {
      showToast("Sync failed: " + e.message, "error");
    }
  }

  // ─── Access denied ────────────────────────────────────────────────────────
  if (!isConnected || !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-5 fade-up">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
          <Lock size={32} style={{ color: "#EF4444" }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: "#e6edf3" }}>Access Denied</h1>
          <p className="text-sm mb-1" style={{ color: "#9da7b3" }}>
            {!isConnected
              ? "Connect your admin wallet to access this page."
              : "Connected wallet is not authorised."}
          </p>
          {isConnected && address && (
            <p className="text-xs font-mono mt-2" style={{ color: "#6b7280" }}>
              {address}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ────────────────────────────────────────────────────────
  return (
    <div className="px-4 sm:px-6 py-8 max-w-5xl mx-auto fade-up">
      <Toast msg={toast.msg} type={toast.type} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} style={{ color: "#22d3ee" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Admin Dashboard</span>
          </div>
          <h1 className="text-3xl font-extrabold" style={{ color: "#e6edf3" }}>Launchpad Control</h1>
          <p className="mt-1 text-sm" style={{ color: "#9da7b3" }}>
            Manage phases, metadata, and contract settings.
          </p>
        </div>
        {/* Sync + wallet badge */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={triggerSync}
            className="h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5"
            style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)", cursor: "pointer" }}>
            <RefreshCw size={12} /> Sync Chain
          </button>
          <div className="h-9 px-3 rounded-xl text-xs font-mono flex items-center gap-1.5"
            style={{ background: "#121821", border: "1px solid rgba(34,197,94,0.3)", color: "#22C55E" }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22C55E" }} />
            {shortenAddr(address)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* ── Sidebar: project list ── */}
        <div className="lg:col-span-1 space-y-3">
          <div className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "#9da7b3" }}>Projects</div>
          {projects.map(proj => (
            <button key={proj.id} onClick={() => handleSelectProject(proj)}
              className="w-full text-left rounded-xl p-3 transition-all"
              style={{
                background: selected?.id === proj.id ? "rgba(34,211,238,0.08)" : "#121821",
                border: selected?.id === proj.id ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.06)",
                cursor: "pointer",
              }}>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg overflow-hidden flex-shrink-0" style={{ background: "#161d28" }}>
                  {proj.logo_url
                    ? <img src={proj.logo_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-xs font-bold" style={{ color: "#22d3ee" }}>{proj.name?.slice(0, 2).toUpperCase()}</div>}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate" style={{ color: "#e6edf3" }}>{proj.name}</div>
                  <div className="text-[10px] capitalize" style={{ color: proj.status === "live" ? "#22C55E" : proj.status === "featured" ? "#22d3ee" : "#9da7b3" }}>
                    {proj.status}
                  </div>
                </div>
              </div>
            </button>
          ))}
          {projects.length === 0 && (
            <div className="text-xs text-center py-6" style={{ color: "#9da7b3" }}>No projects yet</div>
          )}
        </div>

        {/* ── Main content ── */}
        <div className="lg:col-span-3 space-y-5">

          {!selected ? (
            <div className="rounded-2xl p-8 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <Database size={32} className="mx-auto mb-3" style={{ color: "rgba(34,211,238,0.3)" }} />
              <p className="font-bold text-sm" style={{ color: "#e6edf3" }}>Select a project</p>
              <p className="text-xs mt-1" style={{ color: "#9da7b3" }}>Choose a project from the list to manage it.</p>
            </div>
          ) : (
            <>
              {/* Chain stats */}
              {chainData && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Minted",   value: Number(chainData.minted).toLocaleString() },
                    { label: "Max Supply",      value: Number(chainData.max).toLocaleString() },
                    { label: "Platform Fee",    value: chainData.fees ? fmt6(chainData.fees.perMintFlatFee) + " USD/mint" : "—" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl p-3 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>{label}</div>
                      <div className="font-mono font-bold text-sm" style={{ color: "#e6edf3" }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Contract address bar */}
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>Contract</div>
                  <div className="font-mono text-xs truncate" style={{ color: "#e6edf3" }}>{contract || "Not deployed"}</div>
                </div>
                {contract && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button onClick={() => { navigator.clipboard.writeText(contract); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: copied ? "#22d3ee" : "#9da7b3" }}>
                      {copied ? <Check size={13} /> : <Copy size={13} />}
                    </button>
                    <a href={EXPLORER_BASE + "/address/" + contract} target="_blank" rel="noreferrer" style={{ color: "#9da7b3" }}>
                      <ExternalLink size={13} />
                    </a>
                    <button onClick={() => loadChainData(contract)}
                      className="h-7 px-2 rounded-lg text-[10px] font-bold"
                      style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "none", cursor: "pointer" }}>
                      <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    </button>
                  </div>
                )}
              </div>

              {/* ── Phase Management ── */}
              <Section title="Phase Management" icon={Zap} accent="#22d3ee">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#22d3ee" }} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Existing phases */}
                    {phases.map(phase => (
                      <PhaseCard
                        key={phase.id}
                        phaseId={phase.id}
                        phase={phase}
                        contract={contract}
                        onSaved={() => loadChainData(contract)}
                        onToast={showToast}
                      />
                    ))}

                    {/* Add new phase (only if < 3) */}
                    {phases.length < 3 && contract && (
                      <div className="rounded-xl p-3 text-center" style={{ border: "1px dashed rgba(34,211,238,0.2)" }}>
                        <p className="text-xs mb-2" style={{ color: "#9da7b3" }}>
                          {phases.length === 0
                            ? "No phases on-chain yet. Add OG → Whitelist → Public in order."
                            : "Add " + ["OG", "Whitelist", "Public"][phases.length] + " phase"}
                        </p>
                        <PhaseCard
                          phaseId={phases.length}
                          phase={null}
                          contract={contract}
                          onSaved={() => loadChainData(contract)}
                          onToast={showToast}
                        />
                      </div>
                    )}

                    {!contract && (
                      <div className="text-xs text-center py-4" style={{ color: "#9da7b3" }}>
                        No contract address set for this project.
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* ── Project Metadata ── */}
              <Section title="Project Metadata (Supabase)" icon={Database} accent="#a78bfa">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "name",        label: "Project Name",    placeholder: "My NFT Collection" },
                    { key: "mint_price",  label: "Display Price",   placeholder: "0.00 USD" },
                    { key: "max_supply",  label: "Max Supply",      placeholder: "2000" },
                    { key: "website",     label: "Website URL",     placeholder: "https://..." },
                    { key: "twitter",     label: "Twitter URL",     placeholder: "https://x.com/..." },
                    { key: "logo_url",    label: "Logo URL",        placeholder: "https://..." },
                    { key: "banner_url",  label: "Banner URL",      placeholder: "https://..." },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>{label}</label>
                      <input type="text" placeholder={placeholder}
                        value={projectForm[key] || ""}
                        onChange={e => setProjectForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full h-10 rounded-lg px-3 text-sm outline-none"
                        style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
                        onFocus={e => e.target.style.borderColor = "#a78bfa"}
                        onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>Description</label>
                    <textarea rows={3} placeholder="Describe the collection..."
                      value={projectForm.description || ""}
                      onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none"
                      style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
                      onFocus={e => e.target.style.borderColor = "#a78bfa"}
                      onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
                    />
                  </div>
                  {/* Status */}
                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>Status</label>
                    <select value={projectForm.status || "pending"}
                      onChange={e => setProjectForm(f => ({ ...f, status: e.target.value }))}
                      className="w-full h-10 rounded-lg px-3 text-sm outline-none"
                      style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}>
                      {["pending", "approved", "live", "featured", "ended", "rejected"].map(s => (
                        <option key={s} value={s} style={{ background: "#161d28" }}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button onClick={saveProjectMeta} disabled={saving}
                  className="w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 mt-4"
                  style={{ background: saving ? "#161d28" : "#a78bfa", color: saving ? "#9da7b3" : "#0b0f14", border: "none", cursor: saving ? "not-allowed" : "pointer" }}>
                  {saving && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                  {saving ? "Saving..." : "Save to Supabase"}
                </button>
              </Section>

              {/* ── Reveal + Withdraw ── */}
              <Section title="Contract Actions" icon={Globe} accent="#f59e0b">
                <div className="space-y-4">
                  {/* Reveal */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "#161d28" }}>
                    <div>
                      <div className="text-sm font-bold mb-0.5" style={{ color: "#e6edf3" }}>Reveal Collection</div>
                      <div className="text-xs" style={{ color: "#9da7b3" }}>Set the final base URI to reveal metadata to holders.</div>
                    </div>
                    <input type="text" placeholder="ipfs://Qm... or https://..."
                      value={revealUri}
                      onChange={e => setRevealUri(e.target.value)}
                      className="w-full h-10 rounded-lg px-3 text-sm font-mono outline-none"
                      style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
                      onFocus={e => e.target.style.borderColor = "#f59e0b"}
                      onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"}
                    />
                    <button onClick={handleReveal} disabled={!revealUri || !contract}
                      className="w-full h-10 rounded-xl text-xs font-bold"
                      style={{ background: revealUri && contract ? "#f59e0b" : "#161d28", color: revealUri && contract ? "#0b0f14" : "#9da7b3", border: "none", cursor: revealUri && contract ? "pointer" : "not-allowed" }}>
                      Push Reveal On-Chain
                    </button>
                  </div>

                  {/* Withdraw */}
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "#161d28" }}>
                    <div>
                      <div className="text-sm font-bold mb-0.5" style={{ color: "#e6edf3" }}>Withdraw Funds</div>
                      <div className="text-xs" style={{ color: "#9da7b3" }}>Withdraw accumulated pathUSD from the contract to the creator wallet.</div>
                    </div>
                    <button onClick={handleWithdraw} disabled={withdrawing || !contract}
                      className="w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                      style={{ background: withdrawing || !contract ? "#161d28" : "rgba(34,197,94,0.15)", color: withdrawing || !contract ? "#9da7b3" : "#22C55E", border: withdrawing || !contract ? "none" : "1px solid rgba(34,197,94,0.3)", cursor: withdrawing || !contract ? "not-allowed" : "pointer" }}>
                      {withdrawing && <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                      {withdrawing ? "Withdrawing..." : "Withdraw to Creator"}
                    </button>
                  </div>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
