import { useNavigate } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

export default function UpgradeDialog({ open, onOpenChange, reason }) {
  const navigate = useNavigate();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md rounded-lg border hairline bg-card p-6 shadow-xl">
        <AlertDialogHeader className="space-y-2 text-left">
          <div className="font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
            Workspace Quota // Pro Builder
          </div>
          <AlertDialogTitle className="text-xl font-semibold tracking-tight">
            Upgrade for unlimited blueprints
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {reason ||
              "Starter includes 1 active project. Upgrade to Formora Pro for unlimited blueprints, PostgreSQL DDL & Prisma schema exports, and 14-file specification bundles."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-3 rounded-md border hairline bg-muted/25 p-3.5 space-y-2 text-xs text-foreground">
          {[
            "Unlimited active software blueprint projects",
            "PostgreSQL DDL & Prisma schema generators",
            "14 separated Markdown (.md) & CI/CD bundle exports",
            "Multi-model AI Architect & version history",
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-foreground shrink-0" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        <div className="flex items-baseline justify-between px-0.5 font-mono">
          <div>
            <span className="text-2xl font-semibold tracking-tight">$19</span>
            <span className="text-xs text-muted-foreground ml-1">/ month</span>
          </div>
          <span className="rounded border hairline bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground">
            -17% annual
          </span>
        </div>

        <AlertDialogFooter className="mt-4 gap-2 sm:gap-2">
          <AlertDialogCancel onClick={() => onOpenChange(false)} className="h-9 text-xs">
            Cancel
          </AlertDialogCancel>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/billing");
            }}
            className="h-9 gap-1.5 bg-foreground text-background hover:bg-foreground/90 text-xs font-medium"
          >
            <span>View Plans</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
