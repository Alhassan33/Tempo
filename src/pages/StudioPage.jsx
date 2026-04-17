/**
 * pages/StudioPage.jsx
 * 
 * FIXED VERSION - Addresses:
 * 1. Added banner upload support
 * 2. Fixed form state management
 * 3. Better error handling
 * 4. Proper Supabase data insertion
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, usePublicClient, useWriteContract, useChainId } from "wagmi";
import {
  Rocket, ArrowRight, ArrowLeft, CheckCircle2,
  AlertCircle, Wallet, Image as ImageIcon, Zap,
  Settings, ExternalLink, Plus, Upload, Layers
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useCreatorCollections } from "@/hooks/useSupabase";

const LAUNCHPAD_FACTORY = "0x0451929d3c5012978127A2e347d207Aa8b67f14d";
const TEMPO_CHAIN_ID = 4217;
const EXPLORER_BASE = "https://explore.tempo.xyz";

const FACTORY_ABI = [
  {
    name: "createCollection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "preRevealURI", type: "string" },
      { name: "maxSupply", type: "uint256" },
    ],
    outputs: [{ name: "collection", type: "address" }],
  },
  {
    name: "isApprovedCreator",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "openToAll",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "CollectionCreated",
    type: "event",
    inputs: [
      { indexed: true, name: "collection", type: "address" },
      { indexed: true, name: "creator", type: "address" },
      { indexed: false, name: "name", type: "string" },
      { indexed: false, name: "symbol", type: "string" },
    ],
  },
];

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

// ─── Step bar ─────────────────────────────────────────────────────────────────
const STEPS = ["Details", "Review", "Deploy"];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
            style={{
              background:
                i === current
                  ? "rgba(34,211,238,0.12)"
                  : i < current
                  ? "rgba(34,197,94,0.08)"
                  : "rgba(255,255,255,0.04)",
              border:
                i === current
                  ? "1px solid rgba(34,211,238,0.4)"
                  : i < current
                  ? "1px solid rgba(34,197,94,0.3)"
                  : "1px solid rgba(255,255,255,0.06)",
              color:
                i === current ? "#22d3ee" : i < current ? "#22C55E" : "#9da7b3",
            }}
          >
            {i < current ? (
              <CheckCircle2 size={12} />
            ) : (
              <span className="font-mono">{i + 1}</span>
            )}
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className="w-8 h-px"
              style={{
                background:
                  i < current
                    ? "rgba(34,197,94,0.4)"
                    : "rgba(255,255,255,0.08)",
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function Field({ label, hint, required, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label
          className="text-xs font-bold uppercase tracking-wide"
          style={{ color: "#9da7b3" }}
        >
          {label}{" "}
          {required && <span style={{ color: "#EF4444" }}>*</span>}
        </label>
        {hint && (
          <span className="text-[10px]" style={{ color: "#6b7280" }}>
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", min, max }) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      min={min}
      max={max}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-11 rounded-xl px-4 text-sm outline-none"
      style={{
        background: "#161d28",
        border: "1px solid rgba(255,255,255,0.06)",
        color: "#e6edf3",
      }}
      onFocus={(e) => (e.target.style.borderColor = "#22d3ee")}
      onBlur={(e) =>
        (e.target.style.borderColor = "rgba(255,255,255,0.06)")
      }
    />
  );
}

// ─── Logo upload ──────────────────────────────────────────────────────────────
function LogoUpload({ logoUrl, setLogoUrl }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Immediate preview
    const reader = new FileReader();
    reader.onload = (ev) => setLogoUrl(ev.target.result);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `logos/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("nft-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("nft-assets").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
    } catch (err) {
      console.error("Logo upload failed:", err);
      // Keep the preview if upload fails
    } finally {
      setUploading(false);
    }
  }

  return (
    <label
      className="relative flex flex-col items-center justify-center w-28 h-28 rounded-2xl cursor-pointer overflow-hidden"
      style={{
        background: "#161d28",
        border: "2px dashed rgba(34,211,238,0.3)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22d3ee")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)")
      }
    >
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Logo"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <ImageIcon size={20} style={{ color: "#22d3ee" }} />
          <span
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{ color: "#9da7b3" }}
          >
            {uploading ? "Uploading…" : "Logo"}
          </span>
        </div>
      )}
      {uploading && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "#22d3ee" }}
          />
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </label>
  );
}

// ─── Banner upload ────────────────────────────────────────────────────────────
function BannerUpload({ bannerUrl, setBannerUrl }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => setBannerUrl(ev.target.result);
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `banners/${Date.now()}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("nft-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("nft-assets").getPublicUrl(path);
      setBannerUrl(data.publicUrl);
    } catch (err) {
      console.error("Banner upload failed:", err);
    } finally {
      setUploading(false);
    }
  }

  return (
    <label
      className="relative flex flex-col items-center justify-center w-full h-32 rounded-2xl cursor-pointer overflow-hidden"
      style={{
        background: "#161d28",
        border: "2px dashed rgba(34,211,238,0.3)",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#22d3ee")}
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)")
      }
    >
      {bannerUrl ? (
        <img
          src={bannerUrl}
          alt="Banner"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <Upload size={24} style={{ color: "#22d3ee" }} />
          <span
            className="text-[10px] font-bold uppercase tracking-wide"
            style={{ color: "#9da7b3" }}
          >
            {uploading ? "Uploading…" : "Collection Banner"}
          </span>
        </div>
      )}
      {uploading && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}
        >
          <div
            className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: "#22d3ee" }}
          />
        </div>
      )}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </label>
  );
}

// ─── Creator's collection cards ───────────────────────────────────────────────
function MyCollections({ address, onManage }) {
  const { collections, isLoading: loading, error } = useCreatorCollections(address);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="h-24 rounded-2xl animate-pulse"
            style={{ background: "#161d28" }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="mt-4 rounded-2xl p-6 text-center"
        style={{
          background: "rgba(239,68,68,0.08)",
          border: "1px solid rgba(239,68,68,0.2)",
        }}
      >
        <p className="text-sm" style={{ color: "#EF4444" }}>
          Error loading collections: {error}
        </p>
      </div>
    );
  }

  if (!collections.length) {
    return (
      <div
        className="mt-4 rounded-2xl p-6 text-center"
        style={{
          background: "#121821",
          border: "1px dashed rgba(255,255,255,0.08)",
        }}
      >
        <p className="text-sm" style={{ color: "#9da7b3" }}>
          You haven't deployed any collections yet. Click{" "}
          <strong style={{ color: "#22d3ee" }}>Create Collection</strong> below
          to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      {collections.map((col) => (
        <div
          key={col.id}
          className="flex items-center gap-3 p-3 rounded-2xl cursor-pointer transition-all"
          style={{
            background: "#121821",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.borderColor = "rgba(255,255,255,0.06)")
          }
          onClick={() => onManage(col.contract_address)}
        >
          <div
            className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0"
            style={{ background: "#161d28" }}
          >
            {col.logo_url ? (
              <img
                src={col.logo_url}
                alt=""
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-bold text-sm"
                style={{ color: "#22d3ee" }}
              >
                {col.name?.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-bold text-sm truncate"
              style={{ color: "#e6edf3" }}
            >
              {col.name}
            </div>
            <div
              className="text-[10px] font-mono truncate"
              style={{ color: "#9da7b3" }}
            >
              {col.contract_address?.slice(0, 10)}…
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-[9px] font-mono"
                style={{ color: "#6b7280" }}
              >
                Minted: {col.total_minted || 0}/{col.max_supply || col.total_supply || 0}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className="text-[10px] px-2 py-0.5 rounded-lg font-bold capitalize"
              style={{
                background:
                  col.status === "live"
                    ? "rgba(34,197,94,0.1)"
                    : col.status === "draft"
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(34,211,238,0.1)",
                color:
                  col.status === "live"
                    ? "#22C55E"
                    : col.status === "draft"
                    ? "#9da7b3"
                    : "#22d3ee",
              }}
            >
              {col.status || "draft"}
            </span>
            <Settings size={14} style={{ color: "#9da7b3" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main StudioPage ──────────────────────────────────────────────────────────
export default function StudioPage() {
  const navigate = useNavigate();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Track address in a ref so deploy callback doesn't close over stale values
  const addressRef = useRef(address);
  useEffect(() => {
    addressRef.current = address;
  }, [address]);

  const [mode, setMode] = useState("home"); // "home" | "create"
  const [step, setStep] = useState(0);
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [error, setError] = useState("");
  const [txHash, setTxHash] = useState("");
  const [newContract, setNewContract] = useState("");

  const [form, setForm] = useState({
    name: "",
    symbol: "",
    description: "",
    max_supply: "2000",
    pre_reveal: "",
    website: "",
    twitter: "",
    discord: "",
  });
  const [logoUrl, setLogoUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");

  const wrongNetwork = chainId !== TEMPO_CHAIN_ID;

  function set(key, val) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  function canProceed() {
    return (
      form.name.trim() && form.symbol.trim() && Number(form.max_supply) > 0
    );
  }

  function goReview() {
    setError("");
    if (!canProceed())
      return setError("Name, symbol and max supply are required.");
    if (!isConnected) return setError("Connect your wallet first.");
    setStep(1);
  }

  function resetCreate() {
    setMode("home");
    setStep(0);
    setDeploying(false);
    setDeployed(false);
    setError("");
    setTxHash("");
    setNewContract("");
    setForm({
      name: "",
      symbol: "",
      description: "",
      max_supply: "2000",
      pre_reveal: "",
      website: "",
      twitter: "",
      discord: "",
    });
    setLogoUrl("");
    setBannerUrl("");
  }

  const deploy = useCallback(async () => {
    const currentAddress = addressRef.current;
    if (!publicClient || !currentAddress) {
      return setError("Wallet not connected.");
    }
    if (wrongNetwork) return setError("Switch to Tempo Mainnet.");

    setDeploying(true);
    setError("");

    try {
      // Check factory access
      const [openToAll, isApproved] = await Promise.all([
        publicClient.readContract({
          address: LAUNCHPAD_FACTORY,
          abi: FACTORY_ABI,
          functionName: "openToAll",
        }),
        publicClient.readContract({
          address: LAUNCHPAD_FACTORY,
          abi: FACTORY_ABI,
          functionName: "isApprovedCreator",
          args: [currentAddress],
        }),
      ]);

      if (!openToAll && !isApproved) {
        setError("Your wallet isn't approved yet. Contact the Tempo team.");
        setDeploying(false);
        return;
      }

      const hash = await writeContractAsync({
        address: LAUNCHPAD_FACTORY,
        abi: FACTORY_ABI,
        functionName: "createCollection",
        args: [
          form.name.trim(),
          form.symbol.trim().toUpperCase(),
          form.pre_reveal.trim() || "",
          BigInt(form.max_supply),
        ],
      });

      setTxHash(hash);
      setStep(2); // show deploying screen

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Extract contract address from CollectionCreated event
      let contractAddr = null;
      for (const log of receipt.logs) {
        if (
          log.address.toLowerCase() === LAUNCHPAD_FACTORY.toLowerCase() &&
          log.topics[1]
        ) {
          contractAddr = ("0x" + log.topics[1].slice(-40)).toLowerCase();
          break;
        }
      }

      if (!contractAddr) {
        setError(
          "Deployed but couldn't detect address. Check: " +
            EXPLORER_BASE +
            "/tx/" +
            hash
        );
        setDeploying(false);
        return;
      }

      setNewContract(contractAddr);

      // Write to Supabase - FIXED: Added banner_url and better error handling
      const slug = slugify(form.name) + "-" + contractAddr.slice(2, 8);
      
      try {
        const [projectResult, collectionResult] = await Promise.all([
          supabase.from("projects").insert({
            name: form.name.trim(),
            symbol: form.symbol.trim().toUpperCase(),
            description: form.description.trim() || null,
            logo_url: logoUrl || null,
            banner_url: bannerUrl || null,
            contract_address: contractAddr,
            creator_wallet: currentAddress.toLowerCase(),
            max_supply: Number(form.max_supply),
            total_minted: 0,
            website: form.website || null,
            twitter: form.twitter || null,
            discord: form.discord || null,
            status: "draft",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }),
          supabase.from("collections").upsert(
            {
              contract_address: contractAddr,
              name: form.name.trim(),
              slug,
              description: form.description.trim() || null,
              logo_url: logoUrl || null,
              banner_url: bannerUrl || null,
              verified: false,
              floor_price: 0,
              volume_total: 0,
              volume_24h: 0,
              total_sales: 0,
              total_supply: Number(form.max_supply),
              total_minted: 0,
              owners: 0,
              listed_count: 0,
              metadata_base_uri: form.pre_reveal.trim() || "",
              creator_name:
                currentAddress.slice(0, 6) + "…" + currentAddress.slice(-4),
              creator_wallet: currentAddress.toLowerCase(),
              website_url: form.website || null,
              twitter_url: form.twitter || null,
            },
            { onConflict: "contract_address" }
          ),
        ]);

        if (projectResult.error) {
          console.error("Project insert error:", projectResult.error);
        }
        if (collectionResult.error) {
          console.error("Collection upsert error:", collectionResult.error);
        }
      } catch (dbError) {
        console.error("Database error:", dbError);
        // Don't fail deployment if DB insert fails - user can retry later
      }

      // Show success state BEFORE navigating
      setDeploying(false);
      setDeployed(true);
    } catch (e) {
      console.error("Deployment error:", e);
      setError(
        e?.shortMessage || e?.message?.slice(0, 120) || "Deployment failed"
      );
      setDeploying(false);
      setStep(1);
    }
  }, [form, logoUrl, bannerUrl, publicClient, writeContractAsync, wrongNetwork]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen pb-20 fade-up"
      style={{ background: "#0b0f14" }}
    >
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Rocket size={14} style={{ color: "#22d3ee" }} />
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: "#22d3ee", fontFamily: "Syne, sans-serif" }}
            >
              Creator Studio
            </span>
          </div>
          <h1
            className="text-4xl font-extrabold"
            style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}
          >
            {mode === "home" ? "My Studio" : "Create Collection"}
          </h1>
        </div>

        {/* ── HOME: wallet not connected ── */}
        {!isConnected && (
          <div className="text-center py-16">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{
                background: "rgba(34,211,238,0.06)",
                border: "1px solid rgba(34,211,238,0.2)",
              }}
            >
              <Wallet size={32} style={{ color: "#22d3ee" }} />
            </div>
            <h2
              className="text-xl font-extrabold mb-2"
              style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}
            >
              Connect Wallet
            </h2>
            <p className="text-sm" style={{ color: "#9da7b3" }}>
              Connect your wallet to view your collections or deploy a new one.
            </p>
          </div>
        )}

        {/* ── HOME: wallet connected, show collections ── */}
        {isConnected && mode === "home" && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2
                className="text-sm font-bold uppercase tracking-widest"
                style={{ color: "#9da7b3" }}
              >
                Your Collections
              </h2>
            </div>
            <MyCollections
              address={address}
              onManage={(addr) => navigate(`/studio/manage/${addr}`)}
            />

            <button
              onClick={() => {
                setMode("create");
                setStep(0);
                setError("");
              }}
              className="mt-6 w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2"
              style={{
                background: "#22d3ee",
                color: "#0b0f14",
                border: "none",
                cursor: "pointer",
                boxShadow: "0 0 32px rgba(34,211,238,0.15)",
                fontFamily: "Syne, sans-serif",
              }}
            >
              <Plus size={18} /> Create Collection
            </button>
          </div>
        )}

        {/* ── CREATE WIZARD ── */}
        {isConnected && mode === "create" && (
          <>
            <StepBar current={step} />

            {/* Step 0: Details */}
            {step === 0 && (
              <div className="space-y-6">
                {/* Banner Upload */}
                <Field label="Collection Banner" hint="Recommended 1200x400">
                  <BannerUpload bannerUrl={bannerUrl} setBannerUrl={setBannerUrl} />
                </Field>

                <div className="flex gap-5 items-start">
                  <div>
                    <label
                      className="block text-xs font-bold uppercase tracking-wide mb-1.5"
                      style={{ color: "#9da7b3" }}
                    >
                      Logo
                    </label>
                    <LogoUpload logoUrl={logoUrl} setLogoUrl={setLogoUrl} />
                  </div>
                  <div className="flex-1 space-y-4">
                    <Field label="Collection Name" required>
                      <Input
                        value={form.name}
                        onChange={(v) => set("name", v)}
                        placeholder="e.g. Tempo Cats"
                      />
                    </Field>
                    <Field label="Token Symbol" required hint="3–8 chars">
                      <Input
                        value={form.symbol}
                        onChange={(v) => set("symbol", v.toUpperCase())}
                        placeholder="e.g. TCAT"
                      />
                    </Field>
                  </div>
                </div>

                <Field label="Description">
                  <textarea
                    value={form.description}
                    onChange={(e) => set("description", e.target.value)}
                    placeholder="Tell collectors what makes this special…"
                    rows={3}
                    className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                    style={{
                      background: "#161d28",
                      border: "1px solid rgba(255,255,255,0.06)",
                      color: "#e6edf3",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#22d3ee")}
                    onBlur={(e) =>
                      (e.target.style.borderColor = "rgba(255,255,255,0.06)")
                    }
                  />
                </Field>

                <Field label="Max Supply" required hint="Total NFTs in collection">
                  <Input
                    value={form.max_supply}
                    onChange={(v) => set("max_supply", v)}
                    type="number"
                    min="1"
                    max="100000"
                    placeholder="2000"
                  />
                </Field>

                <Field label="Pre-reveal URI" hint="Optional placeholder URI before reveal">
                  <Input
                    value={form.pre_reveal}
                    onChange={(v) => set("pre_reveal", v)}
                    placeholder="ipfs://… (optional)"
                  />
                </Field>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    ["website", "Website", "https://…"],
                    ["twitter", "Twitter", "https://x.com/…"],
                    ["discord", "Discord", "https://discord.gg/…"],
                  ].map(([k, l, p]) => (
                    <Field key={k} label={l}>
                      <Input
                        value={form[k]}
                        onChange={(v) => set(k, v)}
                        placeholder={p}
                      />
                    </Field>
                  ))}
                </div>

                <div
                  className="rounded-2xl p-4"
                  style={{
                    background: "rgba(34,211,238,0.04)",
                    border: "1px solid rgba(34,211,238,0.1)",
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <Zap size={13} style={{ color: "#22d3ee" }} />
                    <span
                      className="text-xs font-bold uppercase tracking-wide"
                      style={{ color: "#22d3ee" }}
                    >
                      $0.05 Platform Fee
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: "#9da7b3" }}>
                    Automatically baked into every mint by the factory contract.
                    You can't remove it and you don't need to set it up.
                  </p>
                </div>

                {error && (
                  <div
                    className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#EF4444",
                    }}
                  >
                    <AlertCircle size={13} /> {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={resetCreate}
                    className="h-12 px-5 rounded-xl text-sm font-bold"
                    style={{
                      background: "#161d28",
                      color: "#9da7b3",
                      border: "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={goReview}
                    disabled={!canProceed()}
                    className="flex-1 h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                    style={{
                      background: canProceed() ? "#22d3ee" : "#161d28",
                      color: canProceed() ? "#0b0f14" : "#9da7b3",
                      border: "none",
                      cursor: canProceed() ? "pointer" : "not-allowed",
                      boxShadow: canProceed()
                        ? "0 0 24px rgba(34,211,238,0.2)"
                        : "none",
                      fontFamily: "Syne, sans-serif",
                    }}
                  >
                    Review & Deploy <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            )}

            {/* Step 1: Review */}
            {step === 1 && (
              <div className="space-y-5">
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{
                    background: "#121821",
                    border: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <div
                    className="flex items-center gap-4 p-5 border-b"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <div
                      className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
                      style={{ background: "#161d28" }}
                    >
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center font-bold text-xl"
                          style={{ color: "#22d3ee" }}
                        >
                          {form.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div
                        className="font-extrabold text-xl"
                        style={{
                          color: "#e6edf3",
                          fontFamily: "Syne, sans-serif",
                        }}
                      >
                        {form.name}
                      </div>
                      <div
                        className="text-sm mt-0.5"
                        style={{ color: "#9da7b3" }}
                      >
                        {form.symbol} · {Number(form.max_supply).toLocaleString()} max supply
                      </div>
                    </div>
                  </div>
                  <div className="p-5 space-y-3">
                    {[
                      ["Factory", LAUNCHPAD_FACTORY.slice(0, 10) + "…"],
                      ["Creator", address?.slice(0, 10) + "…"],
                      ["Platform Fee", "$0.05 per mint (automatic)"],
                      ["Payment Token", "pathUSD (automatic)"],
                      ["Network", "Tempo Mainnet (4217)"],
                    ].map(([l, v]) => (
                      <div key={l} className="flex justify-between text-sm">
                        <span style={{ color: "#9da7b3" }}>{l}</span>
                        <span
                          className="font-mono font-bold"
                          style={{ color: "#e6edf3" }}
                        >
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {wrongNetwork && (
                  <div
                    className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#EF4444",
                    }}
                  >
                    <AlertCircle size={13} /> Switch to Tempo Mainnet before
                    deploying.
                  </div>
                )}
                {error && (
                  <div
                    className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs"
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#EF4444",
                    }}
                  >
                    <AlertCircle size={13} /> {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setStep(0);
                      setError("");
                    }}
                    className="h-12 px-5 rounded-xl text-sm font-bold flex items-center gap-2"
                    style={{
                      background: "#161d28",
                      color: "#9da7b3",
                      border: "1px solid rgba(255,255,255,0.06)",
                      cursor: "pointer",
                    }}
                  >
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button
                    onClick={deploy}
                    disabled={deploying || wrongNetwork}
                    className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{
                      background: deploying || wrongNetwork ? "#161d28" : "#22d3ee",
                      color: deploying || wrongNetwork ? "#9da7b3" : "#0b0f14",
                      border: "none",
                      cursor: deploying || wrongNetwork ? "not-allowed" : "pointer",
                      boxShadow:
                        !deploying && !wrongNetwork
                          ? "0 0 24px rgba(34,211,238,0.2)"
                          : "none",
                      fontFamily: "Syne, sans-serif",
                    }}
                  >
                    {deploying && (
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    )}
                    {deploying ? (
                      "Deploying…"
                    ) : (
                      <>
                        <Rocket size={15} /> Deploy Collection
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Deploying / Done */}
            {step === 2 && (
              <div className="text-center space-y-6 py-8">
                {!deployed ? (
                  <>
                    <div
                      className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                      style={{
                        background: "rgba(34,211,238,0.08)",
                        border: "1px solid rgba(34,211,238,0.2)",
                      }}
                    >
                      <div
                        className="w-8 h-8 rounded-full border-[3px] border-t-transparent animate-spin"
                        style={{
                          borderColor: "#22d3ee",
                          borderTopColor: "transparent",
                        }}
                      />
                    </div>
                    <div>
                      <h2
                        className="text-2xl font-extrabold mb-2"
                        style={{
                          color: "#e6edf3",
                          fontFamily: "Syne, sans-serif",
                        }}
                      >
                        Deploying on Tempo…
                      </h2>
                      <p className="text-sm" style={{ color: "#9da7b3" }}>
                        Your transaction is being confirmed on chain. This
                        usually takes 5–15 seconds.
                      </p>
                      {txHash && (
                        <a
                          href={`${EXPLORER_BASE}/tx/${txHash}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold"
                          style={{ color: "#22d3ee" }}
                        >
                          View on Explorer <ExternalLink size={11} />
                        </a>
                      )}
                    </div>
                    {error && (
                      <div
                        className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs mx-auto max-w-sm"
                        style={{
                          background: "rgba(239,68,68,0.08)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          color: "#EF4444",
                        }}
                      >
                        <AlertCircle size={13} /> {error}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      size={64}
                      className="mx-auto"
                      style={{ color: "#22C55E" }}
                    />
                    <div>
                      <h2
                        className="text-2xl font-extrabold mb-2"
                        style={{
                          color: "#e6edf3",
                          fontFamily: "Syne, sans-serif",
                        }}
                      >
                        Collection Deployed!
                      </h2>
                      <p className="text-sm mb-1" style={{ color: "#9da7b3" }}>
                        Contract:{" "}
                        <code
                          className="font-mono text-xs"
                          style={{ color: "#22d3ee" }}
                        >
                          {newContract}
                        </code>
                      </p>
                      <p className="text-sm" style={{ color: "#9da7b3" }}>
                        Now set up your mint phases in the Collection Manager.
                      </p>
                    </div>
                    <div className="flex gap-3 justify-center">
                      <button
                        onClick={resetCreate}
                        className="h-11 px-5 rounded-xl text-sm font-bold"
                        style={{
                          background: "#161d28",
                          color: "#9da7b3",
                          border: "1px solid rgba(255,255,255,0.06)",
                          cursor: "pointer",
                        }}
                      >
                        Back to Studio
                      </button>
                      <button
                        onClick={() =>
                          navigate(`/studio/manage/${newContract}`)
                        }
                        className="h-11 px-6 rounded-xl text-sm font-bold flex items-center gap-2"
                        style={{
                          background: "#22d3ee",
                          color: "#0b0f14",
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "Syne, sans-serif",
                        }}
                      >
                        <Settings size={14} /> Manage Collection
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
