// pages/ManagePage.jsx
// Managed launchpad model — creator submits art details only.
// Platform deploys the contract after admin approval.

import { useState } from "react";
import { useAccount } from "wagmi";
import { Settings, Rocket, CheckCircle2, AlertCircle } from "lucide-react";
import { useSubmitProject } from "@/hooks/useSupabase";

const inputStyle = {
  background: "#161d28",
  border: "1px solid rgba(255,255,255,0.06)",
  color: "#e6edf3",
};

function Field({ label, required, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>
        {label} {required && <span style={{ color: "#EF4444" }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ label, field, type = "text", placeholder, required, value, onChange }) {
  return (
    <Field label={label} required={required}>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        required={required}
        onChange={e => onChange(field, e.target.value)}
        className="w-full h-11 rounded-xl px-3 text-sm outline-none"
        style={inputStyle}
        onFocus={e => (e.target.style.borderColor = "#22d3ee")}
        onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
      />
    </Field>
  );
}

// ─── Apply Form ───────────────────────────────────────────────────────────────
function ApplyForm() {
  const { submit, isLoading, isSuccess, error } = useSubmitProject();
  const [form, setForm] = useState({
    name:           "",
    symbol:         "",
    description:    "",
    contact_email:  "",
    mint_price:     "",
    max_supply:     "",
    base_uri:       "",
    website:        "",
    twitter:        "",
    discord:        "",
  });

  function set(key, val) { setForm(p => ({ ...p, [key]: val })); }

  async function handleSubmit(e) {
    e.preventDefault();
    // Platform handles contract deployment — no contract_address or payment_token fields
    await submit({
      name:          form.name,
      symbol:        form.symbol,
      description:   form.description,
      contact_email: form.contact_email,
      mint_price:    form.mint_price ? parseFloat(form.mint_price) : null,
      max_supply:    form.max_supply ? parseInt(form.max_supply) : null,
      base_uri:      form.base_uri || null,
      website:       form.website || null,
      twitter:       form.twitter || null,
      discord:       form.discord || null,
      status:        "pending",
    });
  }

  if (isSuccess) {
    return (
      <div className="rounded-2xl p-12 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
        <CheckCircle2 size={48} className="mx-auto mb-4" style={{ color: "#22C55E" }} />
        <div className="font-bold text-xl mb-2" style={{ color: "#e6edf3" }}>Application Submitted!</div>
        <div className="text-sm" style={{ color: "#9da7b3" }}>
          We'll review your project and deploy your contract. You'll hear from us soon.
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-xl">

      {/* Platform badge */}
      <div className="rounded-2xl p-4" style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)" }}>
        <div className="flex items-center gap-2 mb-1">
          <Rocket size={14} style={{ color: "#22d3ee" }} />
          <span className="text-sm font-bold" style={{ color: "#22d3ee" }}>Managed Launch</span>
        </div>
        <p className="text-xs" style={{ color: "#9da7b3" }}>
          Focus on your art. We handle the smart contract deployment, pathUSD integration, and on-chain setup — at no extra cost.
        </p>
      </div>

      {/* ── Project Info ── */}
      <div className="text-xs font-bold uppercase tracking-widest pt-2" style={{ color: "#9da7b3" }}>Project Info</div>

      <Input label="Project Name"   field="name"    required value={form.name}          onChange={set} placeholder="My NFT Collection" />
      <Input label="Token Symbol"   field="symbol"  required value={form.symbol}        onChange={set} placeholder="MNFT" />

      <Field label="Description" required>
        <textarea rows={4} placeholder="Tell us about your project, the art, the vision..." value={form.description} required
          onChange={e => set("description", e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = "#22d3ee")}
          onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
        />
      </Field>

      <Input label="Contact Email" field="contact_email" type="email" required value={form.contact_email} onChange={set} placeholder="team@myproject.com" />

      {/* ── Collection Details ── */}
      <div className="text-xs font-bold uppercase tracking-widest pt-2" style={{ color: "#9da7b3" }}>Collection Details</div>

      <div className="grid grid-cols-2 gap-4">
        <Input label="Mint Price (USD)" field="mint_price" type="number" value={form.mint_price} onChange={set} placeholder="e.g. 20" />
        <Input label="Max Supply"       field="max_supply" type="number" value={form.max_supply} onChange={set} placeholder="e.g. 2000" />
      </div>

      <Field label="Metadata Base URI (IPFS)">
        <input type="text" placeholder="ipfs://QmXxx.../"
          value={form.base_uri} onChange={e => set("base_uri", e.target.value)}
          className="w-full h-11 rounded-xl px-3 text-sm font-mono outline-none"
          style={inputStyle}
          onFocus={e => (e.target.style.borderColor = "#22d3ee")}
          onBlur={e  => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
        />
        <p className="text-[10px] mt-1" style={{ color: "#9da7b3" }}>
          Upload your artwork to IPFS via Pinata or NFT.Storage first, then paste the URI here.
        </p>
      </Field>

      {/* ── Socials ── */}
      <div className="text-xs font-bold uppercase tracking-widest pt-2" style={{ color: "#9da7b3" }}>Socials</div>

      <Input label="Website" field="website" value={form.website} onChange={set} placeholder="https://myproject.xyz" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="X / Twitter" field="twitter" value={form.twitter} onChange={set} placeholder="https://x.com/..." />
        <Input label="Discord"     field="discord" value={form.discord} onChange={set} placeholder="https://discord.gg/..." />
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444" }}>
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" /> {error}
        </div>
      )}

      <button type="submit" disabled={isLoading}
        className="w-full h-12 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
        style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1 }}>
        {isLoading && <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />}
        {isLoading ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function ManagePage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 fade-up">
        <Settings size={40} style={{ color: "#9da7b3" }} />
        <p className="text-lg font-semibold" style={{ color: "#e6edf3" }}>Connect your wallet</p>
        <p className="text-sm" style={{ color: "#9da7b3" }}>to apply to launch your collection on Tempo Chain.</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 py-8 max-w-4xl mx-auto fade-up">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Rocket size={14} style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Launch</span>
        </div>
        <h1 className="text-3xl font-extrabold" style={{ color: "#e6edf3" }}>Launch on TempoNFT</h1>
        <p className="text-sm mt-1" style={{ color: "#9da7b3" }}>
          Apply to launch your NFT collection on Tempo Chain. No technical skills required.
        </p>
      </div>
      <ApplyForm />
    </div>
  );
}
