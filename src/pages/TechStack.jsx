import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Layers } from "lucide-react";
import { http } from "@/lib/api";
import { NODE_TYPES } from "@/lib/arch";
import { useProject } from "@/context/ProjectContext";
import { EmptyState, PageHeader, PageLoading } from "@/components/common";

export default function TechStack() {
  const { pid } = useProject();
  const [data, setData] = useState(null);
  useEffect(() => {
    const fetchStack = () =>
      Promise.all([http.get(`/projects/${pid}/artifacts/architecture`), http.get(`/projects/${pid}/artifacts/brief`)])
        .then(([a, b]) => setData({ nodes: a.data.content?.nodes || [], brief: b.data.content, status: a.data.artifact.status }));
    fetchStack();
    const onArt = (e) => {
      if (e.detail?.kind === "architecture" || e.detail?.kind === "brief") fetchStack();
    };
    window.addEventListener("bp:artifact", onArt);
    return () => window.removeEventListener("bp:artifact", onArt);
  }, [pid]);
  if (!data) return <PageLoading />;
  const prefs = data.brief ? [["Languages", data.brief.languages], ["Hosting", data.brief.hosting], ["Database", data.brief.database], ["Auth", data.brief.auth], ["Payments", data.brief.payments]] : [];
  return (
    <div className="px-6 md:px-10 py-8 max-w-5xl fade-up">
      <PageHeader eyebrow="Engineer" title="Tech stack" description="Every selected technology and why it was chosen. Derived from the architecture so the two never drift apart." />
      {prefs.length > 0 && (
        <div className="mb-10">
          <div className="eyebrow mb-3">Preferences from the brief</div>
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">{prefs.map(([k, v]) => <div key={k}><span className="text-muted-foreground mr-2">{k}</span>{v}</div>)}</div>
        </div>
      )}
      {!data.nodes.length ? (
        <EmptyState icon={Layers} title="No technologies selected yet" body="Technologies come from architecture components. Create the architecture first.">
          <Link to={`/p/${pid}/architecture`} className="text-sm text-primary" data-testid="stack-go-architecture">Open architecture →</Link>
        </EmptyState>
      ) : (
        <div className="divide-y divide-border/60" data-testid="tech-stack-list">
          {data.nodes.map((n) => {
            const t = NODE_TYPES[n.type] || NODE_TYPES.external_api;
            return (
              <div key={n.id} className="grid gap-2 py-5 md:grid-cols-[220px_1fr]" data-testid={`stack-item-${n.id}`}>
                <div className="flex items-start gap-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md" style={{ background: `${t.tint}1a`, color: t.tint }}><t.icon className="h-4 w-4" /></span>
                  <div><div className="font-mono text-sm font-medium">{n.technology || "—"}</div><div className="text-xs text-muted-foreground">{n.name} · {t.label}</div></div>
                </div>
                <div className="text-sm space-y-1">
                  <p>{n.responsibility}</p>
                  <p className="text-muted-foreground"><span className="eyebrow mr-2">Why</span>{n.rationale || <span className="italic">No rationale recorded — add one in the architecture editor.</span>}</p>
                  {Object.keys(n.config || {}).length > 0 && <p className="font-mono text-[11px] text-muted-foreground">{Object.entries(n.config).map(([k, v]) => `${k}=${v}`).join("  ")}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
