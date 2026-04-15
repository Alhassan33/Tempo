/**
 * pages/StudioPage.jsx
 *
 * Creator Studio — OpenSea-style self-service deployment wizard.
 *
 * Flow:
 *   Step 1 → Creator fills name, symbol, description, logo, supply
 *   Step 2 → Preview + wallet approval
 *   Step 3 → Calls factory.createCollection() on Tempo chain
 *   Step 4 → Contract address extracted from CollectionCreated event
 *   Step 5 → Supabase row created, redirect to /studio/manage/[contract]
 *
 * The $0.05 per-mint fee is hardcoded into the factory — creator cannot change it.
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, usePublicClient, useWriteContract, useChainId } from "wagmi";
import {
  Rocket, Upload, ArrowRight, ArrowLeft, CheckCircle2,
  AlertCircle, Wallet, Image as ImageIcon, Layers, Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const LAUNCHPAD_FACTORY = "0x0451929d3c5012978127A2e347d207Aa8b67f14d";
const TEMPO_CHAIN_ID    = 4217;
const EXPLORER_BASE     = "https://explore.tempo.xyz";

// ─── Factory ABI (minimal — only what we need) ────────────────────────────────
const FACTORY_ABI = [
  {
    name: "createCollection",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "name",         type: "string"  },
      { name: "symbol",       type: "string"  },
      { name: "preRevealURI", type: "string"  },
      { name: "maxSupply",    type: "uint256" },
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
      { indexed: true,  name: "collection", type: "address" },
      { indexed: true,  name: "creator",    type: "address" },
      { indexed: false, name: "name",       type: "string"  },
      { indexed: false, name: "symbol",     type: "string"  },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Step indicators ──────────────────────────────────────────────────────────
const STEPS = ["Details", "Review", "Deploy"];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all`}
            style={{
              background: i === current ? "rgba(34,211,238,0.12)" : i < current ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
              border: i === current ? "1px solid rgba(34,211,238,0.4)" : i < current ? "1px solid rgba(34,197,94,0.3)" : "1px solid rgba(255,255,255,0.06)",
              color: i === current ? "#22d3ee" : i < current ? "#22C55E" : "#9da7b3",
            }}>
            {i < current ? <CheckCircle2 size={12} /> : <span className="font-mono">{i + 1}</span>}
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="w-8 h-px" style={{ background: i < current ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.08)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────
function Field({ label, hint, required, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-bold uppercase tracking-wide"
          style={{ color: "#9da7b3" }}>
          {label} {required && <span style={{ color: "#EF4444" }}>*</span>}
        </label>
        {hint && <span className="text-[10px]" style={{ color: "#6b7280" }}>{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, type = "text", min, max }) {
  return (
    <input type={type} value={value} placeholder={placeholder} min={min} max={max}
      onChange={e => onChange(e.target.value)}
      className="w-full h-11 rounded-xl px-4 text-sm outline-none"
      style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
      onFocus={e => e.target.style.borderColor = "#22d3ee"}
      onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"} />
  );
}

// ─── Logo uploader ─────────────────────────────────────────────────────────────
function LogoUpload({ logoUrl, setLogoUrl, setLogoFile }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview immediately
    const reader = new FileReader();
    reader.onload = ev => setLogoUrl(ev.target.result);
    reader.readAsDataURL(file);
    setLogoFile(file);

    // Upload to Supabase storage
    setUploading(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = `logos/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("nft-assets").upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("nft-assets").getPublicUrl(path);
        setLogoUrl(data.publicUrl);
      }
    } catch {}
    setUploading(false);
  }

  return (
    <label className="relative flex flex-col items-center justify-center w-32 h-32 rounded-2xl cursor-pointer overflow-hidden transition-all"
      style={{ background: "#161d28", border: "2px dashed rgba(34,211,238,0.3)" }}
      onMouseEnter={e => e.currentTarget.style.borderColor = "#22d3ee"}
      onMouseLeave={e => e.currentTarget.style.borderColor = "rgba(34,211,238,0.3)"}>
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <ImageIcon size={20} style={{ color: "#22d3ee" }} />
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9da7b3" }}>
            {uploading ? "Uploading..." : "Upload Logo"}
          </span>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: "#22d3ee" }} />
        </div>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </label>
  );
}

// ─── Main StudioPage ───────────────────────────────────────────────────────────
export default function StudioPage() {
  const navigate                 = useNavigate();
  const { address, isConnected } = useAccount();
  const chainId                  = useChainId();
  const publicClient             = usePublicClient();
  const { writeContractAsync }   = useWriteContract();

  const [step,      setStep]      = useState(0);
  const [deploying, setDeploying] = useState(false);
  const [error,     setError]     = useState("");
  const [txHash,    setTxHash]    = useState("");

  // Form state
  const [form, setForm] = useState({
    name:        "",
    symbol:      "",
    description: "",
    max_supply:  "2000",
    pre_reveal:  "",   // optional placeholder URI shown before reveal
    website:     "",
    twitter:     "",
    discord:     "",
  });
  const [logoUrl,  setLogoUrl]  = useState("");
  const [logoFile, setLogoFile] = useState(null);

  const wrongNetwork = chainId !== TEMPO_CHAIN_ID;

  function set(key, val) { setForm(p => ({ ...p, [key]: val })); }

  function canProceed() {
    return form.name.trim() && form.symbol.trim() && Number(form.max_supply) > 0;
  }

  // ─── Step 1 → 2 ─────────────────────────────────────────────────────────
  function goReview() {
    setError("");
    if (!canProceed()) return setError("Name, symbol and max supply are required.");
    if (!isConnected)  return setError("Connect your wallet first.");
    setStep(1);
  }

  // ─── Step 2 → Deploy ─────────────────────────────────────────────────────
  const deploy = useCallback(async () => {
    if (!publicClient || !address) return setError("Wallet not connected.");
    if (wrongNetwork)              return setError("Switch to Tempo Mainnet.");

    setDeploying(true);
    setError("");

    try {
      // Check if creator is approved (or factory is open to all)
      const [openToAll, isApproved] = await Promise.all([
        publicClient.readContract({ address: LAUNCHPAD_FACTORY, abi: FACTORY_ABI, functionName: "openToAll" }),
        publicClient.readContract({ address: LAUNCHPAD_FACTORY, abi: FACTORY_ABI, functionName: "isApprovedCreator", args: [address] }),
      ]);

      if (!openToAll && !isApproved) {
        setError("Your wallet is not yet approved to create collections. Contact the Tempo team.");
        setDeploying(false);
        return;
      }

      // Deploy
      const hash = await writeContractAsync({
        address:      LAUNCHPAD_FACTORY,
        abi:          FACTORY_ABI,
        functionName: "createCollection",
        args: [
          form.name.trim(),
          form.symbol.trim().toUpperCase(),
          form.pre_reveal.trim() || "",
          BigInt(form.max_supply),
        ],
      });

      setTxHash(hash);
      setStep(2);

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // ── Extract new contract address from CollectionCreated event ─────────
      // CollectionCreated(address indexed collection, address indexed creator, ...)
      // indexed params → topics[1] = collection, topics[2] = creator
      let newContractAddress = null;
      for (const log of receipt.logs) {
        if (log.address.toLowerCase() === LAUNCHPAD_FACTORY.toLowerCase() && log.topics[1]) {
          newContractAddress = ("0x" + log.topics[1].slice(-40)).toLowerCase();
          break;
        }
      }

      if (!newContractAddress) {
        setError("Deployed but couldn't detect contract address. Check explorer: " + hash);
        setDeploying(false);
        return;
      }

      // ── Save to Supabase ──────────────────────────────────────────────────
      const slug = slugify(form.name) + "-" + newContractAddress.slice(2, 8);

      // Create project row
      await supabase.from("projects").insert({
        name:             form.name.trim(),
        symbol:           form.symbol.trim().toUpperCase(),
        description:      form.description.trim(),
        logo_url:         logoUrl || null,
        contract_address: newContractAddress,
        creator_wallet:   address.toLowerCase(),
        max_supply:       Number(form.max_supply),
        website:          form.website || null,
        twitter:          form.twitter || null,
        discord:          form.discord || null,
        status:           "draft",  // hidden until creator sets phases
        created_at:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      });

      // Create collections marketplace row
      await supabase.from("collections").upsert({
        contract_address:  newContractAddress,
        name:              form.name.trim(),
        slug,
        description:       form.description.trim(),
        logo_url:          logoUrl || null,
        verified:          false,
        floor_price:       0,
        volume_total:      0,
        volume_24h:        0,
        total_sales:       0,
        total_supply:      Number(form.max_supply),
        metadata_base_uri: form.pre_reveal.trim() || "",
        creator_name:      address.slice(0, 6) + "…" + address.slice(-4),
        website_url:       form.website || null,
        twitter_url:       form.twitter || null,
      }, { onConflict: "contract_address" });

      // ── Redirect to manage page ───────────────────────────────────────────
      setTimeout(() => {
        navigate(`/studio/manage/${newContractAddress}`);
      }, 1500);

    } catch (e) {
      setError(e?.shortMessage || e?.message?.slice(0, 100) || "Deployment failed");
      setDeploying(false);
      setStep(1); // go back to review
    }
  }, [form, logoUrl, address, publicClient, writeContractAsync, wrongNetwork, navigate]);

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 fade-up">
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(34,211,238,0.06)", border: "1px solid rgba(34,211,238,0.2)" }}>
          <Wallet size={32} style={{ color: "#22d3ee" }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
            Connect Wallet
          </h1>
          <p className="text-sm" style={{ color: "#9da7b3" }}>Connect your wallet to start creating your collection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 fade-up" style={{ background: "#0b0f14" }}>
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Rocket size={14} style={{ color: "#22d3ee" }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee", fontFamily: "Syne, sans-serif" }}>
              Creator Studio
            </span>
          </div>
          <h1 className="text-4xl font-extrabold" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
            Create Your Collection
          </h1>
          <p className="mt-2 text-sm" style={{ color: "#9da7b3" }}>
            Deploy your NFT contract on Tempo in minutes. $0.05 per mint fee is applied automatically — no setup needed.
          </p>
        </div>

        <StepBar current={step} />

        {/* ── Step 0: Details ── */}
        {step === 0 && (
          <div className="space-y-6 fade-up">
            {/* Logo + Name row */}
            <div className="flex gap-5 items-start">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>
                  Logo
                </label>
                <LogoUpload logoUrl={logoUrl} setLogoUrl={setLogoUrl} setLogoFile={setLogoFile} />
              </div>
              <div className="flex-1 space-y-4">
                <Field label="Collection Name" required>
                  <Input value={form.name} onChange={v => set("name", v)} placeholder="e.g. Tempo Nyans" />
                </Field>
                <Field label="Token Symbol" required hint="3–8 chars">
                  <Input value={form.symbol} onChange={v => set("symbol", v.toUpperCase())} placeholder="e.g. TNYANS" />
                </Field>
              </div>
            </div>

            <Field label="Description">
              <textarea value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="Tell collectors what makes this collection special..."
                rows={3} className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
                onFocus={e => e.target.style.borderColor = "#22d3ee"}
                onBlur={e  => e.target.style.borderColor = "rgba(255,255,255,0.06)"} />
            </Field>

            <Field label="Max Supply" required hint="Total NFTs in this collection">
              <Input value={form.max_supply} onChange={v => set("max_supply", v)} type="number" min="1" max="100000" placeholder="2000" />
            </Field>

            <Field label="Pre-reveal URI" hint="Optional placeholder shown before reveal">
              <Input value={form.pre_reveal} onChange={v => set("pre_reveal", v)} placeholder="ipfs://... or https://... (optional)" />
            </Field>

            {/* Socials */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[["website", "Website", "https://..."], ["twitter", "Twitter", "https://x.com/..."], ["discord", "Discord", "https://discord.gg/..."]].map(([k, l, p]) => (
                <Field key={k} label={l}>
                  <Input value={form[k]} onChange={v => set(k, v)} placeholder={p} />
                </Field>
              ))}
            </div>

            {/* Platform fee info */}
            <div className="rounded-2xl p-4"
              style={{ background: "rgba(34,211,238,0.04)", border: "1px solid rgba(34,211,238,0.1)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={13} style={{ color: "#22d3ee" }} />
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: "#22d3ee" }}>Platform Fee</span>
              </div>
              <p className="text-xs" style={{ color: "#9da7b3" }}>
                A flat <strong style={{ color: "#e6edf3" }}>$0.05 USD</strong> per mint is automatically included in every transaction by the smart contract. You receive 100% of your set mint price on top of this.
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}>
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <button onClick={goReview} disabled={!canProceed()}
              className="w-full h-14 rounded-2xl font-bold text-base flex items-center justify-center gap-2"
              style={{
                background: canProceed() ? "#22d3ee" : "#161d28",
                color:      canProceed() ? "#0b0f14" : "#9da7b3",
                border:     "none", cursor: canProceed() ? "pointer" : "not-allowed",
                boxShadow:  canProceed() ? "0 0 32px rgba(34,211,238,0.2)" : "none",
                fontFamily: "Syne, sans-serif",
              }}>
              Review & Deploy <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Step 1: Review ── */}
        {step === 1 && (
          <div className="space-y-5 fade-up">
            <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Collection preview */}
              <div className="flex items-center gap-4 p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
                  style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-bold text-xl" style={{ color: "#22d3ee" }}>
                        {form.name.slice(0, 2).toUpperCase()}
                      </div>
                  }
                </div>
                <div>
                  <div className="font-extrabold text-xl" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>{form.name}</div>
                  <div className="text-sm mt-0.5" style={{ color: "#9da7b3" }}>{form.symbol} · {Number(form.max_supply).toLocaleString()} max supply</div>
                </div>
              </div>

              {/* Details */}
              <div className="p-5 space-y-3">
                {[
                  ["Factory",      LAUNCHPAD_FACTORY.slice(0, 10) + "…"],
                  ["Creator",      address?.slice(0, 10) + "…"],
                  ["Platform Fee", "$0.05 per mint (automatic)"],
                  ["Payment Token","pathUSD (automatic)"],
                  ["Network",      "Tempo Mainnet (4217)"],
                ].map(([l, v]) => (
                  <div key={l} className="flex justify-between text-sm">
                    <span style={{ color: "#9da7b3" }}>{l}</span>
                    <span className="font-mono font-bold" style={{ color: "#e6edf3" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {wrongNetwork && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}>
                <AlertCircle size={13} /> Switch to Tempo Mainnet before deploying.
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl px-4 py-3 text-xs"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}>
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <div className="flex gap-3">
              <button onClick={() => { setStep(0); setError(""); }}
                className="h-12 px-6 rounded-xl text-sm font-bold flex items-center gap-2"
                style={{ background: "#161d28", color: "#9da7b3", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}>
                <ArrowLeft size={14} /> Back
              </button>
              <button onClick={deploy} disabled={deploying || wrongNetwork}
                className="flex-1 h-12 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                style={{
                  background:  deploying || wrongNetwork ? "#161d28" : "#22d3ee",
                  color:       deploying || wrongNetwork ? "#9da7b3" : "#0b0f14",
                  border:      "none", cursor: deploying || wrongNetwork ? "not-allowed" : "pointer",
                  boxShadow:   !deploying && !wrongNetwork ? "0 0 24px rgba(34,211,238,0.2)" : "none",
                  fontFamily:  "Syne, sans-serif",
                }}>
                {deploying && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
                {deploying ? "Deploying…" : <><Rocket size={15} /> Deploy Collection</>}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Deploying / Done ── */}
        {step === 2 && (
          <div className="text-center space-y-6 fade-up py-8">
            {deploying ? (
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)" }}>
                  <div className="w-8 h-8 border-3 border-t-transparent rounded-full animate-spin" style={{ border: "3px solid #22d3ee", borderTopColor: "transparent" }} />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
                    Deploying on Tempo…
                  </h2>
                  <p className="text-sm" style={{ color: "#9da7b3" }}>
                    Your transaction is being confirmed on chain. This usually takes 5–15 seconds.
                  </p>
                  {txHash && (
                    <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold"
                      style={{ color: "#22d3ee" }}>
                      View on Explorer ↗
                    </a>
                  )}
                </div>
              </>
            ) : (
              <>
                <CheckCircle2 size={64} className="mx-auto" style={{ color: "#22C55E" }} />
                <div>
                  <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
                    Collection Deployed!
                  </h2>
                  <p className="text-sm" style={{ color: "#9da7b3" }}>
                    Redirecting to your collection manager…
                  </p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
