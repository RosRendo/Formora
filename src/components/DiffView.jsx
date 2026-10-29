import { useMemo, useState } from "react";
import { diffContent } from "@/lib/diff";

export default function DiffView({ before, after, refs, testid = "diff-view", maxHeight = "60vh" }) {
  const [onlyChanges, setOnlyChanges] = useState(true);
  const lines = useMemo(() => diffContent(before, after, refs), [before, after, refs]);
  const added = lines.filter((l) => l.t === "+").length;
  const removed = lines.filter((l) => l.t === "-").length;
  const shown = onlyChanges
    ? lines.filter((l, i) => l.t !== "=" || lines.slice(Math.max(0, i - 2), i + 3).some((x) => x.t !== "="))
    : lines;
  return (
    <div data-testid={testid}>
      <div className="flex items-center gap-3 pb-2 text-xs">
        <span className="font-mono text-[hsl(var(--success))]" data-testid={`${testid}-added`}>+{added}</span>
        <span className="font-mono text-destructive" data-testid={`${testid}-removed`}>−{removed}</span>
        <div className="flex-1" />
        <button className="text-muted-foreground hover:text-foreground" onClick={() => setOnlyChanges(!onlyChanges)} data-testid={`${testid}-toggle`}>
          {onlyChanges ? "Show all lines" : "Only changes"}
        </button>
      </div>
      <pre className="overflow-auto rounded-md border hairline bg-muted/30 py-2 text-[11.5px] leading-[1.6] font-mono" style={{ maxHeight }}>
        {!added && !removed && <div className="px-3 text-muted-foreground">No differences.</div>}
        {shown.map((l, i) => (
          <div key={i} className={l.t === "+" ? "bg-[hsl(var(--success)/0.12)] text-[hsl(var(--success))]" : l.t === "-" ? "bg-destructive/10 text-destructive line-through decoration-destructive/40" : "text-muted-foreground"}>
            <span className="inline-block w-5 select-none text-center opacity-60">{l.t === "=" ? " " : l.t}</span>
            <span className="whitespace-pre-wrap">{l.s}</span>
          </div>
        ))}
      </pre>
    </div>
  );
}
