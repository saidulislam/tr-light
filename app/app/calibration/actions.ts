"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { quintileForRank } from "@/lib/calibration";
import { gradeMeta } from "@/lib/rubric";
import {
  suggestMoveRationale as aiSuggestMoveRationale,
  suggestPlacements as aiSuggestPlacements,
} from "@/lib/ai";

/** Move a subject to a new rank within their grade. Every move requires a
 *  rationale (must be human-accepted, even if AI proposed). Persists the
 *  new QuintileAssignment AND logs the change to QuintileMove. Re-orders
 *  other subjects' ranks within the grade so positions remain dense (1..N).
 */
export async function moveSubject(args: {
  reviewPeriodId: string;
  subjectId: string;
  toRank: number;
  rationale: string;
  source: "AI" | "HUMAN";
  /** Grade boundary — only re-rank others within this grade. */
  grade: string;
  /** Full set of subjectIds in the grade, in their current rank order. The
   *  client computes the new order and submits the new toRank for the moved
   *  subject; the server re-ranks the rest. */
  gradePopulation: number;
}) {
  const me = await getCurrentUser();
  if (!args.rationale.trim()) {
    throw new Error("Rationale is required for every calibration move.");
  }
  if (args.source !== "AI" && args.source !== "HUMAN") {
    throw new Error("Invalid source.");
  }

  const subject = await db.user.findUnique({
    where: { id: args.subjectId },
    select: { id: true, grade: true },
  });
  if (!subject) throw new Error("Subject not found");
  if (subject.grade !== args.grade) {
    throw new Error("Subject grade does not match the grade being calibrated.");
  }

  const period = await db.reviewPeriod.findUnique({
    where: { id: args.reviewPeriodId },
    select: { id: true },
  });
  if (!period) throw new Error("Review period not found");

  // Read existing assignment for from-state logging.
  const existing = await db.quintileAssignment.findUnique({
    where: {
      reviewPeriodId_subjectId: {
        reviewPeriodId: args.reviewPeriodId,
        subjectId: args.subjectId,
      },
    },
  });

  const fromRank = existing?.rankInGrade ?? null;
  const fromQuintile =
    fromRank != null ? quintileForRank(fromRank, args.gradePopulation) : null;
  const toQuintile = quintileForRank(args.toRank, args.gradePopulation);

  // 1) Upsert this subject's assignment to the new rank.
  // 2) Shift other subjects in the grade who were displaced.
  //    Strategy: load all assignments for the grade, remove this one,
  //    splice into the new position, re-number 1..N.
  await db.$transaction(async (tx) => {
    // Get every subject in this grade who has an assignment.
    const gradeSubjectIds = (
      await tx.user.findMany({
        where: { grade: args.grade },
        select: { id: true },
      })
    ).map((u) => u.id);

    const existingForGrade = await tx.quintileAssignment.findMany({
      where: {
        reviewPeriodId: args.reviewPeriodId,
        subjectId: { in: gradeSubjectIds },
      },
      orderBy: { rankInGrade: "asc" },
    });

    // Build the new ordered list of subjectIds.
    const ordered = existingForGrade.map((a) => a.subjectId);
    const otherIds = ordered.filter((id) => id !== args.subjectId);
    // Clamp the destination rank to [1, otherIds.length + 1]
    const dest = Math.max(1, Math.min(args.toRank, otherIds.length + 1));
    const newOrder = [
      ...otherIds.slice(0, dest - 1),
      args.subjectId,
      ...otherIds.slice(dest - 1),
    ];

    // Upsert each assignment with its new rank. To avoid violating the
    // unique constraint we can't simply set rank N to two rows at once,
    // so we update in two passes: bump everyone to negative ranks first,
    // then set the real ranks.
    await tx.quintileAssignment.updateMany({
      where: {
        reviewPeriodId: args.reviewPeriodId,
        subjectId: { in: newOrder.filter((id) => id !== args.subjectId) },
      },
      data: { rankInGrade: -1 },
    });

    for (let i = 0; i < newOrder.length; i++) {
      const sid = newOrder[i];
      const rank = i + 1;
      if (sid === args.subjectId) {
        await tx.quintileAssignment.upsert({
          where: {
            reviewPeriodId_subjectId: {
              reviewPeriodId: args.reviewPeriodId,
              subjectId: sid,
            },
          },
          update: {
            rankInGrade: rank,
            rationale: args.rationale.trim(),
            source: args.source,
          },
          create: {
            reviewPeriodId: args.reviewPeriodId,
            subjectId: sid,
            rankInGrade: rank,
            rationale: args.rationale.trim(),
            source: args.source,
          },
        });
      } else {
        await tx.quintileAssignment.update({
          where: {
            reviewPeriodId_subjectId: {
              reviewPeriodId: args.reviewPeriodId,
              subjectId: sid,
            },
          },
          data: { rankInGrade: rank },
        });
      }
    }

    // Log the move.
    await tx.quintileMove.create({
      data: {
        reviewPeriodId: args.reviewPeriodId,
        subjectId: args.subjectId,
        fromRank,
        toRank: dest,
        fromQuintile,
        toQuintile,
        rationale: args.rationale.trim(),
        source: args.source,
        movedById: me.id,
      },
    });
  });

  revalidatePath("/app/calibration");
}

