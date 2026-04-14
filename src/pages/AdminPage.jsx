// pages/AdminPage.jsx
// Wallet-gated admin dashboard — managed launchpad model.
// Deploy & Launch button calls createCollection() on factory,
// parses the contract address from event logs, updates Supabase.

import { useState, useEffect, useCallback } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import {
  Shield, Lock, RefreshCw, ChevronDown, ChevronUp,
  CheckCircle2, AlertCircle, Zap, Database, Globe,
  ExternalLink, Copy, Check, ToggleLeft, ToggleRight,
  Rocket, X, Clock, User, Mail, ArrowRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Admin wallets ────────────────────────────────────────────────────────────
const ADMIN_WALLETS = [
  "0x4f492db351b111676ec2b5937c0730af1e93d9b0",
  "0x8dd4561cf6fa3ca2024a55db36702ce559318d6c",
  "0x630964adaae799971115518352a0d805d479df51",
];

// ─── Contract addresses ───────────────────────────────────────────────────────
const LAUNCHPAD_FACTORY = "0x0451929d3c5012978127A2e347d207Aa8b67f14d";
const PATHUSD           = "0x20c0000000000000000000000000000000000000";
const FEE_RECIPIENT     = "0x2b063f43217898383af4147952a2838e1d1971e3";
const EXPLORER_BASE     = "https://explore.tempo.xyz";
const ZERO_BYTES32      = "0x0000000000000000000000000000000000000000000000000000000000000000";

// Platform fee: $0.05 = 50_000 raw 6-decimal units
const PER_MINT_FLAT_FEE = 50_000n;

// ─── Launchpad Factory ABI ────────────────────────────────────────────────────
// initialize() is called on each new collection proxy
const FACTORY_ABI = [
  {
    name: "createCollection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name_",         type: "string"  },
      { name: "symbol_",       type: "string"  },
      { name: "preRevealURI_", type: "string"  },
      { name: "maxSupply_",    type: "uint256" },
      { name: "creator_",      type: "address" },
      { name: "pathUSD_",      type: "address" },
      { name: "feeRecipient_", type: "address" },
      {
        name: "fees_", type: "tuple",
        components: [
          { name: "minterFeeBps",    type: "uint256" },
          { name: "creatorFeeBps",   type: "uint256" },
          { name: "perMintFlatFee",  type: "uint256" },
          { name: "royaltyBps",      type: "uint256" },
        ],
      },
    ],
    outputs: [],
  },
  // CollectionCreated event — emitted after deployment
  {
    name: "CollectionCreated",
    type: "event",
    inputs: [
      { name: "collection", type: "address", indexed: true  },
      { name: "creator",    type: "address", indexed: true  },
      { name: "name",       type: "string",  indexed: false },
    ],
  },
];

