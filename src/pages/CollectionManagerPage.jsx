/**
 * pages/CollectionManagerPage.jsx
 *
 * Creator's private dashboard for managing their deployed collection.
 * Route: /studio/manage/:contractAddress
 *
 * FIXED VERSION - Addresses:
 * 1. Added missing Layers import
 * 2. Fixed authorization logic with better error handling
 * 3. Added creator fee configuration UI
 * 4. Better loading states and error messages
 * 5. Fixed Supabase queries
 */

import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAccount, usePublicClient, useWriteContract, useChainId } from "wagmi";
import {
  Settings, Zap, Upload, Globe, ArrowLeft, Layers,
  CheckCircle2, AlertCircle, ToggleLeft, ToggleRight,
  ExternalLink, Copy, Check, RefreshCw, Users,
  DollarSign, Eye, Download, Percent
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { parseCSV, buildAllowlist } from "@/utils/merkleUtils";

// ─── Constants ────────────────────────────────────────────────────────────────
const TEMPO_CHAIN_ID = 4217;
const EXPLORER_BASE = "https://explore.tempo.xyz";
const ZERO_BYTES32 = "0x0000000000000000000000000000000000000000000000000000000000000000";

// ─── Collection ABI ───────────────────────────────────────────────────────────
const COLLECTION_ABI = [
  // Read
  { name: "totalMinted", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "maxSupply", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "totalPhases", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { name: "creator", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    name: "getFeeConfig",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "minterFeeBps", type: "uint256" },
          { name: "creatorFeeBps", type: "uint256" },
          { name: "perMintFlatFee", type: "uint256" },
          { name: "royaltyBps", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getPhase",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "phaseId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "startTime", type: "uint256" },
          { name: "endTime", type: "uint256" },
          { name: "price", type: "uint256" },
          { name: "maxSupply", type: "uint256" },
          { name: "maxPerWallet", type: "uint256" },
          { name: "merkleRoot", type: "bytes32" },
          { name: "active", type: "bool" },
          { name: "minted", type: "uint256" },
        ],
      },
    ],
  },
  // Write
  {
    name: "addPhase",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name_", type: "string" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "maxSupply_", type: "uint256" },
      { name: "maxPerWallet", type: "uint256" },
      { name: "merkleRoot", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    name: "updatePhase",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "phaseId", type: "uint256" },
      { name: "startTime", type: "uint256" },
      { name: "endTime", type: "uint256" },
      { name: "price", type: "uint256" },
      { name: "maxPerWallet", type: "uint256" },
      { name: "merkleRoot", type: "bytes32" },
      { name: "active", type: "bool" },
    ],
    outputs: [],
  },
  { name: "reveal", type: "function", stateMutability: "nonpayable", inputs: [{ name: "baseURI", type: "string" }], outputs: [] },
  { name: "withdraw", type: "function", stateMutability: "nonpayable", inputs: [], outputs: [] },
  {
    name: "updateFeeConfig",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_minterFeeBps", type: "uint256" },
      { name: "_creatorFeeBps", type: "uint256" },
      { name: "_perMintFlatFee", type: "uint256" },
    ],
    outputs: [],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt6 = (v) => (v != null ? (Number(v) / 1e6).toFixed(2) : "0.00");
const toRaw = (usd) => BigInt(Math.round(Number(usd) * 1_000_000));
const toTs = (dt) => (dt ? BigInt(Math.floor(new Date(dt).getTime() / 1000)) : 0n);
const fromTs = (ts) => (ts && Number(ts) > 0 ? new Date(Number(ts) * 1000).toISOString().slice(0, 16) : "");

