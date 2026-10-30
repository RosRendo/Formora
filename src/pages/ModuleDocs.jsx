import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  FolderCode,
  FileText,
  Copy,
  Download,
  ArrowUpRight,
  Save,
  Check,
  Database,
  Braces,
  Network,
  ListChecks,
  FileSignature,
  Map as MapIcon,
  ScrollText,
  Sparkles,
  Route as RouteIcon,
  PenTool,
  ShieldCheck,
  FlaskConical,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { http, errMsg, download } from "@/lib/api";
import { useProject } from "@/context/ProjectContext";
import { PageError, PageHeader, PageLoading } from "@/components/common";

const DOC_ICONS = {
  brief: FileSignature,
  spec: FileText,
  features: ListChecks,
  architecture: Network,
  schema: Database,
  api: Braces,
  roadmap: MapIcon,
  decisions: ScrollText,
  notes: Sparkles,
  flows: RouteIcon,
  ui: PenTool,
  security: ShieldCheck,
  testing: FlaskConical,
};

function InlineMd({ text }) {
  if (!text) return null;
  const tokens = String(text).split(/(\*\*[^*]+\*\*|`[^`]+`|\*[^*]+\*)/g);
  return tokens.map((tok, idx) => {
    if (tok.startsWith("**") && tok.endsWith("**")) {
      return <strong key={idx} className="font-semibold text-foreground">{tok.slice(2, -2)}</strong>;
    }
    if (tok.startsWith("`") && tok.endsWith("`")) {
      return (
        <code key={idx} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11.5px] text-primary">
          {tok.slice(1, -1)}
        </code>
      );
    }
    if (tok.startsWith("*") && tok.endsWith("*") && tok.length > 2) {
      return <em key={idx} className="italic">{tok.slice(1, -1)}</em>;
    }
    return <span key={idx}>{tok}</span>;
  });
}

function MarkdownPreview({ md }) {
  const lines = (md || "").split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const lang = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(
        <div key={`code-${i}`} className="my-3 overflow-hidden rounded-lg border hairline bg-muted/45">
          {lang && (
            <div className="border-b hairline bg-muted/60 px-3 py-1 font-mono text-[10px] uppercase text-muted-foreground">
              {lang}
            </div>
          )}
          <pre className="overflow-x-auto p-3.5 font-mono text-[11.5px] leading-relaxed text-foreground/90">
            {codeLines.join("\n")}
          </pre>
        </div>
      );
      continue;
    }

    // GFM Pipe Table
    if (line.trim().startsWith("|") && lines[i + 1]?.trim().startsWith("|")) {
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        tableLines.push(lines[i]);
        i++;
      }
      const parseRow = (r) =>
        r
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((c) => c.trim());
      const headers = parseRow(tableLines[0]);
      const bodyRows = tableLines.slice(2).map(parseRow);
      blocks.push(
        <div key={`tbl-${i}`} className="my-3 overflow-x-auto rounded-lg border hairline">
          <table className="w-full text-left text-[12.5px]">
            <thead className="border-b hairline bg-muted/50 text-xs font-semibold">
              <tr>
                {headers.map((h, hi) => (
                  <th key={hi} className="px-3 py-2">
                    <InlineMd text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {bodyRows.map((row, ri) => (
                <tr key={ri} className="hover:bg-muted/25">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-3 py-2 align-top text-foreground/90">
                      <InlineMd text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    // Horizontal Rule
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={`hr-${i}`} className="my-5 border-border/70" />);
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={`h1-${i}`} className="text-xl font-semibold tracking-tight mt-2 mb-3">
          <InlineMd text={line.slice(2)} />
        </h1>
      );
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={`h2-${i}`} className="text-[15px] font-semibold tracking-tight mt-6 mb-2 border-b hairline pb-1.5">
          <InlineMd text={line.slice(3)} />
        </h2>
      );
      i++;
      continue;
    }
    if (line.startsWith("### ")) {
      blocks.push(
        <h3 key={`h3-${i}`} className="text-[13.5px] font-semibold mt-4 mb-1.5">
          <InlineMd text={line.slice(4)} />
        </h3>
      );
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith("> ")) {
      const quoteLines = [];
      while (i < lines.length && lines[i].startsWith("> ")) {
        quoteLines.push(lines[i].slice(2));
        i++;
      }
      blocks.push(
        <blockquote
          key={`bq-${i}`}
          className="my-3 rounded-r-md border-l-2 border-primary bg-accent/40 px-3.5 py-2 text-[12.5px] text-muted-foreground space-y-1"
        >
          {quoteLines.map((ql, qi) => (
            <div key={qi}>
              <InlineMd text={ql} />
            </div>
          ))}
        </blockquote>
      );
      continue;
    }

    // Bullet / Checklist items
    if (/^\s*-\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        items.push(lines[i]);
        i++;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="my-2 space-y-1.5 text-[13px]">
          {items.map((raw, li) => {
            const indent = raw.match(/^\s*/)[0].length;
            const body = raw.replace(/^\s*-\s+/, "");
            const checkMatch = body.match(/^\[([ xX])\]\s+(.*)$/);
            return (
              <li
                key={li}
                style={{ paddingLeft: indent > 0 ? `${Math.min(indent * 6, 28)}px` : undefined }}
                className="flex items-start gap-2 leading-relaxed"
              >
                {checkMatch ? (
                  <>
                    <span
                      className={`mt-1 grid h-3.5 w-3.5 shrink-0 place-items-center rounded border text-[9px] ${
                        checkMatch[1].toLowerCase() === "x"
                          ? "border-primary bg-primary text-primary-foreground"
                          : "hairline bg-card"
                      }`}
                    >
                      {checkMatch[1].toLowerCase() === "x" && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="flex-1">
                      <InlineMd text={checkMatch[2]} />
                    </span>
                  </>
                ) : (
                  <>
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span className="flex-1">
                      <InlineMd text={body} />
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      );
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="my-2 text-[13.5px] leading-relaxed text-foreground/90">
        <InlineMd text={line} />
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{blocks}</div>;
}

export default function ModuleDocs() {
  const { pid, project } = useProject();
  const [modules, setModules] = useState([]);
  const [selectedKind, setSelectedKind] = useState("schema");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await http.get(`/projects/${pid}/docs`);
      setModules(data.modules || []);
      setError(null);
      setLoading(false);
    } catch (e) {
      setError(errMsg(e));
      setLoading(false);
    }
  }, [pid]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onUpdate = () => load();
    window.addEventListener("bp:artifact", onUpdate);
    window.addEventListener("bp:docs-updated", onUpdate);
    return () => {
      window.removeEventListener("bp:artifact", onUpdate);
      window.removeEventListener("bp:docs-updated", onUpdate);
    };
  }, [load]);

  const active = modules.find((m) => m.kind === selectedKind) || modules[0];

  useEffect(() => {
    setNoteDraft(active?.notes || "");
  }, [active?.kind, active?.notes]);

  if (loading) return <PageLoading />;
  if (error) return <PageError message={error} onRetry={load} />;

  const slug = (project?.name || "blueprint").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const copyMd = (mod) => {
    navigator.clipboard.writeText(mod.markdown).then(() => toast.success(`Copied ${mod.filename}`));
  };

  const downloadSingle = (mod) => {
    download(`${slug}-${mod.filename}`, mod.markdown, "text/markdown");
    toast.success(`Downloaded ${mod.filename}`);
  };

  const downloadAllSeparate = () => {
    modules.forEach((mod, idx) => {
      setTimeout(() => download(`${slug}-${mod.filename}`, mod.markdown, "text/markdown"), idx * 140);
    });
    toast.success(`Downloading ${modules.length} separate module .md files`);
  };

  const saveNotes = async () => {
    if (!active) return;
    setSavingNote(true);
    try {
      const { data } = await http.put(`/projects/${pid}/docs/${active.kind}`, { notes: noteDraft });
      setModules(data.modules || []);
      toast.success(`Saved notes to ${active.filename}`);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSavingNote(false);
    }
  };

  return (
    <div className="px-6 md:px-10 py-8 max-w-6xl fade-up">
      <PageHeader
        eyebrow="Separated Documentation"
        title="Module Docs (.md)"
        description="Every domain has its own focused Markdown specification — Database, API, Architecture, PRD, Features, and Roadmap stay cleanly separated instead of one giant unreadable .md file."
      >
        <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={downloadAllSeparate} data-testid="docs-download-all-btn">
          <Download className="h-3.5 w-3.5" />
          Download all ({modules.length} .md files)
        </Button>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Separate .md File Tree */}
        <div className="space-y-1" data-testid="module-docs-list">
          <div className="eyebrow px-2.5 pb-1.5 flex items-center gap-1.5">
            <FolderCode className="h-3.5 w-3.5 text-primary" />
            <span>{slug}/docs/</span>
          </div>
          {modules.map((m) => {
            const Icon = DOC_ICONS[m.kind] || FileText;
            const isSel = active?.kind === m.kind;
            return (
              <button
                key={m.kind}
                type="button"
                onClick={() => setSelectedKind(m.kind)}
                data-testid={`module-doc-${m.kind}`}
                className={`group flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-all ${
                  isSel
                    ? "border-primary/50 bg-accent text-accent-foreground"
                    : "border-transparent hover:bg-muted/70 text-foreground"
                }`}
              >
                <Icon className={`h-4 w-4 shrink-0 ${isSel ? "text-primary" : "text-muted-foreground"}`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12px] font-medium">{m.filename}</div>
                  <div className="truncate text-[11px] text-muted-foreground">
                    {m.title} · {m.countLabel}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Module .md Viewer */}
        {active && (
          <div className="min-w-0 rounded-xl border hairline bg-card overflow-hidden" data-testid="module-doc-viewer">
            <div className="flex flex-wrap items-center gap-2 border-b hairline bg-muted/35 px-4 py-3">
              <span className="font-mono text-xs font-semibold text-primary">{active.filename}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
                v{active.version} · {active.countLabel}
              </span>
              <div className="flex-1" />
              {active.visualPath !== "" && (
                <Link
                  to={`/p/${pid}/${active.visualPath}`}
                  className="inline-flex h-7 items-center gap-1 rounded-md border hairline bg-card px-2.5 text-xs font-medium hover:border-primary/50 hover:text-primary transition-colors"
                  data-testid="doc-open-visual-btn"
                >
                  Open Visual Panel
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </Link>
              )}
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => copyMd(active)} data-testid="doc-copy-btn">
                <Copy className="h-3 w-3" />
                Copy .md
              </Button>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => downloadSingle(active)} data-testid="doc-download-btn">
                <Download className="h-3 w-3" />
                {active.filename}
              </Button>
            </div>

            <Tabs defaultValue="preview" className="p-4">
              <TabsList>
                <TabsTrigger value="preview" data-testid="doc-tab-preview">Formatted Preview</TabsTrigger>
                <TabsTrigger value="raw" data-testid="doc-tab-raw">Raw Markdown</TabsTrigger>
                <TabsTrigger value="notes" data-testid="doc-tab-notes">Module Notes</TabsTrigger>
              </TabsList>

              <TabsContent value="preview" className="pt-4 px-1" data-testid="doc-rendered-preview">
                <MarkdownPreview md={active.markdown} />
              </TabsContent>

              <TabsContent value="raw" className="pt-3">
                <pre
                  className="max-h-[65vh] overflow-auto rounded-lg border hairline bg-muted/35 p-4 font-mono text-[11.5px] leading-relaxed"
                  data-testid="doc-raw-markdown"
                >
                  {active.markdown}
                </pre>
              </TabsContent>

              <TabsContent value="notes" className="pt-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Attach custom markdown notes, architectural constraints, or implementation caveats specifically to{" "}
                  <code className="font-mono text-foreground">{active.filename}</code>.
                </p>
                <Textarea
                  className="min-h-[220px] font-mono text-xs"
                  placeholder={`Write module-specific Markdown notes for ${active.filename}…`}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  data-testid="doc-notes-textarea"
                />
                <Button
                  size="sm"
                  onClick={saveNotes}
                  disabled={savingNote || noteDraft === (active.notes || "")}
                  className="gap-1.5"
                  data-testid="doc-save-notes-btn"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save to {active.filename}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}

