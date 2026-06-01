"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ClipboardList,
  Compass,
  Loader2,
  Pencil,
  Plus,
  Sprout,
  Trash2,
} from "lucide-react";
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
  addEvidenceEntry,
  deleteEvidenceEntry,
  updateEvidenceEntry,
  type EvidenceType,
} from "@/app/app/reviews/[id]/actions";

export interface EvidenceEntry {
  id: string;
  body: string;
  type: string; // POSITIVE | CONCERN
  aiGenerated: boolean;
  createdAt: Date;
  authorId: string;
  authorName?: string | null;
  authorEmail?: string;
}

function authorInitials(e: EvidenceEntry): string {
  const source = e.authorName ?? e.authorEmail ?? "";
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

const EMPTY_PRESETS: Record<
  EvidenceDimension,
  { icon: React.ComponentType<{ className?: string }>; headline: (firstName: string) => string; helper: string; cta: string }
> = {
  WHAT: {
    icon: ClipboardList,
    headline: (n) => `Nothing logged for ${n} yet`,
    helper:
      "Best entries cite what shipped, who it helped, and what changed because of it.",
    cta: "Add the first entry",
  },
  HOW: {
    icon: Compass,
    headline: (n) => `Nothing logged for ${n} yet`,
    helper:
      "Look for moments when the work was hard and they handled it well — or didn't.",
    cta: "Add the first entry",
  },
  GROWTH: {
    icon: Sprout,
    headline: (n) => `No growth notes for ${n} yet`,
    helper:
      "Pull threads from the WHAT and HOW timelines — what could they do differently next half?",
    cta: "Add the first note",
  },
};

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export type EvidenceDimension = "WHAT" | "HOW" | "GROWTH";

export function EvidenceTimeline({
  reviewId,
  dimension,
  entries,
  disabled,
  currentUserId,
  subjectFirstName,
  showConcernToggle = true,
  addLabel = "Add entry",
}: {
  reviewId: string;
  dimension: EvidenceDimension;
  entries: EvidenceEntry[];
  disabled: boolean;
  currentUserId: string;
  subjectFirstName: string;
  showConcernToggle?: boolean;
  addLabel?: string;
}) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<EvidenceEntry | null>(null);
  const [pendingDeletes, setPendingDeletes] = useState<Set<string>>(new Set());

  async function handleDelete(entry: EvidenceEntry) {
    // Optimistic: hide immediately, fire server delete, toast with Undo.
    setPendingDeletes((s) => new Set(s).add(entry.id));
    try {
      await deleteEvidenceEntry(entry.id);
      toast.success("Entry deleted", {
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await addEvidenceEntry(
                reviewId,
                dimension,
                entry.body,
                (entry.type as EvidenceType) ?? "POSITIVE",
                entry.aiGenerated
              );
              router.refresh();
            } catch (e) {
              toast.error(
                e instanceof Error ? e.message : "Couldn't restore the entry."
              );
            }
          },
        },
      });
      router.refresh();
    } catch (e) {
      // Server delete failed — revert the optimistic hide.
      setPendingDeletes((s) => {
        const next = new Set(s);
        next.delete(entry.id);
        return next;
      });
      toast.error(e instanceof Error ? e.message : "Couldn't delete the entry.");
    }
  }

  const visibleEntries = entries.filter((e) => !pendingDeletes.has(e.id));
  const isEmpty = visibleEntries.length === 0;
  const preset = EMPTY_PRESETS[dimension];

  return (
    <div>
      {!disabled && !isEmpty && (
        <div className="flex items-center mb-4">
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground hover:text-foreground/80 transition-colors px-2 py-1 -ml-2 rounded-md hover:bg-muted/60"
          >
            <Plus className="size-4" />
            {addLabel}
          </button>
        </div>
      )}

      {isEmpty ? (
        <div className="rounded-lg border border-dashed border-border/70 px-6 py-10 text-center">
          <preset.icon
            className="size-5 text-muted-foreground mx-auto mb-3"
            aria-hidden
          />
          <p className="text-[15px] font-medium text-foreground">
            {preset.headline(subjectFirstName)}
          </p>
          <p className="text-[13px] text-muted-foreground mt-1.5 max-w-[420px] mx-auto leading-[1.55]">
            {preset.helper}
          </p>
          {!disabled && (
            <Button
              size="sm"
              variant="default"
              className="mt-5"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="size-4" />
              {preset.cta}
            </Button>
          )}
        </div>
      ) : (
        <ol className="space-y-0" role="list">
          {visibleEntries.map((e, idx) => {
            const isLast = idx === visibleEntries.length - 1;
            const canEdit = !disabled && e.authorId === currentUserId;
            const isConcern = e.type === "CONCERN";
            return (
              <li key={e.id} className="group flex gap-4">
                <div className="flex flex-col items-center pt-1">
                  {/* Author avatar OR AI glyph */}
                  {e.aiGenerated ? (
                    <div
                      aria-label="AI-drafted entry"
                      className="size-6 rounded-full bg-[--color-ai]/10 flex items-center justify-center shrink-0"
                    >
                      <AiGlyph className="size-3" />
                    </div>
                  ) : (
                    <div
                      aria-label={
                        isConcern ? "Concern entry" : "Positive entry"
                      }
                      className={cn(
                        "size-6 flex items-center justify-center shrink-0 text-[10px] font-medium",
                        isConcern
                          ? "bg-[--color-attention]/15 text-[--color-attention] rounded-sm ring-1 ring-[--color-attention]/30"
                          : "bg-muted text-muted-foreground rounded-full"
                      )}
                    >
                      {authorInitials(e)}
                    </div>
                  )}
                  {!isLast && (
                    <div className="w-px flex-1 bg-border/70 mt-2 min-h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0 pb-8">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-wrap">
                      <p className="text-[12px] font-medium text-muted-foreground tabular-nums">
                        {DATE_FMT.format(e.createdAt)}
                      </p>
                      {isConcern && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[--color-attention] bg-[--color-attention]/10 px-1.5 py-0.5 rounded">
                          <AlertTriangle className="size-3" aria-hidden />
                          Concern
                        </span>
                      )}
                      {e.aiGenerated && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[--color-ai] bg-[--color-ai]/10 px-1.5 py-0.5 rounded">
                          AI-drafted
                        </span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-0.5 opacity-40 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-150 [@media(hover:none)]:opacity-100">
                        <button
                          type="button"
                          onClick={() => setEditing(e)}
                          aria-label="Edit entry"
                          className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(e)}
                          aria-label="Delete entry"
                          className="inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="text-[15px] mt-1.5 whitespace-pre-wrap leading-[1.6]">
                    {e.body}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <EvidenceModal
        open={addOpen}
        onOpenChange={setAddOpen}
        mode="add"
        reviewId={reviewId}
        dimension={dimension}
        showConcernToggle={showConcernToggle}
      />
      {editing && (
        <EvidenceModal
          key={editing.id}
          open={true}
          onOpenChange={(o) => !o && setEditing(null)}
          mode="edit"
          reviewId={reviewId}
          dimension={dimension}
          entry={editing}
          showConcernToggle={showConcernToggle}
        />
      )}
    </div>
  );
}


export function EvidenceModal({
  open,
  onOpenChange,
  mode,
  reviewId,
  dimension,
  entry,
  showConcernToggle = true,
  defaultBody,
  aiGenerated = false,
  titleOverride,
  descriptionOverride,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  reviewId: string;
  dimension: EvidenceDimension;
  entry?: EvidenceEntry;
  showConcernToggle?: boolean;
  defaultBody?: string;
  aiGenerated?: boolean;
  titleOverride?: string;
  descriptionOverride?: string;
}) {
  const router = useRouter();
  const [body, setBody] = useState(entry?.body ?? defaultBody ?? "");
  const [type, setType] = useState<EvidenceType>(
    (entry?.type as EvidenceType) ?? "POSITIVE"
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    const trimmed = body.trim();
    if (!trimmed) {
      setError("Entry can't be empty.");
      return;
    }
    startTransition(async () => {
      try {
        if (mode === "add") {
          await addEvidenceEntry(reviewId, dimension, trimmed, type, aiGenerated);
          setBody(""); // reset for next add
          setType("POSITIVE");
        } else if (entry) {
          await updateEvidenceEntry(entry.id, trimmed, type);
        }
        router.refresh();
        onOpenChange(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  const defaultTitle =
    mode === "add"
      ? `New ${dimension === "WHAT" ? "What" : dimension === "HOW" ? "How" : "Growth"} entry`
      : `Edit entry`;
  const title = titleOverride ?? defaultTitle;
  const defaultDescription =
    mode === "add"
      ? "Capture what you saw — what shipped, what changed, what you'd cite if asked."
      : "Update what you wrote.";
  const description = descriptionOverride ?? defaultDescription;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          setBody(mode === "add" ? defaultBody ?? "" : entry?.body ?? "");
          setError(null);
        }
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={7}
          placeholder="Write your entry..."
          autoFocus
          className={cn(
            "w-full rounded-md border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent resize-y"
          )}
        />

        {showConcernToggle && (
          <label className="flex items-center gap-2 cursor-pointer select-none text-[13px]">
            <input
              type="checkbox"
              checked={type === "CONCERN"}
              onChange={(e) =>
                setType(e.target.checked ? "CONCERN" : "POSITIVE")
              }
              className="size-4 rounded border-border accent-[--color-attention]"
            />
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle
                className={cn(
                  "size-3.5",
                  type === "CONCERN"
                    ? "text-[--color-attention]"
                    : "text-muted-foreground/50"
                )}
                aria-hidden
              />
              Mark as a concern
            </span>
          </label>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {mode === "add" ? "Add entry" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
