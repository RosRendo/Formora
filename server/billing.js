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

export const PADDLE_ENV = process.env.PADDLE_ENV || (process.env.NODE_ENV === "production" ? "production" : "sandbox");
export const PADDLE_API_BASE =
  PADDLE_ENV === "production" ? "https://api.paddle.com" : "https://sandbox-api.paddle.com";

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
    get paddle_price_ids() {
      return {
        monthly: process.env.PADDLE_PRO_MONTHLY_PRICE_ID || "",
        yearly: process.env.PADDLE_PRO_YEARLY_PRICE_ID || "",
      };
    },
    get paddle_checkout_urls() {
      return {
        monthly: process.env.PADDLE_PRO_MONTHLY_URL || "",
        yearly: process.env.PADDLE_PRO_YEARLY_URL || "",
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
    get paddle_price_ids() {
      return {
        monthly: process.env.PADDLE_TEAM_MONTHLY_PRICE_ID || "",
        yearly: process.env.PADDLE_TEAM_YEARLY_PRICE_ID || "",
      };
    },
    get paddle_checkout_urls() {
      return {
        monthly: process.env.PADDLE_TEAM_MONTHLY_URL || "",
        yearly: process.env.PADDLE_TEAM_YEARLY_URL || "",
      };
    },
  },
};

/**
 * Creates a live Paddle Billing v2 checkout session or transaction.
 * Calls Paddle Billing API /transactions if PADDLE_API_KEY is configured,
 * or falls back to direct checkout URLs if configured.
 */
