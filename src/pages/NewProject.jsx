import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ListEditor from "@/components/ListEditor";
import { http, errMsg, getActiveClientLlmConfig } from "@/lib/api";
import UpgradeDialog from "@/components/UpgradeDialog";
import ModelSelector from "@/components/ai/ModelSelector";

const IDEA_EXAMPLES = [
  {
    code: "01",
    title: "Multi-vendor food delivery & KHQR",
    prompt:
      "Build FoodFlow: a multi-vendor food delivery app where restaurants manage menus, customers place orders, drivers stream live delivery status, and checkout supports ABA PayWay KHQR + Stripe.",
  },
  {
    code: "02",
    title: "Clinic scheduling & prescriptions",
    prompt:
      "Build ClinicOS: a medical appointment & prescription platform where patients book doctors, doctors record clinical notes & prescriptions, and admins manage billing.",
  },
  {
    code: "03",
    title: "Video course & quiz LMS",
    prompt:
      "Build SkillForge: an online learning platform where instructors publish video courses & quizzes, students track enrollment progress, and Stripe handles course checkout.",
  },
  {
    code: "04",
    title: "Invoicing & multi-currency ledger",
    prompt:
      "Build LedgerMate: a freelance invoicing, multi-currency wallet, and subscription billing SaaS with automated payment reminders and ledger exports.",
  },
];

const STEPS = [
  {
    id: "basics",
    title: "Product",
    hint: "Core name and scope.",
    required: true,
    fields: [
      { k: "name", label: "Product name", ph: "e.g. Acme Ledger" },
      {
        k: "description",
        label: "Description",
        ph: "One or two sentences on what it does and for whom",
        area: true,
      },
    ],
  },
  {
    id: "users",
    title: "Users & problems",
    hint: "Target persona and friction.",
    fields: [
      { k: "target_users", label: "Target users", ph: "e.g. B2B finance teams" },
      { k: "problems", label: "Current friction", ph: "What breaks in their workflow today?", area: true },
    ],
  },
  {
    id: "business",
    title: "Business & platform",
    hint: "Monetization and runtime surface.",
    fields: [
      { k: "business_model", label: "Business model", ph: "e.g. SaaS $19/mo, free starter tier" },
      { k: "platform", label: "Platform", choices: ["Web", "Mobile", "Web and mobile"] },
    ],
  },
  {
    id: "mvp",
    title: "MVP features",
    hint: "Smallest shippable feature set.",
    fields: [{ k: "mvp_features", list: true }],
  },
  {
    id: "tech",
    title: "Technology",
    hint: "Optional stack preferences.",
    fields: [
      { k: "languages", label: "Languages & frameworks", ph: "e.g. TypeScript, Next.js" },
      { k: "hosting", label: "Hosting", ph: "e.g. Vercel, Railway, Fly.io" },
      { k: "database", label: "Database", ph: "e.g. PostgreSQL" },
    ],
  },
  {
    id: "auth",
    title: "Auth & payments",
    hint: "Identity and billing providers.",
    fields: [
      { k: "auth", label: "Authentication", ph: "e.g. Google OAuth + email, RBAC roles" },
      { k: "payments", label: "Payments", ph: "e.g. Lemon Squeezy / Stripe, or none" },
    ],
  },
  {
    id: "constraints",
    title: "Constraints",
    hint: "Budget, scale, and timeline.",
    fields: [
      { k: "budget", label: "Monthly budget", ph: "e.g. under $50/month" },
      { k: "scale", label: "Expected scale", ph: "e.g. 1,000 active tenants" },
      { k: "deadline", label: "Target launch", ph: "e.g. 6 weeks" },
      { k: "available_time", label: "Engineering capacity", ph: "e.g. 15 hours/week" },
    ],
  },
];

