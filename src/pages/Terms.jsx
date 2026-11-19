import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
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
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">Legal Agreement</span>
          <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
          <p className="text-xs text-zinc-500 font-mono">Last updated: November 19, 2026</p>
        </div>

        <div className="space-y-6 text-sm text-zinc-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">1. Acceptance of Terms</h2>
            <p>
              By accessing, browsing, or using Skemat (accessible at <code>https://skemat.online</code> and <code>https://www.skemat.online</code>),
              you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms,
              you are prohibited from using or accessing this platform.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">2. Service Description &amp; Intellectual Property</h2>
            <p>
              Skemat is a software architecture, database design, and system blueprinting workbench. All blueprints, database schemas, PostgreSQL DDL,
              REST API contracts, and Markdown documentation created or exported by you on the platform remain your sole intellectual property.
              You retain 100% ownership of your engineering designs and generated code.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">3. Accounts &amp; Access</h2>
            <p>
              You are responsible for maintaining the security of your account and credentials. You may not share your account or access with unauthorized
              third parties. Skemat reserves the right to suspend or terminate accounts that violate our security policies or attempt reverse engineering
              or abuse of our infrastructure.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">4. Billing, Subscriptions &amp; Merchant of Record</h2>
            <p>
              Our order process is conducted by our online reseller <strong>Paddle.com</strong>. Paddle.com is the Merchant of Record for all our orders.
              Paddle provides customer service inquiries and handles returns.
            </p>
            <p>
              Paid subscriptions (Pro Builder and Team Studio) are billed on a recurring monthly or annual basis until canceled. You can cancel your
              subscription at any time with one click from your <code>/billing</code> dashboard. Upon cancellation, you will retain full access until the
              end of your current billing period.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">5. Limitation of Liability</h2>
            <p>
              In no event shall Skemat or its operators be liable for any indirect, incidental, special, consequential, or punitive damages,
              including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or inability
              to access the service.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">6. Contact</h2>
            <p>
              For legal inquiries or questions regarding these terms, please contact us at <code>support@skemat.online</code>.
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