// ─── Collection ABI ───────────────────────────────────────────────────────────
const COLLECTION_ABI = [
  { name: "totalPhases",  type: "function", stateMutability: "view",       inputs: [],                                                                                  outputs: [{ type: "uint256" }] },
  { name: "totalMinted",  type: "function", stateMutability: "view",       inputs: [],                                                                                  outputs: [{ type: "uint256" }] },
  { name: "maxSupply",    type: "function", stateMutability: "view",       inputs: [],                                                                                  outputs: [{ type: "uint256" }] },
  { name: "getFeeConfig", type: "function", stateMutability: "view",       inputs: [],                                                                                  outputs: [{ name: "", type: "tuple", components: [{ name: "minterFeeBps", type: "uint256" }, { name: "creatorFeeBps", type: "uint256" }, { name: "perMintFlatFee", type: "uint256" }, { name: "royaltyBps", type: "uint256" }] }] },
  { name: "getPhase",     type: "function", stateMutability: "view",       inputs: [{ name: "phaseId", type: "uint256" }],                                              outputs: [{ name: "", type: "tuple", components: [{ name: "name", type: "string" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }, { name: "price", type: "uint256" }, { name: "maxSupply", type: "uint256" }, { name: "maxPerWallet", type: "uint256" }, { name: "merkleRoot", type: "bytes32" }, { name: "active", type: "bool" }, { name: "minted", type: "uint256" }] }] },
  { name: "addPhase",     type: "function", stateMutability: "nonpayable", inputs: [{ name: "name_", type: "string" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }, { name: "price", type: "uint256" }, { name: "maxSupply_", type: "uint256" }, { name: "maxPerWallet", type: "uint256" }, { name: "merkleRoot", type: "bytes32" }], outputs: [] },
  { name: "updatePhase",  type: "function", stateMutability: "nonpayable", inputs: [{ name: "phaseId", type: "uint256" }, { name: "startTime", type: "uint256" }, { name: "endTime", type: "uint256" }, { name: "price", type: "uint256" }, { name: "maxPerWallet", type: "uint256" }, { name: "merkleRoot", type: "bytes32" }, { name: "active", type: "bool" }], outputs: [] },
  { name: "reveal",       type: "function", stateMutability: "nonpayable", inputs: [{ name: "baseURI", type: "string" }],                                              outputs: [] },
  { name: "withdraw",     type: "function", stateMutability: "nonpayable", inputs: [],                                                                                  outputs: [] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt6    = (v) => v != null ? (Number(v) / 1e6).toFixed(2) : "0.00";
const toRaw   = (usd) => BigInt(Math.round(Number(usd) * 1_000_000));
const toTs    = (dt)  => dt ? BigInt(Math.floor(new Date(dt).getTime() / 1000)) : 0n;
const fromTs  = (ts)  => ts && Number(ts) > 0 ? new Date(Number(ts) * 1000).toISOString().slice(0, 16) : "";
const shorten = (a)   => a ? a.slice(0, 6) + "…" + a.slice(-4) : "—";

const STATUS_COLORS = {
  pending:  { bg: "rgba(234,179,8,0.1)",  border: "rgba(234,179,8,0.3)",  text: "#EAB308" },
  approved: { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.3)",  text: "#22C55E" },
  live:     { bg: "rgba(34,211,238,0.1)", border: "rgba(34,211,238,0.3)", text: "#22d3ee" },
  featured: { bg: "rgba(167,139,250,0.1)",border: "rgba(167,139,250,0.3)",text: "#a78bfa" },
  ended:    { bg: "rgba(157,167,179,0.1)",border: "rgba(157,167,179,0.3)",text: "#9DA7B3" },
  rejected: { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)",  text: "#EF4444" },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md"
      style={{ background: c.bg, border: "1px solid " + c.border, color: c.text }}>
      {status}
    </span>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const colors = { success: "#22C55E", error: "#EF4444", info: "#22d3ee", warn: "#f59e0b" };
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2 max-w-sm text-center"
      style={{ background: "#121821", border: "1px solid " + (colors[type] || colors.info), color: colors[type] || colors.info, backdropFilter: "blur(12px)" }}>
      {type === "success" ? <CheckCircle2 size={15} /> : type === "error" ? <AlertCircle size={15} /> : <Zap size={15} />}
      {msg}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, children, accent = "#22d3ee", defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between px-5 py-4"
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
  const publicClient       = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const [form, setForm] = useState({
    startTime:    fromTs(phase?.startTime),
    endTime:      fromTs(phase?.endTime),
    price:        fmt6(phase?.price),
    maxPerWallet: String(Number(phase?.maxPerWallet ?? 0)),
    merkleRoot:   phase?.merkleRoot || ZERO_BYTES32,
    active:       phase?.active ?? true,
  });
  const [saving, setSaving] = useState(false);
  const isNew = !phase;
  const PHASE_NAMES  = ["OG", "Whitelist", "Public"];
  const PHASE_COLORS = ["#f59e0b", "#a78bfa", "#22d3ee"];
  const phaseName = phase?.name || PHASE_NAMES[phaseId] || "Phase " + phaseId;
  const color     = PHASE_COLORS[phaseId] || "#22d3ee";
  const isPublic  = !form.merkleRoot || form.merkleRoot === ZERO_BYTES32;

  async function handleSave() {
    if (!contract) return onToast("No contract selected", "error");
    setSaving(true);
    try {
      const startTs    = toTs(form.startTime);
      const endTs      = toTs(form.endTime);
      const priceRaw   = toRaw(form.price);
      const maxWallet  = BigInt(form.maxPerWallet || 0);
      const root       = form.merkleRoot || ZERO_BYTES32;

      let hash;
      if (isNew) {
        hash = await writeContractAsync({
          address: contract, abi: COLLECTION_ABI, functionName: "addPhase",
          args: [phaseName, startTs, endTs, priceRaw, 0n, maxWallet, root],
        });
      } else {
        hash = await writeContractAsync({
          address: contract, abi: COLLECTION_ABI, functionName: "updatePhase",
          args: [BigInt(phaseId), startTs, endTs, priceRaw, maxWallet, root, form.active],
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
    <div className="rounded-xl p-4 space-y-3" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
          <span className="font-bold text-sm" style={{ color: "#e6edf3" }}>{phaseName}</span>
          {!isNew && phase && (
            <span className="text-[10px] font-mono" style={{ color: "#9da7b3" }}>
              {Number(phase.minted).toLocaleString()} minted
            </span>
          )}
        </div>
        <button onClick={() => setForm(f => ({ ...f, active: !f.active }))}
          className="flex items-center gap-1 text-xs font-bold"
          style={{ background: "none", border: "none", cursor: "pointer", color: form.active ? "#22C55E" : "#9da7b3" }}>
          {form.active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          {form.active ? "Active" : "Off"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "Price (USD)",      key: "price",        type: "number", placeholder: "0.00"         },
          { label: "Max Per Wallet",   key: "maxPerWallet", type: "number", placeholder: "0 = unlimited" },
        ].map(({ label, key, type, placeholder }) => (
          <div key={key}>
            <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#9da7b3" }}>{label}</label>
            <input type={type} placeholder={placeholder} value={form[key]}
              onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
              className="w-full h-9 rounded-lg px-2.5 text-sm font-mono outline-none"
              style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
              onFocus={e => (e.target.style.borderColor = color)}
              onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
            />
          </div>
        ))}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#9da7b3" }}>Start Time</label>
          <input type="datetime-local" value={form.startTime}
            onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))}
            className="w-full h-9 rounded-lg px-2.5 text-xs outline-none"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", colorScheme: "dark" }}
            onFocus={e => (e.target.style.borderColor = color)}
            onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#9da7b3" }}>End Time</label>
          <input type="datetime-local" value={form.endTime}
            onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))}
            className="w-full h-9 rounded-lg px-2.5 text-xs outline-none"
            style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", colorScheme: "dark" }}
            onFocus={e => (e.target.style.borderColor = color)}
            onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold uppercase tracking-wide mb-1" style={{ color: "#9da7b3" }}>
          Merkle Root <span style={{ color: "#6b7280" }}>(keep 0x000...000 for public)</span>
        </label>
        <input type="text" placeholder={ZERO_BYTES32} value={form.merkleRoot}
          onChange={e => setForm(f => ({ ...f, merkleRoot: e.target.value }))}
          className="w-full h-9 rounded-lg px-2.5 text-xs font-mono outline-none"
          style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3" }}
          onFocus={e => (e.target.style.borderColor = color)}
          onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />
        {!isPublic && (
          <div className="mt-1 text-[10px] font-bold" style={{ color: "#a78bfa" }}>
            ★ Allowlist phase active
          </div>
        )}
      </div>

      <button onClick={handleSave} disabled={saving}
        className="w-full h-9 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
        style={{ background: saving ? "#1a2232" : color, color: saving ? "#9da7b3" : "#0b0f14", border: "none", cursor: saving ? "not-allowed" : "pointer" }}>
        {saving && <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />}
        {saving ? "Pushing to chain..." : isNew ? "Add Phase On-Chain" : "Update Phase On-Chain"}
      </button>
    </div>
  );
}

