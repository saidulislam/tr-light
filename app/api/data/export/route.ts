import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageData } from "@/lib/permissions";
import {
  EXCEL_COLUMNS,
  SHEET_NAME,
  formatCityStateCountry,
  formatManagerName,
  formatRating,
} from "@/lib/excel-schema";
import { quintileForRank } from "@/lib/calibration";

/** BFS down through manager→reports, including the root. */
async function getSubtreeIdsIncludingRoot(rootUserId: string): Promise<string[]> {
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
  return [...collected];
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "user";
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function evidenceToBullets(
  entries: { body: string; type: string; createdAt: Date }[]
): string {
  return entries
    .map((e) => {
      const date = DATE_FMT.format(e.createdAt);
      const prefix = e.type === "CONCERN" ? "[CONCERN] " : "";
      return `• [${date}] ${prefix}${e.body}`;
    })
    .join("\n\n");
}

/** Walks the manager chain to find the ancestor whose grade starts with "604"
 *  — the Engineering Director tier in our org. Falls back to the topmost
 *  ancestor if no 604 is found. */
function findDirectorAncestor(
  userId: string,
  byId: Map<string, { id: string; managerId: string | null; grade: string | null; name: string | null; email: string }>
): { name: string | null; email: string } | null {
  let cursor: string | null = userId;
  let last: { name: string | null; email: string } | null = null;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const u = byId.get(cursor);
    if (!u) break;
    last = { name: u.name, email: u.email };
    if (u.grade && u.grade.startsWith("604") && u.id !== userId) {
      return { name: u.name, email: u.email };
    }
    cursor = u.managerId;
  }
  // No 604 ancestor — return the topmost we walked (excluding self).
  return last && last.email !== byId.get(userId)?.email ? last : null;
}

