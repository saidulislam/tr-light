/**
 * Single source of truth for the Excel import/export schema.
 *
 * Column order matches the screenshot the user shared. If you add a column,
 * update both the export route AND the import route in lockstep.
 */

export const EXCEL_COLUMNS = [
  "Employee Name",
  "Employee Standard ID",
  "Grade",
  "Grade Level",
  "Work Status",
  "Working Hours",
  "Tenure",
  "Job Family",
  "Job Function",
  "Manager Indicator",
  "City, State, Country",
  "TD Level 6 Manager",
  "2024 Ratings",
  "2025 Ratings",
  "2025 Ratings.v2",
  "Code Contributions",
  "AI Usage",
  "What Evidence",
  "How Evidence",
  "What Rating",
  "How Rating",
  "Quintile",
] as const;

export type ExcelColumn = (typeof EXCEL_COLUMNS)[number];

export const SHEET_NAME = "Talent Review";

/** Rating display in Excel — full names so the file is self-documenting.
 *  Import is forgiving and accepts the short codes too. */
export function formatRating(r: string | null | undefined): string {
  if (r === "STAND_OUT") return "Stand Out";
  if (r === "ACHIEVER") return "Achiever";
  if (r === "NEEDS_IMPROVEMENT") return "Needs Improvement";
  return "";
}

/** Inverse of formatRating — forgiving, case-insensitive, accepts common abbrevs.
 *  Returns null if the cell is empty/blank. */
export function parseRating(
  raw: string | number | null | undefined
): "STAND_OUT" | "ACHIEVER" | "NEEDS_IMPROVEMENT" | null {
  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim().toLowerCase();
  if (s === "") return null;
  if (/^stand[\s_-]?out$|^so$|^standout$/.test(s)) return "STAND_OUT";
  if (/^achiever$|^a$|^achiev|^on[\s_-]?track$/.test(s)) return "ACHIEVER";
  if (/^needs?[\s_-]?improvement$|^ni$|^needsimprovement$/.test(s))
    return "NEEDS_IMPROVEMENT";
  return null;
}

export function formatCityStateCountry(
  city: string | null,
  country: string | null
): string {
  const parts = [city, country].filter((p): p is string => !!p && p.trim().length > 0);
  return parts.join(", ");
}

export function formatManagerName(name: string | null, email: string): string {
  // "Lastname,Firstname" matches the screenshot's format.
  const source = name ?? email;
  const tokens = source.trim().split(/\s+/);
  if (tokens.length >= 2) {
    return `${tokens[tokens.length - 1]},${tokens.slice(0, -1).join(" ")}`;
  }
  return source;
}