function Field({ f, value, onChange }) {
  if (f.list) {
    return (
      <ListEditor
        items={value || []}
        onChange={onChange}
        placeholder="Type a feature and press Enter"
        testid="wizard-mvp-features"
      />
    );
  }
  if (f.choices) {
    return (
      <div className="space-y-2">
        <Label>{f.label}</Label>
        <div className="flex flex-wrap gap-2">
          {f.choices.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(value === c ? "" : c)}
              data-testid={`wizard-choice-${c.toLowerCase().replace(/\s/g, "-")}`}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                value === c
                  ? "border-foreground bg-foreground text-background"
                  : "hairline hover:bg-muted"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
    );
  }
  const C = f.area ? Textarea : Input;
  return (
    <div className="space-y-1.5">
      <Label htmlFor={f.k}>{f.label}</Label>
      <C
        id={f.k}
        placeholder={f.ph}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        data-testid={`wizard-${f.k}-input`}
        className={f.area ? "min-h-[96px]" : ""}
      />
    </div>
  );
}

export default function NewProject() {
  const nav = useNavigate();
  const [mode, setMode] = useState("chat");
  const [ideaPrompt, setIdeaPrompt] = useState("");
  const [ideaName, setIdeaName] = useState("");

  const [i, setI] = useState(0);
  const [v, setV] = useState({});
  const [skipped, setSkipped] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const valid = !step.required || (v.name?.trim() && v.description?.trim());
  const answered = (s) =>
    s.fields.some((f) => (Array.isArray(v[f.k]) ? v[f.k].length : v[f.k]));

  const submitIdeaChat = async (e) => {
    e?.preventDefault();
    if (!ideaPrompt.trim() || busy) return;
    setBusy(true);
    try {
      const llmConfig = getActiveClientLlmConfig();
      localStorage.setItem("bp:chat-open", "true");
      const { data } = await http.post("/projects", {
        name: ideaName.trim() || undefined,
        idea_prompt: ideaPrompt.trim(),
        llm_config: llmConfig,
      });
      toast.success(`Created "${data.name}"`);
      nav(`/p/${data.id}/database`);
    } catch (err) {
      if (err?.response?.data?.code === "TIER_LIMIT_REACHED") {
        setUpgradeOpen(true);
      } else {
        toast.error(errMsg(err));
      }
      setBusy(false);
    }
  };

  const submitWizard = async () => {
    setBusy(true);
    const { name, description, ...answers } = v;
    try {
      const { data } = await http.post("/projects", { name, description, answers });
      toast.success("Brief created");
      nav(`/p/${data.id}/brief`);
    } catch (e) {
      if (e?.response?.data?.code === "TIER_LIMIT_REACHED") {
        setUpgradeOpen(true);
      } else {
        toast.error(errMsg(e));
      }
      setBusy(false);
    }
  };

  const next = (skip) => {
    const s = new Set(skipped);
    skip ? s.add(step.id) : s.delete(step.id);
    setSkipped(s);
    last ? submitWizard() : setI(i + 1);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* Minimal Header + Mode Toggle */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
            Workspace // New Blueprint
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Create project</h1>
        </div>

        <div
          className="inline-flex self-start rounded-md border hairline bg-muted/40 p-0.5 font-mono text-[11px]"
          data-testid="new-project-mode-tabs"
        >
          <button
            type="button"
            onClick={() => setMode("chat")}
            data-testid="mode-idea-chat-btn"
            className={`rounded px-3 py-1 transition-colors ${
              mode === "chat"
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Prompt
          </button>
          <button
            type="button"
            onClick={() => setMode("wizard")}
            data-testid="mode-wizard-btn"
            className={`rounded px-3 py-1 transition-colors ${
              mode === "wizard"
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Manual Brief
          </button>
        </div>
      </div>

      {mode === "chat" ? (
        <form
          onSubmit={submitIdeaChat}
          className="space-y-5 fade-up"
          data-testid="idea-chat-creator"
        >
          {/* Antigravity-Style Prompt Composer */}
          <div className="overflow-hidden rounded-lg border hairline bg-card transition-colors focus-within:border-foreground/50">
            {/* Inline Optional Project Name */}
            <div className="flex items-center gap-3 border-b hairline px-4 py-2">
              <label
                htmlFor="idea-name"
                className="shrink-0 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground"
              >
                Project
              </label>
              <input
                id="idea-name"
                type="text"
                value={ideaName}
                onChange={(e) => setIdeaName(e.target.value)}
                placeholder="Optional name (auto-named from prompt)"
                className="w-full bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground outline-none"
                data-testid="idea-name-input"
              />
            </div>

            {/* Clean Prompt Textarea */}
            <textarea
              id="idea-prompt"
              value={ideaPrompt}
              onChange={(e) => setIdeaPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  submitIdeaChat(e);
                }
              }}
              placeholder="Describe the application you want to architect — core entities, user roles, workflows, and stack…"
              className="min-h-[160px] w-full resize-y bg-transparent px-4 py-3.5 text-[14px] leading-relaxed text-foreground placeholder:text-muted-foreground outline-none"
              data-testid="idea-prompt-input"
            />

            {/* Composer Toolbar: Model Selector on Left + Submit on Right */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t hairline bg-muted/20 px-3 py-2">
              <div className="flex items-center gap-2">
                <ModelSelector
                  preferredDirection="auto"
                  testId="new-project-model-selector"
                />
                <span className="hidden sm:inline font-mono text-[10px] text-muted-foreground">
                  12 modules &middot; SQL + .md
                </span>
              </div>

              <Button
                type="submit"
                size="sm"
                disabled={!ideaPrompt.trim() || busy}
                className="h-8 gap-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium px-3.5"
                data-testid="idea-generate-btn"
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Create blueprint</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Minimal 1-Line Templates */}
          <div className="space-y-1.5">
            <div className="px-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Templates
            </div>
            <div className="divide-y hairline rounded-md border hairline bg-card">
              {IDEA_EXAMPLES.map((ex, idx) => (
                <button
                  key={ex.code}
                  type="button"
                  onClick={() => setIdeaPrompt(ex.prompt)}
                  data-testid={`idea-example-${idx}`}
                  className="group flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {ex.code}
                    </span>
                    <span className="truncate text-[13px] font-medium text-foreground">
                      {ex.title}
                    </span>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </form>
      ) : (
        <div className="grid gap-8 md:grid-cols-[200px_1fr] pt-2">
          <ol className="space-y-1" data-testid="wizard-steps">
            {STEPS.map((s, j) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => (j < i || valid) && setI(j)}
                  className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12.5px] transition-colors ${
                    j === i
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted/50"
                  }`}
                  data-testid={`wizard-step-${s.id}`}
                >
                  <span
                    className={`grid h-5 w-5 shrink-0 place-items-center rounded border text-[10px] font-mono ${
                      answered(s)
                        ? "border-foreground bg-foreground text-background"
                        : "hairline"
                    }`}
                  >
                    {answered(s) ? <Check className="h-3 w-3" /> : String(j + 1).padStart(2, "0")}
                  </span>
                  <span className="truncate">{s.title}</span>
                  {skipped.has(s.id) && !answered(s) && (
                    <span className="ml-auto font-mono text-[9.5px]">skip</span>
                  )}
                </button>
              </li>
            ))}
          </ol>

          <div className="rounded-lg border hairline bg-card p-6 fade-up" key={step.id}>
            <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
              Step {String(i + 1).padStart(2, "0")} / {String(STEPS.length).padStart(2, "0")}
              {!step.required && " · optional"}
            </div>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{step.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{step.hint}</p>

            <div className="mt-6 space-y-4">
              {step.fields.map((f) => (
                <Field
                  key={f.k}
                  f={f}
                  value={v[f.k]}
                  onChange={(val) => setV({ ...v, [f.k]: val })}
                />
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2 border-t hairline pt-4">
              {i > 0 && (
                <Button variant="ghost" size="sm" onClick={() => setI(i - 1)} data-testid="wizard-back-btn">
                  <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                  Back
                </Button>
              )}
              <div className="flex-1" />
              {!step.required && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => next(true)}
                  disabled={busy}
                  data-testid="wizard-skip-btn"
                >
                  Skip
                </Button>
              )}
              <Button
                size="sm"
                className="bg-foreground text-background hover:bg-foreground/90"
                onClick={() => next(false)}
                disabled={!valid || busy}
                data-testid={last ? "wizard-create-btn" : "wizard-next-btn"}
              >
                {busy && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                {last ? "Create brief" : "Continue"}
                {!last && <ArrowRight className="ml-1 h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>
      )}

      <UpgradeDialog open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </div>
  );
}
