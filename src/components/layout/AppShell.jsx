import { useState } from "react";
import { Link, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { Moon, Sun, LogOut, Menu, Sparkles, Download, MessageSquareText, CreditCard, Zap } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import Sidebar, { PROJECT_NAV } from "./Sidebar";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import ExportMenu from "@/components/ExportMenu";
import AIPanel from "@/components/ai/AIPanel";
import ChatPanel from "@/components/ai/ChatPanel";

function Logo() {
  return (
    <Link to="/dashboard" className="flex items-center gap-2 px-4 h-14 shrink-0" data-testid="app-logo">
      <div className="grid h-6 w-6 place-items-center rounded-[5px] bg-foreground">
        <div className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-background" />
      </div>
      <span className="text-[14px] font-semibold tracking-tight">Formora</span>
    </Link>
  );
}

function Crumbs() {
  const { pid } = useParams();
  const loc = useLocation();
  const ctx = useProject();
  const seg = loc.pathname.split("/")[3] || "";
  const page = PROJECT_NAV.flatMap((g) => g.items).find((i) => i.to === seg);
  const top = loc.pathname.startsWith("/projects/new") ? "New Project" : loc.pathname.startsWith("/projects") ? "Projects" : loc.pathname.startsWith("/billing") ? "Billing & Plans" : "Dashboard";
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-[13px]" data-testid="breadcrumbs">
      {pid ? (
        <>
          <Link to="/projects" className="text-muted-foreground hover:text-foreground">Projects</Link>
          <span className="text-muted-foreground/50">/</span>
          <Link to={`/p/${pid}`} className="truncate max-w-[180px] text-muted-foreground hover:text-foreground">{ctx?.project?.name || "…"}</Link>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate font-medium">{page?.label || "Overview"}</span>
        </>
      ) : <span className="font-medium">{top}</span>}
    </div>
  );
}

function StatusStrip() {
  const ctx = useProject();
  const p = ctx?.project;
  if (!p) return null;
  const arts = Object.values(p.artifacts);
  const approved = arts.filter((a) => a.status === "approved").length;
  const review = arts.filter((a) => a.needs_review).length;
  const done = p.task_counts?.completed || 0;
  return (
    <div className="hidden xl:flex items-center gap-4 text-[12px] text-muted-foreground font-mono" data-testid="project-status-header">
      <span data-testid="status-approved"><b className="text-foreground font-medium">{approved}</b>/7 approved</span>
      <span data-testid="status-tasks"><b className="text-foreground font-medium">{done}</b>/{p.tasks_total} tasks</span>
      {review > 0 && <span className="text-[hsl(var(--warning))]" data-testid="status-review">{review} need review</span>}
    </div>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobile, setMobile] = useState(false);
  const nav = useNavigate();
  const { pid } = useParams();
  const ctx = useProject();
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="hidden md:flex w-[232px] shrink-0 flex-col border-r hairline bg-card/60">
        <Logo />
        <Sidebar />
      </aside>
      <Sheet open={mobile} onOpenChange={setMobile}>
        <SheetContent side="left" className="w-[260px] p-0"><Logo /><Sidebar onNavigate={(e) => e.target.closest("a") && setMobile(false)} /></SheetContent>
      </Sheet>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2.5 border-b hairline px-4 md:px-6 bg-background/80 backdrop-blur-xl">
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" onClick={() => setMobile(true)} data-testid="mobile-menu-btn"><Menu className="h-4 w-4" /></Button>
          <Crumbs />
          <div className="flex-1" />
          <StatusStrip />
          {pid && (
            <>
              <ExportMenu />
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5"
                onClick={() => ctx.setAiOpen({})}
                title="Single-module diff workflows"
                data-testid="open-ai-assistant-btn"
              >
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="hidden lg:inline">Workflows</span>
              </Button>
              <Button
                size="sm"
                variant={ctx?.chatOpen ? "default" : "outline"}
                className="h-8 gap-1.5"
                onClick={() => ctx.setChatOpen((v) => !v)}
                title="Toggle AI Architect Chat Panel (Ctrl+J)"
                data-testid="toggle-chat-panel-btn"
              >
                <MessageSquareText className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI Chat</span>
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} data-testid="theme-toggle-btn" aria-label="Toggle theme">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Link
            to="/billing"
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase transition-all ${
              user?.plan === "pro"
                ? "bg-primary text-primary-foreground shadow-xs hover:opacity-90"
                : user?.plan === "team"
                ? "bg-violet-600 text-white hover:opacity-90"
                : "border hairline text-muted-foreground hover:bg-muted"
            }`}
            title="Manage Billing & Plans"
            data-testid="header-plan-badge"
          >
            {user?.plan === "pro" || user?.plan === "team" ? <Zap className="h-3 w-3 fill-current" /> : null}
            <span>{user?.plan || "Free"}</span>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 overflow-hidden rounded-full bg-accent text-[11px] font-semibold text-accent-foreground" data-testid="user-menu-btn">
                {user?.picture ? <img src={user.picture} alt="" className="h-full w-full object-cover" /> : (user?.name || "?").slice(0, 1).toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal"><div className="text-sm font-medium">{user?.name}</div><div className="text-xs text-muted-foreground truncate">{user?.email}</div></DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => nav("/billing")} data-testid="billing-menu-item">
                <CreditCard className="h-4 w-4 mr-2" />
                <span>Billing & Plans</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await logout(); nav("/"); }} data-testid="logout-btn"><LogOut className="h-4 w-4 mr-2" />Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto" data-testid="main-workspace">
            <Outlet />
          </main>
          {pid && <ChatPanel />}
        </div>
      </div>
      {pid && <AIPanel />}
    </div>
  );
}

export { Download };
