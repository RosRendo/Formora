import crypto from "crypto";

export const PLANS = {
  free: {
    id: "free",
    name: "Starter",
    description: "For evaluating the 12-module blueprint workbench on your first project.",
    price: { monthly: 0, yearly: 0 },
    limits: {
      max_active_projects: 1,
      modular_markdown_exports: true,
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
    lemon_variant_ids: {
      monthly: process.env.LEMONSQUEEZY_PRO_MONTHLY_VARIANT_ID || "",
      yearly: process.env.LEMONSQUEEZY_PRO_YEARLY_VARIANT_ID || "",
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
    lemon_variant_ids: {
      monthly: process.env.LEMONSQUEEZY_TEAM_MONTHLY_VARIANT_ID || "",
      yearly: process.env.LEMONSQUEEZY_TEAM_YEARLY_VARIANT_ID || "",
    },
  },
};

/**
 * Verify Lemon Squeezy HMAC-SHA256 signature
 */
export function verifyLemonSqueezySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  try {
    const hmac = crypto.createHmac("sha256", secret);
    const digest = Buffer.from(hmac.update(rawBody).digest("hex"), "utf8");
    const signatureBuffer = Buffer.from(signature, "utf8");
    if (digest.length !== signatureBuffer.length) return false;
    return crypto.timingSafeEqual(digest, signatureBuffer);
  } catch (err) {
    console.error("Signature verification error:", err);
    return false;
  }
}

/**
 * Creates a live Lemon Squeezy checkout session.
 */
export async function createCheckoutSession({ user, planId, interval = "monthly", redirectUrl }) {
  const plan = PLANS[planId];
  if (!plan || planId === "free") {
    throw new Error("Invalid plan selection");
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const variantId = plan.lemon_variant_ids?.[interval];

  if (!apiKey || !storeId || !variantId || variantId.startsWith("ls_var_")) {
    throw new Error(
      "Lemon Squeezy live checkout is not configured yet. Set LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, and variant IDs in .env."
    );
  }

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      Accept: "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: user.email,
            name: user.name,
            custom: {
              user_id: user.id,
              plan: planId,
              interval,
            },
          },
          product_options: {
            redirect_url:
              redirectUrl ||
              `${process.env.APP_URL || "http://localhost:3000"}/billing?checkout=success`,
          },
        },
        relationships: {
          store: { data: { type: "stores", id: String(storeId) } },
          variant: { data: { type: "variants", id: String(variantId) } },
        },
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Lemon Squeezy checkout error:", errText);
    throw new Error(`Lemon Squeezy checkout failed: ${response.statusText}`);
  }

  const json = await response.json();
  return {
    checkout_url: json.data?.attributes?.url,
    provider: "lemonsqueezy",
    mode: "live",
  };
}

/**
 * Handle Lemon Squeezy webhook lifecycle events idempotently
 */
export function handleLemonSqueezyWebhookEvent(DB, eventPayload, saveDb) {
  DB.processed_webhooks = DB.processed_webhooks || [];
  DB.subscriptions = DB.subscriptions || {};
  DB.transactions = DB.transactions || [];

  const meta = eventPayload?.meta || {};
  const eventName = meta.event_name;
  const customData = meta.custom_data || {};
  const data = eventPayload?.data || {};
  const attributes = data.attributes || {};

  const eventId =
    meta.event_id || `${eventName}_${data.id || attributes.order_number || Date.now()}`;

  if (DB.processed_webhooks.includes(eventId)) {
    return { status: "already_processed", eventId };
  }

  const userId = customData.user_id;
  const userEmail = (attributes.user_email || attributes.customer_email || "").toLowerCase();
  const user = DB.users.find(
    (u) => (userId && u.id === userId) || (userEmail && u.email?.toLowerCase() === userEmail)
  );

  if (!user) {
    console.warn(`Webhook: no user found for event ${eventName}`, { userId, userEmail });
    DB.processed_webhooks.push(eventId);
    saveDb();
    return { status: "user_not_found", eventId };
  }

  const now = new Date().toISOString();
  const targetPlan =
    customData.plan ||
    (attributes.variant_name?.toLowerCase().includes("team") ? "team" : "pro");
  const targetInterval =
    customData.interval ||
    (attributes.variant_name?.toLowerCase().includes("year") ? "yearly" : "monthly");

  switch (eventName) {
    case "order_created":
    case "subscription_created": {
      user.plan = targetPlan;
      user.subscription = {
        subscription_id: String(data.id || `ls_sub_${Date.now()}`),
        customer_id: String(attributes.customer_id || `ls_cust_${Date.now()}`),
        plan: targetPlan,
        interval: targetInterval,
        status: "active",
        current_period_end:
          attributes.renews_at || new Date(Date.now() + 30 * 86400000).toISOString(),
        renews_at: attributes.renews_at || null,
        cancel_at_period_end: false,
        created_at: now,
        updated_at: now,
      };

      DB.subscriptions[user.id] = user.subscription;
      DB.transactions.unshift({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: user.id,
        event_name: eventName,
        amount: attributes.total || attributes.first_subscription_item?.total || 1900,
        currency: attributes.currency || "USD",
        status: "succeeded",
        invoice_url: attributes.urls?.receipt || null,
        created_at: now,
      });
      break;
    }

    case "subscription_updated": {
      const isCancelled = attributes.cancelled === true;
      const status = attributes.status || (isCancelled ? "cancelled" : "active");

      user.subscription = {
        ...(user.subscription || {}),
        plan: targetPlan,
        status,
        renews_at: attributes.renews_at,
        current_period_end:
          attributes.renews_at || attributes.ends_at || user.subscription?.current_period_end,
        cancel_at_period_end: isCancelled,
        updated_at: now,
      };

      if (status === "expired" || status === "unpaid") {
        user.plan = "free";
      }

      DB.subscriptions[user.id] = user.subscription;
      break;
    }

    case "subscription_cancelled": {
      if (user.subscription) {
        user.subscription.status = "cancelled";
        user.subscription.cancel_at_period_end = true;
        user.subscription.ends_at =
          attributes.ends_at || user.subscription.renews_at || now;
        user.subscription.updated_at = now;
        DB.subscriptions[user.id] = user.subscription;
      }
      break;
    }

    case "subscription_resumed": {
      if (user.subscription) {
        user.subscription.status = "active";
        user.subscription.cancel_at_period_end = false;
        user.subscription.updated_at = now;
        user.plan = user.subscription.plan || "pro";
        DB.subscriptions[user.id] = user.subscription;
      }
      break;
    }

    case "subscription_expired":
    case "subscription_payment_failed": {
      if (eventName === "subscription_expired") {
        user.plan = "free";
        if (user.subscription) {
          user.subscription.status = "expired";
          user.subscription.updated_at = now;
        }
      } else {
        if (user.subscription) {
          user.subscription.status = "past_due";
          user.subscription.updated_at = now;
        }
      }
      DB.transactions.unshift({
        id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        user_id: user.id,
        event_name: eventName,
        amount: attributes.total || 0,
        currency: attributes.currency || "USD",
        status: "failed",
        created_at: now,
      });
      break;
    }

    default:
      console.log(`Unhandled webhook event: ${eventName}`);
  }

  DB.processed_webhooks.push(eventId);
  saveDb();

  return {
    status: "success",
    eventId,
    eventName,
    user_id: user.id,
    plan: user.plan,
  };
}
