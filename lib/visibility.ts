import { db } from "./db";

/**
 * Visibility rules for calibration and the reviews inbox. Data is kept
 * intact — surfaces just filter these out. To re-enable a rule, flip the
 * flag (or empty the array) and the surfaces will show them again.
 */

/** Grade prefixes that are temporarily disabled. Matched as a string prefix
 *  so "604" hides both "604.1" and "604.2". */
export const DISABLED_GRADE_PREFIXES = ["604"];

/** Hide direct reports of any user at the top of the org (managerId === null
 *  — typically the Managing Director). Their subordinates still appear. */
export const HIDE_DIRECT_REPORTS_OF_TOP = true;

export function isGradeDisabled(grade: string | null | undefined): boolean {
  if (!grade) return false;
  return DISABLED_GRADE_PREFIXES.some((p) => grade.startsWith(p));
}

/** Returns the set of user IDs that should be hidden by relationship-based
 *  rules (currently: direct reports of any top-of-org user). */
export async function relationshipHiddenIds(): Promise<Set<string>> {
  if (!HIDE_DIRECT_REPORTS_OF_TOP) return new Set();
  const tops = await db.user.findMany({
    where: { managerId: null },
    select: { id: true },
  });
  if (tops.length === 0) return new Set();
  const directs = await db.user.findMany({
    where: { managerId: { in: tops.map((t) => t.id) } },
    select: { id: true },
  });
  return new Set(directs.map((d) => d.id));
}
