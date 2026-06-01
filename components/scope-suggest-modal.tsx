"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AiGlyph } from "@/components/ui/ai-glyph";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  suggestBlastRadius,
  updateSubjectProfile,
} from "@/app/app/reviews/[id]/actions";
import {
  BLAST_RADII,
  defaultBlastRadius,
  type BlastRadius,
} from "@/lib/grade-examples";

interface Suggestion {
  radius: BlastRadius;
  rationale: string;
  source: "claude" | "mock";
}

export function ScopeSuggestModal({
  subjectId,
  subjectGrade,
  reviewId,
  open,
  onOpenChange,
  currentOverride,
}: {
  subjectId: string;
  subjectGrade: string | null;
  reviewId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentOverride: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [picked, setPicked] = useState<BlastRadius | null>(
    (currentOverride as BlastRadius | null) ?? null
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setSuggestion(null);
    setError(null);
    suggestBlastRadius(reviewId)
      .then((res) => {
        if (!alive) return;
        setSuggestion(res);
        // Pre-select the AI pick (overrides previous picked value).
        setPicked(res.radius);
      })
      .catch((e) => {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Suggestion failed.");
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [open, reviewId]);

  const gradeDefault = defaultBlastRadius(subjectGrade);

  function handleSave() {
    if (!picked) return;
    startTransition(async () => {
      try {
        await updateSubjectProfile(subjectId, { effectiveBlastRadius: picked });
        router.refresh();
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  function handleReset() {
    startTransition(async () => {
      try {
        await updateSubjectProfile(subjectId, { effectiveBlastRadius: null });
        router.refresh();
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Effective scope</DialogTitle>
          <DialogDescription>
            The scope they're actually operating at — inferred from the evidence. Override the grade default if needed.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-lg border border-dashed border-muted-foreground/25 p-4 space-y-2"
          >
            <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <AiGlyph className="size-3.5 animate-pulse motion-reduce:animate-none" />
              <span>Reading the evidence…</span>
            </div>
            <div className="space-y-1.5">
              <div className="h-3 w-full rounded bg-muted animate-pulse motion-reduce:animate-none" />
              <div className="h-3 w-11/12 rounded bg-muted animate-pulse motion-reduce:animate-none" />
              <div className="h-3 w-2/3 rounded bg-muted animate-pulse motion-reduce:animate-none" />
            </div>
          </div>
        )}

        {suggestion && !loading && (
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300 ease-out">
            <div className="flex items-center gap-2 text-[13px]">
              <AiGlyph className="size-3.5" />
              <span className="font-medium">
                Suggested {suggestion.radius}
              </span>
            </div>
            <p className="text-[14px] text-muted-foreground leading-[1.55]">
              {suggestion.rationale}
            </p>
          </div>
        )}

        {!loading && (
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Choose
            </p>
            <div className="flex flex-wrap gap-2">
              {BLAST_RADII.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setPicked(r)}
                  className={cn(
                    "px-3 py-1.5 rounded-md border bg-background text-sm transition-colors",
                    "hover:bg-muted/50",
                    picked === r &&
                      "bg-foreground text-background border-foreground hover:bg-foreground/90"
                  )}
                >
                  {r}
                  {gradeDefault === r && (
                    <span
                      className={cn(
                        "ml-1.5 text-[10px] opacity-70",
                        picked === r ? "" : "text-muted-foreground"
                      )}
                    >
                      grade default
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {currentOverride && (
            <Button
              variant="ghost"
              onClick={handleReset}
              disabled={pending || loading}
              className="mr-auto"
            >
              Reset to grade default
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending || loading || !picked}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
