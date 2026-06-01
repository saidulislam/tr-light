import Anthropic from "@anthropic-ai/sdk";
import {
  BLAST_RADII,
  defaultBlastRadius,
  gradeContextBlock,
  howAnchorsBlock,
  ratingScaleBlock,
  whatOutcomeAreasBlock,
  type BlastRadius,
} from "./rubric";

export type Rating = "STAND_OUT" | "ACHIEVER" | "NEEDS_IMPROVEMENT";
export type Dimension = "WHAT" | "HOW";

export interface SubjectContext {
  name: string | null;
  grade: string | null;
  jobFamily: string | null;
  tenureYears: number | null;
  priorRating2024: string | null;
  priorRating2025: string | null;
  codeContributions: number | null;
  aiUsagePercent: number | null;
}

export interface SuggestRatingInput {
  dimension: Dimension;
  subject: SubjectContext;
  evidence: string;
}

export interface SuggestRatingOutput {
  rating: Rating;
  rationale: string;
  source: "claude" | "mock";
}

function ratingSystemPrompt(dimension: Dimension, grade: string | null): string {
  const anchorsBlock =
    dimension === "WHAT" ? whatOutcomeAreasBlock() : howAnchorsBlock();
  return [
    "# ACME Talent Review rubric",
    "",
    "You are an experienced talent reviewer at ACME Inc. Use the rubric below to suggest a rating that is honest, well-anchored, and grade-appropriate.",
    "",
    ratingScaleBlock(),
    "",
    "RATE AGAINST THE GRADE-APPROPRIATE BAR, not against absolute scope.",
    "",
    gradeContextBlock(grade, dimension),
    "",
    anchorsBlock,
  ].join("\n");
}

