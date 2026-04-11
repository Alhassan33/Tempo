import LogoImg from "../assets/nyans.png";
import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Menu, X, ShoppingBag, Rocket, Briefcase, Settings, Shield, ChevronRight } from "lucide-react";

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
  const menuRef = useRef(null);
  const location = useLocation();

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#03080f", color: "#e6edf3", fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif' }}>
      <header className="sticky top-0 z-40 w-full" style={{ background: scrolled ? "rgba(3, 8, 15, 0.9)" : "#03080f", backdropFilter: scrolled ? "blur(20px)" : "none", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-3 px-4 h-16 max-w-7xl mx-auto">
          <button onClick={() => setMenuOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[#e6edf3]">
            <Menu size={18} />
          </button>

          <NavLink to="/" className="flex items-center gap-3 no-underline">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 shadow-lg shadow-cyan-500/10">
              {/* Using LogoImg variable here as well for consistency */}
              <img src={LogoImg} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-lg tracking-tighter uppercase italic hidden sm:block text-white">
              TEMPO<span className="text-[#22c55e]">NYAN</span>
            </span>
          </NavLink>

          <div className="flex-shrink-0 ml-auto">
            <ConnectButton showBalance={false} chainStatus="none" accountStatus="avatar" />
          </div>
        </div>
      </header>

      {/* Drawer Overlay */}
      {menuOpen && (
        <div 
          onClick={() => setMenuOpen(false)} 
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" 
        />
      )}

      {/* Drawer */}
      <div 
        ref={menuRef} 
        className={`fixed top-0 left-0 h-full z-50 w-[300px] bg-[#03080f] border-r border-white/10 transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <img 
              src={LogoImg} 
              className="w-8 h-8 rounded-lg object-contain" 
              alt="Logo" 
            />
            <span className="text-xl font-bold text-[#22c55e]">NYAN</span>
          </div>
          <button onClick={() => setMenuOpen(false)} className="text-gray-500 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <nav className="p-4">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink 
              key={to} 
              to={to} 
              className={({ isActive }) => 
                `flex items-center justify-between px-4 h-14 rounded-2xl mb-2 no-underline transition-all ${
                  isActive 
                    ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20' 
                    : 'text-gray-400 hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-4">
                <Icon size={18} />
                <span className="text-base font-bold uppercase tracking-tight italic">{label}</span>
              </div>
              <ChevronRight size={14} className="opacity-20" />
            </NavLink>
          ))}
        </nav>
      </div>

      <main>{children}</main> 
    </div>
  );
}
