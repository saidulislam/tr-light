import * as XLSX from "xlsx";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { canManageData, isAdmin } from "@/lib/permissions";
import { parseRating, formatRating } from "@/lib/excel-schema";

/** BFS down through manager→reports, including the root. */
async function subtreeIncludingRoot(rootId: string): Promise<Set<string>> {
  const collected = new Set<string>([rootId]);
  let frontier = [rootId];
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
  return collected;
}

interface UpdateRow {
  row: number;
  name: string;
  email: string;
  matchedBy: "Standard ID" | "Email" | "Name";
  changes: string[]; // "Code Contributions: 487 → 520"
  reviewChanges: string[]; // "What Rating: Achiever → Stand Out"
}

interface CreateRow {
  row: number;
  name: string;
  email: string;
  grade: string;
  title: string;
  managerName: string;
}

interface RowError {
  row: number;
  message: string;
}

interface ImportSummary {
  totalRows: number;
  updates: UpdateRow[];
  creates: CreateRow[];
  skipped: number;
  errors: RowError[];
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/%$/, ""));
  return Number.isFinite(n) ? n : null;
}

function str(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function parseRatingCell(v: unknown) {
  if (v === null || v === undefined) return null;
  if (typeof v === "number") return parseRating(v);
  return parseRating(String(v));
}

/** "Last,First" → "First Last", forgiving of whitespace. */
function denormalizeName(raw: string): string {
  if (!raw.includes(",")) return raw;
  const [last, ...firstParts] = raw.split(",");
  return `${firstParts.join(" ").trim()} ${last.trim()}`.trim();
}

/** Inferred role for a new user based on grade. Mirrors the seed convention. */
function roleForGrade(grade: string): string {
  if (grade.startsWith("604") || grade.startsWith("605")) return "ADMIN";
  if (grade.startsWith("603")) return "MANAGER";
  return "EMPLOYEE";
}

function pushDiff(
  list: string[],
  label: string,
  before: string | number | null | undefined,
  after: string | number | null | undefined
) {
  const a = before == null || before === "" ? "—" : String(before);
  const b = after == null || after === "" ? "—" : String(after);
  if (a === b) return;
  list.push(`${label}: ${a} → ${b}`);
}

export async function POST(req: Request) {
  const me = await getCurrentUser();
  if (!canManageData(me)) {
    return Response.json(
      { error: "Only managers can upload employee data." },
      { status: 403 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return Response.json(
      { error: "Request must be multipart/form-data with a 'file' field." },
      { status: 400 }
    );
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return Response.json({ error: "File too large (10 MB max)." }, { status: 413 });
  }

  let rows: Record<string, unknown>[];
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: "buffer" });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      return Response.json({ error: "Workbook has no sheets." }, { status: 400 });
    }
    const sheet = wb.Sheets[firstSheetName];
    rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  } catch (e) {
    return Response.json(
      {
        error: `Could not parse this file as Excel. Save it as .xlsx and try again. (${e instanceof Error ? e.message : "unknown"})`,
      },
      { status: 400 }
    );
  }

  if (rows.length === 0) {
    return Response.json(
      {
        error:
          "Sheet has no data rows. Make sure the first row is headers and at least one data row follows.",
      },
      { status: 400 }
    );
  }

  // Pre-pass: detect in-file duplicate emails / standard IDs so we don't
  // silently apply two conflicting rows to the same person.
  const seenIds = new Map<string, number>();
  const seenEmails = new Map<string, number>();
  const duplicateErrors: RowError[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    const id = str(row["Employee Standard ID"]);
    const email = str(row["Email"]).toLowerCase();
    if (id) {
      if (seenIds.has(id)) {
        duplicateErrors.push({
          row: rowNum,
          message: `Standard ID "${id}" appears in row ${seenIds.get(id)} too. Each ID can appear only once per file.`,
        });
      } else {
        seenIds.set(id, rowNum);
      }
    }
    if (email) {
      if (seenEmails.has(email)) {
        duplicateErrors.push({
          row: rowNum,
          message: `Email "${email}" appears in row ${seenEmails.get(email)} too. Each email can appear only once per file.`,
        });
      } else {
        seenEmails.set(email, rowNum);
      }
    }
  }

  const openPeriod = await db.reviewPeriod.findFirst({
    where: { status: "OPEN" },
    orderBy: { endsAt: "asc" },
    select: { id: true },
  });

  // Scope check: non-MD managers can only touch users in their subtree.
  // MD is unrestricted.
  const allowAnyone = isAdmin(me);
  const allowedIds = allowAnyone ? null : await subtreeIncludingRoot(me.id);

  const summary: ImportSummary = {
    totalRows: rows.length,
    updates: [],
    creates: [],
    skipped: 0,
    errors: [...duplicateErrors],
  };

  // Track in-batch dup rows so we skip processing them (we already reported).
  const dupRowSet = new Set(duplicateErrors.map((d) => d.row));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    if (dupRowSet.has(rowNum)) continue;

    const standardId = str(row["Employee Standard ID"]);
    const employeeName = str(row["Employee Name"]);
    const rowEmail = str(row["Email"]).toLowerCase();
    const managerEmail = str(row["Manager Email"]).toLowerCase();

    if (!standardId && !employeeName && !rowEmail) {
      summary.skipped++;
      continue;
    }

    try {
      // Match strategy: Standard ID → Email → Name.
      let user = standardId
        ? await db.user.findUnique({ where: { id: standardId } })
        : null;
      let matchedBy: UpdateRow["matchedBy"] | null = user ? "Standard ID" : null;

      if (!user && rowEmail) {
        user = await db.user.findUnique({ where: { email: rowEmail } });
        if (user) matchedBy = "Email";
      }

      if (!user && employeeName) {
        const candidates = [employeeName];
        if (employeeName.includes(",")) {
          candidates.push(denormalizeName(employeeName));
        }
        for (const c of candidates) {
          user = await db.user.findFirst({ where: { name: c } });
          if (user) {
            matchedBy = "Name";
            break;
          }
        }
      }

      if (!user) {
        // CREATE path — requires Email + Manager Email + Grade + Name.
        const grade = str(row["Grade"]);
        if (!rowEmail || !managerEmail || !grade || !employeeName) {
          summary.errors.push({
            row: rowNum,
            message:
              "No matching user found. To create a new employee, fill in Email, Manager Email, Grade, and Employee Name.",
          });
          continue;
        }

        const manager = await db.user.findUnique({
          where: { email: managerEmail },
        });
        if (!manager) {
          summary.errors.push({
            row: rowNum,
            message: `Manager Email "${managerEmail}" doesn't match any existing user.`,
          });
          continue;
        }

        // Scope check for creates: the new hire's manager must be you or
        // someone in your tree.
        if (allowedIds && !allowedIds.has(manager.id)) {
          summary.errors.push({
            row: rowNum,
            message: `You can only add new employees to your own org. "${manager.name ?? manager.email}" is outside your subtree.`,
          });
          continue;
        }

        const created = await db.user.create({
          data: {
            email: rowEmail,
            name: denormalizeName(employeeName),
            role: roleForGrade(grade),
            title: str(row["Job Function"]) || str(row["Grade Level"]) || "Engineer",
            grade,
            gradeLevel: str(row["Grade Level"]) || grade,
            jobFamily: str(row["Job Family"]) || "Software Engineering",
            jobFunction: str(row["Job Function"]) || "Technology",
            city: (() => {
              const cs = str(row["City, State, Country"]);
              if (!cs) return "Hyderabad";
              return cs.split(",")[0].trim() || "Hyderabad";
            })(),
            country: (() => {
              const cs = str(row["City, State, Country"]);
              if (!cs) return "India";
              const parts = cs.split(",").map((p) => p.trim()).filter(Boolean);
              return parts[parts.length - 1] || "India";
            })(),
            tenureYears: num(row["Tenure"]) ?? 0,
            workingHours: num(row["Working Hours"]) ?? 40,
            workStatus: (str(row["Work Status"]) || "ACTIVE").toUpperCase(),
            priorRating2024: parseRatingCell(row["2024 Ratings"]),
            priorRating2025: parseRatingCell(row["2025 Ratings"]),
            codeContributions: num(row["Code Contributions"]),
            aiUsagePercent: num(row["AI Usage"]),
            managerId: manager.id,
          },
        });

        summary.creates.push({
          row: rowNum,
          name: created.name ?? created.email,
          email: created.email,
          grade: created.grade ?? "",
          title: created.title ?? "",
          managerName: manager.name ?? manager.email,
        });

        // Also create the MANAGER review shell for the open period.
        if (openPeriod) {
          await db.review.create({
            data: {
              reviewPeriodId: openPeriod.id,
              subjectId: created.id,
              reviewerId: manager.id,
              kind: "MANAGER",
              status: "DRAFT",
            },
          });
        }
        continue;
      }

      // Scope check for updates: the matched user must be in your tree.
      if (allowedIds && !allowedIds.has(user.id)) {
        summary.errors.push({
          row: rowNum,
          message: `You can only update employees in your own org. "${user.name ?? user.email}" is outside your subtree.`,
        });
        continue;
      }

      // UPDATE path — compute diff first, then apply, then report what changed.
      const changes: string[] = [];

      const newGrade = str(row["Grade"]);
      if (newGrade && newGrade !== user.grade) {
        pushDiff(changes, "Grade", user.grade, newGrade);
      }
      const newGradeLevel = str(row["Grade Level"]);
      if (newGradeLevel && newGradeLevel !== user.gradeLevel) {
        pushDiff(changes, "Grade Level", user.gradeLevel, newGradeLevel);
      }
      const newWorkStatus = str(row["Work Status"]).toUpperCase();
      if (newWorkStatus && newWorkStatus !== user.workStatus) {
        pushDiff(changes, "Work Status", user.workStatus, newWorkStatus);
      }
      const newWorkingHours = num(row["Working Hours"]);
      if (newWorkingHours != null && newWorkingHours !== user.workingHours) {
        pushDiff(changes, "Working Hours", user.workingHours, newWorkingHours);
      }
      const newTenure = num(row["Tenure"]);
      if (newTenure != null && newTenure !== user.tenureYears) {
        pushDiff(changes, "Tenure", user.tenureYears, newTenure);
      }
      const newJobFamily = str(row["Job Family"]);
      if (newJobFamily && newJobFamily !== user.jobFamily) {
        pushDiff(changes, "Job Family", user.jobFamily, newJobFamily);
      }
      const newJobFunction = str(row["Job Function"]);
      if (newJobFunction && newJobFunction !== user.jobFunction) {
        pushDiff(changes, "Job Function", user.jobFunction, newJobFunction);
      }
      const newCodeContrib = num(row["Code Contributions"]);
      if (newCodeContrib != null && newCodeContrib !== user.codeContributions) {
        pushDiff(changes, "Code Contributions", user.codeContributions, newCodeContrib);
      }
      const newAiUsage = num(row["AI Usage"]);
      if (newAiUsage != null && newAiUsage !== user.aiUsagePercent) {
        pushDiff(
          changes,
          "AI Usage",
          user.aiUsagePercent != null ? `${user.aiUsagePercent}%` : null,
          `${newAiUsage}%`
        );
      }
      const newCityCountry = str(row["City, State, Country"]);
      let newCity: string | null = null;
      let newCountry: string | null = null;
      if (newCityCountry) {
        const parts = newCityCountry
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        newCity = parts[0] ?? null;
        newCountry = parts.length >= 2 ? parts[parts.length - 1] : null;
        if (newCity && newCity !== user.city) {
          pushDiff(changes, "City", user.city, newCity);
        }
        if (newCountry && newCountry !== user.country) {
          pushDiff(changes, "Country", user.country, newCountry);
        }
      }
      const newPrior24 = parseRatingCell(row["2024 Ratings"]);
      if (newPrior24 && newPrior24 !== user.priorRating2024) {
        pushDiff(
          changes,
          "2024 Rating",
          formatRating(user.priorRating2024),
          formatRating(newPrior24)
        );
      }
      const newPrior25 = parseRatingCell(row["2025 Ratings"]);
      if (newPrior25 && newPrior25 !== user.priorRating2025) {
        pushDiff(
          changes,
          "2025 Rating",
          formatRating(user.priorRating2025),
          formatRating(newPrior25)
        );
      }

      // Apply the update if anything changed.
      if (changes.length > 0) {
        const userUpdate: Record<string, unknown> = {};
        if (newGrade) userUpdate.grade = newGrade;
        if (newGradeLevel) userUpdate.gradeLevel = newGradeLevel;
        if (newWorkStatus) userUpdate.workStatus = newWorkStatus;
        if (newWorkingHours != null) userUpdate.workingHours = newWorkingHours;
        if (newTenure != null) userUpdate.tenureYears = newTenure;
        if (newJobFamily) userUpdate.jobFamily = newJobFamily;
        if (newJobFunction) userUpdate.jobFunction = newJobFunction;
        if (newCodeContrib != null) userUpdate.codeContributions = newCodeContrib;
        if (newAiUsage != null) userUpdate.aiUsagePercent = newAiUsage;
        if (newCity) userUpdate.city = newCity;
        if (newCountry) userUpdate.country = newCountry;
        if (newPrior24) userUpdate.priorRating2024 = newPrior24;
        if (newPrior25) userUpdate.priorRating2025 = newPrior25;
        await db.user.update({ where: { id: user.id }, data: userUpdate });
      }

      // Optional: update the MANAGER review ratings for the open period.
      const reviewChanges: string[] = [];
      if (openPeriod) {
        const whatRating = parseRatingCell(row["What Rating"]);
        const howRating = parseRatingCell(row["How Rating"]);
        if (whatRating || howRating) {
          const review = await db.review.findFirst({
            where: {
              reviewPeriodId: openPeriod.id,
              subjectId: user.id,
              kind: "MANAGER",
            },
          });
          if (review) {
            if (whatRating && whatRating !== review.whatRating) {
              pushDiff(
                reviewChanges,
                "What Rating",
                formatRating(review.whatRating),
                formatRating(whatRating)
              );
            }
            if (howRating && howRating !== review.howRating) {
              pushDiff(
                reviewChanges,
                "How Rating",
                formatRating(review.howRating),
                formatRating(howRating)
              );
            }
            if (reviewChanges.length > 0) {
              await db.review.update({
                where: { id: review.id },
                data: {
                  ...(whatRating && whatRating !== review.whatRating
                    ? { whatRating }
                    : {}),
                  ...(howRating && howRating !== review.howRating
                    ? { howRating }
                    : {}),
                },
              });
            }
          }
        }
      }

      if (changes.length > 0 || reviewChanges.length > 0) {
        summary.updates.push({
          row: rowNum,
          name: user.name ?? user.email,
          email: user.email,
          matchedBy: matchedBy!,
          changes,
          reviewChanges,
        });
      } else {
        // Matched but nothing actually changed — count as a quiet duplicate.
        summary.updates.push({
          row: rowNum,
          name: user.name ?? user.email,
          email: user.email,
          matchedBy: matchedBy!,
          changes: [],
          reviewChanges: [],
        });
      }
    } catch (e) {
      summary.errors.push({
        row: rowNum,
        message: e instanceof Error ? e.message : "Unknown error",
      });
    }
  }

  return Response.json(summary);
}