export async function suggestRating(
  input: SuggestRatingInput
): Promise<SuggestRatingOutput> {
  if (!process.env.AI_API_KEY) {
    return mockSuggestion(input);
  }

  const client = new Anthropic({ apiKey: process.env.AI_API_KEY });
  const dimensionLabel = input.dimension === "WHAT" ? "WHAT (outcomes delivered)" : "HOW (behaviors used)";
  const s = input.subject;

  const userMessage = `Suggest a rating on the ${dimensionLabel} dimension for the subject below.

Subject:
- Name: ${s.name ?? "(unknown)"}
- Grade: ${s.grade ?? "(unknown)"}
- Job family: ${s.jobFamily ?? "(unknown)"}
- Tenure: ${s.tenureYears != null ? `${s.tenureYears} years` : "(unknown)"}
- Prior ratings: 2024 = ${s.priorRating2024 ?? "n/a"}, 2025 = ${s.priorRating2025 ?? "n/a"}
- Code contributions this period: ${s.codeContributions ?? "n/a"}
- AI tooling usage: ${s.aiUsagePercent != null ? `${s.aiUsagePercent}%` : "n/a"}

Evidence timeline written by the manager (newest entry first, each prefixed with its date; entries flagged [CONCERN] are negative observations the manager has explicitly marked):
${input.evidence.trim() ? input.evidence : "(no entries yet — base your suggestion on the metadata and prior ratings only, and say so in the rationale)"}

Look at the trajectory across entries, not just the most recent one. Weight [CONCERN] entries honestly — they should pull the rating down materially, especially if there are multiple or they are recent. Suggest one of STAND_OUT, ACHIEVER, NEEDS_IMPROVEMENT and a 2–4 sentence rationale citing specifics. Be honest — most people are ACHIEVER and STAND_OUT should be reserved for exceptional performance.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: ratingSystemPrompt(input.dimension, s.grade),
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        name: "submit_rating",
        description: "Submit the suggested rating and reasoning.",
        input_schema: {
          type: "object",
          properties: {
            rating: { type: "string", enum: ["STAND_OUT", "ACHIEVER", "NEEDS_IMPROVEMENT"] },
            rationale: {
              type: "string",
              description: "2–4 sentences citing specifics from the evidence and metadata.",
            },
          },
          required: ["rating", "rationale"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_rating" },
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI did not produce a structured rating.");
  }
  const out = toolUse.input as { rating: Rating; rationale: string };
  return { ...out, source: "claude" };
}

// ─── Blast-radius (effective scope) suggestion ───────────────────────────────

export interface SuggestBlastRadiusInput {
  subject: SubjectContext;
  whatEntries: { date: Date; body: string; type: string }[];
  howEntries: { date: Date; body: string; type: string }[];
}

export interface SuggestBlastRadiusOutput {
  radius: BlastRadius;
  rationale: string;
  source: "claude" | "mock";
}

const ENTRY_DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatEntries(
  label: string,
  entries: { date: Date; body: string; type: string }[]
) {
  if (entries.length === 0) return `${label}: (no entries)`;
  return (
    `${label}:\n` +
    entries
      .map((e) => {
        const date = ENTRY_DATE_FMT.format(e.date);
        const prefix = e.type === "CONCERN" ? " [CONCERN]" : "";
        return `  • [${date}]${prefix} ${e.body}`;
      })
      .join("\n")
  );
}

export async function suggestEffectiveBlastRadius(
  input: SuggestBlastRadiusInput
): Promise<SuggestBlastRadiusOutput> {
  const total = input.whatEntries.length + input.howEntries.length;
  if (total === 0) {
    const def = defaultBlastRadius(input.subject.grade) ?? "Journey of self-improvement";
    return {
      radius: def,
      rationale:
        "No evidence entries yet — defaulting to the grade-derived scope. Add a few entries and re-suggest for evidence-based reasoning.",
      source: "mock",
    };
  }

  if (!process.env.AI_API_KEY) {
    const def = defaultBlastRadius(input.subject.grade) ?? "Journey of self-improvement";
    return {
      radius: def,
      rationale: `Defaulting to the scope expected at Grade ${input.subject.grade ?? "?"}. With evidence-based reasoning enabled, this would weigh the timeline entries to suggest whether the subject is operating above or below their grade default.`,
      source: "mock",
    };
  }

  const client = new Anthropic({ apiKey: process.env.AI_API_KEY });
  const s = input.subject;
  const gradeDefault = defaultBlastRadius(s.grade);

  const systemPrompt = [
    "# ACME Talent Review rubric",
    "",
    "You are deciding the subject's EFFECTIVE BLAST RADIUS — the scope at which they are actually operating in the evidence below, which may differ from their grade-derived default if they are stretched or scoped down.",
    "",
    ratingScaleBlock(),
    "",
    `GRADE-DERIVED DEFAULT: ${gradeDefault ?? "(no default for this grade)"}`,
    "",
    `Valid scopes (pick exactly one):`,
    ...BLAST_RADII.map((b) => `- "${b}"`),
    "",
    "Do not invent new scopes. If the evidence does not clearly justify deviating from the grade default, pick the default.",
    "",
    gradeContextBlock(s.grade, "WHAT"),
    "",
    "Reference — the behavioral anchors that ground HOW assessment:",
    howAnchorsBlock(),
  ].join("\n");

  const userMessage = `Subject:
- Name: ${s.name ?? "(unknown)"}
- Grade: ${s.grade ?? "(unknown)"}
- Job family: ${s.jobFamily ?? "(unknown)"}
- Tenure: ${s.tenureYears != null ? `${s.tenureYears} years` : "(unknown)"}
- Prior ratings: 2024 = ${s.priorRating2024 ?? "n/a"}, 2025 = ${s.priorRating2025 ?? "n/a"}

Evidence from this review period (entries flagged [CONCERN] are negative observations the manager has explicitly marked — these should pull effective scope down toward the grade default or below if recurring):
${formatEntries("WHAT", input.whatEntries)}

${formatEntries("HOW", input.howEntries)}

Decide the effective blast radius. Cite specifics from the evidence in your rationale (2–4 sentences).`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        name: "submit_blast_radius",
        description: "Submit the effective blast radius and reasoning.",
        input_schema: {
          type: "object",
          properties: {
            radius: { type: "string", enum: [...BLAST_RADII] },
            rationale: {
              type: "string",
              description: "2–4 sentences citing specifics from the evidence.",
            },
          },
          required: ["radius", "rationale"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "submit_blast_radius" },
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI did not produce a structured blast radius.");
  }
  const out = toolUse.input as { radius: BlastRadius; rationale: string };
  return { ...out, source: "claude" };
}

// ─── Opportunity-for-growth draft suggestion ─────────────────────────────────

export interface SuggestGrowthInput {
  subject: SubjectContext;
  whatEntries: { date: Date; body: string; type: string }[];
  howEntries: { date: Date; body: string; type: string }[];
}

export interface SuggestGrowthOutput {
  body: string;
  source: "claude" | "mock";
}

export async function suggestGrowthDraft(
  input: SuggestGrowthInput
): Promise<SuggestGrowthOutput> {
  const total = input.whatEntries.length + input.howEntries.length;
  if (total === 0) {
    return {
      body: "(No evidence entries yet — add some WHAT or HOW entries first, then re-suggest. The model uses your timeline to identify the most useful growth area.)",
      source: "mock",
    };
  }

  if (!process.env.AI_API_KEY) {
    const concerns =
      input.whatEntries.filter((e) => e.type === "CONCERN").length +
      input.howEntries.filter((e) => e.type === "CONCERN").length;
    const body =
      concerns > 0
        ? `Looking at the timeline, the most useful next investment is closing the gap behind the marked concerns. Specifically, focus on earlier risk surfacing: bring problems forward in the week, not at the deadline. Strong execution on the wins is already there — the lift is in predictability.`
        : `Strong period overall. The next lever is broadening influence: take one cross-team initiative each quarter where you don't own the surface, but your judgment improves the outcome. Write up your reasoning afterwards — the org learns from clear post-mortems on good decisions too.`;
    return { body, source: "mock" };
  }

  const client = new Anthropic({ apiKey: process.env.AI_API_KEY });
  const s = input.subject;
  const systemPrompt = [
    "# ACME Talent Review rubric — Growth draft",
    "",
    "You are drafting an \"Opportunity for growth\" entry for an ACME Inc performance review. The manager will see your draft, can edit it, then save it to the review timeline. Your job is to find ONE high-leverage growth area — not a list, not platitudes — and explain it in terms of the evidence and the subject's grade-appropriate bar.",
    "",
    gradeContextBlock(s.grade, "GROWTH"),
    "",
    ratingScaleBlock(),
    "",
    "Style guide:",
    "- 2–4 sentences, written for the manager to share with the subject",
    "- Cite specific evidence from the timeline (event, pattern, or trend)",
    "- Be specific and actionable — name the behavior, not the trait",
    "- Forward-looking (\"focus on\", \"next lever is\", \"build the habit of\") — not punitive",
    "- Calibrated to the next stretch for this GRADE, not generic advice",
    "- Skip openers like \"I think\" or \"It seems\" — write directly",
  ].join("\n");

  const userMessage = `Subject:
- Name: ${s.name ?? "(unknown)"}
- Grade: ${s.grade ?? "(unknown)"}
- Tenure: ${s.tenureYears != null ? `${s.tenureYears} years` : "(unknown)"}

Evidence from this review period (entries flagged [CONCERN] are negative observations the manager marked):
${formatEntries("WHAT", input.whatEntries)}

${formatEntries("HOW", input.howEntries)}

Draft the growth-opportunity entry. Just the body text — no title, no preamble, no markdown.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("AI returned no draft text.");
  }
  return { body: text, source: "claude" };
}

// ─── Calibration: AI rationale for a single move ────────────────────────────

export interface SuggestMoveRationaleInput {
  subject: {
    name: string;
    grade: string;
    title: string | null;
    priorRating2024: string | null;
    priorRating2025: string | null;
    whatRating: string | null;
    howRating: string | null;
    codeContributions: number | null;
    aiUsagePercent: number | null;
    evidenceSummary: string;
  };
  fromRank: number;
  toRank: number;
  fromQuintile: number;
  toQuintile: number;
  gradePopulation: number;
  /** Neighbors near the destination to help AI compare. */
  neighbors: Array<{
    name: string;
    rank: number;
    whatRating: string | null;
    howRating: string | null;
  }>;
}

export interface SuggestMoveRationaleOutput {
  rationale: string;
  source: "claude" | "mock";
}

export async function suggestMoveRationale(
  input: SuggestMoveRationaleInput
): Promise<SuggestMoveRationaleOutput> {
  if (!process.env.AI_API_KEY) {
    const direction = input.toRank > input.fromRank ? "down" : "up";
    return {
      rationale: `Moving ${input.subject.name} ${direction} from #${input.fromRank} (${QUINTILE_LABEL[input.fromQuintile]}) to #${input.toRank} (${QUINTILE_LABEL[input.toQuintile]}) reflects WHAT=${ratingLabel(input.subject.whatRating)} / HOW=${ratingLabel(input.subject.howRating)} relative to the ${input.gradePopulation}-person Grade ${input.subject.grade} cohort. Prior trajectory ${input.subject.priorRating2024 ?? "n/a"} → ${input.subject.priorRating2025 ?? "n/a"} supports the calibration. (Edit this draft with your specific rationale.)`,
      source: "mock",
    };
  }

  const client = new Anthropic({ apiKey: process.env.AI_API_KEY });
  const systemPrompt = [
    "You are a senior talent reviewer at ACME Inc helping a manager justify a calibration move.",
    "",
    ratingScaleBlock(),
    "",
    "Write a 2–4 sentence rationale that:",
    "- Cites SPECIFIC evidence from the subject's review (named events, patterns, numbers)",
    "- Anchors against the grade-appropriate bar",
    "- Compares to the neighbors near the destination rank if relevant",
    "- Is honest about whether this is a stretch placement, a correction, or a true reflection of demonstrated outcomes",
    "- Direct, never preachy. Calm voice — never gamified.",
  ].join("\n");

  const userMessage = `Calibration move:
Subject: ${input.subject.name} — ${input.subject.title ?? "(no title)"} — Grade ${input.subject.grade}
From rank #${input.fromRank} (${QUINTILE_LABEL[input.fromQuintile]}) → rank #${input.toRank} (${QUINTILE_LABEL[input.toQuintile]})
Grade population: ${input.gradePopulation}

Subject's current review state:
- WHAT rating: ${ratingLabel(input.subject.whatRating)}
- HOW rating: ${ratingLabel(input.subject.howRating)}
- Prior ratings: 2024 = ${input.subject.priorRating2024 ?? "n/a"}, 2025 = ${input.subject.priorRating2025 ?? "n/a"}
- Code contributions: ${input.subject.codeContributions ?? "n/a"}
- AI tooling usage: ${input.subject.aiUsagePercent != null ? `${input.subject.aiUsagePercent}%` : "n/a"}

Evidence summary:
${input.subject.evidenceSummary || "(no evidence captured yet)"}

Neighbors near the destination rank (for comparison):
${input.neighbors.map((n) => `  #${n.rank} ${n.name} — W:${ratingLabel(n.whatRating)} / H:${ratingLabel(n.howRating)}`).join("\n") || "  (none)"}

