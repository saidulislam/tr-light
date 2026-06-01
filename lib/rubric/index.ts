// The active rubric. ALL rubric content is in `v1-acme.ts`.
//
// FUTURE — DB-backed rubric (configurable upload):
//   1. Add `RubricVersion { id, version, payload: Json, activatedAt }` model.
//   2. Replace this file's `RUBRIC` export with `await getActiveRubric()`
//      (turn callers async, or pre-fetch at request entry and pass in).
//   3. Add an admin route (`/app/rubric-admin`) that accepts JSON matching
//      `RubricConfig` (or YAML if preferred), validates with zod, inserts a
//      new RubricVersion, and atomically flips `activatedAt`.
//   4. Each Review should snapshot the active `version` string at submission
//      time (already in schema as a string field, just add a column) so
//      historical reviews always render against the rubric they were judged on.
//
// The `RubricConfig` shape in `./types.ts` is the contract. As long as that
// shape stays stable, the swap to DB-backed is local to this file.

import { RUBRIC_V1_ACME } from "./v1-acme";
import type {
  BlastRadius,
  Dimension,
  Grade,
  GradeContent,
  GradeMeta,
  RubricConfig,
} from "./types";

export { BLAST_RADII } from "./types";
export type {
  BehavioralAnchor,
  BlastRadius,
  Dimension,
  Grade,
  GradeContent,
  GradeMeta,
  LevelDescriptions,
  OutcomeArea,
  RatingLevel,
  RubricConfig,
} from "./types";

export const RUBRIC: RubricConfig = RUBRIC_V1_ACME;

// ─── Helpers for the rest of the app ────────────────────────────────────

export function gradeMeta(grade: string | null): GradeMeta | null {
  if (!grade) return null;
  const content: GradeContent | undefined = (
    RUBRIC.grades as Record<string, GradeContent>
  )[grade];
  return content?.meta ?? null;
}

export function defaultBlastRadius(grade: string | null): BlastRadius | null {
  const m = gradeMeta(grade);
  return (m?.blastRadius as BlastRadius | undefined) ?? null;
}

export function effectiveBlastRadius(
  grade: string | null,
  override: string | null
): { value: string | null; source: "override" | "grade" | "none" } {
  if (override) return { value: override, source: "override" };
  const def = defaultBlastRadius(grade);
  if (def) return { value: def, source: "grade" };
  return { value: null, source: "none" };
}

export function gradeExample(grade: string | null, dimension: Dimension) {
  const meta = gradeMeta(grade);
  if (!meta) return { meta: null, example: RUBRIC.fallbackExample };
  const content = (RUBRIC.grades as Record<string, GradeContent>)[meta.grade];
  return { meta, example: content.examples[dimension] };
}

/** Inline rendering helpers for AI prompts. Each returns a markdown-ish string
 *  scoped to the calling context, so prompts stay focused and short(ish). */

export function ratingScaleBlock(): string {
  return [
    "RATING SCALE (3 levels, both WHAT and HOW):",
    `- STAND_OUT: ${RUBRIC.ratingScale.STAND_OUT}`,
    `- ACHIEVER: ${RUBRIC.ratingScale.ACHIEVER}`,
    `- NEEDS_IMPROVEMENT: ${RUBRIC.ratingScale.NEEDS_IMPROVEMENT}`,
  ].join("\n");
}

export function gradeContextBlock(grade: string | null, dimension: Dimension): string {
  const meta = gradeMeta(grade);
  if (!meta) {
    return `SUBJECT GRADE: unknown — apply judgment against a generic IC bar.`;
  }
  const content = (RUBRIC.grades as Record<string, GradeContent>)[meta.grade];
  return [
    `SUBJECT GRADE: ${meta.grade} — ${meta.title}`,
    `Blast radius: ${meta.blastRadius}`,
    `Scope expectations: ${meta.scopeDescription}`,
    ``,
    `What "good" looks like at this grade on ${dimension}:`,
    content.examples[dimension],
  ].join("\n");
}

export function whatOutcomeAreasBlock(): string {
  const lines: string[] = ["WHAT — OUTCOME AREAS (use these as anchors):"];
  for (const area of RUBRIC.whatOutcomeAreas) {
    lines.push(``);
    lines.push(`• ${area.name}`);
    lines.push(`    Needs Improvement: ${area.levels.NEEDS_IMPROVEMENT}`);
    lines.push(`    Achiever: ${area.levels.ACHIEVER}`);
    lines.push(`    Stand Out: ${area.levels.STAND_OUT}`);
  }
  return lines.join("\n");
}

export function howAnchorsBlock(): string {
  const lines: string[] = [
    "HOW — BEHAVIORAL ANCHORS (three principles, nine anchors):",
  ];
  let currentPrinciple = "";
  for (const a of RUBRIC.howAnchors) {
    if (a.principle !== currentPrinciple) {
      lines.push(``);
      lines.push(`▸ ${a.principle}`);
      currentPrinciple = a.principle;
    }
    lines.push(``);
    lines.push(`  • ${a.name}`);
    lines.push(`      Needs Improvement: ${a.levels.NEEDS_IMPROVEMENT}`);
    lines.push(`      Achiever: ${a.levels.ACHIEVER}`);
    lines.push(`      Stand Out: ${a.levels.STAND_OUT}`);
  }
  return lines.join("\n");
}
