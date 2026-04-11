import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, Rocket, Briefcase, Clock, Settings } from "lucide-react";

// ✅ Admin removed from nav — import path to your local logo
import NyanLogo from "/client/images/Nyan.jpg";

const NAV = [
  { to: "/",          label: "Market",    icon: LayoutGrid },
  { to: "/launchpad", label: "Launchpad", icon: Rocket },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/history",   label: "History",   icon: Clock },
  { to: "/manage",    label: "Manage",    icon: Settings },
  // Admin intentionally hidden — accessible at /admin but not shown in nav
];

export default function Sidebar({ onNav }) {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-col gap-1">
      {/* Logo */}
      <div className="flex items-center gap-3 px-3 py-4 mb-2">
        <img
          src={NyanLogo}
          alt="TempoNFT"
          className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
        />
        <span
          className="text-base font-extrabold tracking-tight"
          style={{ color: "#e6edf3", fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif" }}
        >
          TempoNFT
        </span>
      </div>

      {NAV.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || (to !== "/" && pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            onClick={onNav}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all no-underline"
            style={{
              color:      active ? "#22d3ee" : "#9da7b3",
              background: active ? "rgba(34,211,238,0.10)" : "transparent",
              fontFamily: "Helvetica Neue, Helvetica, Arial, sans-serif",
              borderLeft: active ? "2px solid #22d3ee" : "2px solid transparent",
            }}
          >
            <Icon size={15} style={{ color: active ? "#22d3ee" : "#9da7b3" }} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
