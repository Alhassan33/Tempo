// components/Layout.jsx
import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  Menu, X, ShoppingBag, Rocket, Briefcase,
  Settings, Shield, Search, ChevronRight
} from "lucide-react";

const NAV_LINKS = [
  { to: "/",          label: "Market",    icon: ShoppingBag },
  { to: "/launchpad", label: "Launchpad", icon: Rocket      },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase   },
  { to: "/manage",    label: "Manage",    icon: Settings    },
  { to: "/admin",     label: "Admin",     icon: Shield      },
];

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [search, setSearch]     = useState("");
  const menuRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  // Close menu on route change
  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  // Scroll shadow
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const fn = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [menuOpen]);

  // Lock body scroll when menu open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  function handleSearch(e) {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/?q=${encodeURIComponent(search.trim())}`);
      setSearch("");
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f14", color: "#e6edf3" }}>

      {/* ── Top Nav ── */}
      <header
        className="sticky top-0 z-40 w-full"
        style={{
          background: scrolled ? "rgba(11,15,20,0.95)" : "#0b0f14",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          transition: "background 0.3s",
        }}
      >
        <div className="flex items-center gap-3 px-4 h-14 max-w-7xl mx-auto">

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", cursor: "pointer" }}
            aria-label="Open menu"
          >
            <Menu size={16} />
          </button>

          {/* Logo */}
          <NavLink
            to="/"
            className="flex items-center gap-2 flex-shrink-0"
            style={{ textDecoration: "none" }}
          >
            <div
              className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
              style={{ background: "#22d3ee" }}
            >
              {/* Try to load Nyan logo — falls back to TN text */}
              <img
                src="/attached_assets/Nyan.jpg"
                alt="TEMPONYAN"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.nextSibling.style.display = "flex";
                }}
              />
              <span
                style={{
                  display: "none",
                  color: "#0b0f14",
                  fontWeight: 900,
                  fontSize: 11,
                  fontFamily: "Syne, sans-serif",
                  letterSpacing: "-0.5px",
                }}
              >TN</span>
            </div>
            <span
              className="font-extrabold text-sm tracking-tight hidden sm:block"
              style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}
            >
              TEMPO<span style={{ color: "#22d3ee" }}>NYAN</span>
            </span>
          </NavLink>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-sm mx-2">
            <div className="relative">
              <Search
                size={13}
                className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                style={{ color: "#9da7b3" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search collections, NFTs..."
                className="w-full h-9 pl-8 pr-3 rounded-xl text-sm outline-none"
                style={{
                  background: "#161d28",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e6edf3",
                  fontFamily: "Syne, sans-serif",
                }}
              />
            </div>
          </form>

          {/* Connect Wallet */}
          <div className="flex-shrink-0 ml-auto">
            <ConnectButton
              showBalance={false}
              chainStatus="none"
              accountStatus="avatar"
            />
          </div>
        </div>
      </header>

      {/* ── Slide-out Menu ── */}
      {/* Overlay */}
      <div
        onClick={() => setMenuOpen(false)}
        className="fixed inset-0 z-50 transition-opacity duration-300"
        style={{
          background: "rgba(0,0,0,0.6)",
          backdropFilter: "blur(4px)",
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? "auto" : "none",
        }}
      />

      {/* Drawer */}
      <div
        ref={menuRef}
        className="fixed top-0 left-0 h-full z-50 flex flex-col"
        style={{
          width: 280,
          background: "#0d1219",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          transform: menuOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          boxShadow: menuOpen ? "4px 0 40px rgba(0,0,0,0.5)" : "none",
        }}
      >
        {/* Drawer header */}
        <div
          className="flex items-center justify-between px-5 h-14 flex-shrink-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden" style={{ background: "#22d3ee" }}>
              <img
                src="/attached_assets/Nyan.jpg"
                alt="TEMPONYAN"
                className="w-full h-full object-cover"
                onError={(e) => { e.currentTarget.style.display = "none"; }}
              />
            </div>
            <span className="font-extrabold text-sm" style={{ color: "#e6edf3", fontFamily: "Syne, sans-serif" }}>
              TEMPO<span style={{ color: "#22d3ee" }}>NYAN</span>
            </span>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.08)", color: "#9da7b3", cursor: "pointer" }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Nav links */}
        <nav className="flex-1 py-4 px-3 overflow-y-auto">
          <div className="text-[9px] font-bold uppercase tracking-widest px-3 mb-2"
            style={{ color: "#9da7b3", fontFamily: "Syne, sans-serif" }}>
            Navigation
          </div>
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className="flex items-center justify-between px-3 h-11 rounded-xl mb-1 group"
              style={({ isActive }) => ({
                background:     isActive ? "rgba(34,211,238,0.1)" : "transparent",
                color:          isActive ? "#22d3ee" : "#9da7b3",
                textDecoration: "none",
                border:         isActive ? "1px solid rgba(34,211,238,0.2)" : "1px solid transparent",
                transition:     "all 0.15s",
              })}
            >
              <div className="flex items-center gap-3">
                <Icon size={15} />
                <span className="text-sm font-semibold" style={{ fontFamily: "Syne, sans-serif" }}>{label}</span>
              </div>
              <ChevronRight size={13} style={{ opacity: 0.4 }} />
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div
          className="px-5 py-4 flex-shrink-0"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[10px]" style={{ color: "#9da7b3" }}>
            Built on <span style={{ color: "#22d3ee" }}>Tempo Chain</span>
          </p>
        </div>
      </div>

      {/* ── Page Content ── */}
      <main style={{ minHeight: "calc(100vh - 56px)" }}>
        {children}
      </main>
    </div>
  );
}
