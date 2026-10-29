import { Button } from "@/components/ui/button";

export function EmptyState({ icon: Icon, title, body, action, onAction, testid = "empty-state", children }) {
  return (
    <div className="flex flex-col items-start gap-3 py-16 max-w-md fade-up" data-testid={testid}>
      {Icon && <div className="grid h-10 w-10 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon className="h-5 w-5" /></div>}
      <h3 className="text-base font-semibold tracking-tight">{title}</h3>
      {body && <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>}
      {action && <Button size="sm" onClick={onAction} data-testid={`${testid}-action`}>{action}</Button>}
      {children}
    </div>
  );
}

export function PageLoading() {
  return (
    <div className="p-6 md:p-8 space-y-3" data-testid="page-loading">
      {[60, 90, 75, 40].map((w, i) => <div key={i} className="h-4 rounded bg-muted animate-pulse" style={{ width: `${w}%` }} />)}
    </div>
  );
}

export function PageError({ message, onRetry }) {
  return (
    <div className="p-8" data-testid="page-error">
      <p className="text-sm text-destructive mb-3">{message}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Retry</Button>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, children }) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between pb-6">
      <div className="min-w-0">
        {eyebrow && <div className="eyebrow mb-2">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight" data-testid="page-title">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted-foreground max-w-2xl">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}