export async function createCheckoutSession({ user, planId, interval = "monthly", redirectUrl, clientIp = null }) {
  const plan = PLANS[planId];
  if (!plan || planId === "free") {
    throw new Error("Invalid plan selection");
  }

  const returnUrl =
    redirectUrl || `${process.env.FRONTEND_URL || "https://skemat.online"}/billing?checkout=success`;

  const priceId = plan.paddle_price_ids?.[interval];
  const directUrl = plan.paddle_checkout_urls?.[interval];
  const apiKey = process.env.PADDLE_API_KEY;

  // Option A: Paddle Billing API Transaction creation
  if (apiKey && priceId) {
    const payload = {
      items: [
        {
          price_id: priceId,
          quantity: 1,
        },
      ],
      custom_data: {
        user_id: user?.id || "",
        plan: planId,
        interval,
      },
      checkout: {
        success_url: returnUrl,
      },
    };

    if (user?.email) {
      payload.customer = {
        email: user.email,
        name: user.name || undefined,
      };
    }

    if (clientIp) {
      payload.customer_ip_address = clientIp;
    }

    try {
      const resp = await fetch(`${PADDLE_API_BASE}/transactions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok) {
        const errorDetail = data?.error?.detail || data?.error?.message || JSON.stringify(data);
        console.error("Paddle API transaction error:", errorDetail);
        throw new Error(`Paddle transaction failed: ${errorDetail}`);
      }

      const checkoutUrl = data?.data?.checkout?.url;
      const transactionId = data?.data?.id;

      if (checkoutUrl) {
        return {
          checkout_url: checkoutUrl,
          url: checkoutUrl,
          transaction_id: transactionId,
          provider: "paddle",
          mode: PADDLE_ENV,
        };
      }
    } catch (err) {
      // If direct URL is also available, log and fall through
      if (!directUrl) throw err;
      console.warn("Paddle API call failed, falling back to direct URL:", err.message);
    }
  }

  // Option B: Direct Paddle checkout URL with query params
  if (directUrl) {
    let checkoutUrl = directUrl;
    try {
      const parsed = new URL(directUrl);
      if (user?.email) parsed.searchParams.set("customer_email", user.email);
      if (user?.id) {
        parsed.searchParams.set("passthrough", JSON.stringify({ user_id: user.id, plan: planId, interval }));
        parsed.searchParams.set("user_id", user.id);
      }
      parsed.searchParams.set("success_url", returnUrl);
      checkoutUrl = parsed.toString();
    } catch {
      // Use raw directUrl
    }
    return {
      checkout_url: checkoutUrl,
      url: checkoutUrl,
      provider: "paddle",
      mode: PADDLE_ENV,
    };
  }

  // If neither is configured, give clear diagnostic guidance
  const priceVarName = `PADDLE_${planId.toUpperCase()}_${interval.toUpperCase()}_PRICE_ID`;
  const urlVarName = `PADDLE_${planId.toUpperCase()}_${interval.toUpperCase()}_URL`;
  throw new Error(
    `Paddle configuration missing in .env. Please set ${priceVarName} (and PADDLE_API_KEY) or ${urlVarName} in your environment variables.`
  );
}

/**
 * Cryptographically verifies a Paddle Billing webhook signature.
 * Header format: `ts=1671552777;h1=eb39f68dc7779fb865e22a3f65b4c1aa0deedd9b0689e47262a4d3ecbb`
 * Signed string: `${ts}:${rawBody}`
 * Algorithm: HMAC-SHA256 with PADDLE_WEBHOOK_SECRET_KEY
 */
export function verifyPaddleWebhookSignature(rawBody, signatureHeader, secretKey) {
  if (!secretKey) {
    return { valid: false, reason: "Secret key missing" };
  }
  if (!signatureHeader || typeof signatureHeader !== "string") {
    return { valid: false, reason: "Missing Paddle-Signature header" };
  }

  // Parse header parts
  const parts = signatureHeader.split(";").reduce((acc, part) => {
    const [k, v] = part.split("=");
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const ts = parts.ts;
  const h1 = parts.h1;

  if (!ts || !h1) {
    return { valid: false, reason: "Malformed Paddle-Signature header (missing ts or h1)" };
  }

  // Replay attack prevention: check timestamp tolerance (300 seconds / 5 minutes)
  const tsNum = parseInt(ts, 10);
  const nowSec = Math.floor(Date.now() / 1000);
  if (isNaN(tsNum) || Math.abs(nowSec - tsNum) > 300) {
    return { valid: false, reason: "Timestamp outside 5-minute tolerance window" };
  }

  // Compute expected HMAC-SHA256 hash
  const rawBodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : String(rawBody || "");
  const payloadToSign = `${ts}:${rawBodyStr}`;

  try {
    const computedHash = crypto
      .createHmac("sha256", secretKey)
      .update(payloadToSign)
      .digest("hex");

    const computedBuffer = Buffer.from(computedHash, "hex");
    const signatureBuffer = Buffer.from(h1, "hex");

    if (computedBuffer.length !== signatureBuffer.length) {
      return { valid: false, reason: "Hash length mismatch" };
    }

    const isValid = crypto.timingSafeEqual(computedBuffer, signatureBuffer);
    return isValid
      ? { valid: true }
      : { valid: false, reason: "Cryptographic signature mismatch" };
  } catch (err) {
    return { valid: false, reason: `Verification error: ${err.message}` };
  }
}

/**
 * Creates a Customer Portal session URL via Paddle API if customer_id exists,
 * or returns the customer management URL saved in the subscription.
 */
export async function getCustomerPortalUrl(subscription, apiKey = process.env.PADDLE_API_KEY) {
  if (!subscription) {
    return "https://paddle.com";
  }

  const customerId = subscription.customer_id;
  if (apiKey && customerId && customerId.startsWith("ctm_")) {
    try {
      const resp = await fetch(`${PADDLE_API_BASE}/customers/${customerId}/portal-sessions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (resp.ok) {
        const body = await resp.json();
        const portalUrl = body?.data?.urls?.general?.overview;
        if (portalUrl) return portalUrl;
      }
    } catch {
      // Fall through to stored URLs
    }
  }

  return (
    subscription.customer_portal_url ||
    subscription.cancel_url ||
    "https://paddle.com"
  );
}

/**
 * Handle Paddle Billing webhook lifecycle events idempotently.
 * Supports:
 * - subscription.created / subscription.activated / subscription.imported
 * - subscription.updated / subscription.resumed
 * - subscription.canceled / subscription.past_due / subscription.paused
 * - transaction.completed / transaction.paid
 */
export function handlePaddleWebhookEvent(DB, eventPayload, saveDb) {
  DB.processed_webhooks = DB.processed_webhooks || [];
  DB.subscriptions = DB.subscriptions || {};
  DB.transactions = DB.transactions || [];

  const eventType =
    eventPayload?.event_type ||
    eventPayload?.type ||
    eventPayload?.alert_name ||
    "unknown";
  const eventId =
    eventPayload?.event_id ||
    eventPayload?.id ||
    `pdl_evt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // 1. Strict Webhook Idempotency Check
  if (DB.processed_webhooks.includes(eventId)) {
    return { status: "already_processed", eventId, eventType };
  }

  const data = eventPayload?.data || eventPayload;
  const customData = data.custom_data || {};
  const metadata = data.metadata || {};

  // Extract User Identification (Custom Data, Customer ID, or Email)
  const userId =
    customData.user_id ||
    metadata.user_id ||
    eventPayload.passthrough?.user_id;
  const customerId = data.customer_id || data.customer?.id || "";
  const customerEmail = (
    data.customer?.email ||
    data.email ||
    customData.email ||
    ""
  ).toLowerCase();

  const user = DB.users.find(
    (u) =>
      (userId && u.id === userId) ||
      (customerId && u.subscription?.customer_id === customerId) ||
      (customerEmail && u.email?.toLowerCase() === customerEmail)
  );

  if (!user) {
    console.warn(`Paddle Webhook: No user matched for event ${eventType}`, {
      userId,
      customerId,
      customerEmail,
      eventId,
    });
    DB.processed_webhooks.push(eventId);
    if (saveDb) saveDb();
    return { status: "user_not_found", eventId, eventType };
  }

  const now = new Date().toISOString();

  // Determine Plan & Interval from custom_data or item price
  const rawPlan = (
    customData.plan ||
    metadata.plan ||
    data.items?.[0]?.price?.description ||
    data.items?.[0]?.price?.name ||
    ""
  ).toLowerCase();
  const targetPlan = rawPlan.includes("team") ? "team" : "pro";

  const rawInterval = (
    customData.interval ||
    data.items?.[0]?.price?.billing_cycle?.interval ||
    ""
  ).toLowerCase();
  const targetInterval =
    rawInterval.includes("year") || rawInterval.includes("annual")
      ? "yearly"
      : "monthly";

  // Subscription Lifecycle State Machine
  if (
    eventType === "subscription.activated" ||
    eventType === "subscription.created" ||
    eventType === "subscription.imported" ||
    eventType === "subscription.resumed"
  ) {
    user.plan = targetPlan;
    user.subscription = {
      provider: "paddle",
      subscription_id: String(data.id || `sub_${Date.now()}`),
      customer_id: String(customerId || user.subscription?.customer_id || `ctm_${Date.now()}`),
      plan: targetPlan,
      interval: targetInterval,
      status: "active",
      current_period_end:
        data.current_billing_period?.ends_at ||
        new Date(Date.now() + (targetInterval === "yearly" ? 365 : 30) * 86400000).toISOString(),
      renews_at: data.next_billed_at || data.current_billing_period?.ends_at || null,
      customer_portal_url:
        data.management_urls?.update_payment_method ||
        user.subscription?.customer_portal_url ||
        "https://paddle.com",
      cancel_url: data.management_urls?.cancel || null,
      created_at: data.created_at || now,
      updated_at: now,
    };
    DB.subscriptions[user.id] = user.subscription;
  } else if (eventType === "subscription.updated") {
    const subStatus = data.status || "active";
    if (subStatus === "canceled") {
      user.plan = "free";
      if (user.subscription) user.subscription.status = "canceled";
    } else if (subStatus === "past_due") {
      if (user.subscription) user.subscription.status = "past_due";
    } else if (subStatus === "paused") {
      if (user.subscription) user.subscription.status = "paused";
    } else {
      user.plan = targetPlan;
      if (user.subscription) {
        user.subscription.status = subStatus;
        user.subscription.plan = targetPlan;
        user.subscription.interval = targetInterval;
        user.subscription.current_period_end =
          data.current_billing_period?.ends_at || user.subscription.current_period_end;
        user.subscription.renews_at = data.next_billed_at || user.subscription.renews_at;
        if (data.management_urls?.update_payment_method) {
          user.subscription.customer_portal_url = data.management_urls.update_payment_method;
        }
        if (data.management_urls?.cancel) {
          user.subscription.cancel_url = data.management_urls.cancel;
        }
        user.subscription.updated_at = now;
      }
    }
  } else if (eventType === "subscription.canceled") {
    user.plan = "free";
    if (user.subscription) {
      user.subscription.status = "canceled";
      user.subscription.canceled_at = data.canceled_at || now;
      user.subscription.updated_at = now;
    }
  } else if (eventType === "subscription.past_due") {
    if (user.subscription) {
      user.subscription.status = "past_due";
      user.subscription.updated_at = now;
    }
  }

  // Transaction Ledger Recording
  if (
    eventType === "transaction.completed" ||
    eventType === "transaction.paid" ||
    eventType === "subscription.activated" ||
    eventType === "subscription.created"
  ) {
    const rawTotal =
      data.details?.totals?.total ||
      data.payments?.[0]?.amount ||
      (targetPlan === "team"
        ? targetInterval === "yearly"
          ? "49000"
          : "4900"
        : targetInterval === "yearly"
        ? "19000"
        : "1900");
    const amountInt = parseInt(rawTotal, 10) || 0;

    DB.transactions.unshift({
      id: `tx_${data.id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      user_id: user.id,
      event_name: eventType,
      amount: amountInt,
      currency: data.currency_code || "USD",
      status: "succeeded",
      receipt_url: data.checkout?.receipt_url || null,
      created_at: now,
    });
  }

  // Mark event as processed
  DB.processed_webhooks.push(eventId);
  if (saveDb) saveDb();

  return {
    status: "success",
    eventId,
    eventType,
    user_id: user.id,
    plan: user.plan,
  };
}
