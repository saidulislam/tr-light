import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isGradeDisabled, relationshipHiddenIds } from "@/lib/visibility";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ManagerReviewForm } from "@/components/manager-review-form";
import { saveReview } from "./actions";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

// Rating scale: 1 = best (Outstanding), 5 = worst (Needs improvement).
const RATING_VALUES = [1, 2, 3, 4, 5];
const RATING_LABEL: Record<number, string> = {
  1: "Outstanding",
  2: "Exceeds expectations",
  3: "Meets expectations",
  4: "Below expectations",
  5: "Needs improvement",
};

function headerTitle(kind: string, subjectName: string | null, isSelf: boolean) {
  if (kind === "SELF" || isSelf) return "Self-review";
  if (kind === "MANAGER") return `Reviewing ${subjectName ?? "your report"}`;
  if (kind === "PEER") return `Peer review of ${subjectName ?? "teammate"}`;
  if (kind === "UPWARD") return `Upward review of ${subjectName ?? "manager"}`;
  return "Review";
}

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await getCurrentUser();
  const review = await db.review.findUnique({
    where: { id },
    include: {
      subject: true,
      reviewPeriod: {
        include: { template: { include: { questions: { orderBy: { order: "asc" } } } } },
      },
      answers: true,
      evidenceEntries: {
        orderBy: { createdAt: "desc" },
        include: { author: { select: { name: true, email: true } } },
      },
    },
  });

  if (!review || review.reviewerId !== me.id) notFound();
  if (isGradeDisabled(review.subject.grade)) notFound();
  const hiddenByRelationship = await relationshipHiddenIds();
  if (hiddenByRelationship.has(review.subjectId)) notFound();

  if (review.kind === "MANAGER") {
    const byDimension = { WHAT: [], HOW: [], GROWTH: [] } as Record<
      "WHAT" | "HOW" | "GROWTH",
      Array<{
        id: string;
        body: string;
        type: string;
        aiGenerated: boolean;
        createdAt: Date;
        authorId: string;
        authorName: string | null;
        authorEmail: string;
      }>
    >;
    for (const e of review.evidenceEntries) {
      const dim = e.dimension as "WHAT" | "HOW" | "GROWTH";
      if (!byDimension[dim]) continue;
      byDimension[dim].push({
        id: e.id,
        body: e.body,
        type: e.type,
        aiGenerated: e.aiGenerated,
        createdAt: e.createdAt,
        authorId: e.authorId,
        authorName: e.author?.name ?? null,
        authorEmail: e.author?.email ?? "",
      });
    }
    return (
      <ManagerReviewForm
        review={review}
        subject={review.subject}
        currentUserId={me.id}
        whatEntries={byDimension.WHAT}
        howEntries={byDimension.HOW}
        growthEntries={byDimension.GROWTH}
      />
    );
  }

  const questions = review.reviewPeriod.template?.questions ?? [];
  const answersByQ = new Map(review.answers.map((a) => [a.questionId, a]));
  const isSubmitted = review.status === "SUBMITTED";
  const isSelf = review.subjectId === review.reviewerId;
  const title = headerTitle(review.kind, review.subject.name, isSelf);

  const saveWithId = saveReview.bind(null, review.id);

  return (
    <div className="px-10 py-10 max-w-3xl mx-auto">
      <Link
        href="/app/reviews"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
      >
        <ArrowLeft className="size-4" />
        Your reviews
      </Link>

      <header className="space-y-3 mb-10">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
          {isSubmitted ? (
            <Badge variant="outline" className="gap-1">
              <Check className="size-3" />
              Submitted
            </Badge>
          ) : (
            <Badge variant="secondary">Draft</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {review.reviewPeriod.name} · due{" "}
          {DATE_FMT.format(review.reviewPeriod.endsAt)}
          {isSubmitted && review.submittedAt && (
            <> · submitted {DATE_FMT.format(review.submittedAt)}</>
          )}
        </p>
      </header>

      <form action={saveWithId} className="space-y-10">
        {questions.map((q, idx) => {
          const a = answersByQ.get(q.id);
          return (
            <section key={q.id} className="space-y-3">
              <div className="flex items-baseline gap-3">
                <span className="text-xs font-medium text-muted-foreground tabular-nums">
                  {String(idx + 1).padStart(2, "0")}
                </span>
                <h2 className="text-base font-semibold tracking-tight">
                  {q.prompt}
                </h2>
              </div>

              {q.kind === "TEXT" ? (
                <textarea
                  name={`text-${q.id}`}
                  defaultValue={a?.text ?? ""}
                  disabled={isSubmitted}
                  rows={5}
                  placeholder="Write your response..."
                  className="w-full rounded-md border bg-background px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent disabled:cursor-not-allowed disabled:opacity-70 resize-y"
                />
              ) : (
                <RatingInput
                  name={`rating-${q.id}`}
                  defaultValue={a?.rating ?? null}
                  disabled={isSubmitted}
                />
              )}
            </section>
          );
        })}

        {!isSubmitted && (
          <>
            <Separator />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                Saving creates a draft. Submitting is final.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="submit"
                  name="intent"
                  value="draft"
                  variant="outline"
                >
                  Save draft
                </Button>
                <Button type="submit" name="intent" value="submit">
                  Submit review
                </Button>
              </div>
            </div>
          </>
        )}
      </form>
    </div>
  );
}

function RatingInput({
  name,
  defaultValue,
  disabled,
}: {
  name: string;
  defaultValue: number | null;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="flex flex-wrap gap-2">
      {RATING_VALUES.map((v) => (
        <label
          key={v}
          className={cn(
            "relative cursor-pointer",
            disabled && "cursor-not-allowed opacity-70"
          )}
        >
          <input
            type="radio"
            name={name}
            value={v}
            defaultChecked={defaultValue === v}
            className="peer sr-only"
          />
          <span
            className={cn(
              "flex flex-col items-center justify-center min-w-28 px-4 py-3 rounded-lg border bg-background text-sm transition-colors",
              "hover:bg-muted/50",
              "peer-checked:bg-foreground peer-checked:text-background peer-checked:border-foreground",
              "peer-focus-visible:ring-2 peer-focus-visible:ring-ring"
            )}
          >
            <span className="text-lg font-semibold tabular-nums">{v}</span>
            <span className="text-[11px] mt-0.5 leading-tight text-center peer-checked:opacity-90">
              {RATING_LABEL[v]}
            </span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}