Draft the rationale.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 400,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content
    .filter((c) => c.type === "text")
    .map((c) => (c.type === "text" ? c.text : ""))
    .join("\n")
    .trim();

  if (!text) throw new Error("AI returned no rationale.");
  return { rationale: text, source: "claude" };
}

// ─── Calibration: AI suggest full re-ranking of a grade ─────────────────────

export interface SuggestPlacementsInput {
  grade: string;
  gradeMeta: { title: string; blastRadius: string; scopeDescription: string };
  subjects: Array<{
    id: string;
    name: string;
    title: string | null;
    tenureYears: number | null;
    priorRating2024: string | null;
    priorRating2025: string | null;
    codeContributions: number | null;
    aiUsagePercent: number | null;
    whatRating: string | null;
    howRating: string | null;
    evidenceSummary: string;
    currentRank: number;
  }>;
}

export interface SuggestPlacementsOutput {
  placements: Array<{
    subjectId: string;
    proposedRank: number;
    rationale: string;
  }>;
  source: "claude" | "mock";
}

export async function suggestPlacements(
  input: SuggestPlacementsInput
): Promise<SuggestPlacementsOutput> {
  if (!process.env.AI_API_KEY) {
    const score = (r: string | null) =>
      r === "STAND_OUT" ? 0 : r === "ACHIEVER" ? 1 : r === "NEEDS_IMPROVEMENT" ? 2 : 3;
    const ranked = [...input.subjects]
      .map((s) => ({
        ...s,
        compositeScore:
          score(s.whatRating) +
          score(s.howRating) +
          (score(s.priorRating2025) * 0.5 + score(s.priorRating2024) * 0.25),
      }))
      .sort((a, b) => a.compositeScore - b.compositeScore);
    return {
      placements: ranked.map((s, i) => ({
        subjectId: s.id,
        proposedRank: i + 1,
        rationale: `Heuristic placement at #${i + 1}: WHAT=${ratingLabel(s.whatRating)}, HOW=${ratingLabel(s.howRating)}, prior trajectory ${s.priorRating2024 ?? "n/a"} → ${s.priorRating2025 ?? "n/a"}. (Replace with AI-grounded rationale when AI_API_KEY is set.)`,
      })),
      source: "mock",
    };
  }

  const client = new Anthropic({ apiKey: process.env.AI_API_KEY });
  const systemPrompt = [
    "You are a senior talent reviewer at ACME Inc proposing a full calibration ranking for a single grade cohort. Your output is a starting point — humans accept every move with their own confirmation.",
    "",
    ratingScaleBlock(),
    "",
    `GRADE: ${input.grade} — ${input.gradeMeta.title}`,
    `Blast radius: ${input.gradeMeta.blastRadius}`,
    `Scope: ${input.gradeMeta.scopeDescription}`,
    "",
    "TARGET DISTRIBUTION (10/25/30/25/10): rank 1 = top, rank N = bottom. Allocate accordingly.",
    "",
    "Style guide for each rationale:",
    "- 2–3 sentences. Cite specific evidence and prior trajectory.",
    "- Anchor against the grade-appropriate bar.",
    "- Be honest. Most people are mid-pack — don't inflate.",
    "- Direct, never preachy.",
  ].join("\n");

  const subjectsBlock = input.subjects
    .map(
      (s, i) =>
        `${i + 1}. [id=${s.id}] ${s.name} — ${s.title ?? "(no title)"} — currently #${s.currentRank}
   WHAT=${ratingLabel(s.whatRating)} / HOW=${ratingLabel(s.howRating)} · prior ${s.priorRating2024 ?? "n/a"} → ${s.priorRating2025 ?? "n/a"} · ${s.codeContributions ?? "?"} contributions · ${s.aiUsagePercent ?? "?"}% AI usage · tenure ${s.tenureYears ?? "?"}y
   Evidence: ${s.evidenceSummary.slice(0, 400) || "(none)"}`
    )
    .join("\n\n");

  const userMessage = `Re-rank the ${input.subjects.length} subjects below from #1 (top) to #${input.subjects.length} (bottom). Provide a rationale for each.

${subjectsBlock}

Submit the full ranking via the tool.`;

  const placementSchema = {
    type: "object" as const,
    properties: {
      placements: {
        type: "array",
        items: {
          type: "object",
          properties: {
            subjectId: { type: "string", description: "The subject id (matches one of the inputs)" },
            proposedRank: { type: "number", description: "1-based rank within the grade" },
            rationale: { type: "string", description: "2–3 sentence rationale" },
          },
          required: ["subjectId", "proposedRank", "rationale"],
        },
      },
    },
    required: ["placements"],
  };

  const response = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    tools: [
      {
        name: "submit_ranking",
        description: "Submit the full proposed ranking with per-subject rationale.",
        input_schema: placementSchema,
      },
    ],
    tool_choice: { type: "tool", name: "submit_ranking" },
  });

  const toolUse = response.content.find((c) => c.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("AI did not produce a ranking.");
  }
  const out = toolUse.input as { placements: Array<{ subjectId: string; proposedRank: number; rationale: string }> };
  return { placements: out.placements, source: "claude" };
}

