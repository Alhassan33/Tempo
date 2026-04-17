import LogoImg from "../assets/nyans.png";
import { useState, useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useContractRead } from "wagmi";
import { formatUnits } from "viem";
import { 
  Menu, 
  X, 
  ShoppingBag, 
  Rocket, 
  Briefcase, 
  Settings, 
  ChevronRight, 
  Zap, 
  Palette, 
  LayoutGrid 
} from "lucide-react";

// pathUSD Contract Constants
const PATH_USD_ADDRESS = "0xYourPathUSDContractAddress"; 
const ERC20_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "balance", type: "uint256" }] }
];

// Updated Navigation
// Excludes Admin, NFTItem, and CollectionManager as requested
const NAV_LINKS = [
  { to: "/",              label: "Market",    icon: ShoppingBag }, // Market.jsx
  { to: "/launchpad",     label: "Launchpad", icon: Rocket      }, // LaunchpadPage.jsx
  { to: "/mint",          label: "Mint",      icon: Zap         }, // MintPage.jsx
  { to: "/studio",        label: "Studio",    icon: Palette     }, // StudioPage.jsx
  { to: "/manage",        label: "Manage",    icon: LayoutGrid  }, // ManagePage.jsx
  { to: "/portfolio",     label: "Portfolio", icon: Briefcase   }, // PortfolioPage.jsx
  { to: "/application",   label: "Apply",     icon: Settings    }, // ApplicationPage.jsx
];

export default function Layout({ children }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { address, isConnected } = useAccount();

  // Fetch pathUSD balance
  const { data: balance } = useContractRead({
    address: PATH_USD_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [address],
    enabled: !!address,
    watch: true,
  });

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const brandFont = { fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif', fontStyle: 'normal' };

  return (
    <div style={{ minHeight: "100vh", background: "#03080f", color: "#e6edf3", ...brandFont }}>
      {/* Header Section */}
      <header className="sticky top-0 z-40 w-full" style={{ background: scrolled ? "rgba(3, 8, 15, 0.9)" : "#03080f", backdropFilter: scrolled ? "blur(20px)" : "none", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center gap-3 px-4 h-16 max-w-7xl mx-auto">
          <button onClick={() => setMenuOpen(true)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 text-[#e6edf3]">
            <Menu size={18} />
          </button>

          <NavLink to="/" className="flex items-center gap-3 no-underline">
            <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/10">
              <img src={LogoImg} alt="Logo" className="w-full h-full object-cover" />
            </div>
            <span className="font-black text-lg tracking-tighter uppercase hidden sm:block">
              <span className="text-white">TEMPO</span>
              <span className="text-[#22c55e]">NYAN</span>
            </span>
          </NavLink>

          <div className="flex-shrink-0 ml-auto flex items-center gap-4">
            {/* pathUSD Balance Display */}
            {isConnected && (
              <div className="hidden xs:flex flex-col items-end">
                <span className="text-[10px] uppercase text-gray-500 font-bold leading-none">pathUSD</span>
                <span className="text-sm font-black text-[#22c55e]">
                  {balance ? Number(formatUnits(balance, 18)).toFixed(2) : "0.00"}
                </span>
              </div>
            )}

            {/* RainbowKit Connect Button */}
            <ConnectButton.Custom>
              {({ account, chain, openAccountModal, openConnectModal, mounted }) => {
                const ready = mounted;
                const connected = ready && account && chain;
                if (!connected) {
                  return (
                    <button 
                      onClick={openConnectModal} 
                      className="px-6 h-10 rounded-xl bg-[#22c55e] text-[#03080f] font-black uppercase text-sm hover:opacity-90 transition-all"
                    >
                      Connect
                    </button>
                  );
                }
                return (
                  <button onClick={openAccountModal} className="flex items-center gap-2 px-3 h-10 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
                    <span className="text-sm font-bold text-white">{account.displayName}</span>
                    <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-[#22c55e] to-cyan-500 opacity-50" />
                  </button>
                );
              }}
            </ConnectButton.Custom>
          </div>
        </div>
      </header>

      {/* Drawer Overlay */}
      {menuOpen && <div onClick={() => setMenuOpen(false)} className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm" />}

      {/* Navigation Drawer */}
      <div className={`fixed top-0 left-0 h-full z-50 w-[300px] bg-[#03080f] border-r border-white/10 transition-transform duration-300 ${menuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <div className="flex items-center gap-2">
            <img src={LogoImg} className="w-8 h-8 rounded-lg object-contain" alt="Logo" />
            <span className="text-xl font-black uppercase tracking-tighter">
              <span className="text-white">TEMPO</span>
              <span className="text-[#22c55e]">NYAN</span>
            </span>
          </div>
          <button onClick={() => setMenuOpen(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        <nav className="p-4">
          {NAV_LINKS.map(({ to, label, icon: Icon }) => (
            <NavLink 
              key={to} to={to} 
              className={({ isActive }) => 
                `flex items-center justify-between px-4 h-14 rounded-2xl mb-2 no-underline transition-all ${
                  isActive ? 'bg-[#22c55e]/10 text-[#22c55e] border border-[#22c55e]/20' : 'text-gray-400 hover:bg-white/5'
                }`
              }
            >
              <div className="flex items-center gap-4">
                <Icon size={18} />
                <span className="text-base font-bold uppercase tracking-tight">{label}</span>
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
