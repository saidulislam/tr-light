// Shared rubric types. Used by the active rubric module(s) and consumers.
// Designed so the active rubric can later move to a DB-backed JSON blob
// (one row per RubricVersion) without changing any consumer code.

export type RatingLevel = "NEEDS_IMPROVEMENT" | "ACHIEVER" | "STAND_OUT";
export type Grade = "502" | "601" | "602" | "603.1" | "603.2";
export type Dimension = "WHAT" | "HOW" | "GROWTH";

export interface LevelDescriptions {
  NEEDS_IMPROVEMENT: string;
  ACHIEVER: string;
  STAND_OUT: string;
}

/** A WHAT outcome area (e.g. "Quality, reliability, follow-through"). */
export interface OutcomeArea {
  name: string;
  levels: LevelDescriptions;
}

/** A HOW behavioral anchor under a principle (e.g. "Create clarity" under "Earn Trust"). */
export interface BehavioralAnchor {
  principle: string;
  name: string;
  levels: LevelDescriptions;
}

export interface GradeMeta {
  grade: Grade;
  title: string;
  blastRadius: string;
  /** Plain-English description of what's expected at this scope. */
  scopeDescription: string;
}

export interface GradeContent {
  meta: GradeMeta;
  examples: {
    WHAT: string;
    HOW: string;
    GROWTH: string;
  };
}

export const BLAST_RADII = [
  "Journey of self-improvement",
  "Uplifting the team",
  "Uplifting the area product",
  "Impact across the entire product",
] as const;
export type BlastRadius = (typeof BLAST_RADII)[number];

export interface RubricConfig {
  version: string;
  ratingScale: Record<RatingLevel, string>;
  dimensions: {
    WHAT: { label: string; description: string };
    HOW: { label: string; description: string };
  };
  whatOutcomeAreas: OutcomeArea[];
  howAnchors: BehavioralAnchor[];
  grades: Record<Grade, GradeContent>;
  fallbackExample: string;
}
