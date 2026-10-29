import { useParams, Link } from "react-router-dom";
import { Route, PenTool, ShieldCheck, FlaskConical, Rocket } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/common";

const PAGES = {
  flows: { title: "User flows", icon: Route, phase: 2, body: "Step-by-step user journeys linked to features and screens.", items: ["Journey diagrams per role", "Entry points and success/failure branches", "Links to features and screens"] },
  ui: { title: "UI/UX blueprint", icon: PenTool, phase: 2, body: "Sitemap, rendered low-fidelity wireframes with desktop and mobile previews, screen and component inventory, design tokens, palette, typography, states and interaction specs.", items: ["Sitemap & navigation hierarchy", "Rendered wireframes (desktop + mobile)", "Design tokens, colors & typography", "Loading / empty / error / success states"] },
  security: { title: "Security plan", icon: ShieldCheck, phase: 2, body: "A checklist covering auth, authorization, validation, secrets, database policies, payments, uploads, rate limiting, logging and backups — separating implemented from planned controls.", items: ["Implemented vs planned controls", "AI security risk review", "Links to endpoints and tasks"] },
  testing: { title: "Testing center", icon: FlaskConical, phase: 2, body: "Test plans linked to features, endpoints and tasks, with AI-generated test cases.", items: ["Unit, integration and E2E plans", "Coverage by feature and endpoint", "Flags when upstream changes"] },
  deployment: { title: "Deployment center", icon: Rocket, phase: 3, body: "Readiness review, environment variable documentation and a step-by-step deployment guide.", items: ["Deployment readiness review", "Environment variable catalog", "Deployment guide export"] },
};

export default function LaterPhase() {
  const { later, pid } = useParams();
  const p = PAGES[later];
  if (!p) return <div className="p-10 text-sm text-muted-foreground">Page not found. <Link to={`/p/${pid}`} className="text-primary">Back to overview</Link></div>;
  return (
    <div className="px-6 md:px-10 py-8 max-w-3xl fade-up">
      <PageHeader eyebrow={`Planned · Phase ${p.phase}`} title={p.title} />
      <EmptyState icon={p.icon} title={`Coming in phase ${p.phase}`} body={p.body} testid={`later-${later}`}>
        <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">{p.items.map((i) => <li key={i} className="flex gap-2"><span className="text-primary">—</span>{i}</li>)}</ul>
        <p className="mt-4 text-xs text-muted-foreground">Nothing here is generated yet, so nothing is shown as done. Continue with the MVP artifacts in the meantime.</p>
      </EmptyState>
    </div>
  );
}