/** Build a condensed evidence summary for a subject — newest entries first,
 *  trimmed to keep prompt size sane. */
async function evidenceSummaryFor(
  reviewPeriodId: string,
  subjectId: string
): Promise<string> {
  const review = await db.review.findFirst({
    where: { reviewPeriodId, subjectId, kind: "MANAGER" },
    include: {
      evidenceEntries: { orderBy: { createdAt: "desc" }, take: 8 },
    },
  });
  if (!review) return "";
  const lines: string[] = [];
  for (const e of review.evidenceEntries) {
    const prefix =
      e.dimension === "GROWTH"
        ? "[GROWTH]"
        : e.type === "CONCERN"
          ? `[${e.dimension} CONCERN]`
          : `[${e.dimension}]`;
    lines.push(`${prefix} ${e.body.slice(0, 280)}`);
  }
  return lines.join("\n");
}

/** AI rationale for a SINGLE pending move. Called from the move modal. */
export async function suggestMoveRationale(args: {
  reviewPeriodId: string;
  subjectId: string;
  fromRank: number;
  toRank: number;
  grade: string;
  gradePopulation: number;
}) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in");

  const subject = await db.user.findUnique({
    where: { id: args.subjectId },
    select: {
      name: true,
      email: true,
      title: true,
      grade: true,
      priorRating2024: true,
      priorRating2025: true,
      codeContributions: true,
      aiUsagePercent: true,
    },
  });
  if (!subject) throw new Error("Subject not found");

  const review = await db.review.findFirst({
    where: { reviewPeriodId: args.reviewPeriodId, subjectId: args.subjectId, kind: "MANAGER" },
    select: { whatRating: true, howRating: true },
  });

  // Find current neighbors near the destination rank.
  const allInGrade = await db.quintileAssignment.findMany({
    where: {
      reviewPeriodId: args.reviewPeriodId,
      subject: { grade: args.grade },
    },
    include: {
      subject: { select: { id: true, name: true, email: true } },
    },
    orderBy: { rankInGrade: "asc" },
  });
  const allReviews = await db.review.findMany({
    where: {
      reviewPeriodId: args.reviewPeriodId,
      subjectId: { in: allInGrade.map((a) => a.subjectId) },
      kind: "MANAGER",
    },
    select: { subjectId: true, whatRating: true, howRating: true },
  });
  const rvBySubj = new Map(allReviews.map((r) => [r.subjectId, r]));

  const neighborRanks = [
    args.toRank - 1,
    args.toRank,
    args.toRank + 1,
  ].filter((r) => r >= 1 && r <= args.gradePopulation && r !== args.fromRank);
  const neighbors = neighborRanks.flatMap((rank) => {
    const a = allInGrade.find((x) => x.rankInGrade === rank);
    if (!a || a.subjectId === args.subjectId) return [];
    const r = rvBySubj.get(a.subjectId);
    return [{
      name: a.subject.name ?? a.subject.email,
      rank,
      whatRating: r?.whatRating ?? null,
      howRating: r?.howRating ?? null,
    }];
  });

  const evidenceSummary = await evidenceSummaryFor(
    args.reviewPeriodId,
    args.subjectId
  );

  return aiSuggestMoveRationale({
    subject: {
      name: subject.name ?? subject.email,
      grade: subject.grade ?? "?",
      title: subject.title,
      priorRating2024: subject.priorRating2024,
      priorRating2025: subject.priorRating2025,
      whatRating: review?.whatRating ?? null,
      howRating: review?.howRating ?? null,
      codeContributions: subject.codeContributions,
      aiUsagePercent: subject.aiUsagePercent,
      evidenceSummary,
    },
    fromRank: args.fromRank,
    toRank: args.toRank,
    fromQuintile: quintileForRank(args.fromRank, args.gradePopulation),
    toQuintile: quintileForRank(args.toRank, args.gradePopulation),
    gradePopulation: args.gradePopulation,
    neighbors,
  });
}

