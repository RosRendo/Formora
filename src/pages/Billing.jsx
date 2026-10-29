import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Check,
  Zap,
  Sparkles,
  ShieldCheck,
  CreditCard,
  Building2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  FolderKanban,
  CheckCircle2,
  FileCode,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { http } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { PageHeader, PageLoading, EmptyState } from "@/components/common";

export default function Billing() {
  const { user, check: refreshAuth } = useAuth();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState(null);
  const [plans, setPlans] = useState({});
  const [interval, setInterval] = useState("monthly"); // monthly | yearly
  const [actionBusy, setActionBusy] = useState(null);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      const [plansRes, subRes] = await Promise.all([
        http.get("/billing/plans"),
        http.get("/billing/subscription"),
      ]);
      setPlans(plansRes.data.plans || {});
      setSubData(subRes.data || null);
    } catch (err) {
      toast.error("Failed to load subscription information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBillingData();
    if (searchParams.get("checkout") === "success") {
      toast.success("Checkout completed! Webhook processing in progress.");
    }
  }, []);

  const handleCheckout = async (planKey) => {
    if (planKey === "free") return;
    try {
      setActionBusy(planKey);
      const { data } = await http.post("/billing/checkout", {
        plan: planKey,
        interval,
        redirect_url: `${window.location.origin}/billing?checkout=success`,
      });

      if (data.checkout_url) {
        if (data.mode === "simulation") {
          toast.info("Entering Lemon Squeezy checkout simulation...");
        }
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Checkout creation failed");
    } finally {
      setActionBusy(null);
    }
  };

  const handleSimulateWebhook = async (eventName, targetPlan = "pro") => {
    try {
      setActionBusy("sim");
      const { data } = await http.post("/billing/dev-simulate-webhook", {
        event_name: eventName,
        plan: targetPlan,
        interval,
      });
      toast.success(`Simulated Lemon Squeezy event: ${eventName} (${targetPlan})`);
      await fetchBillingData();
      await refreshAuth();
    } catch (err) {
      toast.error("Simulation failed");
    } finally {
      setActionBusy(null);
    }
  };

  if (loading) return <PageLoading />;

  const currentPlanKey = subData?.plan || user?.plan || "free";
  const usage = subData?.usage || { active_projects: 0, max_projects: 1 };
  const subscription = subData?.subscription;
  const isSimulation = subData?.simulation_mode;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-10">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your Formora workspace plan, quotas, invoices, and Lemon Squeezy payment settings."
      />

      {/* Subscription Status Card */}
      <div className="relative overflow-hidden rounded-2xl border hairline bg-card p-6 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Active Tier
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold capitalize ${
                  currentPlanKey === "pro"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : currentPlanKey === "team"
                    ? "bg-violet-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                {plans[currentPlanKey]?.name || currentPlanKey}
              </span>
              {subscription?.status && (
                <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20 capitalize">
                  {subscription.status}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              {currentPlanKey === "free"
                ? "Starter Plan"
                : currentPlanKey === "pro"
                ? "Formora Pro Builder"
                : "Formora Team Studio"}
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              {currentPlanKey === "free"
                ? "You are currently on the free Starter tier with 1 active project blueprint. Upgrade to Pro for unlimited projects and full code exports."
                : `Your subscription renews automatically on ${
                    subscription?.renews_at
                      ? new Date(subscription.renews_at).toLocaleDateString()
                      : "the end of billing period"
                  }.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {currentPlanKey !== "free" ? (
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  toast.info("Opening Lemon Squeezy customer billing portal...");
                  window.open("https://app.lemonsqueezy.com/my-orders", "_blank");
                }}
              >
                <CreditCard className="h-4 w-4" />
                <span>Customer Portal</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Button>
            ) : (
              <Button
                onClick={() => handleCheckout("pro")}
                disabled={actionBusy === "pro"}
                className="gap-2 font-medium"
              >
                <Zap className="h-4 w-4 fill-current" />
                <span>Upgrade to Pro</span>
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={fetchBillingData}
              title="Refresh subscription status"
            >
              <RefreshCw className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        </div>

        {/* Quota Progress Bar */}
        <div className="mt-6 pt-6 border-t hairline grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl border hairline bg-muted/30 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <FolderKanban className="h-3.5 w-3.5 text-primary" />
                Active Projects Quota
              </span>
              <span className="font-mono font-medium text-foreground">
                {usage.active_projects} /{" "}
                {usage.max_projects === Infinity ? "Unlimited" : usage.max_projects}
              </span>
            </div>
            <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  usage.max_projects !== Infinity && usage.active_projects >= usage.max_projects
                    ? "bg-amber-500"
                    : "bg-primary"
                }`}
                style={{
                  width:
                    usage.max_projects === Infinity
                      ? "100%"
                      : `${Math.min(100, (usage.active_projects / usage.max_projects) * 100)}%`,
                }}
              />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              {usage.max_projects === Infinity
                ? "Unlimited projects allowed on your current tier."
                : usage.active_projects >= usage.max_projects
                ? "Quota limit reached. Upgrade to Pro to create more blueprints."
                : `${usage.max_projects - usage.active_projects} active project slot remaining.`}
            </p>
          </div>

          <div className="rounded-xl border hairline bg-muted/30 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <FileCode className="h-3.5 w-3.5 text-primary" />
                Schema & DDL Generators
              </span>
              <span className="font-mono font-medium text-foreground">
                {currentPlanKey === "free" ? "Limited" : "Full Access"}
              </span>
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
              {currentPlanKey === "free"
                ? "PostgreSQL DDL & Prisma generator locked on Starter."
                : "Full PostgreSQL DDL, Prisma schema, and 9-module ZIP downloads enabled."}
            </p>
          </div>

          <div className="rounded-xl border hairline bg-muted/30 p-4">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="h-3.5 w-3.5 text-primary" />
                Team Seats
              </span>
              <span className="font-mono font-medium text-foreground">
                {currentPlanKey === "team" ? "10 seats" : "1 seat"}
              </span>
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
              {currentPlanKey === "team"
                ? "Centralized multi-seat billing & shared blueprints."
                : "Single builder license."}
            </p>
          </div>
        </div>
      </div>

      {/* Interval Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4">
        <div>
          <h3 className="text-xl font-bold tracking-tight">Available Plans</h3>
          <p className="text-sm text-muted-foreground">
            Billed transparently through Lemon Squeezy Merchant of Record.
          </p>
        </div>

        <div className="inline-flex items-center rounded-xl border hairline bg-muted/40 p-1 text-xs self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              interval === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly Billing
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all flex items-center gap-1.5 ${
              interval === "yearly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Annual Billing</span>
            <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              Save 17%
            </span>
          </button>
        </div>
      </div>

      {/* 3 Bento-Grid Plan Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Starter Plan */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-6 transition-all ${
            currentPlanKey === "free"
              ? "border-primary/40 bg-card shadow-sm"
              : "hairline bg-card/60 hover:bg-card"
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">Starter</h4>
              {currentPlanKey === "free" && (
                <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  Current Plan
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground min-h-[36px]">
              For testing the 9-panel architectural canvas on your first product idea.
            </p>
            <div className="flex items-baseline gap-1 pt-2">
              <span className="text-3xl font-bold tracking-tight">$0</span>
              <span className="text-xs text-muted-foreground">/ forever</span>
            </div>

            <div className="border-t hairline pt-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>1 active blueprint project</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>All 9 modular blueprint panels</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Individual Markdown (.md) exports</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>AI Architect chat router</span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t hairline">
            <Button
              variant="outline"
              disabled={currentPlanKey === "free"}
              onClick={() => handleSimulateWebhook("subscription_cancelled", "free")}
              className="w-full text-xs font-medium"
            >
              {currentPlanKey === "free" ? "Active" : "Downgrade to Starter"}
            </Button>
          </div>
        </div>

        {/* Pro Builder Plan (Featured) */}
        <div
          className={`relative flex flex-col justify-between rounded-2xl border-2 p-6 transition-all ${
            currentPlanKey === "pro"
              ? "border-primary bg-card shadow-md"
              : "border-primary/60 bg-gradient-to-b from-primary/5 via-card to-card hover:border-primary shadow-sm"
          }`}
        >
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <span className="rounded-full bg-primary px-3 py-0.5 text-[11px] font-semibold text-primary-foreground shadow-sm">
              Most Popular
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">Pro Builder</h4>
              {currentPlanKey === "pro" && (
                <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                  Current Plan
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground min-h-[36px]">
              For senior engineers and founders building real fullstack applications.
            </p>
            <div className="flex items-baseline gap-1 pt-2">
              <span className="text-3xl font-bold tracking-tight">
                ${interval === "yearly" ? "190" : "19"}
              </span>
              <span className="text-xs text-muted-foreground">
                {interval === "yearly" ? "/ year" : "/ month"}
              </span>
            </div>

            <div className="border-t hairline pt-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Unlimited active blueprint projects</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>PostgreSQL DDL & Prisma generator</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Complete 9-file ZIP bulk downloads</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Priority high-speed AI Architect</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Project archives & sync</span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t hairline">
            <Button
              onClick={() => handleCheckout("pro")}
              disabled={actionBusy === "pro" || currentPlanKey === "pro"}
              className="w-full gap-2 text-xs font-medium shadow-sm"
            >
              <Zap className="h-3.5 w-3.5 fill-current" />
              <span>{currentPlanKey === "pro" ? "Current Plan" : "Upgrade to Pro"}</span>
            </Button>
          </div>
        </div>

        {/* Team Studio Plan */}
        <div
          className={`flex flex-col justify-between rounded-2xl border p-6 transition-all ${
            currentPlanKey === "team"
              ? "border-violet-500 bg-card shadow-sm"
              : "hairline bg-card/60 hover:bg-card"
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-lg">Team Studio</h4>
              {currentPlanKey === "team" && (
                <span className="text-[11px] font-semibold text-violet-600 bg-violet-500/10 px-2 py-0.5 rounded-full">
                  Current Plan
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground min-h-[36px]">
              For software consultancies, agencies, and engineering teams.
            </p>
            <div className="flex items-baseline gap-1 pt-2">
              <span className="text-3xl font-bold tracking-tight">
                ${interval === "yearly" ? "490" : "49"}
              </span>
              <span className="text-xs text-muted-foreground">
                {interval === "yearly" ? "/ year" : "/ month"}
              </span>
            </div>

            <div className="border-t hairline pt-4 space-y-2.5 text-xs">
              <div className="flex items-center gap-2 font-medium">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Everything in Pro</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Up to 10 member seats included</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Shared team blueprint workspace</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Centralized team invoicing</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Dedicated SLA & priority support</span>
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t hairline">
            <Button
              variant={currentPlanKey === "team" ? "secondary" : "outline"}
              onClick={() => handleCheckout("team")}
              disabled={actionBusy === "team" || currentPlanKey === "team"}
              className="w-full text-xs font-medium"
            >
              {currentPlanKey === "team" ? "Current Plan" : "Upgrade to Team"}
            </Button>
          </div>
        </div>
      </div>

      {/* Developer Simulation Sandbox Toolbar (Zero-Config Test Drive) */}
      <div className="rounded-2xl border border-dashed border-amber-500/40 bg-amber-500/5 p-5 space-y-3">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4" />
          <h4 className="text-xs font-semibold uppercase tracking-wider">
            Lemon Squeezy Webhook Sandbox Simulator
          </h4>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isSimulation
            ? "Live Lemon Squeezy API keys are not set in environment. Developer Simulation Mode is active. You can trigger authentic server-to-server webhook lifecycle transitions with a single click to test tier transitions and project quota gating."
            : "Live Lemon Squeezy API keys detected. You can test authentic webhook transitions using the buttons below."}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1.5"
            disabled={actionBusy !== null}
            onClick={() => handleSimulateWebhook("subscription_created", "pro")}
          >
            <Zap className="h-3 w-3 text-amber-500" />
            <span>Simulate Upgrade to Pro</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1.5"
            disabled={actionBusy !== null}
            onClick={() => handleSimulateWebhook("subscription_created", "team")}
          >
            <Users className="h-3 w-3 text-violet-500" />
            <span>Simulate Upgrade to Team</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1.5"
            disabled={actionBusy !== null}
            onClick={() => handleSimulateWebhook("subscription_cancelled", currentPlanKey)}
          >
            <span>Simulate Cancellation</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-xs h-7 gap-1.5"
            disabled={actionBusy !== null}
            onClick={() => handleSimulateWebhook("subscription_expired", "free")}
          >
            <span>Simulate Expiration / Downgrade</span>
          </Button>
        </div>
      </div>

      {/* Invoices & Transaction History */}
      <div className="rounded-2xl border hairline bg-card p-6 space-y-4">
        <h4 className="text-base font-semibold tracking-tight">Payment & Transaction Ledger</h4>
        {subData?.transactions?.length > 0 ? (
          <div className="divide-y hairline text-xs">
            {subData.transactions.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    <span>{tx.event_name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{tx.id}</span>
                  </div>
                  <div className="text-muted-foreground text-[11px] mt-0.5">
                    {new Date(tx.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-mono font-medium">
                    ${(tx.amount / 100).toFixed(2)} {tx.currency}
                  </div>
                  <span className="text-[10px] text-emerald-600 dark:text-emerald-400 capitalize">
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            No transaction records found yet. Completed payments via Lemon Squeezy will appear here.
          </p>
        )}
      </div>
    </div>
  );
}

