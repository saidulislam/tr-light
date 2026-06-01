import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isGradeDisabled, relationshipHiddenIds } from "@/lib/visibility";
import { cn } from "@/lib/utils";

const DATE_FMT_SHORT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
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

function daysUntil(dueDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return Math.round(diff);
}

function dueChip(dueDate: Date, isSubmitted: boolean) {
  if (isSubmitted) {
    return { label: DATE_FMT_SHORT.format(dueDate), tone: "muted" as const };
  }
  const days = daysUntil(dueDate);
  if (days < 0) {
    return {
      label: `Overdue · ${Math.abs(days)}d`,
      tone: "destructive" as const,
    };
  }
  if (days === 0) return { label: "Due today", tone: "attention" as const };
  if (days <= 7) return { label: `Due in ${days}d`, tone: "attention" as const };
  if (days <= 14) return { label: `Due in ${days}d`, tone: "foreground" as const };
  return { label: `Due ${DATE_FMT_SHORT.format(dueDate)}`, tone: "muted" as const };
}

function reviewTitle(kind: string, subjectName: string | null, isSelf: boolean) {
  if (kind === "SELF" || isSelf) return "Self-review";
  if (kind === "MANAGER") return subjectName ?? "Direct report";
  if (kind === "PEER") return `Peer review · ${subjectName ?? "teammate"}`;
  if (kind === "UPWARD") return `Upward · ${subjectName ?? "manager"}`;
  return "Review";
}

function subtitleFor(
  kind: string,
  subjectTitle: string | null,
  periodName: string
) {
  if (kind === "MANAGER") {
    return [subjectTitle, periodName].filter(Boolean).join(" · ");
  }
  return periodName;
}

export default async function ReviewsInboxPage() {
  const me = await getCurrentUser();
  const allReviews = await db.review.findMany({
    where: { reviewerId: me.id },
    orderBy: [{ createdAt: "desc" }],
    include: {
      subject: true,
      reviewPeriod: true,
      _count: { select: { evidenceEntries: true } },
    },
  });

  // Hide reviews per visibility rules — see lib/visibility.ts.
  const hiddenByRelationship = await relationshipHiddenIds();
  const reviews = allReviews.filter(
    (r) =>
      !isGradeDisabled(r.subject.grade) &&
      !hiddenByRelationship.has(r.subject.id)
  );

  const drafts = reviews.filter((r) => r.status === "DRAFT");
  const submitted = reviews.filter((r) => r.status === "SUBMITTED");

  return (
    <div className="px-10 py-10 max-w-5xl">
      <header className="mb-10 space-y-2">
        <h1 className="text-[32px] font-semibold tracking-[-0.02em] leading-tight">
          Your reviews
        </h1>
        <p className="text-[13px] text-muted-foreground">
          Reviews assigned to you across open review periods.
        </p>
      </header>

      {reviews.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-12">
          {drafts.length > 0 && (
            <ReviewGroup heading="To do" count={drafts.length} reviews={drafts} />
          )}
          {submitted.length > 0 && (
            <ReviewGroup
              heading="Submitted"
              count={submitted.length}
              reviews={submitted}
              dim
            />
          )}
        </div>
      )}
    </div>
  );
}

function ReviewGroup({
  heading,
  count,
  reviews,
  dim = false,
}: {
  heading: string;
  count: number;
  reviews: Array<{
    id: string;
    kind: string;
    status: string;
    subjectId: string;
    reviewerId: string;
    submittedAt: Date | null;
    subject: { name: string | null; email: string; title: string | null };
    reviewPeriod: { name: string; endsAt: Date };
    _count: { evidenceEntries: number };
  }>;
  dim?: boolean;
}) {
  return (
    <section className={cn(dim && "opacity-70")} aria-labelledby={`group-${heading}`}>
      <div className="flex items-baseline gap-2 mb-4">
        <p
          id={`group-${heading}`}
          className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
        >
          {heading}
        </p>
        <span className="text-[11px] font-medium text-muted-foreground/60 tabular-nums">
          {count}
        </span>
      </div>
      <ul className="divide-y divide-border/70">
        {reviews.map((r) => {
          const isSelf = r.subjectId === r.reviewerId;
          const title = reviewTitle(r.kind, r.subject.name, isSelf);
          const subtitle = subtitleFor(r.kind, r.subject.title, r.reviewPeriod.name);
          const chip = dueChip(r.reviewPeriod.endsAt, r.status === "SUBMITTED");
          return (
            <li key={r.id}>
              <Link
                href={`/app/reviews/${r.id}`}
                className="group flex items-center gap-4 py-3.5 -mx-2 px-2 rounded-md hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px] transition-colors duration-150"
              >
                <div className="size-9 rounded-full bg-foreground/[0.07] flex items-center justify-center text-[12px] font-medium shrink-0">
                  {initials(r.subject.name, r.subject.email)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">{title}</p>
                  <p className="text-[12px] text-muted-foreground truncate mt-0.5">
                    {subtitle}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-0.5 shrink-0">
                  <span
                    className={cn(
                      "text-[12px] font-medium tabular-nums",
                      chip.tone === "destructive" && "text-destructive",
                      chip.tone === "attention" && "text-[--color-attention]",
                      chip.tone === "foreground" && "text-foreground",
                      chip.tone === "muted" && "text-muted-foreground"
                    )}
                  >
                    {chip.label}
                  </span>
                  <span className="text-[11px] text-muted-foreground/70 tabular-nums">
                    {r._count.evidenceEntries === 0
                      ? "No entries"
                      : `${r._count.evidenceEntries} ${r._count.evidenceEntries === 1 ? "entry" : "entries"}`}
                  </span>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border/70 py-16 px-6 flex flex-col items-center text-center">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Inbox className="size-5 text-muted-foreground" />
      </div>
      <h2 className="font-medium text-base">You're all caught up</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        No reviews are waiting for you. When a new review period opens, your
        assigned reviews will show up here.
      </p>
    </div>
  );
}