/** AI proposes a full re-ranking for a grade in the subtree. Returns the
 *  proposed placements with per-subject rationale. Nothing is persisted —
 *  the manager must review and accept (via `acceptPlacements`). */
export async function suggestPlacementsForGrade(args: {
  reviewPeriodId: string;
  grade: string;
}) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in");

  const meta = gradeMeta(args.grade);
  if (!meta) {
    throw new Error(`Unknown grade ${args.grade}`);
  }

  // Subtree-scoped — only subjects under the current user.
  const subtreeIds = await getSubtreeIds(me.id);
  const subjects = await db.user.findMany({
    where: { id: { in: subtreeIds }, grade: args.grade },
    select: {
      id: true,
      name: true,
      email: true,
      title: true,
      tenureYears: true,
      priorRating2024: true,
      priorRating2025: true,
      codeContributions: true,
      aiUsagePercent: true,
    },
  });

  const reviews = await db.review.findMany({
    where: {
      reviewPeriodId: args.reviewPeriodId,
      subjectId: { in: subjects.map((s) => s.id) },
      kind: "MANAGER",
    },
    select: { subjectId: true, whatRating: true, howRating: true },
  });
  const rvBySubj = new Map(reviews.map((r) => [r.subjectId, r]));

  const assignments = await db.quintileAssignment.findMany({
    where: {
      reviewPeriodId: args.reviewPeriodId,
      subjectId: { in: subjects.map((s) => s.id) },
    },
    select: { subjectId: true, rankInGrade: true },
  });
  const rankBySubj = new Map(assignments.map((a) => [a.subjectId, a.rankInGrade]));

  const inputs = await Promise.all(
    subjects.map(async (s) => {
      const r = rvBySubj.get(s.id);
      const evidence = await evidenceSummaryFor(args.reviewPeriodId, s.id);
      return {
        id: s.id,
        name: s.name ?? s.email,
        title: s.title,
        tenureYears: s.tenureYears,
        priorRating2024: s.priorRating2024,
        priorRating2025: s.priorRating2025,
        codeContributions: s.codeContributions,
        aiUsagePercent: s.aiUsagePercent,
        whatRating: r?.whatRating ?? null,
        howRating: r?.howRating ?? null,
        evidenceSummary: evidence,
        currentRank: rankBySubj.get(s.id) ?? 999,
      };
    })
  );

  return aiSuggestPlacements({
    grade: args.grade,
    gradeMeta: {
      title: meta.title,
      blastRadius: meta.blastRadius,
      scopeDescription: meta.scopeDescription,
    },
    subjects: inputs,
  });
}

