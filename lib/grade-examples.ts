// Back-compat shim. Rubric content moved to `./rubric/`. New code should
// import from `@/lib/rubric` directly. This file just re-exports so the
// large-batch rename doesn't churn imports across components.
export {
  BLAST_RADII,
  defaultBlastRadius,
  effectiveBlastRadius,
  gradeExample,
  gradeMeta,
} from "./rubric";
export type {
  BlastRadius,
  Dimension,
  Grade,
} from "./rubric";
