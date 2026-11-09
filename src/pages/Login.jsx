import { useState, useEffect } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { http, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STAGES = [
  "Brief",
  "PRD",
  "Features",
  "Flows",
  "UI/UX",
  "Architecture",
  "Database",
  "API",
  "Security",
  "Roadmap",
  "Testing",
  "Deploy",
];

function BlueprintVisual() {
  return (
    <div className="relative hidden lg:flex flex-1 flex-col justify-between overflow-hidden border-l border-zinc-800 bg-[#09090b] p-12 text-zinc-100">
      <div
        className="absolute inset-0 opacity-[0.16]"
        style={{
          backgroundImage:
            "linear-gradient(#27272a 1px, transparent 1px), linear-gradient(90deg, #27272a 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(65% 55% at 65% 42%, transparent, #09090b 88%)",
        }}
      />

      <div className="relative flex items-center justify-between font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-400">
        <span>Formora // Blueprint OS</span>
        <span>12 Modules &middot; SQL + .MD</span>
      </div>

      <div className="relative space-y-8">
        <svg viewBox="0 0 520 240" className="w-full max-w-[520px]" aria-hidden>
          {[
            [24, 98, "01 prompt"],
            [188, 36, "07 postgres_ddl"],
            [188, 98, "08 rest_openapi"],
            [188, 160, "06 topology"],
            [356, 66, "09 security"],
            [356, 132, "12 deploy_ci"],
          ].map(([x, y, t], i) => (
            <g key={t} style={{ animation: `fadeUp .45s ${i * 0.08}s both` }}>
              <rect
                x={x}
                y={y}
                width="136"
                height="42"
                rx="4"
                fill="#111113"
                stroke="#3f3f46"
              />
              <text
                x={x + 12}
                y={y + 25}
                fill="#e4e4e7"
                fontSize="11.5"
                fontFamily="JetBrains Mono, monospace"
              >
                {t}
              </text>
            </g>
          ))}
          {[
            [160, 119, 188, 57],
            [160, 119, 188, 119],
            [160, 119, 188, 181],
            [324, 57, 356, 87],
            [324, 119, 356, 87],
            [324, 181, 356, 153],
          ].map(([a, b, c, d], i) => (
            <path
              key={i}
              d={`M${a} ${b} C ${a + 16} ${b}, ${c - 16} ${d}, ${c} ${d}`}
              stroke="#71717a"
              strokeOpacity=".75"
              fill="none"
              strokeDasharray="3 3"
            />
          ))}
        </svg>

        <h2 className="max-w-md text-4xl font-semibold leading-[1.08] tracking-tight text-white">
          Decide before you build.
        </h2>
        <p className="max-w-sm text-sm leading-relaxed text-zinc-400">
          Turn a plain-English system prompt into versioned requirements, relational schemas, API contracts, security controls, and deployment specs.
        </p>
      </div>

      <div className="relative flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[10.5px] text-zinc-500">
        {STAGES.map((s, i) => (
          <span key={s}>
            {String(i + 1).padStart(2, "0")} {s}
          </span>
        ))}
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
  const [mode, setMode] = useState(
    searchParams.get("mode") === "register" ? "register" : "login"
  );
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
      const { data } = await http.post(
        `/auth/${mode === "login" ? "login" : "register"}`,
        form
      );
      setUser(data);
      nav(targetDestination);
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
          <div className="grid h-6 w-6 place-items-center rounded-[5px] bg-foreground">
            <div className="h-2.5 w-2.5 rounded-[2px] border-[1.5px] border-background" />
          </div>
          <span className="text-[14px] font-semibold tracking-tight">Formora</span>
          <span className="rounded border hairline bg-muted/50 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
            Blueprint OS
          </span>
        </div>

        {selectedPlan && (
          <div className="mb-5 rounded-md border hairline bg-muted/40 px-3 py-2 font-mono text-xs text-foreground">
            Plan: <span className="uppercase font-semibold">{selectedPlan}</span> &mdash; continues to billing after signup.
          </div>
        )}

        <h1 className="text-2xl font-semibold tracking-tight" data-testid="login-title">
          {mode === "login" ? "Sign in" : "Create your account"}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {mode === "login"
            ? "Access your software blueprints."
            : "Start free with 1 active blueprint project."}
        </p>

        <Button
          variant="outline"
          className="mt-7 h-10 gap-2"
          onClick={google}
          data-testid="google-login-btn"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24">
            <path
              fill="#EA4335"
              d="M12 10.2v3.9h5.5c-.2 1.3-1.6 3.9-5.5 3.9-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.3 14.6 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.1-1.1-.2-1.6H12z"
            />
          </svg>
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
          <div className="h-px flex-1 bg-border" />
          or
          <div className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={submit} className="space-y-4" data-testid="auth-form">
          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={set("name")}
                required
                data-testid="register-name-input"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={set("email")}
              required
              data-testid="login-email-input"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={set("password")}
              required
              minLength={mode === "register" ? 8 : undefined}
              data-testid="login-password-input"
            />
          </div>
          {err && (
            <p className="text-sm text-destructive" data-testid="auth-error">
              {err}
            </p>
          )}
          <Button
            type="submit"
            className="w-full h-10 bg-foreground text-background hover:bg-foreground/90"
            disabled={busy}
            data-testid="auth-submit-btn"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="mt-5 flex flex-col gap-3">
          <button
            type="button"
            className="text-sm text-muted-foreground hover:text-foreground text-left transition-colors"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setErr("");
            }}
            data-testid="toggle-auth-mode-btn"
          >
            {mode === "login"
              ? "No account? Create one"
              : "Already have an account? Sign in"}
          </button>
        </div>
      </div>

      <BlueprintVisual />
    </div>
  );
}
