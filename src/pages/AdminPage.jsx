import { useState } from "react";
import { Shield, RefreshCw, Database, Zap } from "lucide-react";
import { API_BASE } from "@/config/index.js";

const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD ?? "admin";

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState({});
  const [results, setResults] = useState({});

  if (!authed) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 fade-up">
        <Shield size={40} style={{ color: "#22d3ee" }} />
        <h1 className="text-xl font-bold" style={{ color: "#e6edf3" }}>Admin Access</h1>
        <div className="flex gap-2">
          <input
            type="password"
            placeholder="Enter password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && pw === ADMIN_PASSWORD && setAuthed(true)}
            className="h-10 rounded-lg px-3 text-sm outline-none"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3" }}
          />
          <button
            onClick={() => pw === ADMIN_PASSWORD && setAuthed(true)}
            className="h-10 px-4 rounded-lg text-sm font-bold"
            style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer" }}
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  async function runAction(key, endpoint, method = "POST") {
    setLoading((p) => ({ ...p, [key]: true }));
    setResults((p) => ({ ...p, [key]: null }));
    try {
      const res = await fetch(`${API_BASE}/${endpoint}`, { method });
      const text = await res.text();
      setResults((p) => ({ ...p, [key]: text.slice(0, 200) }));
    } catch (err) {
      setResults((p) => ({ ...p, [key]: `Error: ${err.message}` }));
    } finally {
      setLoading((p) => ({ ...p, [key]: false }));
    }
  }

  const ACTIONS = [
    { key: "seed",       label: "Seed Database",        icon: Database, endpoint: "seed",        desc: "Populate the database with sample collections and listings." },
    { key: "sync",       label: "Sync Collections",     icon: RefreshCw, endpoint: "collections?action=sync", desc: "Re-index all collection metadata from the chain." },
    { key: "activity",   label: "Refresh Activity",     icon: Zap,       endpoint: "activity?action=refresh", desc: "Pull the latest on-chain activity events." },
  ];

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto fade-up">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={14} style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Admin</span>
        </div>
        <h1 className="text-3xl font-extrabold" style={{ color: "#e6edf3" }}>Admin Panel</h1>
        <p className="mt-1 text-sm" style={{ color: "#9da7b3" }}>Manage data, sync the chain, and run maintenance tasks.</p>
      </div>

      <div className="flex flex-col gap-4">
        {ACTIONS.map(({ key, label, icon: Icon, endpoint, desc }) => (
          <div key={key} className="rounded-2xl p-5 flex flex-col gap-3" style={{ background: "#121821", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "rgba(34,211,238,0.08)" }}>
                  <Icon size={16} style={{ color: "#22d3ee" }} />
                </div>
                <div>
                  <p className="text-sm font-bold" style={{ color: "#e6edf3" }}>{label}</p>
                  <p className="text-xs mt-0.5" style={{ color: "#9da7b3" }}>{desc}</p>
                </div>
              </div>
              <button
                onClick={() => runAction(key, endpoint)}
                disabled={loading[key]}
                className="h-8 px-4 rounded-lg text-xs font-bold flex-shrink-0"
                style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", opacity: loading[key] ? 0.6 : 1 }}
              >
                {loading[key] ? "Running…" : "Run"}
              </button>
            </div>
            {results[key] && (
              <div className="rounded-xl p-3 font-mono text-xs" style={{ background: "#0b0f14", color: "#22d3ee", wordBreak: "break-all" }}>
                {results[key]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
