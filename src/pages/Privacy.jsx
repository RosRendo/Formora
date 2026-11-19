import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
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
          <span className="font-mono text-xs uppercase tracking-wider text-zinc-500">Privacy &amp; Data Protection</span>
          <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-xs text-zinc-500 font-mono">Last updated: November 19, 2026</p>
        </div>

        <div className="space-y-6 text-sm text-zinc-700 leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">1. Information We Collect</h2>
            <p>
              When you use Skemat (<code>https://skemat.online</code>), we collect minimal information necessary to deliver our services:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-zinc-600">
              <li><strong>Account Information:</strong> Name, email address, and authentication identifiers (e.g. Google OAuth profile ID).</li>
              <li><strong>Project Blueprints:</strong> Architectural specifications, entity schemas, API endpoints, and notes you create within your projects.</li>
              <li><strong>Usage Telemetry:</strong> Log data, browser type, and timestamps strictly for system performance and error monitoring.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">2. Payment Processing &amp; Billing Data</h2>
            <p>
              All payment transactions are processed externally by our Merchant of Record, <strong>Paddle.com</strong>.
              Skemat does not process, store, or have access to your full credit card numbers, CVVs, or sensitive banking details.
              Paddle processes your payment details in accordance with their <a href="https://paddle.com/legal/privacy/" target="_blank" rel="noopener noreferrer" className="underline font-medium text-zinc-900">Privacy Policy</a> and strict PCI-DSS Level 1 compliance.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">3. How We Use Your Data</h2>
            <p>
              Your data is used solely to provide, maintain, and improve the Skemat blueprint engine. We do not sell your personal data or your proprietary
              architectural blueprints to any third parties or advertisers. We do not use your proprietary project designs to train public AI models.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">4. Data Retention &amp; Deletion</h2>
            <p>
              You retain full control over your project blueprints and account data. You can delete projects or export your specifications as plain text Markdown (.md),
              SQL DDL, or Prisma schemas at any time. Upon account deletion requests, your data is permanently purged from our primary database.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-900">5. Contact Information</h2>
            <p>
              If you have any questions or requests regarding your personal data or this Privacy Policy, please reach out to us at <code>privacy@skemat.online</code>.
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