const PHASE_NAMES = ["OG", "Whitelist", "Public"];
const PHASE_COLORS = ["#f59e0b", "#a78bfa", "#22d3ee"];

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type }) {
  if (!msg) return null;
  const c = { success: "#22C55E", error: "#EF4444", info: "#22d3ee" };
  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[999] px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl flex items-center gap-2"
      style={{
        background: "#121821",
        border: "1px solid " + (c[type] || c.info),
        color: c[type] || c.info,
        backdropFilter: "blur(12px)",
      }}
    >
      {type === "success" ? <CheckCircle2 size={15} /> : type === "error" ? <AlertCircle size={15} /> : <RefreshCw size={15} />}
      {msg}
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────
function Section({ title, icon: Icon, accent = "#22d3ee", children }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      <div
        className="flex items-center gap-2.5 px-5 py-4 border-b"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(34,211,238,0.08)" }}
        >
          <Icon size={13} style={{ color: accent }} />
        </div>
        <span
          className="text-sm font-bold uppercase tracking-widest"
          style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}
        >
          {title}
        </span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Phase editor ─────────────────────────────────────────────────────────────
function PhaseEditor({ phaseId, phase, contractAddress, onSaved, onToast }) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const isNew = !phase;
  const name = phase?.name || PHASE_NAMES[phaseId] || "Phase " + phaseId;
  const color = PHASE_COLORS[phaseId] || "#22d3ee";

  const [form, setForm] = useState({
    price: fmt6(phase?.price ?? 0),
    maxPerWallet: Number(phase?.maxPerWallet ?? 0).toString(),
    startTime: fromTs(phase?.startTime),
    endTime: fromTs(phase?.endTime),
    merkleRoot: phase?.merkleRoot || ZERO_BYTES32,
    active: phase?.active ?? true,
  });

  const [saving, setSaving] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [allowlistCount, setAllowlistCount] = useState(0);

  const isPublicPhase = !form.merkleRoot || form.merkleRoot === ZERO_BYTES32;

  // Update form when phase prop changes
  useEffect(() => {
    if (phase) {
      setForm({
        price: fmt6(phase.price ?? 0),
        maxPerWallet: Number(phase.maxPerWallet ?? 0).toString(),
        startTime: fromTs(phase.startTime),
        endTime: fromTs(phase.endTime),
        merkleRoot: phase.merkleRoot || ZERO_BYTES32,
        active: phase.active ?? true,
      });
    }
  }, [phase]);

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
      setForm((f) => ({ ...f, merkleRoot: allowlist.root }));

      // Save proofs to Supabase so the mint page can look them up
      const { error: upsertError } = await supabase.from("allowlists").upsert(
        {
          contract_address: contractAddress.toLowerCase(),
          phase_id: phaseId,
          merkle_root: allowlist.root,
          addresses: allowlist.addresses,
          proofs: allowlist.proofs,
          count: allowlist.count,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "contract_address,phase_id" }
      );

      if (upsertError) {
        console.error("Allowlist upsert error:", upsertError);
        onToast("Warning: Merkle root generated but DB save failed", "error");
      } else {
        onToast(`✓ ${allowlist.count} addresses loaded. Root: ${allowlist.root.slice(0, 12)}…`, "success");
      }
    } catch (err) {
      console.error("CSV processing error:", err);
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
          address: contractAddress,
          abi: COLLECTION_ABI,
          functionName: "addPhase",
          args: [name, args[0], args[1], args[2], 0n, args[3], args[4]],
        });
      } else {
        hash = await writeContractAsync({
          address: contractAddress,
          abi: COLLECTION_ABI,
          functionName: "updatePhase",
          args: [BigInt(phaseId), ...args],
        });
      }

      onToast("Waiting for confirmation…", "info");
      await publicClient.waitForTransactionReceipt({ hash });
      onToast(name + " phase saved!", "success");
      onSaved?.();
    } catch (e) {
      console.error("Phase save error:", e);
      onToast(e?.shortMessage || e?.message || "Transaction failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="rounded-xl p-4 space-y-4"
      style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}
    >
      {/* Phase header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
          <span className="font-bold text-sm" style={{ color: "#e6edf3" }}>
            {name}
          </span>
          {!isNew && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md font-bold"
              style={{ background: "rgba(255,255,255,0.06)", color: "#9da7b3" }}
            >
              Phase #{phaseId}
            </span>
          )}
          {!isPublicPhase && allowlistCount > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-md font-bold"
              style={{
                background: "rgba(167,139,250,0.12)",
                color: "#a78bfa",
                border: "1px solid rgba(167,139,250,0.2)",
              }}
            >
              {allowlistCount} wallets
            </span>
          )}
        </div>
        <button
          onClick={() => setForm((f) => ({ ...f, active: !f.active }))}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: form.active ? "#22C55E" : "#9da7b3",
          }}
          className="flex items-center gap-1.5 text-xs font-bold"
        >
          {form.active ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
          {form.active ? "Active" : "Inactive"}
        </button>
      </div>

      {/* Stats for existing phases */}
      {!isNew && phase && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg p-2.5" style={{ background: "#0b0f14" }}>
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>
              Minted
            </div>
            <div className="font-mono font-bold text-sm" style={{ color: "#e6edf3" }}>
              {Number(phase.minted).toLocaleString()}
            </div>
          </div>
          <div className="rounded-lg p-2.5" style={{ background: "#0b0f14" }}>
            <div className="text-[9px] uppercase tracking-wider mb-0.5" style={{ color: "#9da7b3" }}>
              Type
            </div>
            <div
              className="font-mono font-bold text-sm"
              style={{ color: isPublicPhase ? "#22d3ee" : "#a78bfa" }}
            >
              {isPublicPhase ? "Public" : "Allowlist"}
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            className="block text-[10px] font-bold uppercase tracking-wide mb-1.5"
            style={{ color: "#9da7b3" }}
          >
            Mint Price (USD)
          </label>
          <input
            type="number"
            step="0.01"
            placeholder="0.00"
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm outline-none font-mono"
            style={{
              background: "#0b0f14",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e6edf3",
            }}
            onFocus={(e) => (e.target.style.borderColor = color)}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>
        <div>
          <label
            className="block text-[10px] font-bold uppercase tracking-wide mb-1.5"
            style={{ color: "#9da7b3" }}
          >
            Max Per Wallet
          </label>
          <input
            type="number"
            placeholder="0 = unlimited"
            value={form.maxPerWallet}
            onChange={(e) => setForm((f) => ({ ...f, maxPerWallet: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm outline-none font-mono"
            style={{
              background: "#0b0f14",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e6edf3",
            }}
            onFocus={(e) => (e.target.style.borderColor = color)}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>
        <div>
          <label
            className="block text-[10px] font-bold uppercase tracking-wide mb-1.5"
            style={{ color: "#9da7b3" }}
          >
            Start Time
          </label>
          <input
            type="datetime-local"
            value={form.startTime}
            onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm outline-none"
            style={{
              background: "#0b0f14",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e6edf3",
              colorScheme: "dark",
            }}
            onFocus={(e) => (e.target.style.borderColor = color)}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>
        <div>
          <label
            className="block text-[10px] font-bold uppercase tracking-wide mb-1.5"
            style={{ color: "#9da7b3" }}
          >
            End Time <span style={{ color: "#6b7280" }}>(blank = no end)</span>
          </label>
          <input
            type="datetime-local"
            value={form.endTime}
            onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
            className="w-full h-10 rounded-lg px-3 text-sm outline-none"
            style={{
              background: "#0b0f14",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e6edf3",
              colorScheme: "dark",
            }}
            onFocus={(e) => (e.target.style.borderColor = color)}
            onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
          />
        </div>
      </div>

      {/* Allowlist upload (OG + Whitelist only) */}
      {phaseId < 2 && (
        <div>
          <label
            className="block text-[10px] font-bold uppercase tracking-wide mb-2"
            style={{ color: "#9da7b3" }}
          >
            Allowlist (CSV/TXT)
          </label>
          <div className="flex items-center gap-3">
            <label
              className="flex items-center gap-2 h-10 px-4 rounded-lg text-xs font-bold cursor-pointer"
              style={{
                background: "rgba(167,139,250,0.08)",
                color: "#a78bfa",
                border: "1px solid rgba(167,139,250,0.2)",
              }}
            >
              {csvUploading ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />{" "}
                  Parsing…
                </>
              ) : (
                <>
                  <Upload size={13} /> Upload CSV
                </>
              )}
              <input
                type="file"
                accept=".csv,.txt"
                className="hidden"
                onChange={handleCSV}
                disabled={csvUploading}
              />
            </label>
            {!isPublicPhase && (
              <span className="text-xs" style={{ color: "#9da7b3" }}>
                Root:{" "}
                <code className="font-mono text-[10px]" style={{ color: "#a78bfa" }}>
                  {form.merkleRoot.slice(0, 14)}…
                </code>
              </span>
            )}
          </div>
          <p className="mt-1.5 text-[10px]" style={{ color: "#6b7280" }}>
            One address per line, or comma-separated. Generates Merkle root automatically.
          </p>
        </div>
      )}

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2"
        style={{
          background: saving ? "#161d28" : color,
          color: saving ? "#9da7b3" : "#0b0f14",
          border: "none",
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        {saving && (
          <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
        )}
        {saving ? "Pushing to chain…" : isNew ? "Add Phase On-Chain" : "Save Phase On-Chain"}
      </button>
    </div>
  );
}

// ─── Fee Config Editor ─────────────────────────────────────────────────────────
function FeeConfigEditor({ contractAddress, currentFees, onSaved, onToast }) {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [creatorFeeBps, setCreatorFeeBps] = useState(
    currentFees ? Number(currentFees.creatorFeeBps) : 250
  );
  const [minterFeeBps, setMinterFeeBps] = useState(
    currentFees ? Number(currentFees.minterFeeBps) : 250
  );
  const [flatFee, setFlatFee] = useState(
    currentFees ? fmt6(currentFees.perMintFlatFee) : "0.05"
  );
  const [updating, setUpdating]