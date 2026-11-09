import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Check,
  CreditCard,
  ExternalLink,
  RefreshCw,
  ArrowUpRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { http, errMsg } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { PageHeader, PageLoading } from "@/components/common";

export default function Billing() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [subData, setSubData] = useState(null);
  const [plans, setPlans] = useState({});
  const [interval, setInterval] = useState("monthly");
  const [actionBusy, setActionBusy] = useState(null);

  const fetchBillingData = async (sync = false) => {
    try {
      setLoading(true);
      const [plansRes, subRes] = await Promise.all([
        http.get("/billing/plans"),
        http.get(`/billing/subscription${sync ? "?sync=true" : ""}`),
      ]);
      setPlans(plansRes.data.plans || {});
      setSubData(subRes.data || null);
      if (sync && subRes.data?.plan && subRes.data?.plan !== "free") {
        toast.success(`Active plan synced: ${subRes.data.plan_name}`);
      }
    } catch {
      toast.error("Failed to load subscription information");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const isSuccess = searchParams.get("checkout") === "success";
    fetchBillingData(isSuccess);
    if (isSuccess) {
      toast.success("Checkout completed. Subscription verified.");
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
        window.location.href = data.checkout_url;
      }
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setActionBusy(null);
    }
  };

  const openCustomerPortal = async () => {
    try {
      const { data } = await http.get("/billing/portal");
      if (data?.portal_url && data.portal_url.startsWith("http")) {
        window.open(data.portal_url, "_blank", "noopener,noreferrer");
      } else {
        window.open("https://app.lemonsqueezy.com/my-orders", "_blank", "noopener,noreferrer");
      }
    } catch {
      window.open("https://app.lemonsqueezy.com/my-orders", "_blank", "noopener,noreferrer");
    }
  };

  if (loading) return <PageLoading />;

  const currentPlanKey = subData?.plan || user?.plan || "free";
  const usage = subData?.usage || { active_projects: 0, max_projects: 1 };
  const subscription = subData?.subscription;
  const isUnlimited = usage.max_projects === Infinity || usage.max_projects === null;

  return (
    <div className="mx-auto max-w-6xl px-6 md:px-10 py-10 space-y-10">
      <PageHeader
        title="Billing & Subscription"
        description="Manage your workspace plan, active project quota, and invoices."
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchBillingData(true)}
          title="Sync subscription status with Lemon Squeezy"
          data-testid="billing-refresh-btn"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PageHeader>

      {/* Active Subscription Summary */}
      <div className="rounded-lg border hairline bg-card">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
                Current Tier
              </span>
              <span className="rounded border hairline bg-foreground px-2 py-0.5 font-mono text-[10px] font-medium uppercase text-background">
                {plans[currentPlanKey]?.name || currentPlanKey}
              </span>
              {subscription?.status && (
                <span className="rounded border hairline bg-muted/50 px-2 py-0.5 font-mono text-[10px] uppercase text-foreground">
                  {subscription.status}
                </span>
              )}
            </div>

            <h2 className="text-xl font-semibold tracking-tight">
              {currentPlanKey === "free"
                ? "Starter Workspace"
                : currentPlanKey === "pro"
                ? "Pro Builder Workspace"
                : "Team Studio Workspace"}
            </h2>
            <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
              {currentPlanKey === "free"
                ? "Includes 1 active blueprint project across all 12 architectural modules. Upgrade to Pro for unlimited blueprints, PostgreSQL DDL & Prisma generators, and bulk specification exports."
                : `Renews automatically on ${
                    subscription?.renews_at
                      ? new Date(subscription.renews_at).toLocaleDateString()
                      : "your next billing date"
                  }.`}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {currentPlanKey !== "free" ? (
              <Button
                variant="outline"
                size="sm"
                className="h-9 gap-2 text-xs"
                onClick={openCustomerPortal}
                data-testid="billing-portal-btn"
              >
                <CreditCard className="h-3.5 w-3.5" />
                <span>Customer Portal</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground" />
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => handleCheckout("pro")}
                disabled={actionBusy === "pro"}
                className="h-9 gap-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium px-4"
                data-testid="billing-upgrade-hero-btn"
              >
                {actionBusy === "pro" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                <span>Upgrade to Pro</span>
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* 3-Column Architectural Telemetry Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x hairline border-t hairline bg-muted/15">
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-muted-foreground">ACTIVE PROJECTS</span>
              <span className="font-medium text-foreground">
                {usage.active_projects} / {isUnlimited ? "∞" : usage.max_projects}
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
              <div
                className="h-full bg-foreground transition-all duration-300"
                style={{
                  width: isUnlimited
                    ? "100%"
                    : `${Math.min(100, (usage.active_projects / Math.max(1, usage.max_projects)) * 100)}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              {isUnlimited
                ? "Unlimited active blueprints enabled."
                : usage.active_projects >= usage.max_projects
                ? "Starter limit reached. Upgrade for unlimited projects."
                : `${usage.max_projects - usage.active_projects} active slot available.`}
            </p>
          </div>

          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-muted-foreground">CODE &amp; DDL EXPORTS</span>
              <span className="font-medium text-foreground">
                {currentPlanKey === "free" ? ".MD ONLY" : "FULL SUITE"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {currentPlanKey === "free"
                ? "Individual Markdown specs enabled. PostgreSQL DDL, Prisma & bulk exports require Pro."
                : "PostgreSQL DDL, Prisma schema, OpenAPI, CI/CD & 14-file bundle exports enabled."}
            </p>
          </div>

          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-muted-foreground">WORKSPACE SEATS</span>
              <span className="font-medium text-foreground">
                {currentPlanKey === "team" ? "10 SEATS" : "1 SEAT"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {currentPlanKey === "team"
                ? "Shared team blueprints & centralized invoicing."
                : "Single engineer workspace."}
            </p>
          </div>
        </div>
      </div>

      {/* Billing Interval Switch */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-2">
        <div>
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
            Plans // Lemon Squeezy Merchant of Record
          </div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight">Workspace Tiers</h3>
        </div>

        <div className="inline-flex items-center rounded-md border hairline bg-muted/40 p-0.5 font-mono text-[11px] self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setInterval("monthly")}
            className={`rounded px-3 py-1 transition-colors ${
              interval === "monthly"
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setInterval("yearly")}
            className={`flex items-center gap-1.5 rounded px-3 py-1 transition-colors ${
              interval === "yearly"
                ? "bg-foreground text-background font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Annual</span>
            <span className="opacity-75">-17%</span>
          </button>
        </div>
      </div>

      {/* 3 Swiss Architectural Plan Columns */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* 01 Starter */}
        <div
          className={`flex flex-col justify-between rounded-lg border p-6 ${
            currentPlanKey === "free" ? "border-foreground/50 bg-card" : "hairline bg-card/70"
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">01</span>
                <h4 className="font-semibold text-base">Starter</h4>
              </div>
              {currentPlanKey === "free" && (
                <span className="rounded border hairline bg-muted px-2 py-0.5 font-mono text-[10px] text-foreground">
                  CURRENT
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground min-h-[34px]">
              For evaluating the 12-module blueprint workbench on your first project.
            </p>

            <div className="flex items-baseline gap-1 pt-1 font-mono">
              <span className="text-3xl font-semibold tracking-tight">$0</span>
              <span className="text-xs text-muted-foreground">/ forever</span>
            </div>

            <div className="border-t hairline pt-4 space-y-2.5 text-xs">
              {[
                "1 active blueprint project",
                "All 12 modular engineering panels",
                "Individual Markdown (.md) exports",
                "Multi-model AI Architect router",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-foreground shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t hairline">
            <Button
              variant="outline"
              disabled={currentPlanKey === "free"}
              onClick={openCustomerPortal}
              className="w-full h-9 text-xs font-medium"
            >
              {currentPlanKey === "free" ? "Active Plan" : "Manage via Portal"}
            </Button>
          </div>
        </div>

        {/* 02 Pro Builder */}
        <div
          className={`flex flex-col justify-between rounded-lg border p-6 ${
            currentPlanKey === "pro"
              ? "border-foreground bg-card"
              : "border-foreground/70 bg-card shadow-sm"
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">02</span>
                <h4 className="font-semibold text-base">Pro Builder</h4>
              </div>
              <span className="rounded border hairline bg-foreground px-2 py-0.5 font-mono text-[10px] text-background">
                {currentPlanKey === "pro" ? "CURRENT" : "RECOMMENDED"}
              </span>
            </div>

            <p className="text-xs text-muted-foreground min-h-[34px]">
              For founders and engineers shipping production full-stack systems.
            </p>

            <div className="flex items-baseline gap-1 pt-1 font-mono">
              <span className="text-3xl font-semibold tracking-tight">
                ${interval === "yearly" ? "190" : "19"}
              </span>
              <span className="text-xs text-muted-foreground">
                {interval === "yearly" ? "/ year" : "/ month"}
              </span>
            </div>

            <div className="border-t hairline pt-4 space-y-2.5 text-xs">
              {[
                "Unlimited active blueprint projects",
                "PostgreSQL DDL & Prisma schema generators",
                "14-file separated .md & CI/CD bundle export",
                "Priority multi-provider AI Architect",
                "Version history & impact cascade tracking",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-foreground shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t hairline">
            <Button
              onClick={() => handleCheckout("pro")}
              disabled={actionBusy === "pro" || currentPlanKey === "pro"}
              className="w-full h-9 gap-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium"
              data-testid="billing-checkout-pro-btn"
            >
              {actionBusy === "pro" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{currentPlanKey === "pro" ? "Current Plan" : "Upgrade to Pro"}</span>
            </Button>
          </div>
        </div>

        {/* 03 Team Studio */}
        <div
          className={`flex flex-col justify-between rounded-lg border p-6 ${
            currentPlanKey === "team" ? "border-foreground bg-card" : "hairline bg-card/70"
          }`}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">03</span>
                <h4 className="font-semibold text-base">Team Studio</h4>
              </div>
              {currentPlanKey === "team" && (
                <span className="rounded border hairline bg-foreground px-2 py-0.5 font-mono text-[10px] text-background">
                  CURRENT
                </span>
              )}
            </div>

            <p className="text-xs text-muted-foreground min-h-[34px]">
              For product teams, software agencies, and engineering studios.
            </p>

            <div className="flex items-baseline gap-1 pt-1 font-mono">
              <span className="text-3xl font-semibold tracking-tight">
                ${interval === "yearly" ? "490" : "49"}
              </span>
              <span className="text-xs text-muted-foreground">
                {interval === "yearly" ? "/ year" : "/ month"}
              </span>
            </div>

            <div className="border-t hairline pt-4 space-y-2.5 text-xs">
              {[
                "Everything in Pro Builder",
                "Up to 10 member seats included",
                "Shared team blueprint workspace",
                "Centralized invoicing & VAT receipts",
                "Priority engineering support",
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-foreground shrink-0" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-6 mt-6 border-t hairline">
            <Button
              variant="outline"
              onClick={() => handleCheckout("team")}
              disabled={actionBusy === "team" || currentPlanKey === "team"}
              className="w-full h-9 gap-1.5 text-xs font-medium"
              data-testid="billing-checkout-team-btn"
            >
              {actionBusy === "team" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{currentPlanKey === "team" ? "Current Plan" : "Upgrade to Team"}</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Invoices & Transaction Ledger */}
      <div className="rounded-lg border hairline bg-card p-6 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold tracking-tight">Invoice &amp; Transaction Ledger</h4>
          <span className="font-mono text-[10.5px] text-muted-foreground">LEMON SQUEEZY MOR</span>
        </div>

        {subData?.transactions?.length > 0 ? (
          <div className="divide-y hairline text-xs">
            {subData.transactions.map((tx) => (
              <div key={tx.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-foreground flex items-center gap-2">
                    <span>{tx.event_name}</span>
                    <span className="font-mono text-[11px] text-muted-foreground">{tx.id}</span>
                  </div>
                  <div className="font-mono text-[10.5px] text-muted-foreground mt-0.5">
                    {new Date(tx.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="font-medium">
                    ${(tx.amount / 100).toFixed(2)} {tx.currency}
                  </div>
                  <span className="text-[10px] uppercase text-muted-foreground">{tx.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-1">
            No completed transactions yet. Invoices processed via Lemon Squeezy appear here automatically.
          </p>
        )}
      </div>
    </div>
  );
}
