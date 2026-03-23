import { NavLink } from "react-router-dom";
import { Wind } from "lucide-react";

const links = [
  { to: "/", label: "Accueil" },
  { to: "/analyse", label: "Analyse éolienne" },
  { to: "/analyse-meteo", label: "Analyse météo" },
];

const Navbar = () => (
  <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
    <div className="flex h-16 items-center justify-between px-6">
      <NavLink to="/" className="flex items-center gap-2 font-display font-semibold text-foreground">
        <Wind className="h-5 w-5 text-primary" />
        <div className="flex flex-col leading-tight">
          <span className="text-base">WEEX Éolien</span>
          <span className="text-[10px] font-normal text-muted-foreground">Groupe 18</span>
        </div>
      </NavLink>

      <div className="flex items-center gap-1">
        {links.map((l) => (
          <NavLink
            key={l.to}
            to={l.to}
            end={l.to === "/"}
            className={({ isActive }) =>
              `rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {l.label}
          </NavLink>
        ))}
      </div>
    </div>
  </nav>
);

export default Navbar;
