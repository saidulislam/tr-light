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

/** A small workbook the user can download, tweak, and re-upload to see the
 *  dedup + create flow in action. Includes 3 existing rows from THEIR subtree
 *  (with values nudged so updates are visible), plus 2 brand-new rows wired
 *  to report to the current user. */
export async function GET() {
  const me = await getCurrentUser();
  if (!canManageData(me)) {
    return Response.json(
      { error: "Only managers can download sample data." },
      { status: 403 }
    );
  }

  // Pull a handful of existing folks from below the current user. We pick
  // varying grades so the demo updates aren't all the same.
  const directs = await db.user.findMany({
    where: { managerId: me.id },
    take: 3,
    orderBy: { name: "asc" },
  });

  // If you have no directs, fall back to any 3 users (excluding the current
  // user — uploading them as a row is a self-edit edge case we don't want to
  // encourage in the sample).
  let existing = directs;
  if (existing.length === 0) {
    existing = await db.user.findMany({
      where: { id: { not: me.id } },
      take: 3,
      orderBy: { name: "asc" },
    });
  }

  // Build the all-users map so we can compute "TD Level 6 Manager" — the
  // 604.x ancestor — for parity with the export schema. The import ignores
  // this column; we populate it for visual consistency.
  const allUsers = await db.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      grade: true,
      managerId: true,
    },
  });
  const byId = new Map(allUsers.map((u) => [u.id, u] as const));

  function directorAncestorFor(userId: string): string {
    let cursor: string | null = userId;
    const seen = new Set<string>();
    let last: { name: string | null; email: string } | null = null;
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const u = byId.get(cursor);
      if (!u) break;
      last = { name: u.name, email: u.email };
      if (u.grade && u.grade.startsWith("604") && u.id !== userId) {
        return formatManagerName(u.name, u.email);
      }
      cursor = u.managerId;
    }
    return last && last.email !== byId.get(userId)?.email
      ? formatManagerName(last.name, last.email)
      : "";
  }

  const headers = [...EXCEL_COLUMNS, "Email", "Manager Email", "Notes"] as const;

  const existingRows = existing.map((u, i) => {
    // Nudge a different field per row so the diff is visible after import.
    const codeNudge = i === 0 ? (u.codeContributions ?? 0) + 25 : u.codeContributions;
    const aiNudge =
      i === 1 ? Math.min(100, (u.aiUsagePercent ?? 0) + 5) : u.aiUsagePercent;
    const ratingNudge: typeof u.priorRating2025 =
      i === 2 ? "STAND_OUT" : u.priorRating2025;

    return {
      "Employee Name": formatManagerName(u.name, u.email),
      "Employee Standard ID": u.id,
      "Grade": u.grade ?? "",
      "Grade Level": u.gradeLevel ?? u.grade ?? "",
      "Work Status": u.workStatus ?? "ACTIVE",
      "Working Hours": u.workingHours ?? 40,
      "Tenure": u.tenureYears ?? "",
      "Job Family": u.jobFamily ?? "",
      "Job Function": u.jobFunction ?? "",
      "Manager Indicator": "N",
      "City, State, Country": formatCityStateCountry(u.city, u.country),
      "TD Level 6 Manager": directorAncestorFor(u.id),
      "2024 Ratings": formatRating(u.priorRating2024),
      "2025 Ratings": formatRating(ratingNudge),
      "2025 Ratings.v2": "",
      "Code Contributions": codeNudge ?? "",
      "AI Usage": aiNudge != null ? `${aiNudge}%` : "",
      "What Evidence": "",
      "How Evidence": "",
      "What Rating": "",
      "How Rating": "",
      "Quintile": "",
      "Email": "",
      "Manager Email": "",
      "Notes":
        i === 0
          ? "Existing employee — Code Contributions bumped by +25 to demo an UPDATE."
          : i === 1
            ? "Existing employee — AI Usage bumped by +5% to demo an UPDATE."
            : "Existing employee — 2025 Rating set to Stand Out to demo an UPDATE.",
    };
  });

  // Pool of synthetic new employees. We pick the first 2 whose emails don't
  // already exist in the DB, so every fresh sample download yields true
  // CREATEs instead of being shadowed by prior test runs.
  const candidates: Array<{
    last: string;
    first: string;
    grade: string;
    tenure: number;
    city: string;
    country: string;
    contrib: number;
    aiUsage: number;
    rating24: string;
    rating25: string;
  }> = [
    { last: "Patel", first: "Anika", grade: "601", tenure: 2.1, city: "Bangalore", country: "India", contrib: 274, aiUsage: 83, rating24: "Achiever", rating25: "Stand Out" },
    { last: "Williams", first: "Theo", grade: "502", tenure: 0.9, city: "Toronto", country: "Canada", contrib: 138, aiUsage: 88, rating24: "Achiever", rating25: "Achiever" },
    { last: "Nakamura", first: "Ren", grade: "602", tenure: 5.2, city: "Tokyo", country: "Japan", contrib: 312, aiUsage: 91, rating24: "Achiever", rating25: "Stand Out" },
    { last: "Costa", first: "Mariana", grade: "601", tenure: 3.4, city: "Lisbon", country: "Portugal", contrib: 257, aiUsage: 79, rating24: "Achiever", rating25: "Achiever" },
    { last: "Ahmed", first: "Yousef", grade: "502", tenure: 1.4, city: "Cairo", country: "Egypt", contrib: 162, aiUsage: 86, rating24: "Achiever", rating25: "Achiever" },
    { last: "Schneider", first: "Lina", grade: "602", tenure: 6.7, city: "Munich", country: "Germany", contrib: 401, aiUsage: 92, rating24: "Stand Out", rating25: "Stand Out" },
    { last: "Okafor", first: "Chinedu", grade: "601", tenure: 2.8, city: "Lagos", country: "Nigeria", contrib: 289, aiUsage: 84, rating24: "Achiever", rating25: "Stand Out" },
    { last: "Petrov", first: "Daria", grade: "502", tenure: 1.1, city: "Belgrade", country: "Serbia", contrib: 147, aiUsage: 90, rating24: "Achiever", rating25: "Achiever" },
  ];

  function emailFor(c: { first: string; last: string }) {
    return `${c.first.toLowerCase()}.${c.last.toLowerCase()}@acme.com`;
  }
  const candidateEmails = candidates.map(emailFor);
  const taken = new Set(
    (
      await db.user.findMany({
        where: { email: { in: candidateEmails } },
        select: { email: true },
      })
    ).map((u) => u.email)
  );
  const picks = candidates.filter((c) => !taken.has(emailFor(c))).slice(0, 2);
  const finalPicks = picks.length > 0 ? picks : candidates.slice(0, 2);

  const newRows = finalPicks.map((c) => ({
    "Employee Name": `${c.last},${c.first}`,
    "Employee Standard ID": "",
    "Grade": c.grade,
    "Grade Level": c.grade,
    "Work Status": "ACTIVE",
    "Working Hours": 40,
    "Tenure": c.tenure,
    "Job Family": "Software Engineering",
    "Job Function": "Technology",
    "Manager Indicator": "N",
    "City, State, Country": `${c.city}, ${c.country}`,
    "TD Level 6 Manager": directorAncestorFor(me.id),
    "2024 Ratings": c.rating24,
    "2025 Ratings": c.rating25,
    "2025 Ratings.v2": "",
    "Code Contributions": c.contrib,
    "AI Usage": `${c.aiUsage}%`,
    "What Evidence": "",
    "How Evidence": "",
    "What Rating": "",
    "How Rating": "",
    "Quintile": "",
    "Email": emailFor(c),
    "Manager Email": me.email,
    "Notes":
      "NEW employee — has Email + Manager Email but no Standard ID. Will be CREATED.",
  }));

  // One in-file DUPLICATE row so the user can see that detection too.
  // Reuses the email from the first new row — both should be rejected.
  const dupRow = newRows.length > 0
    ? {
        ...newRows[0],
        "Employee Name": `${newRows[0]["Employee Name"]} (duplicate)`,
        "Notes":
          "This row has the SAME email as the prior row. Both will be rejected as in-file duplicates.",
      }
    : null;

  const allRows = [...existingRows, ...newRows, ...(dupRow ? [dupRow] : [])];

  const worksheet = XLSX.utils.json_to_sheet(allRows, { header: [...headers] });

  worksheet["!cols"] = headers.map((col) => {
    if (col === "Notes") return { wch: 70 };
    if (col === "What Evidence" || col === "How Evidence") return { wch: 30 };
    if (col === "Employee Name" || col === "TD Level 6 Manager") return { wch: 26 };
    if (col === "Email" || col === "Manager Email") return { wch: 26 };
    if (col === "Employee Standard ID") return { wch: 26 };
    if (col === "City, State, Country") return { wch: 22 };
    return { wch: Math.max(12, col.length + 2) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, SHEET_NAME);

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const today = new Date().toISOString().slice(0, 10);
  const filename = `talent-review-sample-${today}.xlsx`;

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
