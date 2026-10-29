import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Check,
  ArrowRight,
  ArrowLeft,
  Loader2,
  MessageSquareText,
  ListOrdered,
  Database,
  Braces,
  Network,
  ListChecks,
  FileText,
  FileSignature,
  Map as MapIcon,
  FolderCode,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import ListEditor from "@/components/ListEditor";
import { http, errMsg } from "@/lib/api";

const IDEA_EXAMPLES = [
  {
    title: "Food Delivery & KHQR",
    prompt:
      "Build FoodFlow: a multi-vendor food delivery app where restaurants manage menus, customers place orders, drivers stream live delivery status, and checkout supports ABA PayWay KHQR + Stripe.",
  },
  {
    title: "Clinic & Prescriptions",
    prompt:
      "Build ClinicOS: a medical appointment & prescription platform where patients book doctors, doctors record clinical notes & prescriptions, and admins manage billing.",
  },
  {
    title: "Course & Quiz LMS",
    prompt:
      "Build SkillForge: an online learning platform where instructors publish video courses & quizzes, students track enrollment progress, and Stripe handles course checkout.",
  },
  {
    title: "Freelance Invoicing & Wallet",
    prompt:
      "Build LedgerMate: a freelance invoicing, multi-currency wallet, and subscription billing SaaS with automated payment reminders and ledger exports.",
  },
];

const SEPARATED_MODULES = [
  { label: "Database ERD + SQL", icon: Database, tint: "#10b981" },
  { label: "REST API Contracts", icon: Braces, tint: "#0ea5e9" },
  { label: "Architecture Diagram", icon: Network, tint: "#8b5cf6" },
  { label: "Features Kanban", icon: ListChecks, tint: "#f59e0b" },
  { label: "Requirements PRD", icon: FileText, tint: "#3b82f6" },
  { label: "Project Brief", icon: FileSignature, tint: "#64748b" },
  { label: "Milestone Roadmap", icon: MapIcon, tint: "#14b8a6" },
  { label: "Separate .md Files", icon: FolderCode, tint: "#ec4899" },
];

const STEPS = [
  { id: "basics", title: "Product", hint: "What are you building?", required: true, fields: [
    { k: "name", label: "Product name", ph: "e.g. Shelfmate" },
    { k: "description", label: "Description", ph: "One or two sentences on what it does and for whom", area: true }] },
  { id: "users", title: "Users & problems", hint: "Who is it for and what hurts today?", fields: [
    { k: "target_users", label: "Target users", ph: "e.g. Freelance designers billing 3–10 clients" },
    { k: "problems", label: "Their problems", ph: "What do they struggle with today?", area: true }] },
  { id: "business", title: "Business & platform", hint: "How it makes money and where it runs.", fields: [
    { k: "business_model", label: "Business model", ph: "e.g. Subscription $9/mo, free tier" },
    { k: "platform", label: "Platform", choices: ["Web", "Mobile", "Web and mobile"] }] },
  { id: "mvp", title: "MVP features", hint: "The smallest set that delivers value.", fields: [{ k: "mvp_features", list: true }] },
  { id: "tech", title: "Technology", hint: "Preferences only — leave blank if you have none.", fields: [
    { k: "languages", label: "Languages & frameworks", ph: "e.g. TypeScript, Next.js" },
    { k: "hosting", label: "Hosting", ph: "e.g. Vercel, Fly.io" },
    { k: "database", label: "Database", ph: "e.g. PostgreSQL via Supabase" }] },
  { id: "auth", title: "Auth & payments", hint: "How people sign in and pay.", fields: [
    { k: "auth", label: "Authentication", ph: "e.g. Google + email, roles: admin/member" },
    { k: "payments", label: "Payments", ph: "e.g. Stripe subscriptions, or none" }] },
  { id: "constraints", title: "Constraints", hint: "Budget, scale and time available.", fields: [
    { k: "budget", label: "Monthly budget", ph: "e.g. under $50/month" },
    { k: "scale", label: "Expected scale", ph: "e.g. 500 users in 6 months" },
    { k: "deadline", label: "Deadline", ph: "e.g. 8 weeks" },
    { k: "available_time", label: "Available development time", ph: "e.g. 10 hours/week" }] },
];

