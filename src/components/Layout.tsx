import { Link, useLocation } from "react-router-dom";
import { Search, LayoutGrid, Rocket, Briefcase, Clock, Settings, Shield } from "lucide-react";
import { useWallet } from "@/hooks/useWallet.js";

const NAV = [
  { to: "/",         label: "Market",    icon: LayoutGrid },
  { to: "/launchpad",label: "Launchpad", icon: Rocket },
  { to: "/portfolio",label: "Portfolio", icon: Briefcase },
  { to: "/history",  label: "History",   icon: Clock },
  { to: "/manage",   label: "Manage",    icon: Settings },
];

function shortenAddress(addr) {
  return addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
}

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const { address, isConnected, isConnecting, connect, disconnect } = useWallet();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className="hidden md:flex flex-col gap-1 w-56 flex-shrink-0 border-r p-4"
        style={{ borderColor: "rgba(255,255,255,0.06)", background: "#0d1219" }}
      >
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 mb-8 no-underline">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold"
            style={{ background: "#22d3ee", color: "#0b0f14", fontFamily: "Space Mono, monospace" }}
          >
            TN
          </div>
          <span className="text-[17px] font-extrabold" style={{ color: "#e6edf3" }}>
            TEMPO<span style={{ color: "#22d3ee" }}>NYAN</span>
          </span>
        </Link>

        {/* Nav */}
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || (to !== "/" && pathname.startsWith(to));
          return (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors no-underline"
              style={{
                color: active ? "#22d3ee" : "#9da7b3",
                background: active ? "rgba(34,211,238,0.08)" : "transparent",
              }}
            >
              <Icon size={15} />
              {label}
            </Link>
          );
        })}

        {/* Admin (bottom) */}
        <div className="mt-auto">
          <Link
            to="/admin"
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors no-underline"
            style={{ color: pathname === "/admin" ? "#22d3ee" : "#9da7b3" }}
          >
            <Shield size={15} />
            Admin
          </Link>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header
          className="sticky top-0 z-50 flex items-center gap-4 px-6 h-16"
          style={{ background: "rgba(11,15,20,0.9)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          {/* Mobile logo */}
          <Link to="/" className="flex items-center gap-2 md:hidden no-underline">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: "#22d3ee", color: "#0b0f14" }}>TN</div>
          </Link>

          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "#9da7b3" }} />
            <input
              type="search"
              placeholder="Search collections, NFTs…"
              className="w-full h-9 rounded-lg pl-9 pr-4 text-sm outline-none transition-colors"
              style={{
                background: "#161d28",
                border: "1px solid rgba(255,255,255,0.06)",
                color: "#e6edf3",
                fontFamily: "Syne, sans-serif",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#22d3ee")}
              onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.06)")}
            />
          </div>

          {/* Wallet */}
          <div className="ml-auto">
            {isConnected && address ? (
              <button
                onClick={disconnect}
                className="h-9 px-4 rounded-lg text-sm font-bold transition-colors"
                style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)", color: "#e6edf3", fontFamily: "Syne, sans-serif" }}
              >
                {shortenAddress(address)}
              </button>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="h-9 px-5 rounded-lg text-sm font-bold transition-colors"
                style={{ background: "#22d3ee", color: "#0b0f14", border: "none", fontFamily: "Syne, sans-serif", cursor: "pointer" }}
              >
                {isConnecting ? "Connecting…" : "Connect Wallet"}
              </button>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
      }
