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

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const fn = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [menuOpen]);

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
    <div style={{ minHeight: "100vh", background: "#03080f", color: "#e6edf3", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>

      {/* ── Top Nav ── */}
      <header
        className="sticky top-0 z-40 w-full"
        style={{
          background: scrolled ? "rgba(3, 8, 15, 0.9)" : "#03080f",
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          transition: "all 0.3s ease",
        }}
      >
        <div className="flex items-center gap-3 px-4 h-16 max-w-7xl mx-auto">

          {/* Hamburger */}
          <button
            onClick={() => setMenuOpen(true)}
            className="w-10 h-10 flex items-center justify-center rounded-xl flex-shrink-0 transition-colors"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", color: "#e6edf3", cursor: "pointer" }}
          >
            <Menu size={18} />
          </button>

          {/* Logo - Updated with hardcoded logo asset */}
          <NavLink to="/" className="flex items-center gap-3 flex-shrink-0" style={{ textDecoration: "none" }}>
            <div className="w-10 h-10 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 shadow-lg shadow-cyan-500/10">
              <img
                src="/attached_assets/1001940886.jpg" 
                alt="Nyan Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <span className="font-black text-lg tracking-tighter uppercase italic hidden sm:block" style={{ color: "#e6edf3" }}>
              TEMPO<span style={{ color: "#22d3ee" }}>NYAN</span>
            </span>
          </NavLink>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex-1 max-w-sm mx-4 hidden md:block">
            <div className="relative group">
              <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors group-focus-within:text-[#22d3ee]" style={{ color: "#4b5563" }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search marketplace..."
                className="w-full h-10 pl-10 pr-4 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#e6edf3",
                }}
              />
            </div>
          </form>

          {/* Connect Wallet */}
          <div className="flex-shrink-0 ml-auto scale-90 md:scale-100">
            <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
          </div>
        </div>
      </header>

      {/* ── Drawer ── */}
      <div
        onClick={() => setMenuOpen(false)}
        className="fixed inset-0 z-50 transition-opacity duration-500"
        style={{
          background: "rgba(0,0,0,0.8)",
          backdropFilter: "blur(8px)",
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? "auto" : "none",
        }}
      />

      <div
        ref={menuRef}
        className="fixed top-0 left-0 h-full z-50 flex flex-col"
        style={{
          width: 300,
          background: "#03080f",
          borderRight: "1px solid rgba(255,255,255,0.08)",
          transform: menuOpen ? "translateX(0)" : "translateX(-100%)",
          transition: "transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
        }}
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-6 h-16 flex-shrink-0" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-3">
            <img src="/attached_assets/1001940886.jpg" className="w-8 h-8 rounded-lg" alt="Logo" />
            <span className="font-black text-sm tracking-tighter italic uppercase">TEMPO<span className="text-[#22d3ee]">NYAN</span></span>
          </div>
          <button onClick={() => setMenuOpen(false)} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Nav links - Helvetica Bold Styling */}
        <nav className="flex-1 py-8 px-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] px-4 mb-6 text-gray-600">
            Main Menu
          </div>
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className="flex items-center justify-between px-4 h-14 rounded-2xl mb-2 transition-all group"
              style={({ isActive }) => ({
                background: isActive ? "rgba(34,211,238,0.08)" : "transparent",
                color: isActive ? "#22d3ee" : "#9ca3af",
                textDecoration: "none",
                border: isActive ? "1px solid rgba(34,211,238,0.2)" : "1px solid transparent",
              })}
            >
              <div className="flex items-center gap-4">
                <Icon size={18} className={({ isActive }) => isActive ? "text-[#22d3ee]" : "text-gray-500"} />
                <span className="text-base font-bold uppercase tracking-tight italic">{label}</span>
              </div>
              <ChevronRight size={14} className="opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-8 flex-shrink-0" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <div className="flex items-center gap-2">
             <div className="w-2 h-2 rounded-full bg-[#22d3ee] animate-pulse" />
             <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
               Tempo Network Live
             </p>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <main className="relative z-10" style={{ minHeight: "calc(100vh - 64px)" }}>
        {children}
      </main>
    </div>
  );
}