// ─── Pending Project Card ─────────────────────────────────────────────────────
function PendingCard({ project, onDeploy, onReject, deploying }) {
  const [expanded, setExpanded] = useState(false);
  const isDeplying = deploying === project.id;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-sm" style={{ color: "#e6edf3" }}>{project.name}</span>
              <StatusBadge status={project.status} />
            </div>
            <div className="flex items-center gap-3 text-[11px]" style={{ color: "#9da7b3" }}>
              {project.symbol && <span className="font-mono">${project.symbol}</span>}
              {project.max_supply && <span>{Number(project.max_supply).toLocaleString()} supply</span>}
              {project.mint_price && <span>{project.mint_price} USD</span>}
            </div>
            {project.contact_email && (
              <div className="flex items-center gap-1 mt-1 text-[11px]" style={{ color: "#9da7b3" }}>
                <Mail size={10} /> {project.contact_email}
              </div>
            )}
          </div>
          <button onClick={() => setExpanded(e => !e)}
            className="text-[10px] px-2 py-1 rounded-lg flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.04)", color: "#9da7b3", border: "none", cursor: "pointer" }}>
            {expanded ? "Less" : "More"}
          </button>
        </div>

        {expanded && (
          <div className="mt-3 space-y-2 text-xs" style={{ color: "#9da7b3" }}>
            {project.description && <p className="leading-relaxed">{project.description}</p>}
            <div className="grid grid-cols-2 gap-2 pt-1">
              {project.base_uri   && <div><span style={{ color: "#6b7280" }}>Base URI: </span><span className="font-mono break-all">{project.base_uri.slice(0, 30)}...</span></div>}
              {project.website    && <div><span style={{ color: "#6b7280" }}>Website: </span>{project.website}</div>}
              {project.twitter    && <div><span style={{ color: "#6b7280" }}>Twitter: </span>{project.twitter}</div>}
              {project.discord    && <div><span style={{ color: "#6b7280" }}>Discord: </span>{project.discord}</div>}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 mt-4">
          {/* Deploy & Launch — the magic button */}
          {(project.status === "pending" || project.status === "approved") && !project.contract_address && (
            <button onClick={() => onDeploy(project)} disabled={isDeplying}
              className="flex-1 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
              style={{
                background: isDeplying ? "#1a2232" : "linear-gradient(135deg, #22d3ee, #3b82f6)",
                color: isDeplying ? "#9da7b3" : "#0b0f14",
                border: "none",
                cursor: isDeplying ? "not-allowed" : "pointer",
                boxShadow: isDeplying ? "none" : "0 0 20px rgba(34,211,238,0.3)",
              }}>
              {isDeplying
                ? <><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" /> Deploying...</>
                : <><Rocket size={13} /> Deploy &amp; Launch</>}
            </button>
          )}

          {/* Already deployed */}
          {project.contract_address && (
            <div className="flex-1 flex items-center gap-2 h-10 px-3 rounded-xl text-xs"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.2)", color: "#22C55E" }}>
              <CheckCircle2 size={13} />
              <span className="font-mono truncate">{shorten(project.contract_address)}</span>
              <a href={EXPLORER_BASE + "/address/" + project.contract_address} target="_blank" rel="noreferrer"
                className="ml-auto flex-shrink-0" style={{ color: "#22d3ee" }}>
                <ExternalLink size={11} />
              </a>
            </div>
          )}

          {/* Reject */}
          {project.status !== "rejected" && (
            <button onClick={() => onReject(project.id)}
              className="h-10 px-3 rounded-xl text-xs font-bold"
              style={{ background: "rgba(239,68,68,0.08)", color: "#EF4444", border: "1px solid rgba(239,68,68,0.2)", cursor: "pointer" }}>
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}


// ─── Main Admin Page ──────────────────────────────────────────────────────────
export default function AdminPage() {
  const { address, isConnected } = useAccount();
  const publicClient             = usePublicClient();
  const { writeContractAsync }   = useWriteContract();

  const isAdmin = isConnected && address && ADMIN_WALLETS.includes(address.toLowerCase());

  const [projects,    setProjects]    = useState([]);
  const [selected,    setSelected]    = useState(null);
  const [contract,    setContract]    = useState("");
  const [phases,      setPhases]      = useState([]);
  const [chainData,   setChainData]   = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [deploying,   setDeploying]   = useState(null); // project.id being deployed
  const [toast,       setToast]       = useState({ msg: "", type: "info" });
  const [revealUri,   setRevealUri]   = useState("");
  const [projectForm, setProjectForm] = useState({});
  const [saving,      setSaving]      = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [copied,      setCopied]      = useState(false);
  const [queueFilter, setQueueFilter] = useState("pending");

  function showToast(msg, type = "info") {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "info" }), 5000);
  }

  // ─── Load projects ────────────────────────────────────────────────────────
  const loadProjects = useCallback(async () => {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects(data || []);
  }, []);

  useEffect(() => { if (isAdmin) loadProjects(); }, [isAdmin, loadProjects]);

  // ─── Load chain data ──────────────────────────────────────────────────────
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
              .then(p => ({ id: i, ...p })).catch(() => null)
          )
        );
        setPhases(fetched.filter(Boolean));
      }
    } catch (e) {
      showToast("Chain load failed: " + (e?.shortMessage || e?.message?.slice(0, 50)), "error");
    } finally {
      setLoading(false);
    }
  }, [publicClient]);

  function handleSelectProject(proj) {
    setSelected(proj);
    setContract(proj.contract_address || "");
    setRevealUri("");
    setProjectForm({
      name:        proj.name        || "",
      symbol:      proj.symbol      || "",
      description: proj.description || "",
      logo_url:    proj.logo_url    || "",
      banner_url:  proj.banner_url  || "",
      mint_price:  proj.mint_price  || "",
      max_supply:  proj.max_supply  || "",
      status:      proj.status      || "pending",
      website:     proj.website     || "",
      twitter:     proj.twitter     || "",
      discord:     proj.discord     || "",
    });
    if (proj.contract_address) loadChainData(proj.contract_address);
  }

  // ─── DEPLOY & LAUNCH ──────────────────────────────────────────────────────
  // The magic button: calls createCollection() on factory, parses contract
  // address from event logs, writes it back to Supabase, updates status → "live"
  async function handleDeploy(project) {
    if (!project) return;
    setDeploying(project.id);
    showToast("Confirm the deploy transaction in your wallet...", "info");

    try {
      const maxSupply  = BigInt(project.max_supply  || 2000);
      const preReveal  = project.base_uri || "ipfs://placeholder/";
      // creator_ = project submitter's wallet (stored in creator_address column)
      // If not available, fallback to admin wallet so contract still deploys
      const creator    = (project.creator_address || project.wallet_address || address);

      const fees = {
        minterFeeBps:   0n,          // platform takes flat fee only
        creatorFeeBps:  0n,
        perMintFlatFee: PER_MINT_FLAT_FEE, // $0.05
        royaltyBps:     500n,        // 5% royalty
      };

      const hash = await writeContractAsync({
        address: LAUNCHPAD_FACTORY,
        abi: FACTORY_ABI,
        functionName: "createCollection",
        args: [
          project.name        || "Unnamed",
          project.symbol      || "NFT",
          preReveal,
          maxSupply,
          creator,
          PATHUSD,
          FEE_RECIPIENT,
          fees,
        ],
      });

      showToast("Transaction sent — waiting for confirmation...", "info");

      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // ── Parse new contract address from CollectionCreated event ────────────
      // Event signature: CollectionCreated(address indexed collection, address indexed creator, string name)
      let newContractAddress = null;

      // Look for CollectionCreated event in logs
      const COLLECTION_CREATED_TOPIC = "0x" + Array.from(
        new TextEncoder().encode("CollectionCreated(address,address,string)")
      ).map(b => b.toString(16).padStart(2, "0")).join("");

      // Try to find it by scanning logs for any address topic
      for (const log of receipt.logs) {
        // The first indexed param (topics[1]) is the collection address
        if (log.address.toLowerCase() === LAUNCHPAD_FACTORY.toLowerCase() && log.topics?.[1]) {
          // topics[1] is the collection address, padded to 32 bytes
          const raw = log.topics[1]; // 0x000...address
          newContractAddress = "0x" + raw.slice(-40);
          break;
        }
      }

      // Fallback: if no event found, check all logs for a new contract address
      if (!newContractAddress && receipt.logs.length > 0) {
        // The first log from the new contract is usually the Initialized event
        // Its address IS the new collection contract
        const newContractLog = receipt.logs.find(
          l => l.address.toLowerCase() !== LAUNCHPAD_FACTORY.toLowerCase()
        );
        if (newContractLog) {
          newContractAddress = newContractLog.address;
        }
      }

      if (!newContractAddress) {
        throw new Error("Could not find new contract address in transaction logs. Check Explorer: " + EXPLORER_BASE + "/tx/" + hash);
      }

      const contractAddr = newContractAddress.toLowerCase();
      showToast("Contract deployed at " + shorten(contractAddr) + " — saving to Supabase...", "info");

      // ── Update Supabase ────────────────────────────────────────────────────
      const { error: dbError } = await supabase
        .from("projects")
        .update({
          contract_address: contractAddr,
          status:           "live",
          updated_at:       new Date().toISOString(),
        })
        .eq("id", project.id);

      if (dbError) throw new Error("Supabase update failed: " + dbError.message);

      // Also add to collections table so marketplace indexes it
      await supabase.from("collections").upsert({
        contract_address: contractAddr,
        name:             project.name,
        slug:             (project.name || "collection").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        description:      project.description || "",
        logo_url:         project.logo_url    || null,
        banner_url:       project.banner_url  || null,
        total_supply:     Number(maxSupply),
        metadata_base_uri: project.base_uri   || null,
        website_url:      project.website     || null,
        twitter_url:      project.twitter     || null,
        discord_url:      project.discord     || null,
        verified:         false,
        floor_price:      0,
        volume_total:     0,
        volume_24h:       0,
        total_sales:      0,
        listed_count:     0,
      }, { onConflict: "contract_address" });

      showToast("🚀 " + project.name + " is LIVE at " + shorten(contractAddr), "success");
      await loadProjects();

      // Auto-select the newly deployed project
      setSelected(prev => prev?.id === project.id ? { ...prev, contract_address: contractAddr, status: "live" } : prev);
      setContract(contractAddr);
      loadChainData(contractAddr);

    } catch (e) {
      console.error("[Deploy]", e);
      showToast(e?.shortMessage || e?.message?.slice(0, 100) || "Deploy failed", "error");
    } finally {
      setDeploying(null);
    }
  }

  // ─── Reject project ───────────────────────────────────────────────────────
  async function handleReject(id) {
    await supabase.from("projects").update({ status: "rejected" }).eq("id", id);
    showToast("Project rejected", "warn");
    loadProjects();
  }

  // ─── Save metadata ────────────────────────────────────────────────────────
  async function saveProjectMeta() {
    if (!selected?.id) return showToast("No project selected", "error");
    setSaving(true);
    try {
      const { error } = await supabase.from("projects")
        .update({ ...projectForm, updated_at: new Date().toISOString() })
        .eq("id", selected.id);
      if (error) throw error;
      showToast("Saved to Supabase!", "success");
      loadProjects();
    } catch (e) {
      showToast(e.message?.slice(0, 80) || "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  // ─── Reveal ───────────────────────────────────────────────────────────────
  async function handleReveal() {
    if (!contract || !revealUri) return showToast("Enter the base URI first", "error");
    try {
      const hash = await writeContractAsync({ address: contract, abi: COLLECTION_ABI, functionName: "reveal", args: [revealUri] });
      showToast("Waiting for reveal...", "info");
      await publicClient.waitForTransactionReceipt({ hash });
      showToast("Collection revealed!", "success");
    } catch (e) {
      showToast(e?.shortMessage || "Reveal failed", "error");
    }
  }

  // ─── Withdraw ─────────────────────────────────────────────────────────────
  async function handleWithdraw() {
    if (!contract) return;
    setWithdrawing(true);
    try {
      const hash = await writeContractAsync({ address: contract, abi: COLLECTION_ABI, functionName: "withdraw", args: [] });
      showToast("Waiting for withdraw...", "info");
      await publicClient.waitForTransactionReceipt({ hash });
      showToast("Funds withdrawn!", "success");
    } catch (e) {
      showToast(e?.shortMessage || "Withdraw failed", "error");
    } finally {
      setWithdrawing(false);
    }
  }

  // ─── Trigger sync ─────────────────────────────────────────────────────────
  async function triggerSync() {
    try {
      const res  = await fetch("/api/cron/sync");
      const data = await res.json();
      showToast("Synced " + data.synced + " events · block " + data.block, "success");
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
          <p className="text-sm" style={{ color: "#9da7b3" }}>
            {!isConnected ? "Connect your admin wallet." : "This wallet is not authorised."}
          </p>
          {isConnected && address && (
            <p className="text-xs font-mono mt-2" style={{ color: "#6b7280" }}>{address}</p>
          )}
        </div>
      </div>
    );
  }

  // Counts for tabs
  const pendingCount  = projects.filter(p => p.status === "pending").length;
  const liveCount     = projects.filter(p => p.status === "live" || p.status === "featured").length;
  const filteredQueue = projects.filter(p => queueFilter === "all" ? true : p.status === queueFilter);

  return (
    <div className="px-4 sm:px-6 py-8 max-w-6xl mx-auto fade-up">
      <Toast msg={toast.msg} type={toast.type} />

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Shield size={14} style={{ color: "#22d3ee" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Admin Dashboard</span>
          </div>
          <h1 className="text-3xl font-extrabold" style={{ color: "#e6edf3" }}>Launchpad Control</h1>
          <p className="mt-1 text-sm" style={{ color: "#9da7b3" }}>Deploy contracts, manage phases, review applications.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 mt-1">
          <button onClick={triggerSync}
            className="h-9 px-3 rounded-xl text-xs font-bold flex items-center gap-1.5"
            style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)", cursor: "pointer" }}>
            <RefreshCw size={12} /> Sync Chain
          </button>
          <div className="h-9 px-3 rounded-xl text-xs font-mono flex items-center gap-1.5"
            style={{ background: "#121821", border: "1px solid rgba(34,197,94,0.3)", color: "#22C55E" }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#22C55E" }} />
            {shorten(address)}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: "Pending Review", value: pendingCount, color: "#EAB308" },
          { label: "Live Projects",  value: liveCount,    color: "#22C55E" },
          { label: "Total Projects", value: projects.length, color: "#22d3ee" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl p-4 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>{label}</div>
            <div className="font-mono font-bold text-2xl" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

        {/* ── Left: Application Queue ── */}
        <div className="lg:col-span-2 space-y-4">
          <Section title="Application Queue" icon={User} accent="#EAB308" defaultOpen={true}>

            {/* Filter tabs */}
            <div className="flex gap-1 mb-4 flex-wrap">
              {["pending", "live", "featured", "rejected", "all"].map(f => (
                <button key={f} onClick={() => setQueueFilter(f)}
                  className="h-7 px-3 rounded-full text-[10px] font-bold capitalize"
                  style={{
                    background: queueFilter === f ? "rgba(34,211,238,0.12)" : "#161d28",
                    color:      queueFilter === f ? "#22d3ee" : "#9da7b3",
                    border:     queueFilter === f ? "1px solid rgba(34,211,238,0.3)" : "1px solid rgba(255,255,255,0.06)",
                    cursor: "pointer",
                  }}>
                  {f === "all" ? "All" : f}
                  {f === "pending" && pendingCount > 0 && (
                    <span className="ml-1 px-1 py-0.5 rounded-sm text-[9px]"
                      style={{ background: "#EAB308", color: "#0b0f14" }}>
                      {pendingCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {filteredQueue.length === 0 ? (
                <div className="text-xs text-center py-6" style={{ color: "#9da7b3" }}>
                  No {queueFilter === "all" ? "" : queueFilter} projects
                </div>
              ) : filteredQueue.map(proj => (
                <div key={proj.id}
                  className="cursor-pointer"
                  onClick={() => handleSelectProject(proj)}>
                  <PendingCard
                    project={proj}
                    onDeploy={handleDeploy}
                    onReject={handleReject}
                    deploying={deploying}
                  />
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* ── Right: Project Editor ── */}
        <div className="lg:col-span-3 space-y-5">
          {!selected ? (
            <div className="rounded-2xl p-10 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <ArrowRight size={32} className="mx-auto mb-3" style={{ color: "rgba(34,211,238,0.3)", transform: "rotate(-135deg)" }} />
              <p className="font-bold text-sm" style={{ color: "#e6edf3" }}>Select a project</p>
              <p className="text-xs mt-1" style={{ color: "#9da7b3" }}>Click any project to manage phases, metadata, and contract settings.</p>
            </div>
          ) : (
            <>
              {/* Contract bar */}
              <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>Contract</div>
                  <div className="font-mono text-xs truncate" style={{ color: contract ? "#e6edf3" : "#6b7280" }}>
                    {contract || "Not deployed yet — click Deploy & Launch"}
                  </div>
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
                      className="h-7 px-2 rounded-lg"
                      style={{ background: "rgba(34,211,238,0.08)", color: "#22d3ee", border: "none", cursor: "pointer" }}>
                      <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
                    </button>
                  </div>
                )}
              </div>

              
              {/* Chain stats if deployed */}
              {chainData && (
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Total Minted", value: Number(chainData.minted).toLocaleString() },
                    { label: "Max Supply",   value: Number(chainData.max).toLocaleString()    },
                    { label: "Flat Fee",     value: chainData.fees ? fmt6(chainData.fees.perMintFlatFee) + " USD" : "$0.05" },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl p-3 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "#9da7b3" }}>{label}</div>
                      <div className="font-mono font-bold text-sm" style={{ color: "#e6edf3" }}>{value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Phase Management */}
              <Section title="Phase Management" icon={Zap} accent="#22d3ee">
                {!contract ? (
                  <div className="text-xs text-center py-6" style={{ color: "#9da7b3" }}>
                    Deploy the contract first, then configure phases here.
                  </div>
                ) : loading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#22d3ee" }} />
                  </div>
                ) : (
                  <div className="space-y-4">
                    {phases.map(phase => (
                      <PhaseCard key={phase.id} phaseId={phase.id} phase={phase} contract={contract}
                        onSaved={() => loadChainData(contract)} onToast={showToast} />
                    ))}
                    {phases.length < 3 && (
                      <div className="rounded-xl p-3" style={{ border: "1px dashed rgba(34,211,238,0.2)" }}>
                        <p className="text-xs text-center mb-3" style={{ color: "#9da7b3" }}>
                          Add {["OG", "Whitelist", "Public"][phases.length] || "next"} phase
                        </p>
                        <PhaseCard phaseId={phases.length} phase={null} contract={contract}
                          onSaved={() => loadChainData(contract)} onToast={showToast} />
                      </div>
                    )}
                  </div>
                )}
              </Section>

              {/* Project Metadata */}
              <Section title="Project Metadata" icon={Database} accent="#a78bfa">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { key: "name",       label: "Name",        placeholder: "My Collection" },
                    { key: "symbol",     label: "Symbol",      placeholder: "NFT"           },
                    { key: "mint_price", label: "Price (USD)", placeholder: "20"            },
                    { key: "max_supply", label: "Max Supply",  placeholder: "2000"          },
                    { key: "website",    label: "Website",     placeholder: "https://..."   },
                    { key: "twitter",    label: "Twitter URL", placeholder: "https://x.com/..." },
                    { key: "discord",    label: "Discord URL", placeholder: "https://discord.gg/..." },
                    { key: "logo_url",   label: "Logo URL",    placeholder: "https://..."   },
                    { key: "banner_url", label: "Banner URL",  placeholder: "https://..."   },
                  ].map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>{label}</label>
                      <input type="text" placeholder={placeholder} value={projectForm[key] || ""}
                        onChange={e => setProjectForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full h-10 rounded-lg px-3 text-sm outline-none"
                        style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
                        onFocus={e => (e.target.style.borderColor = "#a78bfa")}
                        onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
                      />
                    </div>
                  ))}
                  <div className="sm:col-span-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>Description</label>
                    <textarea rows={3} placeholder="Collection description..." value={projectForm.description || ""}
                      onChange={e => setProjectForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none resize-none"
                      style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
                      onFocus={e => (e.target.style.borderColor = "#a78bfa")}
                      onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
                    />
                  </div>
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

              {/* Contract Actions */}
              <Section title="Contract Actions" icon={Globe} accent="#f59e0b">
                <div className="space-y-4">
                  <div className="rounded-xl p-4 space-y-3" style={{ background: "#161d28" }}>
                    <div>
                      <div className="text-sm font-bold mb-0.5" style={{ color: "#e6edf3" }}>Reveal Collection</div>
                      <div className="text-xs" style={{ color: "#9da7b3" }}>Set final base URI to reveal metadata to holders.</div>
                    </div>
                    <input type="text" placeholder="ipfs://Qm.../" value={revealUri}
                      onChange={e => setRevealUri(e.target.value)}
                      className="w-full h-10 rounded-lg px-3 text-sm font-mono outline-none"
                      style={{ background: "#0b0f14", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
                      onFocus={e => (e.target.style.borderColor = "#f59e0b")}
                      onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
                    />
                    <button onClick={handleReveal} disabled={!revealUri || !contract}
                      className="w-full h-10 rounded-xl text-xs font-bold"
                      style={{ background: revealUri && contract ? "#f59e0b" : "#1a2232", color: revealUri && contract ? "#0b0f14" : "#9da7b3", border: "none", cursor: revealUri && contract ? "pointer" : "not-allowed" }}>
                      Push Reveal On-Chain
                    </button>
                  </div>

                  <div className="rounded-xl p-4 space-y-3" style={{ background: "#161d28" }}>
                    <div>
                      <div className="text-sm font-bold mb-0.5" style={{ color: "#e6edf3" }}>Withdraw Funds</div>
                      <div className="text-xs" style={{ color: "#9da7b3" }}>Pull accumulated pathUSD from the contract to the creator wallet.</div>
                    </div>
                    <button onClick={handleWithdraw} disabled={withdrawing || !contract}
                      className="w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
                      style={{
                        background: !contract || withdrawing ? "#1a2232" : "rgba(34,197,94,0.12)",
                        color:      !contract || withdrawing ? "#9da7b3" : "#22C55E",
                        border:     !contract || withdrawing ? "none" : "1px solid rgba(34,197,94,0.3)",
                        cursor:     !contract || withdrawing ? "not-allowed" : "pointer",
                      }}>
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