function Field({ f, value, onChange }) {
  if (f.list) return <ListEditor items={value || []} onChange={onChange} placeholder="Type a feature and press Enter" testid="wizard-mvp-features" />;
  if (f.choices) return (
    <div className="space-y-2"><Label>{f.label}</Label>
      <div className="flex flex-wrap gap-2">{f.choices.map((c) => (
        <button key={c} type="button" onClick={() => onChange(value === c ? "" : c)} data-testid={`wizard-choice-${c.toLowerCase().replace(/\s/g, "-")}`}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${value === c ? "border-primary bg-accent text-accent-foreground" : "hairline hover:bg-muted"}`}>{c}</button>
      ))}</div>
    </div>
  );
  const C = f.area ? Textarea : Input;
  return (
    <div className="space-y-1.5"><Label htmlFor={f.k}>{f.label}</Label>
      <C id={f.k} placeholder={f.ph} value={value || ""} onChange={(e) => onChange(e.target.value)} data-testid={`wizard-${f.k}-input`} className={f.area ? "min-h-[96px]" : ""} />
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

  const step = STEPS[i];
  const last = i === STEPS.length - 1;
  const valid = !step.required || (v.name?.trim() && v.description?.trim());
  const answered = (s) => s.fields.some((f) => (Array.isArray(v[f.k]) ? v[f.k].length : v[f.k]));

  const submitIdeaChat = async (e) => {
    e?.preventDefault();
    if (!ideaPrompt.trim() || busy) return;
    setBusy(true);
    try {
      let llmConfig = null;
      try {
        const saved = JSON.parse(localStorage.getItem("bp:llm-config") || "null");
        if (saved?.apiKey?.trim()) llmConfig = saved;
      } catch {
        // ignore
      }
      localStorage.setItem("bp:chat-open", "true");
      const { data } = await http.post("/projects", {
        name: ideaName.trim() || undefined,
        idea_prompt: ideaPrompt.trim(),
        llm_config: llmConfig,
      });
      toast.success(`Separated "${data.name}" across Database, API, Architecture & .md panels`);
      nav(`/p/${data.id}/database`);
    } catch (err) {
      toast.error(errMsg(err));
      setBusy(false);
    }
  };

  const submitWizard = async () => {
    setBusy(true);
    const { name, description, ...answers } = v;
    try {
      const { data } = await http.post("/projects", { name, description, answers });
      toast.success("Brief drafted — review it before continuing");
      nav(`/p/${data.id}/brief`);
    } catch (e) {
      toast.error(errMsg(e));
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
    <div className="px-6 md:px-10 py-10 max-w-5xl">
      {/* Mode Switcher */}
      <div className="mb-8 inline-flex rounded-lg border hairline bg-muted/50 p-1" data-testid="new-project-mode-tabs">
        <button
          type="button"
          onClick={() => setMode("chat")}
          data-testid="mode-idea-chat-btn"
          className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
            mode === "chat" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <MessageSquareText className="h-3.5 w-3.5 text-primary" />
          Describe Idea in Chat (Auto-place panels)
        </button>
        <button
          type="button"
          onClick={() => setMode("wizard")}
          data-testid="mode-wizard-btn"
          className={`flex items-center gap-2 rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
            mode === "wizard" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <ListOrdered className="h-3.5 w-3.5" />
          7-Step Manual Wizard
        </button>
      </div>

      {mode === "chat" ? (
        <form onSubmit={submitIdeaChat} className="max-w-3xl space-y-6 fade-up" data-testid="idea-chat-creator">
          <div>
            <div className="eyebrow mb-2">AI Modular Blueprint Router</div>
            <h1 className="text-3xl font-semibold tracking-tight">Describe your idea — AI places every module separately</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Instead of dumping one giant Markdown wall where everything is mixed together, Blueprint OS splits your idea directly into visual{" "}
              <b className="text-foreground">Database ERD tables</b>, <b className="text-foreground">REST API contracts</b>,{" "}
              <b className="text-foreground">Architecture diagrams</b>, <b className="text-foreground">PRD</b>,{" "}
              <b className="text-foreground">Roadmap</b>, and <b className="text-foreground">separate .md files</b>.
            </p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {SEPARATED_MODULES.map((m) => (
              <span
                key={m.label}
                className="inline-flex items-center gap-1.5 rounded-full border hairline bg-card px-2.5 py-1 text-[11.5px] font-medium"
              >
                <m.icon className="h-3.5 w-3.5" style={{ color: m.tint }} />
                {m.label}
              </span>
            ))}
          </div>

          <div className="space-y-4 rounded-xl border hairline bg-card p-5">
            <div className="space-y-1.5">
              <Label htmlFor="idea-prompt">Describe what you want to build</Label>
              <Textarea
                id="idea-prompt"
                value={ideaPrompt}
                onChange={(e) => setIdeaPrompt(e.target.value)}
                placeholder="e.g. I want to build a pet shelter adoption & vet vaccination platform where shelters list pets, adopters submit applications, vets record vaccine history, and Stripe handles adoption fees…"
                className="min-h-[130px] text-[14px] leading-relaxed"
                data-testid="idea-prompt-input"
              />
            </div>

            <div className="space-y-1.5 max-w-sm">
              <Label htmlFor="idea-name" className="text-xs text-muted-foreground">
                Project name (optional — leave blank to let AI name it)
              </Label>
              <Input
                id="idea-name"
                value={ideaName}
                onChange={(e) => setIdeaName(e.target.value)}
                placeholder="e.g. PawHaven"
                className="h-8 text-sm"
                data-testid="idea-name-input"
              />
            </div>

            <div className="space-y-2 pt-1">
              <div className="eyebrow">Or click a sample idea to populate</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {IDEA_EXAMPLES.map((ex, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setIdeaPrompt(ex.prompt)}
                    data-testid={`idea-example-${idx}`}
                    className="rounded-lg border hairline bg-background/60 p-2.5 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
                  >
                    <div className="text-xs font-semibold text-primary">{ex.title}</div>
                    <div className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">{ex.prompt}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end pt-2">
              <Button type="submit" disabled={!ideaPrompt.trim() || busy} className="gap-2" data-testid="idea-generate-btn">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate &amp; Place into Separate Panels
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </form>
      ) : (
        <div className="grid gap-10 md:grid-cols-[220px_1fr]">
          <ol className="space-y-1" data-testid="wizard-steps">
            {STEPS.map((s, j) => (
              <li key={s.id}>
                <button
                  onClick={() => (j < i || valid) && setI(j)}
                  className={`flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors ${
                    j === i ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-muted"
                  }`}
                  data-testid={`wizard-step-${s.id}`}
                >
                  <span
                    className={`grid h-5 w-5 place-items-center rounded-full border text-[10px] font-mono ${
                      answered(s) ? "border-primary bg-primary text-primary-foreground" : "hairline"
                    }`}
                  >
                    {answered(s) ? <Check className="h-3 w-3" /> : j + 1}
                  </span>
                  {s.title}
                  {skipped.has(s.id) && !answered(s) && <span className="ml-auto text-[10px]">skipped</span>}
                </button>
              </li>
            ))}
          </ol>
          <div className="fade-up" key={step.id}>
            <div className="eyebrow mb-2">
              Step {i + 1} of {STEPS.length}
              {!step.required && " · optional"}
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{step.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{step.hint}</p>
            <div className="mt-8 space-y-5 max-w-xl">
              {step.fields.map((f) => (
                <Field key={f.k} f={f} value={v[f.k]} onChange={(val) => setV({ ...v, [f.k]: val })} />
              ))}
            </div>
            {!step.required && (
              <p className="mt-6 text-xs text-muted-foreground max-w-xl">
                Anything you skip becomes a clearly labeled assumption in the brief — you can change it later.
              </p>
            )}
            <div className="mt-10 flex items-center gap-2">
              {i > 0 && (
                <Button variant="ghost" onClick={() => setI(i - 1)} data-testid="wizard-back-btn">
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Back
                </Button>
              )}
              <div className="flex-1" />
              {!step.required && (
                <Button variant="ghost" onClick={() => next(true)} disabled={busy} data-testid="wizard-skip-btn">
                  Skip
                </Button>
              )}
              <Button onClick={() => next(false)} disabled={!valid || busy} data-testid={last ? "wizard-create-btn" : "wizard-next-btn"}>
                {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {last ? "Create & review brief" : "Continue"}
                {!last && <ArrowRight className="h-4 w-4 ml-1" />}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
