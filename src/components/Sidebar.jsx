import { Link, useLocation } from "react-router-dom";
import { LayoutGrid, Rocket, Briefcase, Clock, Settings, Shield } from "lucide-react";

const NAV = [
  { to: "/",          label: "Market",    icon: LayoutGrid },
  { to: "/launchpad", label: "Launchpad", icon: Rocket },
  { to: "/portfolio", label: "Portfolio", icon: Briefcase },
  { to: "/history",   label: "History",   icon: Clock },
  { to: "/manage",    label: "Manage",    icon: Settings },
  { to: "/admin",     label: "Admin",     icon: Shield },
];

/**
 * Sidebar — standalone component (already included in Layout.jsx).
 * Exported separately so it can be used in mobile drawers or tests.
 */
export default function Sidebar({ onNav }) {
  const { pathname } = useLocation();

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || (to !== "/" && pathname.startsWith(to));
        return (
          <Link
            key={to}
            to={to}
            onClick={onNav}
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
    </nav>
  );
}