/** Accept a batch of placements proposed by AI. Each accepted placement
 *  creates the same effect as a human drag-and-rationale: updates the
 *  Assignment + logs a Move. Skips placements that match current rank. */
export async function acceptPlacements(args: {
  reviewPeriodId: string;
  grade: string;
  placements: Array<{
    subjectId: string;
    proposedRank: number;
    rationale: string;
  }>;
}) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Not signed in");

  for (const p of args.placements) {
    if (!p.rationale.trim()) {
      throw new Error(
        "Every accepted placement requires a rationale — even AI drafts must be confirmed."
      );
    }
  }

  // Validate all subjects are in the same grade.
  const subjects = await db.user.findMany({
    where: { id: { in: args.placements.map((p) => p.subjectId) } },
    select: { id: true, grade: true },
  });
  for (const s of subjects) {
    if (s.grade !== args.grade) {
      throw new Error("All placements must be within the same grade.");
    }
  }

  // Sort the accepted placements by proposed rank (1..K). We'll apply them
  // by reading the current grade ordering, replacing each placed subject
  // at the requested rank, and re-numbering the rest densely.
  const sorted = [...args.placements].sort((a, b) => a.proposedRank - b.proposedRank);

  const allInGrade = await db.user.findMany({
    where: { grade: args.grade },
    select: { id: true },
  });
  const allIds = allInGrade.map((u) => u.id);

  await db.$transaction(async (tx) => {
    const existing = await tx.quintileAssignment.findMany({
      where: {
        reviewPeriodId: args.reviewPeriodId,
        subjectId: { in: allIds },
      },
      orderBy: { rankInGrade: "asc" },
    });
    const currentOrder = existing.map((a) => a.subjectId);
    const beingPlaced = new Set(sorted.map((p) => p.subjectId));
    const rest = currentOrder.filter((id) => !beingPlaced.has(id));

    // Build new order: start with rest, then insert each placed subject at
    // their requested rank position (1-based). When multiple placements
    // collide, the later one bumps the earlier one down by 1.
    const newOrder: string[] = [...rest];
    for (const p of sorted) {
      const idx = Math.max(0, Math.min(p.proposedRank - 1, newOrder.length));
      newOrder.splice(idx, 0, p.subjectId);
    }

    const gradePop = newOrder.length;
    const fromRanks = new Map(existing.map((a) => [a.subjectId, a.rankInGrade]));

    // Two-phase rank update (negative ranks then positive) to satisfy the
    // unique constraint.
    await tx.quintileAssignment.updateMany({
      where: {
        reviewPeriodId: args.reviewPeriodId,
        subjectId: { in: newOrder },
      },
      data: { rankInGrade: -1 },
    });

    for (let i = 0; i < newOrder.length; i++) {
      const sid = newOrder[i];
      const rank = i + 1;
      const placement = sorted.find((p) => p.subjectId === sid);
      const rationale = placement
        ? placement.rationale.trim()
        : existing.find((a) => a.subjectId === sid)?.rationale ?? "Re-numbered after batch placement.";
      await tx.quintileAssignment.upsert({
        where: {
          reviewPeriodId_subjectId: {
            reviewPeriodId: args.reviewPeriodId,
            subjectId: sid,
          },
        },
        update: {
          rankInGrade: rank,
          ...(placement ? { rationale, source: "AI" } : {}),
        },
        create: {
          reviewPeriodId: args.reviewPeriodId,
          subjectId: sid,
          rankInGrade: rank,
          rationale,
          source: placement ? "AI" : "AI",
        },
      });

      // Log only the subjects whose rank actually changed.
      const from = fromRanks.get(sid);
      if (from !== rank) {
        await tx.quintileMove.create({
          data: {
            reviewPeriodId: args.reviewPeriodId,
            subjectId: sid,
            fromRank: from ?? null,
            toRank: rank,
            fromQuintile: from != null ? quintileForRank(from, gradePop) : null,
            toQuintile: quintileForRank(rank, gradePop),
            rationale: placement
              ? placement.rationale.trim()
              : "Re-numbered due to neighboring placement.",
            source: placement ? "AI" : "AI",
            movedById: me.id,
          },
        });
      }
    }
  });

  revalidatePath("/app/calibration");
}

