import { useState } from "react";
import { Plus, X } from "lucide-react";

export default function ListEditor({ items = [], onChange, placeholder = "Add item…", testid = "list", mono = false }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (!v) return;
    onChange([...items, v]);
    setDraft("");
  };
  return (
    <div className="space-y-1" data-testid={testid}>
      {items.map((it, i) => (
        <div key={i} className="group flex items-start gap-2">
          <span className="mt-[11px] h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
          <input
            className={`inline-input text-sm ${mono ? "font-mono text-xs" : ""}`}
            value={it}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))}
            data-testid={`${testid}-item-${i}`}
          />
          <button className="mt-1.5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove" data-testid={`${testid}-remove-${i}`}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Plus className="h-3 w-3 shrink-0" />
        <input
          className="inline-input text-sm placeholder:text-muted-foreground/60"
          placeholder={placeholder}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          onBlur={add}
          data-testid={`${testid}-add-input`}
        />
      </div>
    </div>
  );
}
