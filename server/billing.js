import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Auto-load .env in Node 20.6+ if not already loaded
try {
  if (typeof process.loadEnvFile === "function") {
    const rootEnv = path.resolve(__dirname, "../.env");
    const localEnv = path.resolve(__dirname, "./.env");
    if (fs.existsSync(rootEnv)) {
      process.loadEnvFile(rootEnv);
    } else if (fs.existsSync(localEnv)) {
      process.loadEnvFile(localEnv);
    }
  }
} catch {
  // Ignore if already loaded or missing
}

export const PLANS = {
  free: {
    id: "free",
    name: "Starter",
    description: "For evaluating the 12-module blueprint workbench on your first project.",
    price: { monthly: 0, yearly: 0 },
    limits: {
      max_active_projects: 1,
      modular_markdown_exports: true,
      bundle_export: false,
      ddl_exports: false,
      ai_architect_priority: "standard",
      team_seats: 1,
    },
    features: [
      "1 active blueprint project",
      "All 12 modular engineering panels",
      "Individual Markdown (.md) exports",
      "Multi-model AI Architect router",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro Builder",
    description: "For founders and engineers shipping production full-stack systems.",
    price: { monthly: 19, yearly: 190 },
    limits: {
      max_active_projects: Infinity,
      modular_markdown_exports: true,
      bundle_export: true,
      ddl_exports: true,
      ai_architect_priority: "high",
      team_seats: 1,
    },
    features: [
      "Unlimited active blueprint projects",
      "PostgreSQL DDL & Prisma schema generators",
      "14-file separated .md & CI/CD bundle export",
      "Priority multi-provider AI Architect",
      "Version history & impact cascade tracking",
    ],
    get blink_checkout_urls() {
      return {
        monthly: process.env.BLINK_PRO_MONTHLY_URL || "",
        yearly: process.env.BLINK_PRO_YEARLY_URL || "",
      };
    },
  },
  team: {
    id: "team",
    name: "Team Studio",
    description: "For product teams, software agencies, and engineering studios.",
    price: { monthly: 49, yearly: 490 },
    limits: {
      max_active_projects: Infinity,
      modular_markdown_exports: true,
      bundle_export: true,
      ddl_exports: true,
      ai_architect_priority: "dedicated",
      team_seats: 10,
    },
    features: [
      "Everything in Pro Builder",
      "Up to 10 member seats included",
      "Shared team blueprint workspace",
      "Centralized invoicing & VAT receipts",
      "Priority engineering support",
    ],
    get blink_checkout_urls() {
      return {
        monthly: process.env.BLINK_TEAM_MONTHLY_URL || "",
        yearly: process.env.BLINK_TEAM_YEARLY_URL || "",
      };
    },
  },
};

/**
 * Creates a live Blink checkout session with pre-filled customer details and plan metadata.
 */
export async function createCheckoutSession({ user, planId, interval = "monthly", redirectUrl }) {
  const plan = PLANS[planId];
  if (!plan || planId === "free") {
    throw new Error("Invalid plan selection");
  }

  const rawUrl = plan.blink_checkout_urls?.[interval];
  if (!rawUrl) {
    const varName = `BLINK_${planId.toUpperCase()}_${interval.toUpperCase()}_URL`;
    throw new Error(
      `Blink checkout URL missing in .env (set ${varName} to your Blink checkout/product URL from sellonblink.com).`
    );
  }

  const returnUrl =
    redirectUrl || `${process.env.FRONTEND_URL || "http://localhost:3000"}/billing?checkout=success`;

  let checkoutUrl = rawUrl;
  try {
    const parsed = new URL(rawUrl);
    if (user?.email) parsed.searchParams.set("email", user.email);
    if (user?.name) parsed.searchParams.set("name", user.name);
    if (user?.id) {
      parsed.searchParams.set("user_id", user.id);
      parsed.searchParams.set("custom_data[user_id]", user.id);
      parsed.searchParams.set("metadata[user_id]", user.id);
    }
    parsed.searchParams.set("plan", planId);
    parsed.searchParams.set("interval", interval);
    parsed.searchParams.set("redirect_url", returnUrl);
    parsed.searchParams.set("success_url", returnUrl);
    checkoutUrl = parsed.toString();
  } catch {
    // If custom non-standard URL, use rawUrl as-is
  }

  return {
    checkout_url: checkoutUrl,
    url: checkoutUrl,
    provider: "blink",
    mode: "live",
  };
}

/**
 * Handle Blink webhook lifecycle events idempotently (sellonblink.com / blink.store)
 */
export function handleBlinkWebhookEvent(DB, eventPayload, saveDb) {
  DB.processed_webhooks = DB.processed_webhooks || [];
  DB.subscriptions = DB.subscriptions || {};
  DB.transactions = DB.transactions || [];

  const eventName =
    eventPayload?.event ||
    eventPayload?.type ||
    eventPayload?.event_name ||
    "payment.succeeded";
  const data = eventPayload?.data || eventPayload?.object || eventPayload || {};
  const metadata = data.metadata || data.custom_data || eventPayload?.metadata || {};
  const eventId =
    eventPayload?.id ||
    eventPayload?.event_id ||
    `blink_${data.id || data.order_id || Date.now()}`;

  if (DB.processed_webhooks.includes(eventId)) {
    return { status: "already_processed", eventId };
  }

  const userId = metadata.user_id || data.user_id || data.customer_id;
  const userEmail = (
    data.customer_email ||
    data.email ||
    data.customer?.email ||
    ""
  ).toLowerCase();

  const user = DB.users.find(
    (u) => (userId && u.id === userId) || (userEmail && u.email?.toLowerCase() === userEmail)
  );

  if (!user) {
    console.warn(`Blink Webhook: no user found for event ${eventName}`, { userId, userEmail });
    DB.processed_webhooks.push(eventId);
    if (saveDb) saveDb();
    return { status: "user_not_found", eventId };
  }

  const now = new Date().toISOString();
  const rawPlan = metadata.plan || data.plan || data.product_name || "";
  const targetPlan = rawPlan.toLowerCase().includes("team") ? "team" : "pro";
  const rawInterval = metadata.interval || data.interval || "";
  const targetInterval =
    rawInterval.toLowerCase().includes("year") || rawInterval.toLowerCase().includes("annual")
      ? "yearly"
      : "monthly";

  user.plan = targetPlan;
  user.subscription = {
    provider: "blink",
    subscription_id: String(data.subscription_id || data.id || `blink_sub_${Date.now()}`),
    customer_id: String(data.customer_id || data.customer?.id || `blink_cust_${Date.now()}`),
    plan: targetPlan,
    interval: targetInterval,
    status: "active",
    current_period_end:
      data.current_period_end || new Date(Date.now() + 30 * 86400000).toISOString(),
    renews_at: data.renews_at || null,
    customer_portal_url: data.customer_portal_url || "https://sellonblink.com",
    created_at: now,
    updated_at: now,
  };

  DB.subscriptions[user.id] = user.subscription;
  DB.transactions.unshift({
    id: `tx_blink_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    user_id: user.id,
    event_name: eventName,
    amount:
      data.amount ||
      (targetPlan === "team"
        ? targetInterval === "yearly"
          ? 49000
          : 4900
        : targetInterval === "yearly"
        ? 19000
        : 1900),
    currency: data.currency || "USD",
    status: "succeeded",
    created_at: now,
  });

  DB.processed_webhooks.push(eventId);
  if (saveDb) saveDb();

  return {
    status: "success",
    eventId,
    eventName,
    user_id: user.id,
    plan: user.plan,
  };
}
