"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Check, Pencil } from "lucide-react";
import { AiGlyph } from "@/components/ui/ai-glyph";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  generateRatingSuggestion,
  saveManagerReview,
  suggestGrowthDraft,
} from "@/app/app/reviews/[id]/actions";
import {
  EditPersonModal,
  EditContextModal,
} from "@/components/subject-edit-modals";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RubricToc } from "@/components/rubric-toc";
import {
  EvidenceTimeline,
  EvidenceModal,
  type EvidenceEntry,
} from "@/components/evidence-timeline";
import { GradeExampleHint } from "@/components/grade-example-hint";
import { ScopeSuggestModal } from "@/components/scope-suggest-modal";
import { effectiveBlastRadius } from "@/lib/grade-examples";

type Rating = "STAND_OUT" | "ACHIEVER" | "NEEDS_IMPROVEMENT";

const RATINGS: { value: Rating; label: string }[] = [
  { value: "NEEDS_IMPROVEMENT", label: "Needs Improvement" },
  { value: "ACHIEVER", label: "Achiever" },
  { value: "STAND_OUT", label: "Stand Out" },
];

const RATING_LABEL: Record<Rating, string> = {
  STAND_OUT: "Stand Out",
  ACHIEVER: "Achiever",
  NEEDS_IMPROVEMENT: "Needs Improvement",
};

interface Subject {
  id: string;
  name: string | null;
  email: string;
  grade: string | null;
  gradeLevel: string | null;
  jobFamily: string | null;
  city: string | null;
  country: string | null;
  tenureYears: number | null;
  priorRating2024: string | null;
  priorRating2025: string | null;
  codeContributions: number | null;
  aiUsagePercent: number | null;
  effectiveBlastRadius: string | null;
}

