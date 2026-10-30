import { NavLink, useParams } from "react-router-dom";
import {
  LayoutDashboard, FolderKanban, Plus, Compass, FileText, ListChecks, Route, PenTool, Layers, Network,
  Database, Braces, ShieldCheck, Map, FlaskConical, Rocket, ScrollText, Settings, FileSignature, FolderCode,
  CreditCard,
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { cn } from "@/lib/utils";

export const PROJECT_NAV = [
  { group: "Plan", items: [
    { to: "", label: "Overview", icon: Compass, end: true },
    { to: "brief", label: "Project Brief", icon: FileSignature, kind: "brief" },
    { to: "requirements", label: "Product Requirements", icon: FileText, kind: "spec" },
    { to: "features", label: "Features & Stories", icon: ListChecks, kind: "features" },
    { to: "flows", label: "User Flows", icon: Route, kind: "flows" },
    { to: "ui", label: "UI/UX Blueprint", icon: PenTool, kind: "ui" },
  ] },
  { group: "Engineer", items: [
    { to: "stack", label: "Tech Stack", icon: Layers },
    { to: "architecture", label: "Architecture", icon: Network, kind: "architecture" },
    { to: "database", label: "Database Designer", icon: Database, kind: "schema" },
    { to: "api", label: "API Explorer", icon: Braces, kind: "api" },
    { to: "docs", label: "Module Docs (.md)", icon: FolderCode },
    { to: "security", label: "Security Plan", icon: ShieldCheck, kind: "security" },
  ] },
  { group: "Deliver", items: [
    { to: "roadmap", label: "Roadmap", icon: Map, kind: "roadmap" },
    { to: "testing", label: "Testing Center", icon: FlaskConical, kind: "testing" },
    { to: "deployment", label: "Deployment Center", icon: Rocket, kind: "deployment" },
    { to: "decisions", label: "Decision Log", icon: ScrollText },
    { to: "settings", label: "Project Settings", icon: Settings },
  ] },
];

function Dot({ art }) {
  if (!art || art.status === "empty") return <span className="h-1.5 w-1.5 rounded-full bg-border" />;
  if (art.needs_review) return <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))]" title="Needs review" />;
  if (art.status === "approved") return <span className="h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))]" title="Approved" />;
  return <span className="h-1.5 w-1.5 rounded-full bg-primary/60" title="Draft" />;
}

const linkCls = ({ isActive }) =>
  cn("group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-150",
    isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground");

export default function Sidebar({ onNavigate }) {
  const { pid } = useParams();
  const ctx = useProject();
  const arts = ctx?.project?.artifacts || {};
  return (
    <nav className="flex h-full flex-col gap-5 overflow-y-auto px-3 py-4" data-testid="sidebar-nav" onClick={onNavigate}>
      <div className="space-y-0.5">
        <NavLink to="/dashboard" className={linkCls} data-testid="nav-dashboard"><LayoutDashboard className="h-4 w-4" />Dashboard</NavLink>
        <NavLink to="/projects" end className={linkCls} data-testid="nav-projects"><FolderKanban className="h-4 w-4" />Projects</NavLink>
        <NavLink to="/projects/new" className={linkCls} data-testid="nav-new-project"><Plus className="h-4 w-4" />New Project</NavLink>
        <NavLink to="/billing" className={linkCls} data-testid="nav-billing"><CreditCard className="h-4 w-4" />Billing & Plans</NavLink>
      </div>
      {pid && PROJECT_NAV.map((g) => (
        <div key={g.group} className="space-y-0.5">
          <div className="eyebrow px-2.5 pb-1.5">{g.group}</div>
          {g.items.map((it) => (
            <NavLink key={it.label} to={`/p/${pid}/${it.to}`} end={it.end} className={linkCls} data-testid={`nav-${it.to || "overview"}`}>
              <it.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{it.label}</span>
              {it.kind && <Dot art={arts[it.kind]} />}
              {it.later && <span className="text-[10px] text-muted-foreground/70">later</span>}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}
