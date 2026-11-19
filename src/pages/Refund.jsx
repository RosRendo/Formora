import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Refund() {
  return (
    <div className="min-h-screen bg-white text-zinc-900 flex flex-col justify-between">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white/80 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-4xl px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="grid h-6 w-6 place-items-center rounded bg-zinc-900">
              <div className="h-2 w-2 rounded-[2px] border-[1.5px] border-white" />
            </div>
            <span className="font-semibold tracking-tight text-sm">Skemat</span>
          </Link>
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs">
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Back to home</span>
            </Button>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-6 py-12 sm:py-16 space-y-8 flex-1">
        <div className="space-y-2 border-b border-zinc-200 pb-6">
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">Billing Policies</span>
          <h1 className="text-3xl font-bold tracking-tight">Refund &amp; Cancellation Policy</h1>
          <p className="text-xs text-zinc-500 font-mono">Last updated: November 19, 2026</p>
        </div>

        <div className="space-y-6 text-sm text-zinc-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">1. Free Starter Tier</h2>
            <p>
              Skemat offers a fully functional Free Starter tier with access to all 12 software blueprint modules, individual Markdown exports,
              and our semantic architecture engine. We encourage all users to evaluate the platform thoroughly before purchasing a paid tier.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">2. 14-Day Money-Back Guarantee</h2>
            <p>
              If you purchase a paid subscription (Pro Builder or Team Studio) and find that Skemat does not meet your engineering workflow requirements,
              you are entitled to a full refund within <strong>14 calendar days</strong> of your initial purchase date.
            </p>
            <p>
              To request a refund within 14 days, contact our support team at <code>billing@skemat.online</code> or through our Merchant of Record,
              <strong>Paddle.com</strong> at <a href="https://paddle.net" target="_blank" rel="noopener noreferrer" className="underline font-medium text-zinc-900">paddle.net</a>. Please include your order reference number or the email address used during checkout.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">3. Subscription Cancellation</h2>
            <p>
              You may cancel your subscription at any time without fees or penalties:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li>Log in to your account at <code>https://skemat.online/billing</code>.</li>
              <li>Click <strong>"Customer Portal"</strong> to access the self-serve subscription manager.</li>
              <li>Click <strong>"Cancel Subscription"</strong>.</li>
            </ul>
            <p>
              Once canceled, your subscription will not renew. You will retain full access to all Pro or Team features until the end of your current prepaid billing cycle.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">4. Ownership of Exported Work</h2>
            <p>
              Even after a cancellation or refund, all software specifications, PostgreSQL DDL files, Prisma schemas, and Markdown documents exported
              during your active subscription remain yours permanently.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">5. Billing Inquiries &amp; Support</h2>
            <p>
              For any questions regarding charges, receipts, or refund requests, please email <code>billing@skemat.online</code> or contact Paddle support directly at <code>help@paddle.com</code>.
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200 bg-zinc-50 py-6 text-center text-xs text-zinc-500">
        <p>&copy; {new Date().getFullYear()} Skemat (Blueprint OS). All rights reserved.</p>
      </footer>
    </div>
  );
}
