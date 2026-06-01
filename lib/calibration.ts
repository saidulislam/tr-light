// Calibration math: derive a person's default quintile from their WHAT × HOW
// ratings (per the rubric matrix), and compute quintile bands from rank +
// grade population (the 10/25/30/25/10 target distribution).

import type { Rating } from "./ai";

/** Per the rubric matrix (image #1):
 *
 *                  | Stand Out | Achiever | Needs Imp
 *  What:Stand Out  |    Q1     |    Q2    |    Q3
 *  What:Achiever   |    Q2     |    Q3    |    Q4
 *  What:Needs Imp  |    Q3     |    Q4    |    Q5
 *
 *  Returns null if either rating is missing — caller decides how to handle
 *  un-rated subjects (typically: park them at the bottom of the rank list).
 */
export function deriveQuintileFromRatings(
  what: Rating | string | null,
  how: Rating | string | null
): number | null {
  if (!what || !how) return null;
  const score = (r: string) =>
    r === "STAND_OUT" ? 0 : r === "ACHIEVER" ? 1 : r === "NEEDS_IMPROVEMENT" ? 2 : -1;
  const w = score(what);
  const h = score(how);
  if (w < 0 || h < 0) return null;
  // Sum = 0 → Q1, 1 → Q2, 2 → Q3, 3 → Q4, 4 → Q5
  return w + h + 1;
}

/** Target distribution: 10 / 25 / 30 / 25 / 10. */
export const QUINTILE_TARGET_PCT = [0.1, 0.25, 0.3, 0.25, 0.1] as const;

export const QUINTILE_LABELS: Record<number, string> = {
  1: "Q1",
  2: "Q2",
  3: "Q3",
  4: "Q4",
  5: "Q5",
};

/** Given a population N for a grade, compute how many people fall in each
 *  quintile by the target percentages. Sum equals N, with rounding-bias to
 *  the middle (Q3 absorbs the rounding so the tails stay tight).
 */
export function targetCountsForPopulation(n: number): number[] {
  if (n <= 0) return [0, 0, 0, 0, 0];
  const raw = QUINTILE_TARGET_PCT.map((p) => p * n);
  const counts = raw.map((x) => Math.round(x));
  // Adjust so sum equals n by tweaking Q3 (index 2).
  const sum = counts.reduce((a, b) => a + b, 0);
  counts[2] += n - sum;
  if (counts[2] < 0) counts[2] = 0;
  return counts;
}

/** Given a person's 1-based rank within a grade of population N, return
 *  the quintile they fall in by the target distribution.
 */
export function quintileForRank(rank: number, n: number): number {
  if (n <= 0 || rank < 1) return 3;
  const counts = targetCountsForPopulation(n);
  let cumulative = 0;
  for (let q = 0; q < 5; q++) {
    cumulative += counts[q];
    if (rank <= cumulative) return q + 1;
  }
  return 5;
}

/** True when grade population is large enough that 10/25/30/25/10 is
 *  meaningfully expressible (at least one person per quintile is possible).
 *  Below this threshold, the page shows a "preview-only" disclaimer.
 */
export const CALIBRATION_BINDING_THRESHOLD = 5;

export function calibrationBindingNote(n: number): string | null {
  if (n >= CALIBRATION_BINDING_THRESHOLD) return null;
  if (n === 0) return "No one is in this grade.";
  if (n === 1) return "Only one person at this grade — quintile math doesn't apply at this level. Calibration becomes binding at Engineering Director level (8+ per grade).";
  return `Only ${n} people at this grade — too small to fit a 10/25/30/25/10 distribution. Calibration becomes binding at Engineering Director level (8+ per grade).`;
}
