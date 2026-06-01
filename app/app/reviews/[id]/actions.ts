"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  suggestRating,
  suggestEffectiveBlastRadius,
  suggestGrowthDraft as aiSuggestGrowthDraft,
  type Dimension,
  type Rating,
} from "@/lib/ai";

// Evidence can live in three dimensions; WHAT and HOW carry ratings, GROWTH is
// qualitative coaching notes only.
export type EvidenceDimension = "WHAT" | "HOW" | "GROWTH";

// ─── Self / Peer / Upward review (question-based template) ────────────────────

export async function saveReview(reviewId: string, formData: FormData) {
  const me = await getCurrentUser();
  const intent = formData.get("intent");
  if (intent !== "draft" && intent !== "submit") {
    throw new Error(`Unknown intent: ${intent}`);
  }

  const review = await db.review.findUnique({
    where: { id: reviewId },
    include: { reviewPeriod: { include: { template: { include: { questions: true } } } } },
  });
  if (!review) throw new Error("Review not found");
  if (review.reviewerId !== me.id) throw new Error("Not your review");
  if (review.status === "SUBMITTED") throw new Error("Already submitted");

  const questions = review.reviewPeriod.template?.questions ?? [];

  await db.$transaction(async (tx) => {
    for (const q of questions) {
      const text = formData.get(`text-${q.id}`);
      const rating = formData.get(`rating-${q.id}`);
      const hasText = typeof text === "string" && text.trim().length > 0;
      const hasRating = typeof rating === "string" && rating.length > 0;
      if (!hasText && !hasRating) continue;

      await tx.answer.upsert({
        where: {
          reviewId_questionId: { reviewId: review.id, questionId: q.id },
        },
        update: {
          text: hasText ? (text as string) : null,
          rating: hasRating ? Number(rating) : null,
        },
        create: {
          reviewId: review.id,
          questionId: q.id,
          text: hasText ? (text as string) : null,
          rating: hasRating ? Number(rating) : null,
        },
      });
    }

    if (intent === "submit") {
      await tx.review.update({
        where: { id: review.id },
        data: { status: "SUBMITTED", submittedAt: new Date() },
      });
    }
  });

  revalidatePath(`/app/reviews/${reviewId}`);
  revalidatePath(`/app/reviews`);
  if (intent === "submit") redirect("/app/reviews");
}

// ─── Manager review (rubric form: WHAT / HOW rating; evidence in entries) ────

export async function saveManagerReview(args: {
  reviewId: string;
  whatRating: Rating | null;
  howRating: Rating | null;
  intent: "draft" | "submit";
}) {
  const me = await getCurrentUser();
  const review = await db.review.findUnique({ where: { id: args.reviewId } });
  if (!review) throw new Error("Review not found");
  if (review.reviewerId !== me.id) throw new Error("Not your review");
  if (review.kind !== "MANAGER") throw new Error("Wrong review kind");

  if (args.intent === "submit") {
    if (!args.whatRating || !args.howRating) {
      throw new Error("Both What Rating and How Rating are required to submit.");
    }
  }

  const isFirstSubmit =
    args.intent === "submit" && review.status !== "SUBMITTED";

  await db.review.update({
    where: { id: args.reviewId },
    data: {
      whatRating: args.whatRating,
      howRating: args.howRating,
      // First submit sets status + submittedAt. Re-submits keep the original
      // submittedAt; Prisma auto-updates `updatedAt` on every write.
      ...(isFirstSubmit
        ? { status: "SUBMITTED", submittedAt: new Date() }
        : {}),
    },
  });

  revalidatePath(`/app/reviews/${args.reviewId}`);
  revalidatePath(`/app/reviews`);
  // Only redirect on FIRST submit (sense of finality). Re-submits stay on page.
  if (isFirstSubmit) redirect("/app/reviews");
}

// ─── Evidence entries (timeline) ─────────────────────────────────────────────

export type EvidenceType = "POSITIVE" | "CONCERN";

export async function addEvidenceEntry(
  reviewId: string,
  dimension: EvidenceDimension,
  body: string,
  type: EvidenceType = "POSITIVE",
  aiGenerated: boolean = false
) {
  const me = await getCurrentUser();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Entry can't be empty.");
  if (type !== "POSITIVE" && type !== "CONCERN") {
    throw new Error(`Invalid type: ${type}`);
  }

  const review = await db.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new Error("Review not found");
  if (review.reviewerId !== me.id) throw new Error("Not your review");

  await db.evidenceEntry.create({
    data: {
      reviewId,
      dimension,
      type,
      body: trimmed,
      aiGenerated,
      authorId: me.id,
    },
  });

  revalidatePath(`/app/reviews/${reviewId}`);
}

