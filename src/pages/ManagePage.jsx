import { useState } from "react";
import { Settings, Upload, Image } from "lucide-react";
import { useWallet } from "@/hooks/useWallet.js";
import { API_BASE } from "@/config/index.js";

export default function ManagePage() {
  const { isConnected, connect } = useWallet();
  const [tab, setTab] = useState("upload");
  const [form, setForm] = useState({ name: "", description: "", royalty: "5" });
  const [imageFile, setImageFile] = useState(null);
  const [status, setStatus] = useState("idle");

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-96 gap-4 fade-up">
        <Settings size={40} style={{ color: "#9da7b3" }} />
        <p className="text-lg font-semibold" style={{ color: "#e6edf3" }}>Connect your wallet</p>
        <p className="text-sm" style={{ color: "#9da7b3" }}>to manage your collections.</p>
        <button onClick={connect} className="h-10 px-6 rounded-xl text-sm font-bold" style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>Connect Wallet</button>
      </div>
    );
  }

  async function handleUpload(e) {
    e.preventDefault();
    setStatus("uploading");
    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("description", form.description);
    if (imageFile) fd.append("file", imageFile);
    try {
      await fetch(`${API_BASE}/upload`, { method: "POST", body: fd });
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="px-6 py-8 max-w-3xl mx-auto fade-up">
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-3">
          <Settings size={14} style={{ color: "#22d3ee" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: "#22d3ee" }}>Manage</span>
        </div>
        <h1 className="text-3xl font-extrabold" style={{ color: "#e6edf3" }}>My Collections</h1>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        {["upload", "metadata"].map((t) => (
          <button key={t} onClick={() => setTab(t)} className="h-10 px-4 text-sm font-semibold capitalize -mb-px"
            style={{ background: "none", border: "none", cursor: "pointer", color: tab === t ? "#22d3ee" : "#9da7b3", borderBottom: tab === t ? "2px solid #22d3ee" : "2px solid transparent", fontFamily: "Syne, sans-serif" }}>
            {t}
          </button>
        ))}
      </div>

      {tab === "upload" && (
        <form onSubmit={handleUpload} className="flex flex-col gap-5">
          {/* Image drop zone */}
          <label
            className="flex flex-col items-center justify-center gap-2 h-40 rounded-2xl cursor-pointer transition-colors"
            style={{ background: "#161d28", border: "2px dashed rgba(255,255,255,0.1)" }}
            onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#22d3ee"; }}
            onDragLeave={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
          >
            {imageFile ? (
              <div className="flex flex-col items-center gap-1">
                <Image size={24} style={{ color: "#22d3ee" }} />
                <p className="text-sm font-semibold" style={{ color: "#22d3ee" }}>{imageFile.name}</p>
              </div>
            ) : (
              <>
                <Upload size={24} style={{ color: "#9da7b3" }} />
                <p className="text-sm" style={{ color: "#9da7b3" }}>Drop image or click to browse</p>
              </>
            )}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => setImageFile(e.target.files[0])} />
          </label>

          {[{ key: "name", label: "Collection Name", ph: "My NFT Collection" }, { key: "description", label: "Description", ph: "Describe your collection…" }].map(({ key, label, ph }) => (
            <div key={key} className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9da7b3" }}>{label}</label>
              {key === "description" ? (
                <textarea rows={3} placeholder={ph} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
                  style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", fontFamily: "Syne, sans-serif" }} />
              ) : (
                <input type="text" placeholder={ph} value={form[key]} onChange={(e) => setForm((p) => ({ ...p, [key]: e.target.value }))}
                  className="h-11 rounded-xl px-3 text-sm outline-none"
                  style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", fontFamily: "Syne, sans-serif" }} />
              )}
            </div>
          ))}

          <button type="submit" disabled={status === "uploading"}
            className="h-11 rounded-xl font-bold text-sm"
            style={{ background: "#22d3ee", color: "#0b0f14", border: "none", cursor: "pointer", fontFamily: "Syne, sans-serif" }}>
            {status === "uploading" ? "Uploading…" : status === "success" ? "Uploaded!" : "Upload Collection"}
          </button>
        </form>
      )}

      {tab === "metadata" && (
        <div className="flex flex-col gap-4">
          <p className="text-sm" style={{ color: "#9da7b3" }}>Upload a JSON metadata file for your collection.</p>
          <label className="flex flex-col items-center justify-center gap-2 h-32 rounded-2xl cursor-pointer" style={{ background: "#161d28", border: "2px dashed rgba(255,255,255,0.1)" }}>
            <Upload size={20} style={{ color: "#9da7b3" }} />
            <p className="text-sm" style={{ color: "#9da7b3" }}>Drop .json file or click to browse</p>
            <input type="file" accept=".json" className="hidden" />
          </label>
        </div>
      )}
    </div>
  );
}