const QUINTILE_LABEL: Record<number, string> = { 1: "Q1", 2: "Q2", 3: "Q3", 4: "Q4", 5: "Q5" };
function ratingLabel(r: string | null): string {
  if (r === "STAND_OUT") return "Stand Out";
  if (r === "ACHIEVER") return "Achiever";
  if (r === "NEEDS_IMPROVEMENT") return "Needs Improvement";
  return "n/a";
}

function mockSuggestion(input: SuggestRatingInput): SuggestRatingOutput {
  const score = (r: string | null) =>
    r === "STAND_OUT" ? 3 : r === "ACHIEVER" ? 2 : r === "NEEDS_IMPROVEMENT" ? 1 : 2;

  const priors = [input.subject.priorRating2024, input.subject.priorRating2025]
    .filter((r): r is string => !!r)
    .map(score);
  const avgPrior = priors.length ? priors.reduce((a, b) => a + b, 0) / priors.length : 2;

  let adj = 0;
  const contrib = input.subject.codeContributions ?? 0;
  if (contrib >= 300) adj += 0.4;
  else if (contrib < 100 && contrib > 0) adj -= 0.4;

  const aiUsage = input.subject.aiUsagePercent ?? 0;
  if (aiUsage >= 80) adj += 0.2;
  else if (aiUsage < 40) adj -= 0.2;

  const evidenceWords = input.evidence.trim().split(/\s+/).filter(Boolean).length;
  if (evidenceWords > 60) adj += 0.15;

  const final = avgPrior + adj;
  const rating: Rating =
    final >= 2.6 ? "STAND_OUT" : final < 1.7 ? "NEEDS_IMPROVEMENT" : "ACHIEVER";

  const prior24 = input.subject.priorRating2024
    ? labelOf(input.subject.priorRating2024)
    : "no prior";
  const prior25 = input.subject.priorRating2025
    ? labelOf(input.subject.priorRating2025)
    : "no prior";
  const rationale = `Suggestion based on prior ratings (${prior24} → ${prior25}), ${contrib} code contributions, and ${aiUsage}% AI tooling usage in this period. Weighted lightly toward recent direction.`;

  return { rating, rationale, source: "mock" };
}

function labelOf(r: string): string {
  if (r === "STAND_OUT") return "Stand Out";
  if (r === "ACHIEVER") return "Achiever";
  if (r === "NEEDS_IMPROVEMENT") return "Needs Improvement";
  return r;
}