export async function suggestGrowthDraft(reviewId: string) {
  const me = await getCurrentUser();
  const review = await db.review.findUnique({
    where: { id: reviewId },
    include: {
      subject: true,
      evidenceEntries: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!review) throw new Error("Review not found");
  if (review.reviewerId !== me.id) throw new Error("Not your review");

  const whatEntries = review.evidenceEntries
    .filter((e) => e.dimension === "WHAT")
    .map((e) => ({ date: e.createdAt, body: e.body, type: e.type }));
  const howEntries = review.evidenceEntries
    .filter((e) => e.dimension === "HOW")
    .map((e) => ({ date: e.createdAt, body: e.body, type: e.type }));

  return aiSuggestGrowthDraft({
    subject: {
      name: review.subject.name,
      grade: review.subject.grade,
      jobFamily: review.subject.jobFamily,
      tenureYears: review.subject.tenureYears,
      priorRating2024: review.subject.priorRating2024,
      priorRating2025: review.subject.priorRating2025,
      codeContributions: review.subject.codeContributions,
      aiUsagePercent: review.subject.aiUsagePercent,
    },
    whatEntries,
    howEntries,
  });
}

export async function deleteEvidenceEntry(entryId: string) {
  const me = await getCurrentUser();
  const entry = await db.evidenceEntry.findUnique({
    where: { id: entryId },
    include: { review: true },
  });
  if (!entry) throw new Error("Entry not found");
  if (entry.authorId !== me.id) {
    throw new Error("You can only delete entries you wrote.");
  }

  await db.evidenceEntry.delete({ where: { id: entryId } });
  revalidatePath(`/app/reviews/${entry.reviewId}`);
}

export async function updateEvidenceEntry(
  entryId: string,
  body: string,
  type: EvidenceType = "POSITIVE"
) {
  const me = await getCurrentUser();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("Entry can't be empty.");
  if (type !== "POSITIVE" && type !== "CONCERN") {
    throw new Error(`Invalid type: ${type}`);
  }

  const entry = await db.evidenceEntry.findUnique({
    where: { id: entryId },
    include: { review: true },
  });
  if (!entry) throw new Error("Entry not found");
  if (entry.authorId !== me.id) {
    throw new Error("You can only edit entries you wrote.");
  }

  await db.evidenceEntry.update({
    where: { id: entryId },
    data: { body: trimmed, type },
  });

  revalidatePath(`/app/reviews/${entry.reviewId}`);
}

// ─── Edit subject profile (HR fields) ────────────────────────────────────────
// A manager can edit profile fields of their direct reports inline from the
// review form. Note: this mutates the User record — every other review of this
// person sees the new values. We can switch to per-review snapshots later if
// the immutability of HR data at review-time matters.

export type SubjectProfilePatch = {
  name?: string | null;
  jobFamily?: string | null;
  grade?: string | null;
  gradeLevel?: string | null;
  tenureYears?: number | null;
  city?: string | null;
  country?: string | null;
  priorRating2024?: string | null;
  priorRating2025?: string | null;
  codeContributions?: number | null;
  aiUsagePercent?: number | null;
  effectiveBlastRadius?: string | null;
};

export async function updateSubjectProfile(
  subjectId: string,
  patch: SubjectProfilePatch
) {
  const me = await getCurrentUser();
  const subject = await db.user.findUnique({ where: { id: subjectId } });
  if (!subject) throw new Error("Subject not found");
  if (subject.managerId !== me.id) {
    throw new Error("You can only edit your own direct reports.");
  }

  await db.user.update({ where: { id: subjectId }, data: patch });
  revalidatePath(`/app/reviews`);
}

const DATE_FMT_ENTRY = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export async function suggestBlastRadius(reviewId: string) {
  const me = await getCurrentUser();
  const review = await db.review.findUnique({
    where: { id: reviewId },
    include: {
      subject: true,
      evidenceEntries: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!review) throw new Error("Review not found");
  if (review.reviewerId !== me.id) throw new Error("Not your review");

  const whatEntries = review.evidenceEntries
    .filter((e) => e.dimension === "WHAT")
    .map((e) => ({ date: e.createdAt, body: e.body, type: e.type }));
  const howEntries = review.evidenceEntries
    .filter((e) => e.dimension === "HOW")
    .map((e) => ({ date: e.createdAt, body: e.body, type: e.type }));

  return suggestEffectiveBlastRadius({
    subject: {
      name: review.subject.name,
      grade: review.subject.grade,
      jobFamily: review.subject.jobFamily,
      tenureYears: review.subject.tenureYears,
      priorRating2024: review.subject.priorRating2024,
      priorRating2025: review.subject.priorRating2025,
      codeContributions: review.subject.codeContributions,
      aiUsagePercent: review.subject.aiUsagePercent,
    },
    whatEntries,
    howEntries,
  });
}

export async function generateRatingSuggestion(
  reviewId: string,
  dimension: Dimension
) {
  const me = await getCurrentUser();
  const review = await db.review.findUnique({
    where: { id: reviewId },
    include: {
      subject: true,
      evidenceEntries: {
        where: { dimension },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!review) throw new Error("Review not found");
  if (review.reviewerId !== me.id) throw new Error("Not your review");

  // Format the full timeline newest-first so the model sees the trajectory.
  // Concern entries get an explicit prefix so the model weights them honestly.
  const evidence =
    review.evidenceEntries.length === 0
      ? ""
      : review.evidenceEntries
          .map((e) => {
            const date = DATE_FMT_ENTRY.format(e.createdAt);
            const prefix = e.type === "CONCERN" ? " [CONCERN]" : "";
            return `[${date}]${prefix} ${e.body}`;
          })
          .join("\n\n");

  const result = await suggestRating({
    dimension,
    evidence,
    subject: {
      name: review.subject.name,
      grade: review.subject.grade,
      jobFamily: review.subject.jobFamily,
      tenureYears: review.subject.tenureYears,
      priorRating2024: review.subject.priorRating2024,
      priorRating2025: review.subject.priorRating2025,
      codeContributions: review.subject.codeContributions,
      aiUsagePercent: review.subject.aiUsagePercent,
    },
  });

  await db.review.update({
    where: { id: reviewId },
    data:
      dimension === "WHAT"
        ? {
            whatRatingAiSuggestion: result.rating,
            whatRatingAiRationale: result.rationale,
          }
        : {
            howRatingAiSuggestion: result.rating,
            howRatingAiRationale: result.rationale,
          },
  });

  return result;
}