async function getSubtreeIds(rootUserId: string): Promise<string[]> {
  const collected = new Set<string>([rootUserId]);
  let frontier = [rootUserId];
  while (frontier.length > 0) {
    const reports = await db.user.findMany({
      where: { managerId: { in: frontier } },
      select: { id: true },
    });
    const next: string[] = [];
    for (const r of reports) {
      if (!collected.has(r.id)) {
        collected.add(r.id);
        next.push(r.id);
      }
    }
    frontier = next;
  }
  collected.delete(rootUserId);
  return [...collected];
}

/** Seed assignments for a grade — derives initial ranks from current ratings.
 *  Called when the page first loads and there are subjects without assignments.
 *  Idempotent: only inserts for subjects who don't already have one.
 */
export async function ensureInitialAssignments(args: {
  reviewPeriodId: string;
  grade: string;
}) {
  const me = await getCurrentUser();

  const subjects = await db.user.findMany({
    where: { grade: args.grade },
    select: { id: true },
  });
  if (subjects.length === 0) return;

  const existing = await db.quintileAssignment.findMany({
    where: {
      reviewPeriodId: args.reviewPeriodId,
      subjectId: { in: subjects.map((s) => s.id) },
    },
    select: { subjectId: true },
  });
  const existingIds = new Set(existing.map((a) => a.subjectId));
  const missing = subjects.filter((s) => !existingIds.has(s.id));
  if (missing.length === 0) return;

  // Derive initial rank for missing subjects from their MANAGER reviews in this period.
  const reviews = await db.review.findMany({
    where: {
      reviewPeriodId: args.reviewPeriodId,
      subjectId: { in: missing.map((s) => s.id) },
      kind: "MANAGER",
    },
    select: { subjectId: true, whatRating: true, howRating: true },
  });
  const reviewBySubject = new Map(reviews.map((r) => [r.subjectId, r]));

  function ratingScore(r: string | null): number {
    if (r === "STAND_OUT") return 0;
    if (r === "ACHIEVER") return 1;
    if (r === "NEEDS_IMPROVEMENT") return 2;
    return 3; // unrated → bottom
  }

  // Rank candidates by combined score (lower = better).
  const ranked = missing
    .map((s) => {
      const r = reviewBySubject.get(s.id);
      const score = ratingScore(r?.whatRating ?? null) + ratingScore(r?.howRating ?? null);
      return { subjectId: s.id, score };
    })
    .sort((a, b) => a.score - b.score);

  // If the grade already has assignments, insert new ones at the bottom.
  const currentMax = await db.quintileAssignment.aggregate({
    where: { reviewPeriodId: args.reviewPeriodId, subjectId: { in: subjects.map((s) => s.id) } },
    _max: { rankInGrade: true },
  });
  let nextRank = (currentMax._max.rankInGrade ?? 0) + 1;

  await db.$transaction(async (tx) => {
    for (const r of ranked) {
      await tx.quintileAssignment.create({
        data: {
          reviewPeriodId: args.reviewPeriodId,
          subjectId: r.subjectId,
          rankInGrade: nextRank++,
          rationale: "Initial placement, derived from WHAT × HOW ratings.",
          source: "AI", // derivation counts as AI proposal; human accepts by viewing
        },
      });
      await tx.quintileMove.create({
        data: {
          reviewPeriodId: args.reviewPeriodId,
          subjectId: r.subjectId,
          fromRank: null,
          toRank: nextRank - 1,
          fromQuintile: null,
          toQuintile: quintileForRank(nextRank - 1, ranked.length),
          rationale: "Initial placement, derived from WHAT × HOW ratings.",
          source: "AI",
          movedById: me.id,
        },
      });
    }
  });
}
