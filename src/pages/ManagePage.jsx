import { useState } from "react";
import { Settings, Shield, Rocket, LayoutGrid, Check, X, Star, Clock, ChevronDown, ExternalLink } from "lucide-react";
import { useWallet } from "@/hooks/useWallet.js";
import { useAdminProjects, useSubmitProject } from "@/hooks/useSupabase";

// ─── Admin wallet addresses (add yours here) ──────────────────────────────────
const ADMIN_WALLETS = [
  // "0x8dd4561cf6fa3ca2024a55db36702ce559318d6c",
];

const STATUS_COLORS = {
  pending:  { bg: "rgba(234,179,8,0.1)",  border: "rgba(234,179,8,0.3)",  text: "#EAB308" },
  approved: { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.3)",  text: "#22C55E" },
  featured: { bg: "rgba(34,211,238,0.1)", border: "rgba(34,211,238,0.3)", text: "#22D3EE" },
  rejected: { bg: "rgba(239,68,68,0.1)",  border: "rgba(239,68,68,0.3)",  text: "#EF4444" },
  live:     { bg: "rgba(34,197,94,0.1)",  border: "rgba(34,197,94,0.3)",  text: "#22C55E" },
  ended:    { bg: "rgba(157,167,179,0.1)",border: "rgba(157,167,179,0.3)",text: "#9DA7B3" },
};

function StatusBadge({ status }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      {status}
    </span>
  );
}

function Field({ label, value, half }) {
  if (!value) return null;
  return (
    <div className={half ? "col-span-1" : "col-span-2"}>
      <div className="text-[10px] font-semibold uppercase tracking-wide mb-1" style={{ color: "#9da7b3" }}>{label}</div>
      <div className="text-sm" style={{ color: "#e6edf3" }}>{value}</div>
    </div>
  );
}

