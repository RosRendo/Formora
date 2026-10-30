import { useNavigate } from "react-router-dom";
import { Download, FileText, FolderCode } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { http, errMsg, download } from "@/lib/api";
import { useProject } from "@/context/ProjectContext";

const SEPARATE_MDS = [
  ["brief", "01-brief.md"],
  ["spec", "02-requirements.md"],
  ["features", "03-features.md"],
  ["architecture", "04-architecture.md"],
  ["schema", "05-database.md"],
  ["api", "06-api.md"],
  ["roadmap", "07-roadmap.md"],
  ["flows", "10-user-flows.md"],
  ["ui", "11-ui-blueprint.md"],
  ["security", "12-security-plan.md"],
  ["testing", "13-testing-plan.md"],
  ["deployment", "14-deployment-guide.md"],
];

export default function ExportMenu() {
  const { pid, project } = useProject();
  const nav = useNavigate();
  const slug = (project?.name || "blueprint").toLowerCase().replace(/[^a-z0-9]+/g, "-");

  const run = async (what, docKind, filename) => {
    try {
      if (what === "module_md") {
        const { data } = await http.get(`/projects/${pid}/export/markdown/${docKind}`, { responseType: "text" });
        download(`${slug}-${filename}`, data, "text/markdown");
      } else if (what === "md") {
        const { data } = await http.get(`/projects/${pid}/export/markdown`, { responseType: "text" });
        download(`${slug}-blueprint.md`, data, "text/markdown");
      } else {
        const { data } = await http.get(`/projects/${pid}/schema/code`);
        what === "sql" ? download(`${slug}-schema.sql`, data.sql) : download(`schema.prisma`, data.prisma);
      }
      toast.success("Export downloaded");
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1.5" data-testid="export-menu-btn">
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => nav(`/p/${pid}/docs`)} data-testid="export-open-docs-btn">
          <FolderCode className="h-4 w-4 mr-2 text-primary" />
          Browse separate .md docs
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] text-muted-foreground font-normal">
          Separate module .md files
        </DropdownMenuLabel>
        {SEPARATE_MDS.map(([kind, file]) => (
          <DropdownMenuItem
            key={kind}
            onClick={() => run("module_md", kind, file)}
            className="font-mono text-xs"
            data-testid={`export-md-${kind}`}
          >
            {file}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => run("sql")} data-testid="export-sql-btn">
          PostgreSQL DDL (.sql)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("prisma")} data-testid="export-prisma-btn">
          Prisma schema (.prisma)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => run("md")} data-testid="export-markdown-btn">
          <FileText className="h-4 w-4 mr-2" />
          Combined blueprint (.md)
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
