import { useState, useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { http, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STEPS = ["Idea", "Requirements", "Design", "Architecture", "Database", "API", "Roadmap", "Launch"];

function BlueprintVisual() {
  return (
    <div className="relative hidden lg:flex flex-1 flex-col justify-between overflow-hidden bg-[#0b0d14] p-12 text-white">
      <div className="absolute inset-0 opacity-[0.18]" style={{ backgroundImage: "linear-gradient(#6366f1 1px, transparent 1px), linear-gradient(90deg, #6366f1 1px, transparent 1px)", backgroundSize: "32px 32px" }} />
      <div className="absolute inset-0" style={{ background: "radial-gradient(60% 50% at 70% 40%, transparent, #0b0d14 85%)" }} />
      <div className="relative text-[11px] font-mono uppercase tracking-[0.2em] text-indigo-300/80">Formora / Blueprint OS</div>
      <div className="relative space-y-8">
        <svg viewBox="0 0 520 240" className="w-full max-w-[520px]" aria-hidden>
          {[[30, 100, "web"], [190, 40, "api"], [190, 160, "auth"], [350, 40, "postgres"], [350, 160, "email"]].map(([x, y, t], i) => (
            <g key={t} style={{ animation: `fadeUp .5s ${i * 0.12}s both` }}>
              <rect x={x} y={y} width="130" height="44" rx="6" fill="#111318" stroke="#6366f1" strokeOpacity=".5" />
              <text x={x + 12} y={y + 27} fill="#c7d2fe" fontSize="12" fontFamily="JetBrains Mono">{t}</text>
            </g>
          ))}
          {[[160, 122, 190, 62], [160, 122, 190, 182], [320, 62, 350, 62], [320, 182, 350, 182]].map(([a, b, c, d], i) => (
            <path key={i} d={`M${a} ${b} C ${a + 20} ${b}, ${c - 20} ${d}, ${c} ${d}`} stroke="#818cf8" strokeOpacity=".7" fill="none" strokeDasharray="4 4" />
          ))}
        </svg>
        <h2 className="text-4xl font-semibold leading-[1.1] tracking-tight max-w-md">Decide before you build.</h2>
        <p className="text-sm text-indigo-100/60 max-w-sm leading-relaxed">Turn an idea into an approved, versioned blueprint — requirements, architecture, schema, API and a dependency-aware task list.</p>
      </div>
      <div className="relative flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-mono text-indigo-200/50">
        {STEPS.map((s, i) => <span key={s}>{String(i + 1).padStart(2, "0")} {s}</span>)}
      </div>
    </div>
  );
}

export default function Login() {
  const { user, setUser } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [searchParams] = useSearchParams();

  const selectedPlan = searchParams.get("plan");
  const [mode, setMode] = useState(searchParams.get("mode") === "register" ? "register" : "login");
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [err, setErr] = useState(loc.state?.error || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const queryMode = searchParams.get("mode");
    if (queryMode === "register" || queryMode === "login") {
      setMode(queryMode);
    }
  }, [searchParams]);

  const targetDestination = selectedPlan ? "/billing" : loc.state?.from || "/dashboard";
  if (user) return <Navigate to={targetDestination} replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const { data } = await http.post(`/auth/${mode === "login" ? "login" : "register"}`, form);
      setUser(data);
      nav(targetDestination);
    } catch (ex) { setErr(errMsg(ex)); }
    setBusy(false);
  };

  const loginDemo = async () => {
    setBusy(true);
    setErr("");
    try {
      const { data } = await http.post("/auth/login", {
        email: "demo@blueprintos.dev",
        password: "Blueprint123!",
      });
      setUser(data);
      nav("/dashboard");
    } catch (ex) {
      setErr(errMsg(ex));
    }
    setBusy(false);
  };

  const google = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/dashboard";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="flex min-h-screen bg-background">
      <div className="flex w-full lg:w-[480px] shrink-0 flex-col justify-center px-8 sm:px-14 py-10">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            data-testid="back-to-landing-link"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to Formora</span>
          </Link>
        </div>

        <div className="mb-8 flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-[5px] bg-foreground"><div className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-background" /></div>
          <span className="text-[14px] font-semibold tracking-tight">Formora</span>
          <span className="rounded-full border hairline bg-muted/60 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">Blueprint OS</span>
        </div>

        {selectedPlan && (
          <div className="mb-5 rounded-md border hairline bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
            Plan: <span className="uppercase font-semibold">{selectedPlan}</span> &mdash; continues to billing after signup.
          </div>
        )}

        <h1 className="text-2xl font-semibold tracking-tight" data-testid="login-title">{mode === "login" ? "Sign in" : "Create your account"}</h1>
        <p className="mt-1.5 text-sm text-muted-foreground">{mode === "login" ? "Continue where you left off." : "Start free with 1 active blueprint project."}</p>
        <Button variant="outline" className="mt-7 h-10 gap-2" onClick={google} data-testid="google-login-btn">
          <svg className="h-4 w-4" viewBox="0 0 24 24"><path fill="#EA4335" d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z" /></svg>
          Continue with Google
        </Button>
        <div className="my-5 flex items-center gap-3 text-[11px] uppercase tracking-wider text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
        <form onSubmit={submit} className="space-y-4" data-testid="auth-form">
          {mode === "register" && (
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" value={form.name} onChange={set("name")} required data-testid="register-name-input" /></div>
          )}
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={set("email")} required data-testid="login-email-input" /></div>
          <div className="space-y-1.5"><Label htmlFor="password">Password</Label><Input id="password" type="password" value={form.password} onChange={set("password")} required minLength={mode === "register" ? 8 : undefined} data-testid="login-password-input" /></div>
          {err && <p className="text-sm text-destructive" data-testid="auth-error">{err}</p>}
          <Button type="submit" className="w-full h-10" disabled={busy} data-testid="auth-submit-btn">{busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{mode === "login" ? "Sign in" : "Create account"}</Button>
        </form>

        <div className="mt-5 flex flex-col gap-3">
          <button className="text-sm text-muted-foreground hover:text-foreground text-left" onClick={() => { setMode(mode === "login" ? "register" : "login"); setErr(""); }} data-testid="toggle-auth-mode-btn">
            {mode === "login" ? "No account? Create one" : "Already have an account? Sign in"}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={loginDemo}
            className="font-mono text-xs text-muted-foreground hover:text-foreground text-left underline underline-offset-4"
            data-testid="login-demo-account-btn"
          >
            Inspect sample workspace (&ldquo;Shelfmate&rdquo;) &rarr;
          </button>
        </div>
      </div>
      <BlueprintVisual />
    </div>
  );
}