// ─── Admin Panel ──────────────────────────────────────────────────────────────
function AdminPanel() {
  const { projects, isLoading, updateStatus, featureProject } = useAdminProjects();
  const [filter, setFilter] = useState("pending");
  const [expanded, setExpanded] = useState(null);
  const [featOrder, setFeatOrder] = useState("1");
  const [notes, setNotes] = useState("");

  const filtered = projects.filter((p) =>
    filter === "all" ? true : p.status === filter
  );

  const counts = projects.reduce((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});

  async function handle(id, status) {
    await updateStatus(id, status, notes);
    setExpanded(null);
    setNotes("");
  }

  async function handleFeature(id) {
    await featureProject(id, parseInt(featOrder));
    setExpanded(null);
  }

  const filters = ["all", "pending", "approved", "featured", "live", "rejected"];

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {filters.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors"
            style={{
              background: filter === f ? "rgba(34,211,238,0.1)" : "#161d28",
              border: `1px solid ${filter === f ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.06)"}`,
              color: filter === f ? "#22d3ee" : "#9da7b3",
              cursor: "pointer", fontFamily: "Syne, sans-serif",
            }}>
            {f} {counts[f] ? `(${counts[f]})` : ""}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl animate-pulse" style={{ background: "#161d28" }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl p-12 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
          <Clock size={32} className="mx-auto mb-3" style={{ color: "#9da7b3" }} />
          <div className="font-semibold mb-1" style={{ color: "#e6edf3" }}>No {filter} applications</div>
          <div className="text-sm" style={{ color: "#9da7b3" }}>Applications will appear here when submitted</div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <div key={p.id} className="rounded-2xl overflow-hidden"
              style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
              {/* Row */}
              <div className="flex items-center gap-4 p-4 cursor-pointer"
                onClick={() => setExpanded(expanded === p.id ? null : p.id)}>
                {/* Logo */}
                <div className="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center font-bold text-sm"
                  style={{ background: "#161d28", color: "#22d3ee" }}>
                  {p.logo_url
                    ? <img src={p.logo_url} alt={p.name} className="w-full h-full object-cover" />
                    : p.name?.slice(0, 2).toUpperCase()
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate" style={{ color: "#e6edf3" }}>{p.name}</div>
                  <div className="text-xs" style={{ color: "#9da7b3" }}>
                    {new Date(p.submitted_at).toLocaleDateString()} · {p.contact_email || "No email"}
                  </div>
                </div>
                <StatusBadge status={p.status} />
                <ChevronDown size={14} style={{ color: "#9da7b3", transform: expanded === p.id ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
              </div>

              {/* Expanded details */}
              {expanded === p.id && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                  <div className="grid grid-cols-2 gap-3 mt-4 mb-4">
                    <Field label="Contract" value={p.contract_address} />
                    <Field label="Description" value={p.description} />
                    <Field label="Mint Price" value={p.mint_price ? `${p.mint_price} USD` : null} half />
                    <Field label="Max Supply" value={p.max_supply?.toLocaleString()} half />
                    <Field label="Mint Start" value={p.mint_start_time ? new Date(p.mint_start_time).toLocaleString() : null} half />
                    <Field label="Payment Token" value={p.payment_token} half />
                    <Field label="Base URI" value={p.base_uri} />
                    <Field label="Website" value={p.website} half />
                    <Field label="Twitter" value={p.twitter} half />
                    <Field label="Discord" value={p.discord} half />
                  </div>

                  {/* Links */}
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {p.website && (
                      <a href={p.website} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: "#161d28", color: "#9da7b3", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none" }}>
                        <ExternalLink size={10} /> Website
                      </a>
                    )}
                    {p.contract_address && (
                      <a href={`https://explorer.moderato.tempo.xyz/address/${p.contract_address}`} target="_blank" rel="noreferrer"
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: "#161d28", color: "#9da7b3", border: "1px solid rgba(255,255,255,0.06)", textDecoration: "none" }}>
                        <ExternalLink size={10} /> Explorer
                      </a>
                    )}
                  </div>

                  {/* Notes */}
                  <textarea
                    placeholder="Add internal notes (optional)..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    className="w-full rounded-xl px-3 py-2 text-sm outline-none resize-none mb-3"
                    style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", fontFamily: "Syne, sans-serif" }}
                  />

                  {/* Feature order */}
                  {(p.status === "approved" || p.status === "featured") && (
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="number" min="1" max="20" value={featOrder}
                        onChange={(e) => setFeatOrder(e.target.value)}
                        className="w-16 h-8 rounded-lg px-2 text-sm text-center outline-none"
                        style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
                      />
                      <button onClick={() => handleFeature(p.id)}
                        className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-bold"
                        style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)", color: "#22d3ee", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                        <Star size={11} /> Feature at #{featOrder}
                      </button>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 flex-wrap">
                    {p.status === "pending" && (
                      <>
                        <button onClick={() => handle(p.id, "approved")}
                          className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-bold"
                          style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.3)", color: "#22C55E", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                          <Check size={13} /> Approve
                        </button>
                        <button onClick={() => handle(p.id, "rejected")}
                          className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-bold"
                          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                          <X size={13} /> Reject
                        </button>
                      </>
                    )}
                    {p.status === "approved" && (
                      <button onClick={() => handle(p.id, "live")}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-bold"
                        style={{ background: "rgba(34,211,238,0.1)", border: "1px solid rgba(34,211,238,0.3)", color: "#22d3ee", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                        <Rocket size={13} /> Mark as Live
                      </button>
                    )}
                    {p.status === "live" && (
                      <button onClick={() => handle(p.id, "ended")}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-bold"
                        style={{ background: "rgba(157,167,179,0.1)", border: "1px solid rgba(157,167,179,0.3)", color: "#9DA7B3", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                        Mark as Ended
                      </button>
                    )}
                    {p.status !== "pending" && p.status !== "rejected" && (
                      <button onClick={() => handle(p.id, "rejected")}
                        className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-bold"
                        style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
                        <X size={13} /> Remove
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Apply Form (for project teams) ──────────────────────────────────────────
function ApplyForm() {
  const { submit, isLoading, isSuccess, error } = useSubmitProject();
  const [form, setForm] = useState({
    name: "", description: "", contract_address: "", website: "",
    twitter: "", discord: "", contact_email: "", mint_price: "",
    max_supply: "", mint_start_time: "", base_uri: "", payment_token: "",
  });

  function set(key, val) {
    setForm((p) => ({ ...p, [key]: val }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    await submit({
      ...form,
      mint_price: form.mint_price ? parseFloat(form.mint_price) : null,
      max_supply: form.max_supply ? parseInt(form.max_supply) : null,
      mint_start_time: form.mint_start_time || null,
    });
  }

  if (isSuccess) {
    return (
      <div className="rounded-2xl p-12 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="text-4xl mb-3">🎉</div>
        <div className="font-bold text-lg mb-2" style={{ color: "#e6edf3" }}>Application Submitted!</div>
        <div className="text-sm" style={{ color: "#9da7b3" }}>We'll review your project and get back to you soon.</div>
      </div>
    );
  }

  const inputStyle = {
    background: "#161d28", border: "1px solid rgba(255,255,255,0.06)",
    color: "#e6edf3", fontFamily: "Syne, sans-serif",
  };

  function Input({ label, field, type = "text", placeholder, required }) {
    return (
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>
          {label} {required && <span style={{ color: "#EF4444" }}>*</span>}
        </label>
        <input type={type} placeholder={placeholder} value={form[field]} required={required}
          onChange={(e) => set(field, e.target.value)}
          className="w-full h-11 rounded-xl px-3 text-sm outline-none"
          style={inputStyle} />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="rounded-2xl p-4 mb-2" style={{ background: "rgba(34,211,238,0.05)", border: "1px solid rgba(34,211,238,0.15)" }}>
        <div className="text-sm font-semibold mb-1" style={{ color: "#22d3ee" }}>Before applying</div>
        <div className="text-xs" style={{ color: "#9da7b3" }}>
          Make sure your NFT contract is deployed on Tempo Chain and your metadata is uploaded to IPFS via Pinata. Applications without a contract address will not be reviewed.
        </div>
      </div>

      {/* Basic info */}
      <div className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#9da7b3" }}>Project Info</div>
      <Input label="Project Name" field="name" placeholder="My NFT Collection" required />
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5" style={{ color: "#9da7b3" }}>
          Description <span style={{ color: "#EF4444" }}>*</span>
        </label>
        <textarea rows={3} placeholder="Tell us about your project..." value={form.description} required
          onChange={(e) => set("description", e.target.value)}
          className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
          style={inputStyle} />
      </div>
      <Input label="Contact Email" field="contact_email" type="email" placeholder="team@myproject.com" required />

      {/* Contract */}
      <div className="text-xs font-bold uppercase tracking-widest mt-6 mb-2" style={{ color: "#9da7b3" }}>Contract Details</div>
      <Input label="NFT Contract Address" field="contract_address" placeholder="0x..." required />
      <Input label="Base URI (IPFS)" field="base_uri" placeholder="ipfs://QmXxx.../" />
      <Input label="Payment Token Address" field="payment_token" placeholder="0x... (leave blank for native)" />

      {/* Mint details */}
      <div className="text-xs font-bold uppercase tracking-widest mt-6 mb-2" style={{ color: "#9da7b3" }}>Mint Details</div>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Mint Price (USD)" field="mint_price" type="number" placeholder="0.5" />
        <Input label="Max Supply" field="max_supply" type="number" placeholder="10000" />
      </div>
      <Input label="Mint Start Time" field="mint_start_time" type="datetime-local" />

      {/* Socials */}
      <div className="text-xs font-bold uppercase tracking-widest mt-6 mb-2" style={{ color: "#9da7b3" }}>Socials</div>
      <Input label="Website" field="website" placeholder="https://myproject.xyz" />
      <div className="grid grid-cols-2 gap-4">
        <Input label="Twitter" field="twitter" placeholder="@myproject" />
        <Input label="Discord" field="discord" placeholder="discord.gg/myproject" />
      </div>

      {error && (
        <div className="rounded-xl px-4 py-3 text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444" }}>
          {error}
        </div>
      )}

      <button type="submit" disabled={isLoading}
        className="w-full h-12 rounded-xl font-bold text-sm"
        style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: isLoading ? "not-allowed" : "pointer", fontFamily: "Syne, sans-serif", opacity: isLoading ? 0.7 : 1 }}>
        {isLoading ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
}

// ─── Main ManagePage ──────────────────────────────────────────────────────────
export default function ManagePage() {
  const { address, isConnected, connect } = useWallet();
  const [tab, setTab] = useState("apply");

  const isAdmin = ADMIN_WALLETS.length === 0 || // allow all if no admins set
    ADMIN_WALLETS.map((a) => a.toLowerCase()).includes(address?.toLowerCase());

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 fade-up">
        <Settings size={40} style={{ color: "#9da7b3" }} />
        <p className="text-lg font-semibold" style={{ color: "#e6edf3" }}>Connect your wallet</p>
        <p className="text-sm" style={{ color: "#9da7b3" }}>to manage collections and apply to launch.</p>
        <button onClick={connect}
          className="h-10 px-6 rounded-xl text-sm font-bold"
          style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
          Connect Wallet
        </button>
      </div>
    );
  }

  const tabs = [
    { id: "apply",  label: "Apply to Launch", icon: Rocket  },
    ...(isAdmin ? [{ id: "admin", label: "Admin Panel",      icon: Shield  }] : []),
    ...(isAdmin ? [{ id: "collections", label: "Collections", icon: LayoutGrid }] : []),
  ];

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto fade-up">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Settings size={14} style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Manage</span>
        </div>
        <h1 className="text-3xl font-extrabold" style={{ color: "#e6edf3" }}>
          {isAdmin ? "Admin Panel" : "Launch on TempoNFT"}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#9da7b3" }}>
          {isAdmin ? "Review and manage launchpad applications" : "Apply to launch your NFT collection on Tempo Chain"}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-8 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className="flex items-center gap-2 h-10 px-4 text-sm font-semibold -mb-px"
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: tab === id ? "#22d3ee" : "#9da7b3",
              borderBottom: tab === id ? "2px solid #22d3ee" : "2px solid transparent",
              fontFamily: "Syne, sans-serif",
            }}>
            <Icon size={13} /> {label}
          </button>
        ))}
      </div>

      {tab === "apply"       && <ApplyForm />}
      {tab === "admin"       && <AdminPanel />}
      {tab === "collections" && (
        <div className="rounded-2xl p-8 text-center" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
          <LayoutGrid size={32} className="mx-auto mb-3" style={{ color: "#9da7b3" }} />
          <div className="font-semibold mb-1" style={{ color: "#e6edf3" }}>Collections Manager</div>
          <div className="text-sm" style={{ color: "#9da7b3" }}>Coming soon — add and manage marketplace collections</div>
        </div>
      )}
    </div>
  );
}
