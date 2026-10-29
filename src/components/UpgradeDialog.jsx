import { useNavigate } from "react-router-dom";
import { Sparkles, Check, ArrowRight, ShieldCheck, Zap } from "lucide-react";
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

export default function UpgradeDialog({ open, onOpenChange, reason, currentPlan = "free" }) {
  const navigate = useNavigate();

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md p-6 border shadow-2xl rounded-2xl bg-card">
        <AlertDialogHeader className="space-y-3 text-left">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <AlertDialogTitle className="text-xl font-semibold tracking-tight">
              Unlock Unlimited Blueprints with Pro
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
              {reason ||
                "Your Starter plan is limited to 1 active project. Upgrade to Formora Pro to craft unlimited blueprints, export complete PostgreSQL & Prisma schemas, and access high-speed AI architecture."}
            </AlertDialogDescription>
          </div>
        </AlertDialogHeader>

        <div className="my-3 rounded-xl border hairline bg-muted/30 p-3.5 space-y-2.5 text-xs text-foreground/90">
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span><b>Unlimited</b> active software blueprint projects</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span><b>Production DDL & Prisma</b> schema generator</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span><b>Modular Markdown (.md)</b> 9-module bulk zip exports</span>
          </div>
          <div className="flex items-center gap-2">
            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span><b>Priority AI Architect</b> semantic router</span>
          </div>
        </div>

        <div className="flex items-baseline justify-between py-1 px-1">
          <div>
            <span className="text-2xl font-bold tracking-tight">$19</span>
            <span className="text-xs text-muted-foreground ml-1">/ month</span>
          </div>
          <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
            Save 17% with annual billing
          </span>
        </div>

        <AlertDialogFooter className="mt-4 gap-2 sm:gap-2">
          <AlertDialogCancel onClick={() => onOpenChange(false)} className="rounded-lg">
            Maybe later
          </AlertDialogCancel>
          <Button
            onClick={() => {
              onOpenChange(false);
              navigate("/billing");
            }}
            className="gap-2 rounded-lg font-medium shadow-sm"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span>View Plans & Upgrade</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