export async function GET(req: Request) {
  const me = await getCurrentUser();
  if (!canManageData(me)) {
    return Response.json(
      { error: "Only managers can download employee data." },
      { status: 403 }
    );
  }

  // Effective root for the export. Defaults to the signed-in user (so you
  // download your whole subtree, including yourself). Optional ?scope=<userId>
  // narrows further — validated against your own subtree so you can't export
  // outside your scope.
  const url = new URL(req.url);
  const scopeParam = url.searchParams.get("scope");
  const mySubtree = await getSubtreeIdsIncludingRoot(me.id);

  let rootUserId = me.id;
  let rootUser = me;
  if (scopeParam && scopeParam !== me.id && mySubtree.includes(scopeParam)) {
    const scoped = await db.user.findUnique({ where: { id: scopeParam } });
    if (scoped) {
      rootUserId = scoped.id;
      rootUser = scoped;
    }
  }
  const subtreeIds =
    rootUserId === me.id ? mySubtree : await getSubtreeIdsIncludingRoot(rootUserId);

  const [users, openPeriod, allReviews, allAssignments] = await Promise.all([
    db.user.findMany({
      where: { id: { in: subtreeIds } },
      orderBy: [{ grade: "desc" }, { name: "asc" }],
    }),
    db.reviewPeriod.findFirst({
      where: { status: "OPEN" },
      orderBy: { endsAt: "asc" },
      select: { id: true },
    }),
    db.review.findMany({
      where: { kind: "MANAGER", subjectId: { in: subtreeIds } },
      include: {
        evidenceEntries: { orderBy: { createdAt: "desc" } },
      },
    }),
    db.quintileAssignment.findMany({
      include: { subject: { select: { grade: true } } },
    }),
  ]);

  const byId = new Map(
    users.map((u) => [
      u.id,
      { id: u.id, managerId: u.managerId, grade: u.grade, name: u.name, email: u.email },
    ])
  );

  // Whether each user has direct reports — for the "Manager Indicator" column.
  const managerIds = new Set(
    users.map((u) => u.managerId).filter((id): id is string => !!id)
  );

  // Latest MANAGER review per subject. Prefer open period; otherwise use the
  // most recently updated review across periods.
  const reviewsBySubject = new Map<string, (typeof allReviews)[number]>();
  for (const r of allReviews) {
    const existing = reviewsBySubject.get(r.subjectId);
    if (!existing) {
      reviewsBySubject.set(r.subjectId, r);
      continue;
    }
    if (openPeriod && r.reviewPeriodId === openPeriod.id) {
      reviewsBySubject.set(r.subjectId, r);
      continue;
    }
    if (r.updatedAt > existing.updatedAt) {
      reviewsBySubject.set(r.subjectId, r);
    }
  }

  // Compute the grade population so we can derive each assignment's quintile.
  const gradePopulation = new Map<string, number>();
  for (const a of allAssignments) {
    if (!a.subject.grade) continue;
    if (!openPeriod || a.reviewPeriodId !== openPeriod.id) continue;
    gradePopulation.set(
      a.subject.grade,
      (gradePopulation.get(a.subject.grade) ?? 0) + 1
    );
  }
  const assignmentBySubject = new Map(
    allAssignments
      .filter((a) => !openPeriod || a.reviewPeriodId === openPeriod.id)
      .map((a) => [a.subjectId, a])
  );

  const rows = users.map((u) => {
    const review = reviewsBySubject.get(u.id);
    const whatEntries = (review?.evidenceEntries ?? []).filter((e) => e.dimension === "WHAT");
    const howEntries = (review?.evidenceEntries ?? []).filter((e) => e.dimension === "HOW");
    const director = findDirectorAncestor(u.id, byId);
    const assignment = assignmentBySubject.get(u.id);
    const pop = u.grade ? gradePopulation.get(u.grade) ?? 0 : 0;
    const quintile =
      assignment && pop > 0 ? quintileForRank(assignment.rankInGrade, pop) : "";

    return {
      "Employee Name": formatManagerName(u.name, u.email),
      "Employee Standard ID": u.id,
      "Grade": u.grade ?? "",
      "Grade Level": u.gradeLevel ?? u.grade ?? "",
      "Work Status": u.workStatus ?? "",
      "Working Hours": u.workingHours ?? "",
      "Tenure": u.tenureYears ?? "",
      "Job Family": u.jobFamily ?? "",
      "Job Function": u.jobFunction ?? "",
      "Manager Indicator": managerIds.has(u.id) ? "Y" : "N",
      "City, State, Country": formatCityStateCountry(u.city, u.country),
      "TD Level 6 Manager": director ? formatManagerName(director.name, director.email) : "",
      "2024 Ratings": formatRating(u.priorRating2024),
      "2025 Ratings": formatRating(u.priorRating2025),
      "2025 Ratings.v2": "",
      "Code Contributions": u.codeContributions ?? "",
      "AI Usage": u.aiUsagePercent != null ? `${u.aiUsagePercent}%` : "",
      "What Evidence": evidenceToBullets(whatEntries),
      "How Evidence": evidenceToBullets(howEntries),
      "What Rating": formatRating(review?.whatRating),
      "How Rating": formatRating(review?.howRating),
      "Quintile": quintile === "" ? "" : `Q${quintile}`,
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(rows, { header: [...EXCEL_COLUMNS] });

  // Auto-width per column based on header length (bounded). Wider for evidence.
  worksheet["!cols"] = EXCEL_COLUMNS.map((col) => {
    if (col === "What Evidence" || col === "How Evidence") return { wch: 80 };
    if (col === "Employee Name" || col === "TD Level 6 Manager") return { wch: 28 };
    if (col === "City, State, Country" || col === "Job Family") return { wch: 22 };
    if (col === "Employee Standard ID") return { wch: 28 };
    return { wch: Math.max(12, col.length + 2) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const today = new Date().toISOString().slice(0, 10);
  const ownerSlug = slugify(rootUser.name ?? rootUser.email);
  const filename = `talent-review-${ownerSlug}-${today}.xlsx`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
