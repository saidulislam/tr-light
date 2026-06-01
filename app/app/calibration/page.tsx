import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageData } from "@/lib/permissions";
import { CalibrationBoard } from "@/components/calibration-board";
import { isGradeDisabled, relationshipHiddenIds } from "@/lib/visibility";
import { ensureInitialAssignments } from "./actions";

interface SubjectRow {
  id: string;
  name: string | null;
  email: string;
  title: string | null;
  grade: string;
  whatRating: string | null;
  howRating: string | null;
  reviewStatus: string;
  rankInGrade: number;
  rationale: string;
  source: string;
}

async function getSubtreeIds(rootUserId: string): Promise<string[]> {
  // BFS down through manager → reports relationships.
  const collected = new Set<string>([rootUserId]);
  let frontier = [rootUserId];
  while (frontier.length > 0) {
    const next: string[] = [];
    const reports = await db.user.findMany({
      where: { managerId: { in: frontier } },
      select: { id: true },
    });
    for (const r of reports) {
      if (!collected.has(r.id)) {
        collected.add(r.id);
        next.push(r.id);
      }
    }
    frontier = next;
  }
  // Exclude the root themselves — calibration is about your reports, not you.
  collected.delete(rootUserId);
  return [...collected];
}

export default async function CalibrationPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const me = await getCurrentUser();
  const params = await searchParams;
  const openPeriod = await db.reviewPeriod.findFirst({
    where: { status: "OPEN" },
    orderBy: { endsAt: "asc" },
  });

  if (!openPeriod) {
    return (
      <div className="px-10 py-10 max-w-5xl mx-auto">
        <h1 className="text-[32px] font-semibold tracking-[-0.02em]">
          Calibration
        </h1>
        <p className="text-[13px] text-muted-foreground mt-2">
          No open review period.
        </p>
      </div>
    );
  }

  // Always compute MY subtree — used for scope picker + security check.
  const mySubtreeIds = await getSubtreeIds(me.id);

  // Determine the scope root. Default is `me`. If a scope param is set AND it
  // points to someone in my subtree, use that as the root instead.
  let scopeUserId = me.id;
  let scopeUser = me;
  const rawScope = params?.scope;
  if (rawScope && rawScope !== me.id && mySubtreeIds.includes(rawScope)) {
    const scoped = await db.user.findUnique({
      where: { id: rawScope },
      select: { id: true, name: true, email: true, title: true },
    });
    if (scoped) {
      scopeUserId = scoped.id;
      scopeUser = { ...me, ...scoped };
    }
  }

  // Get the subtree under the chosen scope.
  const subtreeIds =
    scopeUserId === me.id ? mySubtreeIds : await getSubtreeIds(scopeUserId);

  // Scope picker options: every descendant in MY subtree who is themselves a
  // manager (has at least one report). Always include "Your whole org".
  const myDescendants = await db.user.findMany({
    where: { id: { in: mySubtreeIds } },
    select: { id: true, name: true, email: true, title: true, managerId: true },
  });
  const descendantManagerIds = new Set(
    myDescendants
      .map((u) => u.managerId)
      .filter((id): id is string => !!id && (id === me.id || mySubtreeIds.includes(id)))
  );
  const scopeOptions = [
    { id: me.id, name: me.name, email: me.email, title: me.title, isRoot: true },
    ...myDescendants
      .filter((u) => descendantManagerIds.has(u.id))
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        title: u.title,
        isRoot: false,
      }))
      .sort((a, b) =>
        (a.name ?? a.email).localeCompare(b.name ?? b.email)
      ),
  ];

  if (subtreeIds.length === 0) {
    return (
      <div className="px-10 py-10 max-w-5xl mx-auto">
        <h1 className="text-[32px] font-semibold tracking-[-0.02em]">
          Calibration
        </h1>
        <p className="text-[13px] text-muted-foreground mt-2">
          {scopeUserId === me.id
            ? "You don't have any direct or indirect reports to calibrate."
            : `${scopeUser.name ?? scopeUser.email} has no direct or indirect reports.`}
        </p>
      </div>
    );
  }

  // For every grade that has at least one subject in your tree, ensure
  // initial assignments exist (derived from ratings). Apply visibility rules
  // (disabled grades + direct reports of top-of-org) — see lib/visibility.ts.
  const subjects = await db.user.findMany({
    where: { id: { in: subtreeIds } },
    select: { id: true, grade: true },
  });
  const hiddenByRelationship = await relationshipHiddenIds();
  const visibleSubjects = subjects.filter(
    (s) => !isGradeDisabled(s.grade) && !hiddenByRelationship.has(s.id)
  );
  const enabledSubjectIds = visibleSubjects.map((s) => s.id);
  const gradesInTree = [
    ...new Set(
      visibleSubjects
        .map((s) => s.grade)
        .filter((g): g is string => !!g)
    ),
  ];
  for (const grade of gradesInTree) {
    await ensureInitialAssignments({
      reviewPeriodId: openPeriod.id,
      grade,
    });
  }

  // Load all the assignment + subject + rating data needed to render —
  // restricted to enabled grades within the chosen scope.
  const assignments = await db.quintileAssignment.findMany({
    where: {
      reviewPeriodId: openPeriod.id,
      subject: { id: { in: enabledSubjectIds } },
    },
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          email: true,
          title: true,
          grade: true,
        },
      },
    },
    orderBy: { rankInGrade: "asc" },
  });

  const reviews = await db.review.findMany({
    where: {
      reviewPeriodId: openPeriod.id,
      subjectId: { in: enabledSubjectIds },
      kind: "MANAGER",
    },
    select: {
      subjectId: true,
      whatRating: true,
      howRating: true,
      status: true,
    },
  });
  const reviewBySubject = new Map(reviews.map((r) => [r.subjectId, r]));

  const rows: SubjectRow[] = assignments
    .filter((a) => a.subject.grade)
    .map((a) => {
      const r = reviewBySubject.get(a.subject.id);
      return {
        id: a.subject.id,
        name: a.subject.name,
        email: a.subject.email,
        title: a.subject.title,
        grade: a.subject.grade!,
        whatRating: r?.whatRating ?? null,
        howRating: r?.howRating ?? null,
        reviewStatus: r?.status ?? "DRAFT",
        rankInGrade: a.rankInGrade,
        rationale: a.rationale,
        source: a.source,
      };
    });

  // Group by grade, sort each by rank.
  const byGrade = new Map<string, SubjectRow[]>();
  for (const row of rows) {
    if (!byGrade.has(row.grade)) byGrade.set(row.grade, []);
    byGrade.get(row.grade)!.push(row);
  }
  for (const arr of byGrade.values()) arr.sort((a, b) => a.rankInGrade - b.rankInGrade);
  const grades = [...byGrade.keys()].sort();

  // Recent moves for the activity log (scope-bounded, enabled grades only).
  const recentMoves = await db.quintileMove.findMany({
    where: {
      reviewPeriodId: openPeriod.id,
      subjectId: { in: enabledSubjectIds },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      subject: { select: { name: true, email: true, grade: true } },
      movedBy: { select: { name: true, email: true } },
    },
  });

  return (
    <CalibrationBoard
      currentUser={{
        id: me.id,
        name: me.name,
        email: me.email,
        canManage: canManageData(me),
      }}
      period={{ id: openPeriod.id, name: openPeriod.name, endsAt: openPeriod.endsAt }}
      gradesInOrder={grades}
      rowsByGrade={Object.fromEntries(grades.map((g) => [g, byGrade.get(g)!]))}
      recentMoves={recentMoves.map((m) => ({
        id: m.id,
        createdAt: m.createdAt,
        subjectName: m.subject.name ?? m.subject.email,
        subjectGrade: m.subject.grade ?? "?",
        fromRank: m.fromRank,
        toRank: m.toRank,
        fromQuintile: m.fromQuintile,
        toQuintile: m.toQuintile,
        rationale: m.rationale,
        source: m.source,
        movedByName: m.movedBy.name ?? m.movedBy.email,
      }))}
      scope={{
        currentScopeId: scopeUserId,
        currentScopeName: scopeUser.name ?? scopeUser.email,
        currentScopeIsRoot: scopeUserId === me.id,
        options: scopeOptions,
      }}
    />
  );
}