interface ReviewInput {
  id: string;
  status: string;
  submittedAt: Date | null;
  updatedAt: Date;
  whatRating: string | null;
  whatRatingAiSuggestion: string | null;
  whatRatingAiRationale: string | null;
  howRating: string | null;
  howRatingAiSuggestion: string | null;
  howRatingAiRationale: string | null;
  reviewPeriod: { name: string; endsAt: Date };
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function initials(name: string | null, email: string) {
  const source = name ?? email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

function priorRatingLabel(r: string | null) {
  if (!r) return "—";
  return RATING_LABEL[r as Rating] ?? r;
}

function ConfirmSubmitDialog({
  open,
  onOpenChange,
  subjectName,
  whatRating,
  howRating,
  pending,
  isUpdate,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  subjectName: string;
  whatRating: Rating | null;
  howRating: Rating | null;
  pending: boolean;
  isUpdate: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isUpdate ? "Update this submission?" : "Submit this review?"}
          </DialogTitle>
          <DialogDescription>
            {isUpdate
              ? `New ratings for ${subjectName}. The submission updates in place.`
              : `Final ratings for ${subjectName}.`}
          </DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground self-center">
            What
          </dt>
          <dd className="text-[14px] font-medium">
            {whatRating ? RATING_LABEL[whatRating] : "—"}
          </dd>
          <dt className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground self-center">
            How
          </dt>
          <dd className="text-[14px] font-medium">
            {howRating ? RATING_LABEL[howRating] : "—"}
          </dd>
        </dl>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            {isUpdate ? "Update submission" : "Submit review"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function formatSavedHint(lastSavedAt: number | null, now: number): string | null {
  if (lastSavedAt == null) return null;
  const seconds = Math.floor((now - lastSavedAt) / 1000);
  if (seconds < 5) return "Saved just now";
  if (seconds < 60) return `Saved ${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Saved ${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `Saved ${hours}h ago`;
}

function formatTimeAgo(when: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - when) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return DATE_FMT.format(new Date(when));
}

function RatingSegmented({
  dimension,
  value,
  aiPick,
  disabled,
  onChange,
}: {
  dimension: "WHAT" | "HOW";
  value: Rating | null;
  aiPick: Rating | null;
  disabled: boolean;
  onChange: (r: Rating) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const currentIdx = RATINGS.findIndex((r) => r.value === value);
    let nextIdx = currentIdx;
    if (e.key === "ArrowLeft") {
      nextIdx = currentIdx <= 0 ? RATINGS.length - 1 : currentIdx - 1;
    } else {
      nextIdx = currentIdx >= RATINGS.length - 1 ? 0 : currentIdx + 1;
    }
    onChange(RATINGS[nextIdx].value);
  }

  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={`${dimension === "WHAT" ? "What" : "How"} rating`}
      onKeyDown={handleKeyDown}
      className="inline-flex p-0.5 rounded-lg bg-muted/70 ring-1 ring-border/50"
    >
      {RATINGS.map((r) => {
        const isSelected = value === r.value;
        const isAiPick = aiPick === r.value && !isSelected;
        return (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected || (!value && r.value === RATINGS[0].value) ? 0 : -1}
            disabled={disabled}
            onClick={() => onChange(r.value)}
            data-selected={isSelected}
            className={cn(
              "relative px-3.5 py-1.5 rounded-md text-[13px] font-medium transition-all duration-150 ease-out",
              "text-muted-foreground hover:text-foreground",
              "data-[selected=true]:bg-background data-[selected=true]:shadow-sm data-[selected=true]:text-foreground",
              "active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            )}
          >
            {r.label}
            {isAiPick && (
              <AiGlyph className="absolute -top-1.5 -right-1.5 size-3" />
            )}
            {isSelected && (
              <Check className="inline size-3 ml-1.5 -mr-0.5 animate-in fade-in zoom-in-50 duration-200" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

export function ManagerReviewForm({
  review,
  subject,
  currentUserId,
  whatEntries,
  howEntries,
  growthEntries,
}: {
  review: ReviewInput;
  subject: Subject;
  currentUserId: string;
  whatEntries: EvidenceEntry[];
  howEntries: EvidenceEntry[];
  growthEntries: EvidenceEntry[];
}) {
  const isSubmitted = review.status === "SUBMITTED";
  const subjectFirstName =
    subject.name?.split(/\s+/)[0] ?? subject.email.split("@")[0];

  const [whatRating, setWhatRating] = useState<Rating | null>(
    (review.whatRating as Rating | null) ?? null
  );
  const [howRating, setHowRating] = useState<Rating | null>(
    (review.howRating as Rating | null) ?? null
  );

  const [whatAi, setWhatAi] = useState<{ rating: Rating; rationale: string } | null>(
    review.whatRatingAiSuggestion
      ? {
          rating: review.whatRatingAiSuggestion as Rating,
          rationale: review.whatRatingAiRationale ?? "",
        }
      : null
  );
  const [howAi, setHowAi] = useState<{ rating: Rating; rationale: string } | null>(
    review.howRatingAiSuggestion
      ? {
          rating: review.howRatingAiSuggestion as Rating,
          rationale: review.howRatingAiRationale ?? "",
        }
      : null
  );

  const [generating, setGenerating] = useState<"WHAT" | "HOW" | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  type EditKey = "person" | "context" | "scope";
  const [editing, setEditing] = useState<EditKey | null>(null);

  // "Saved Xs ago" — a tick clock + a timestamp updated on successful save.
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Submit-final confirmation dialog
  const [confirmSubmit, setConfirmSubmit] = useState(false);

  async function handleGenerate(dim: "WHAT" | "HOW") {
    setGenerateError(null);
    setGenerating(dim);
    try {
      const result = await generateRatingSuggestion(review.id, dim);
      // Persist the AI suggestion, but clear the user's rating so they must
      // explicitly click a chip to commit. The chip the AI picked gets a
      // subtle "AI's pick" indicator until the user confirms.
      if (dim === "WHAT") {
        setWhatAi({ rating: result.rating, rationale: result.rationale });
        setWhatRating(null);
      } else {
        setHowAi({ rating: result.rating, rationale: result.rationale });
        setHowRating(null);
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Suggestion failed.");
    } finally {
      setGenerating(null);
    }
  }

  function handleSave(intent: "draft" | "submit") {
    setSubmitError(null);
    if (intent === "submit" && (!whatRating || !howRating)) {
      setSubmitError("Pick both a What Rating and a How Rating before submitting.");
      return;
    }
    startTransition(async () => {
      try {
        await saveManagerReview({
          reviewId: review.id,
          whatRating,
          howRating,
          intent,
        });
        setLastSavedAt(Date.now());
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "Save failed.");
      }
    });
  }

  // Render-helper: relative-time formatter.
  const savedHint = formatSavedHint(lastSavedAt, nowTick);

  // "Updated X ago" — only shown for submitted reviews that have been edited
  // after the initial submission. Uses the freshest of in-session save time
  // and the server's updatedAt. 60s grace avoids showing it right after
  // first submit when updatedAt ≈ submittedAt.
  const submittedAtMs = review.submittedAt
    ? new Date(review.submittedAt).getTime()
    : null;
  const lastEditMs = Math.max(
    lastSavedAt ?? 0,
    new Date(review.updatedAt).getTime()
  );
  const wasEditedAfterSubmit =
    isSubmitted && submittedAtMs != null && lastEditMs - submittedAtMs > 60_000;
  const updatedAgo = wasEditedAfterSubmit
    ? formatTimeAgo(lastEditMs, nowTick)
    : null;
  const canSubmit = !!whatRating && !!howRating;
  const disabledReason = !whatRating && !howRating
    ? "Pick both ratings to submit"
    : !whatRating
      ? "Pick a What rating to submit"
      : !howRating
        ? "Pick a How rating to submit"
        : null;

  // ⌘↵ / Ctrl+Enter to open submit-confirm (only when ratings ready).
  useEffect(() => {
    if (isSubmitted) return;
    function onKey(e: KeyboardEvent) {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key === "Enter" &&
        !e.shiftKey &&
        !e.altKey
      ) {
        if (canSubmit && !pending) {
          e.preventDefault();
          setConfirmSubmit(true);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canSubmit, pending, isSubmitted]);

  return (
    <div>
      {/* Sticky context bar — identity + progress + primary actions */}
      <div className="sticky top-0 z-20 -mx-0 border-b bg-background/85 backdrop-blur-md">
        <div className="px-10 max-w-5xl mx-auto h-14 flex items-center gap-4">
          <Link
            href="/app/reviews"
            aria-label="Back to your reviews"
            className="inline-flex items-center justify-center size-7 -ml-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors duration-150"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <p className="text-[14px] font-medium truncate">
              {subject.name ?? subject.email}
            </p>
            {isSubmitted ? (
              <Badge variant="outline" className="gap-1 shrink-0">
                <Check className="size-3" />
                Submitted
              </Badge>
            ) : (
              <Badge variant="secondary" className="shrink-0">
                Draft
              </Badge>
            )}
          </div>

          {/* Progress dots */}
          <div
            className="hidden md:flex items-center gap-3 text-[11px] font-medium text-muted-foreground tabular-nums ml-2"
            aria-label="Review progress"
          >
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  whatRating ? "bg-foreground" : "bg-border"
                )}
                aria-hidden
              />
              What
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  howRating ? "bg-foreground" : "bg-border"
                )}
                aria-hidden
              />
              How
            </span>
            <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
              <span className="size-1.5 rounded-sm bg-border" aria-hidden />
              Growth
            </span>
          </div>

          <div className="flex items-center gap-3 ml-auto">
            {savedHint && (
              <span
                className="text-[12px] text-muted-foreground tabular-nums hidden sm:inline"
                role="status"
                aria-live="polite"
              >
                {savedHint}
              </span>
            )}
            <>
              {disabledReason && (
                <span className="text-[12px] text-muted-foreground hidden md:inline">
                  {disabledReason}
                </span>
              )}
              {!isSubmitted && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => handleSave("draft")}
                >
                  Save draft
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                disabled={pending || !canSubmit}
                onClick={() => setConfirmSubmit(true)}
                title={
                  disabledReason ??
                  (isSubmitted ? "Update submission (⌘↵)" : "Submit review (⌘↵)")
                }
              >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : null}
                {isSubmitted ? "Update submission" : "Submit review"}
              </Button>
            </>
          </div>
        </div>
      </div>

      <div className="px-10 py-10 max-w-6xl mx-auto lg:grid lg:grid-cols-[1fr_160px] lg:gap-12">
        <div className="min-w-0">
        <header className="space-y-2 mb-12">
          <h1 className="text-[32px] font-semibold tracking-[-0.02em] leading-tight">
            Reviewing {subject.name ?? subject.email}
          </h1>
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {review.reviewPeriod.name} · due{" "}
            {DATE_FMT.format(review.reviewPeriod.endsAt)}
            {isSubmitted && review.submittedAt && (
              <> · submitted {DATE_FMT.format(review.submittedAt)}</>
            )}
            {updatedAgo && (
              <>
                {" · "}
                <span className="text-foreground/80">
                  updated {updatedAgo}
                </span>
              </>
            )}
          </p>
        </header>

      <PersonCard
        subject={subject}
        onEdit={() => setEditing("person")}
        onSuggestScope={() => setEditing("scope")}
      />
      <ContextStrip
        subject={subject}
        onEdit={() => setEditing("context")}
      />

      <EditPersonModal
        subjectId={subject.id}
        open={editing === "person"}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={subject}
      />
      <EditContextModal
        subjectId={subject.id}
        open={editing === "context"}
        onOpenChange={(o) => !o && setEditing(null)}
        initial={subject}
      />
      <ScopeSuggestModal
        subjectId={subject.id}
        subjectGrade={subject.grade}
        reviewId={review.id}
        open={editing === "scope"}
        onOpenChange={(o) => !o && setEditing(null)}
        currentOverride={subject.effectiveBlastRadius}
      />
      <ConfirmSubmitDialog
        open={confirmSubmit}
        onOpenChange={setConfirmSubmit}
        subjectName={subject.name ?? subject.email}
        whatRating={whatRating}
        howRating={howRating}
        pending={pending}
        isUpdate={isSubmitted}
        onConfirm={() => {
          setConfirmSubmit(false);
          handleSave("submit");
        }}
      />

      <Separator className="my-12" />

      <div className="space-y-12">
        <DimensionBlock
          reviewId={review.id}
          dimension="WHAT"
          title="What they achieved"
          subtitle="Outcomes delivered against the grade-appropriate bar. Quality, business impact, complexity handled."
          subjectGrade={subject.grade}
          subjectScopeOverride={subject.effectiveBlastRadius}
          subjectFirstName={subjectFirstName}
          entries={whatEntries}
          currentUserId={currentUserId}
          rating={whatRating}
          onRatingChange={setWhatRating}
          ai={whatAi}
          generating={generating === "WHAT"}
          onGenerate={() => handleGenerate("WHAT")}
          disabled={false}
        />

        <DimensionBlock
          reviewId={review.id}
          dimension="HOW"
          title="How they achieved it"
          subtitle="Behaviors against the firm's principles: Earn trust, Improve relentlessly, Do the right thing."
          subjectGrade={subject.grade}
          subjectScopeOverride={subject.effectiveBlastRadius}
          subjectFirstName={subjectFirstName}
          entries={howEntries}
          currentUserId={currentUserId}
          rating={howRating}
          onRatingChange={setHowRating}
          ai={howAi}
          generating={generating === "HOW"}
          onGenerate={() => handleGenerate("HOW")}
          disabled={false}
        />
      </div>

      <Separator className="my-12" />

      <GrowthSection
        reviewId={review.id}
        entries={growthEntries}
        currentUserId={currentUserId}
        disabled={false}
        subjectGrade={subject.grade}
        subjectScopeOverride={subject.effectiveBlastRadius}
        subjectFirstName={subjectFirstName}
      />

      {generateError && (
        <p className="mt-6 text-sm text-destructive">{generateError}</p>
      )}

      <div className="mt-16 pt-6 border-t border-border/60 flex items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">
          {isSubmitted
            ? "Submitted reviews can still be updated. Edit anything, then Update submission above."
            : "Entries autosave. Rating selections save when you Save draft above."}
        </p>
        {disabledReason && (
          <p className="text-[12px] text-muted-foreground">
            {disabledReason}
          </p>
        )}
      </div>
      {submitError && (
        <p className="mt-3 text-sm text-destructive text-right">{submitError}</p>
      )}
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <RubricToc
              whatRated={!!whatRating}
              howRated={!!howRating}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

function PersonCard({
  subject,
  onEdit,
  onSuggestScope,
}: {
  subject: Subject;
  onEdit: () => void;
  onSuggestScope?: () => void;
}) {
  const scope = effectiveBlastRadius(
    subject.grade,
    subject.effectiveBlastRadius
  );

  return (
    <section
      id="profile"
      aria-labelledby="profile-label"
      className="group/section scroll-mt-24"
    >
      <div className="flex items-center justify-between mb-3">
        <p
          id="profile-label"
          className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
        >
          Profile
        </p>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit profile"
          className="opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-opacity duration-150"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-full bg-foreground/[0.07] flex items-center justify-center text-sm font-medium tracking-tight">
          {initials(subject.name, subject.email)}
        </div>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="text-xl font-semibold tracking-[-0.015em] truncate">
            {subject.name ?? subject.email}
          </p>
          <p className="text-[13px] text-muted-foreground truncate">
            {subject.jobFamily ?? "—"}
            {subject.grade && ` · Grade ${subject.grade}`}
            {subject.tenureYears != null && ` · ${subject.tenureYears.toFixed(1)} years`}
            {subject.city && ` · ${subject.city}${subject.country ? `, ${subject.country}` : ""}`}
          </p>
        </div>
      </div>
      {scope.value && (
        <p className="text-[13px] text-muted-foreground flex items-center gap-1.5 flex-wrap mt-3 ml-16">
          <span>
            Effective scope{" "}
            <span className="text-foreground font-medium">{scope.value}</span>
            <span className="text-muted-foreground/70">
              {" · "}
              {scope.source === "grade" ? "grade default" : "custom"}
            </span>
          </span>
          {onSuggestScope && (
            <button
              type="button"
              onClick={onSuggestScope}
              className="inline-flex items-center gap-1 text-[12px] text-[--color-ai] hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-muted/60"
            >
              <AiGlyph className="size-3" aria-hidden />
              Infer from evidence
            </button>
          )}
        </p>
      )}
    </section>
  );
}

function ContextStrip({
  subject,
  onEdit,
}: {
  subject: Subject;
  onEdit: () => void;
}) {
  function ratingTone(r: string | null): "positive" | "attention" | "neutral" {
    if (r === "STAND_OUT") return "positive";
    if (r === "NEEDS_IMPROVEMENT") return "attention";
    return "neutral";
  }

  const items: {
    label: string;
    value: string;
    tone: "positive" | "attention" | "neutral";
  }[] = [
    {
      label: "2024 rating",
      value: priorRatingLabel(subject.priorRating2024),
      tone: ratingTone(subject.priorRating2024),
    },
    {
      label: "2025 rating",
      value: priorRatingLabel(subject.priorRating2025),
      tone: ratingTone(subject.priorRating2025),
    },
    {
      label: "Code contributions",
      value:
        subject.codeContributions != null
          ? subject.codeContributions.toString()
          : "—",
      tone: "neutral",
    },
    {
      label: "AI usage",
      value:
        subject.aiUsagePercent != null
          ? `${subject.aiUsagePercent.toFixed(0)}%`
          : "—",
      tone: "neutral",
    },
  ];
  return (
    <section
      id="context"
      aria-labelledby="context-label"
      className="group/section mt-10 scroll-mt-24"
    >
      <div className="flex items-center justify-between mb-3">
        <p
          id="context-label"
          className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
        >
          Context
        </p>
        <button
          type="button"
          onClick={onEdit}
          aria-label="Edit performance context"
          className="opacity-0 group-hover/section:opacity-100 focus-visible:opacity-100 inline-flex items-center justify-center size-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-opacity duration-150"
        >
          <Pencil className="size-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-x-6 gap-y-4">
        {items.map((it) => (
          <div
            key={it.label}
            className={cn(
              "pl-3 border-l-2",
              it.tone === "positive" && "border-[--color-positive]",
              it.tone === "attention" && "border-[--color-attention]",
              it.tone === "neutral" && "border-border"
            )}
          >
            <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {it.label}
            </p>
            <p className="text-xl font-semibold tracking-tight tabular-nums mt-1 truncate">
              {it.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DimensionBlock({
  reviewId,
  dimension,
  title,
  subtitle,
  subjectGrade,
  subjectScopeOverride,
  subjectFirstName,
  entries,
  currentUserId,
  rating,
  onRatingChange,
  ai,
  generating,
  onGenerate,
  disabled,
}: {
  reviewId: string;
  dimension: "WHAT" | "HOW";
  title: string;
  subtitle: string;
  subjectGrade: string | null;
  subjectScopeOverride: string | null;
  subjectFirstName: string;
  entries: EvidenceEntry[];
  currentUserId: string;
  rating: Rating | null;
  onRatingChange: (r: Rating) => void;
  ai: { rating: Rating; rationale: string } | null;
  generating: boolean;
  onGenerate: () => void;
  disabled: boolean;
}) {
  return (
    <section
      id={dimension.toLowerCase()}
      className="space-y-6 scroll-mt-24"
    >
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {dimension}
        </p>
        <div className="flex items-center gap-1.5">
          <h2 className="text-xl font-semibold tracking-[-0.015em]">{title}</h2>
          <GradeExampleHint
            grade={subjectGrade}
            blastRadiusOverride={subjectScopeOverride}
            dimension={dimension}
          />
        </div>
        <p className="text-[14px] text-muted-foreground">{subtitle}</p>
      </div>

      <div className="flex items-center justify-end">
        <RatingSegmented
          dimension={dimension}
          value={rating}
          aiPick={ai?.rating ?? null}
          disabled={disabled}
          onChange={onRatingChange}
        />
      </div>

      {!disabled && (
        <div className="flex items-center justify-end -mt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onGenerate}
            disabled={generating}
            className="gap-1.5 text-[--color-ai] hover:text-[--color-ai] hover:bg-[--color-ai]/10"
          >
            {generating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <AiGlyph className="size-3.5" />
            )}
            {generating ? "Reading the evidence…" : "Suggest rating"}
          </Button>
        </div>
      )}

      {generating && !ai && (
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

      {ai && (
        <div className="rounded-lg border border-dashed border-muted-foreground/30 p-4 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-300 ease-out">
          <div className="flex items-center gap-2 text-[13px]">
            <AiGlyph className="size-3.5 text-[--color-ai]" aria-hidden />
            <span className="font-medium">
              Suggested {RATING_LABEL[ai.rating]}
            </span>
            {rating ? (
              <span className="text-muted-foreground">
                · you chose {RATING_LABEL[rating]}
              </span>
            ) : (
              <span className="text-muted-foreground">
                · pick a chip to commit
              </span>
            )}
          </div>
          <p className="text-[14px] text-muted-foreground leading-[1.55]">
            {ai.rationale}
          </p>
        </div>
      )}

      <EvidenceTimeline
        reviewId={reviewId}
        dimension={dimension}
        entries={entries}
        disabled={disabled}
        currentUserId={currentUserId}
        subjectFirstName={subjectFirstName}
      />
    </section>
  );
}

function GrowthSection({
  reviewId,
  entries,
  currentUserId,
  disabled,
  subjectGrade,
  subjectScopeOverride,
  subjectFirstName,
}: {
  reviewId: string;
  entries: EvidenceEntry[];
  currentUserId: string;
  disabled: boolean;
  subjectGrade: string | null;
  subjectScopeOverride: string | null;
  subjectFirstName: string;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);
  const [draft, setDraft] = useState<string | null>(null);

  async function handleSuggest() {
    setSuggestError(null);
    setSuggesting(true);
    try {
      const result = await suggestGrowthDraft(reviewId);
      setDraft(result.body);
    } catch (e) {
      setSuggestError(
        e instanceof Error ? e.message : "Couldn't generate a draft."
      );
    } finally {
      setSuggesting(false);
    }
  }

  return (
    <section id="growth" className="space-y-6 scroll-mt-24">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Growth
        </p>
        <div className="flex items-center gap-1.5">
          <h2 className="text-xl font-semibold tracking-[-0.015em]">
            Where to grow next
          </h2>
          <GradeExampleHint
            grade={subjectGrade}
            blastRadiusOverride={subjectScopeOverride}
            dimension="GROWTH"
          />
        </div>
        <p className="text-[14px] text-muted-foreground">
          Coaching notes for the subject — pulled from the WHAT and HOW timelines. Optional.
        </p>
      </div>

      {!disabled && (
        <div className="flex items-center justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSuggest}
            disabled={suggesting}
            className="gap-1.5 text-[--color-ai]"
          >
            {suggesting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <AiGlyph className="size-3.5" />
            )}
            {suggesting ? "Reading the evidence…" : "Draft from evidence"}
          </Button>
        </div>
      )}

      {suggestError && (
        <p className="text-sm text-destructive">{suggestError}</p>
      )}

      <EvidenceTimeline
        reviewId={reviewId}
        dimension="GROWTH"
        entries={entries}
        disabled={disabled}
        currentUserId={currentUserId}
        subjectFirstName={subjectFirstName}
        showConcernToggle={false}
      />

      {draft !== null && (
        <EvidenceModal
          open={true}
          onOpenChange={(o) => !o && setDraft(null)}
          mode="add"
          reviewId={reviewId}
          dimension="GROWTH"
          showConcernToggle={false}
          defaultBody={draft}
          aiGenerated={true}
          titleOverride="New growth entry"
          descriptionOverride="AI drafted this from the WHAT and HOW timelines. Edit before saving — or cancel to discard."
        />
      )}
    </section>
  );
}
