/**
 * pages/StudioPage.jsx
 *
 * Creator Studio — self-service deployment wizard.
 * Font: Helvetica Neue
 * Theme: Green (#00E6A8) replacing cyan
 *
 * Fix: After deploy, stays on step 2 with success state and
 * a "Manage Collection" button — no blind navigate that caused the blank screen.
 */

import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAccount, usePublicClient, useWriteContract, useChainId } from "wagmi";
import {
  Rocket, ArrowRight, ArrowLeft, CheckCircle2,
  AlertCircle, Wallet, Image as ImageIcon, Zap, ExternalLink,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

// ─── Constants ────────────────────────────────────────────────────────────────
const LAUNCHPAD_FACTORY = "0x0451929d3c5012978127A2e347d207Aa8b67f14d";
const TEMPO_CHAIN_ID    = 4217;
const EXPLORER_BASE     = "https://explore.tempo.xyz";
const GREEN             = "#00E6A8";
const FONT              = "'Helvetica Neue', Helvetica, Arial, sans-serif";

// ─── Factory ABI ──────────────────────────────────────────────────────────────
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
    type: "function", stateMutability: "view",
    inputs: [{ name: "creator", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "openToAll",
    type: "function", stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "CollectionCreated", type: "event",
    inputs: [
      { indexed: true,  name: "collection", type: "address" },
      { indexed: true,  name: "creator",    type: "address" },
      { indexed: false, name: "name",       type: "string"  },
      { indexed: false, name: "symbol",     type: "string"  },
    ],
  },
];

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ─── Step Bar ─────────────────────────────────────────────────────────────────
const STEPS = ["Details", "Review", "Deploy"];

function StepBar({ current }) {
  return (
    <div className="flex items-center gap-2 mb-10">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all"
            style={{
              fontFamily: FONT,
              background: i === current ? "rgba(0,230,168,0.12)" : i < current ? "rgba(0,230,168,0.06)" : "rgba(255,255,255,0.04)",
              border:     i === current ? "1px solid rgba(0,230,168,0.4)" : i < current ? "1px solid rgba(0,230,168,0.25)" : "1px solid rgba(255,255,255,0.06)",
              color:      i === current ? GREEN : i < current ? GREEN : "#9da7b3",
            }}>
            {i < current ? <CheckCircle2 size={12} /> : <span className="font-mono">{i + 1}</span>}
            <span className="hidden sm:inline">{label}</span>
          </div>
          {i < STEPS.length - 1 && (
            <div className="w-8 h-px" style={{ background: i < current ? "rgba(0,230,168,0.3)" : "rgba(255,255,255,0.08)" }} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Field + Input ────────────────────────────────────────────────────────────
function Field({ label, hint, required, children }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label className="text-xs font-bold uppercase tracking-wide" style={{ color: "#9da7b3", fontFamily: FONT }}>
          {label} {required && <span style={{ color: "#EF4444" }}>*</span>}
        </label>
        {hint && <span className="text-[10px]" style={{ color: "#6b7280", fontFamily: FONT }}>{hint}</span>}
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
      style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", fontFamily: FONT }}
      onFocus={e => (e.target.style.borderColor = GREEN)}
      onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
    />
  );
}

// ─── Logo uploader ────────────────────────────────────────────────────────────
function LogoUpload({ logoUrl, setLogoUrl, setLogoFile }) {
  const [uploading, setUploading] = useState(false);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogoUrl(ev.target.result);
    reader.readAsDataURL(file);
    setLogoFile(file);

    setUploading(true);
    try {
      const ext  = file.name.split(".").pop();
      const path = "logos/" + Date.now() + "." + ext;
      const { error } = await supabase.storage.from("nft-assets").upload(path, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage.from("nft-assets").getPublicUrl(path);
        setLogoUrl(data.publicUrl);
      }
    } catch {}
    setUploading(false);
  }

  return (
    <label
      className="relative flex flex-col items-center justify-center w-32 h-32 rounded-2xl cursor-pointer overflow-hidden transition-all"
      style={{ background: "#161d28", border: "2px dashed rgba(0,230,168,0.3)" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = GREEN)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(0,230,168,0.3)")}>
      {logoUrl ? (
        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-2">
          <ImageIcon size={20} style={{ color: GREEN }} />
          <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: "#9da7b3", fontFamily: FONT }}>
            {uploading ? "Uploading..." : "Upload Logo"}
          </span>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.6)" }}>
          <div className="w-5 h-5 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: GREEN }} />
        </div>
      )}
      <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </label>
  );
}

// ─── Main StudioPage ──────────────────────────────────────────────────────────
export default function StudioPage() {
  const navigate                 = useNavigate();
  const { address, isConnected } = useAccount();
  const chainId                  = useChainId();
  const publicClient             = usePublicClient();
  const { writeContractAsync }   = useWriteContract();

  const [step,         setStep]        = useState(0);
  const [deploying,    setDeploying]   = useState(false);
  const [error,        setError]       = useState("");
  const [txHash,       setTxHash]      = useState("");
  const [deployedAddr, setDeployedAddr] = useState(""); // new contract address
  const [deployedSlug, setDeployedSlug] = useState(""); // for redirect

  const [form, setForm] = useState({
    name: "", symbol: "", description: "",
    max_supply: "2000", pre_reveal: "",
    website: "", twitter: "", discord: "",
  });
  const [logoUrl,  setLogoUrl]  = useState("");
  const [logoFile, setLogoFile] = useState(null);

  const wrongNetwork = chainId !== TEMPO_CHAIN_ID;

  function set(key, val) { setForm(p => ({ ...p, [key]: val })); }
  function canProceed() { return form.name.trim() && form.symbol.trim() && Number(form.max_supply) > 0; }

  function goReview() {
    setError("");
    if (!canProceed()) return setError("Name, symbol and max supply are required.");
    if (!isConnected)  return setError("Connect your wallet first.");
    setStep(1);
  }

  const deploy = useCallback(async () => {
    if (!publicClient || !address) return setError("Wallet not connected.");
    if (wrongNetwork)               return setError("Switch to Tempo Mainnet (Chain ID 4217).");

    setDeploying(true);
    setError("");
    setStep(2); // move to deploying screen immediately

    try {
      // Check access
      let canDeploy = false;
      try {
        const [openToAll, isApproved] = await Promise.all([
          publicClient.readContract({ address: LAUNCHPAD_FACTORY, abi: FACTORY_ABI, functionName: "openToAll" }),
          publicClient.readContract({ address: LAUNCHPAD_FACTORY, abi: FACTORY_ABI, functionName: "isApprovedCreator", args: [address] }),
        ]);
        canDeploy = openToAll || isApproved;
      } catch {
        // If the read fails, attempt deploy anyway (factory might not have these getters)
        canDeploy = true;
      }

      if (!canDeploy) {
        setError("Your wallet is not yet approved to create collections.");
        setDeploying(false);
        setStep(1);
        return;
      }

      // Deploy transaction
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

      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // ── Extract contract address from CollectionCreated event logs ─────────
      // CollectionCreated(address indexed collection, address indexed creator, ...)
      // topics[0] = event sig, topics[1] = collection address (indexed), topics[2] = creator
      let newAddr = null;

      for (const log of receipt.logs) {
        // The factory emits this — its address should be the factory
        if (
          log.address?.toLowerCase() === LAUNCHPAD_FACTORY.toLowerCase() &&
          log.topics?.length >= 2
        ) {
          newAddr = ("0x" + log.topics[1].slice(-40)).toLowerCase();
          break;
        }
      }

      // Fallback: first log from a different address is the new contract
      if (!newAddr) {
        const newContractLog = receipt.logs.find(
          l => l.address?.toLowerCase() !== LAUNCHPAD_FACTORY.toLowerCase()
        );
        if (newContractLog) newAddr = newContractLog.address.toLowerCase();
      }

      if (!newAddr) {
        // Deploy happened but we can't extract address — show tx link, don't crash
        setError(
          "Deployed! But couldn't auto-detect the contract address. " +
          "Check the explorer for your new contract, then go to /studio/manage/<address>."
        );
        setDeploying(false);
        return;
      }

      // ── Save to Supabase ──────────────────────────────────────────────────
      const slug = slugify(form.name) + "-" + newAddr.slice(2, 8);

      await supabase.from("projects").insert({
        name:             form.name.trim(),
        symbol:           form.symbol.trim().toUpperCase(),
        description:      form.description.trim(),
        logo_url:         logoUrl || null,
        contract_address: newAddr,
        creator_wallet:   address.toLowerCase(),
        max_supply:       Number(form.max_supply),
        website:          form.website || null,
        twitter:          form.twitter || null,
        discord:          form.discord || null,
        status:           "draft",
        created_at:       new Date().toISOString(),
        updated_at:       new Date().toISOString(),
      });

      await supabase.from("collections").upsert({
        contract_address:  newAddr,
        name:              form.name.trim(),
        slug,
        description:       form.description.trim(),
        logo_url:          logoUrl || null,
        verified:          false,
        floor_price:       0, volume_total: 0, volume_24h: 0, total_sales: 0,
        total_supply:      Number(form.max_supply),
        metadata_base_uri: form.pre_reveal.trim() || null,
        creator_name:      address.slice(0, 6) + "…" + address.slice(-4),
        website_url:       form.website  || null,
        twitter_url:       form.twitter  || null,
        discord_url:       form.discord  || null,
      }, { onConflict: "contract_address" });

      // ── Success — store address for buttons, don't auto-navigate ─────────
      setDeployedAddr(newAddr);
      setDeployedSlug(slug);
      setDeploying(false);

    } catch (e) {
      console.error("[StudioPage deploy]", e);
      const msg = e?.shortMessage || e?.message?.slice(0, 120) || "Deployment failed";
      setError(msg);
      setDeploying(false);
      setStep(1); // go back to review so user can retry
    }
  }, [form, logoUrl, address, publicClient, writeContractAsync, wrongNetwork]);

  // ─── Not connected ────────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 fade-up"
        style={{ fontFamily: FONT }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{ background: "rgba(0,230,168,0.06)", border: "1px solid rgba(0,230,168,0.2)" }}>
          <Wallet size={32} style={{ color: GREEN }} />
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-extrabold mb-2" style={{ color: "#e6edf3" }}>Connect Wallet</h1>
          <p className="text-sm" style={{ color: "#9da7b3" }}>Connect your wallet to start creating your collection.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20 fade-up" style={{ background: "#0b0f14", fontFamily: FONT }}>
      <div className="max-w-2xl mx-auto px-4 py-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <Rocket size={14} style={{ color: GREEN }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GREEN }}>Creator Studio</span>
          </div>
          <h1 className="text-4xl font-extrabold mb-2" style={{ color: "#e6edf3" }}>Create Your Collection</h1>
          <p className="text-sm" style={{ color: "#9da7b3" }}>
            Deploy your NFT contract on Tempo in minutes. $0.05 per mint fee is applied automatically.
          </p>
        </div>

        <StepBar current={step} />

        {/* ── Step 0: Details ── */}
        {step === 0 && (
          <div className="space-y-6 fade-up">
            <div className="flex gap-5 items-start">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>Logo</label>
                <LogoUpload logoUrl={logoUrl} setLogoUrl={setLogoUrl} setLogoFile={setLogoFile} />
              </div>
              <div className="flex-1 space-y-4">
                <Field label="Collection Name" required>
                  <Input value={form.name} onChange={v => set("name", v)} placeholder="e.g. Tempo Nyans" />
                </Field>
                <Field label="Token Symbol" required hint="3–8 chars">
                  <Input value={form.symbol} onChange={v => set("symbol", v.toUpperCase())} placeholder="TNYANS" />
                </Field>
              </div>
            </div>

            <Field label="Description">
              <textarea value={form.description} onChange={e => set("description", e.target.value)}
                placeholder="Tell collectors what makes this collection special..."
                rows={3} className="w-full rounded-xl px-4 py-3 text-sm outline-none resize-none"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", fontFamily: FONT }}
                onFocus={e => (e.target.style.borderColor = GREEN)}
                onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
              />
            </Field>

            <Field label="Max Supply" required hint="Total NFTs in this collection">
              <Input value={form.max_supply} onChange={v => set("max_supply", v)} type="number" min="1" max="100000" placeholder="2000" />
            </Field>

            <Field label="Pre-reveal URI" hint="Optional placeholder shown before reveal">
              <Input value={form.pre_reveal} onChange={v => set("pre_reveal", v)} placeholder="ipfs://... or https://... (optional)" />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[["website", "Website", "https://..."], ["twitter", "Twitter", "https://x.com/..."], ["discord", "Discord", "https://discord.gg/..."]].map(([k, l, p]) => (
                <Field key={k} label={l}>
                  <Input value={form[k]} onChange={v => set(k, v)} placeholder={p} />
                </Field>
              ))}
            </div>

            <div className="rounded-2xl p-4" style={{ background: "rgba(0,230,168,0.04)", border: "1px solid rgba(0,230,168,0.1)" }}>
              <div className="flex items-center gap-2 mb-2">
                <Zap size={13} style={{ color: GREEN }} />
                <span className="text-xs font-bold uppercase tracking-wide" style={{ color: GREEN }}>Platform Fee</span>
              </div>
              <p className="text-xs" style={{ color: "#9da7b3" }}>
                A flat <strong style={{ color: "#e6edf3" }}>$0.05 USD</strong> per mint is automatically included by the smart contract.
                You receive 100% of your set mint price on top of this.
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
                background: canProceed() ? GREEN : "#161d28",
                color:      canProceed() ? "#0b0f14" : "#9da7b3",
                border: "none", cursor: canProceed() ? "pointer" : "not-allowed",
                boxShadow: canProceed() ? "0 0 32px rgba(0,230,168,0.2)" : "none",
                fontFamily: FONT,
              }}>
              Review & Deploy <ArrowRight size={16} />
            </button>
          </div>
        )}

        {/* ── Step 1: Review ── */}
        {step === 1 && (
          <div className="space-y-5 fade-up">
            <div className="rounded-2xl overflow-hidden" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center gap-4 p-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                <div className="w-16 h-16 rounded-2xl overflow-hidden flex-shrink-0"
                  style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
                  {logoUrl
                    ? <img src={logoUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center font-bold text-xl" style={{ color: GREEN }}>
                        {form.name.slice(0, 2).toUpperCase()}
                      </div>}
                </div>
                <div>
                  <div className="font-extrabold text-xl" style={{ color: "#e6edf3" }}>{form.name}</div>
                  <div className="text-sm mt-0.5" style={{ color: "#9da7b3" }}>
                    {form.symbol} · {Number(form.max_supply).toLocaleString()} max supply
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-3">
                {[
                  ["Factory",       LAUNCHPAD_FACTORY.slice(0, 10) + "…"],
                  ["Creator",       address?.slice(0, 10) + "…"],
                  ["Platform Fee",  "$0.05 per mint (automatic)"],
                  ["Payment Token", "pathUSD (automatic)"],
                  ["Network",       "Tempo Mainnet (4217)"],
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
                <AlertCircle size={13} /> Switch to Tempo Mainnet (Chain ID 4217) before deploying.
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-xl px-4 py-3 text-xs"
                style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#EF4444" }}>
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" /> {error}
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
                  background: deploying || wrongNetwork ? "#161d28" : GREEN,
                  color:      deploying || wrongNetwork ? "#9da7b3" : "#0b0f14",
                  border: "none", cursor: deploying || wrongNetwork ? "not-allowed" : "pointer",
                  boxShadow: !deploying && !wrongNetwork ? "0 0 24px rgba(0,230,168,0.2)" : "none",
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
                  style={{ background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.2)" }}>
                  <div className="w-8 h-8 rounded-full animate-spin"
                    style={{ border: "3px solid " + GREEN, borderTopColor: "transparent" }} />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#e6edf3" }}>Deploying on Tempo…</h2>
                  <p className="text-sm" style={{ color: "#9da7b3" }}>
                    Your transaction is being confirmed on chain. This usually takes 5–15 seconds.
                  </p>
                  {txHash && (
                    <a href={EXPLORER_BASE + "/tx/" + txHash} target="_blank" rel="noreferrer"
                      className="inline-flex items-center gap-1.5 mt-3 text-xs font-bold"
                      style={{ color: GREEN }}>
                      View on Explorer <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </>
            ) : deployedAddr ? (
              /* ── SUCCESS STATE — no blank screen ── */
              <>
                <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                  style={{ background: "rgba(0,230,168,0.08)", border: "1px solid rgba(0,230,168,0.3)" }}>
                  <CheckCircle2 size={40} style={{ color: GREEN }} />
                </div>
                <div>
                  <h2 className="text-2xl font-extrabold mb-2" style={{ color: "#e6edf3" }}>Collection Deployed! 🎉</h2>
                  <p className="text-sm mb-1" style={{ color: "#9da7b3" }}>Your contract is live on Tempo Chain.</p>
                  <code className="text-xs font-mono px-3 py-1.5 rounded-lg inline-block mt-2"
                    style={{ background: "#161d28", color: GREEN, border: "1px solid rgba(0,230,168,0.2)" }}>
                    {deployedAddr}
                  </code>
                </div>

                {txHash && (
                  <a href={EXPLORER_BASE + "/tx/" + txHash} target="_blank" rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold"
                    style={{ color: GREEN }}>
                    View transaction <ExternalLink size={12} />
                  </a>
                )}

                {/* Action buttons — explicit navigation instead of auto-redirect */}
                <div className="flex flex-col sm:flex-row gap-3 justify-center mt-4">
                  <button
                    onClick={() => navigate("/studio/manage/" + deployedAddr)}
                    className="h-12 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: GREEN, color: "#0b0f14", border: "none", cursor: "pointer" }}>
                    <Zap size={14} /> Manage Collection
                  </button>
                  <button
                    onClick={() => navigate("/collection/" + deployedSlug)}
                    className="h-12 px-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2"
                    style={{ background: "#161d28", color: "#e6edf3", border: "1px solid rgba(255,255,255,0.1)", cursor: "pointer" }}>
                    View on Marketplace
                  </button>
                </div>

                {error && (
                  <div className="text-xs rounded-xl px-4 py-3 text-left"
                    style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", color: "#EAB308" }}>
                    {error}
                  </div>
                )}
              </>
            ) : (
              /* Deploy attempted but failed mid-way (error shown, step=1) — shouldn't reach here */
              <div style={{ color: "#9da7b3" }}>Something went wrong — check the previous step.</div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
