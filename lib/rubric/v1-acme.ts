import type { RubricConfig } from "./types";

// ─── ACME Talent Review rubric, version 1 ────────────────────────────────────
//
// This module is the SINGLE SOURCE OF TRUTH for what "good" means in a review.
// It feeds both:
//   1. The hover hints managers see while writing evidence
//   2. The AI prompts that suggest ratings, infer scope, and draft growth notes
//
// FUTURE: this content moves to DB-backed `RubricVersion` rows so admins can
// upload an updated rubric (JSON / YAML) without redeploying. The migration
// path is: keep the same `RubricConfig` shape, swap the import in
// `lib/rubric/index.ts` from this module to a `getActiveRubric()` DB call.
// Each Review should also lock in the rubric version active at submission
// time for audit immutability.

export const RUBRIC_V1_ACME: RubricConfig = {
  version: "v1-acme-2026",

  // ─── Rating scale (3 levels, applies to both WHAT and HOW) ──────────────
  ratingScale: {
    STAND_OUT:
      "Consistently delivers exceptional results and/or demonstrates exemplary habits. Exceeds the standard for the role. Reserved for the strongest combined performance across outcomes and behaviors.",
    ACHIEVER:
      "Delivers the reliable outcomes the role is designed to produce. Meets the standard with quality, reliability, and follow-through. MOST EMPLOYEES land here — this is the norm, not a fallback.",
    NEEDS_IMPROVEMENT:
      "Results and/or behaviors do not consistently meet expectations. Additional support or development required.",
  },

  dimensions: {
    WHAT: {
      label: "WHAT (you achieve)",
      description:
        "Outcomes delivered: deliverables, quality, business impact, complexity handled, planning under pressure, opportunity creation, risk prevention.",
    },
    HOW: {
      label: "HOW (you achieve it)",
      description:
        "Behaviors used: anchored on three principles — Earn Trust, Improve Relentlessly, Do the Right Thing.",
    },
  },

  // ─── WHAT — six outcome areas ───────────────────────────────────────────
  whatOutcomeAreas: [
    {
      name: "Delivery against role expectations",
      levels: {
        NEEDS_IMPROVEMENT:
          "Does not consistently deliver the outcomes required for the role; work may be incomplete, delayed, or uneven.",
        ACHIEVER:
          "Consistently delivers the reliable outcomes the role is designed to produce and meets expected priorities.",
        STAND_OUT:
          "Delivers outcomes well beyond the role's expectations, with results that materially change business performance or direction.",
      },
    },
    {
      name: "Quality, reliability, and follow-through",
      levels: {
        NEEDS_IMPROVEMENT:
          "Results are unreliable, require rescue or rework, or put team or business outcomes at risk.",
        ACHIEVER:
          "Delivers priorities with quality, reliability, and follow-through, supporting team and business goals without needing rescue or rework.",
        STAND_OUT:
          "Leaves a distinctive and sustained performance footprint that is clearly above standard and redefines success in the role.",
      },
    },
    {
      name: "Business impact and materiality",
      levels: {
        NEEDS_IMPROVEMENT:
          "Misses, delays, or weakens key outcomes, limiting the impact expected from the role.",
        ACHIEVER:
          "Produces steady, dependable contributions that deliver the results the firm needs from the role.",
        STAND_OUT:
          "Produces results that materially shift direction, performance, or outcomes for the team, business, customers, or firm.",
      },
    },
    {
      name: "Complexity and problem-solving",
      levels: {
        NEEDS_IMPROVEMENT:
          "Struggles to handle the expected complexity or workload of the role, requiring sustained improvement.",
        ACHIEVER:
          "Handles expected complexity and workload at the right level.",
        STAND_OUT:
          "Solves the hardest, most ambiguous, or highest-risk problems the team faces, producing lasting results.",
      },
    },
    {
      name: "Planning, demand management, and execution under pressure",
      levels: {
        NEEDS_IMPROVEMENT:
          "Has difficulty sustaining expected outcomes when volume, urgency, or competing priorities increase.",
        ACHIEVER:
          "Delivers consistently against expected priorities and workload with dependable execution.",
        STAND_OUT:
          "Anticipates periods of high volume and delivers ahead of demand with visible business impact.",
      },
    },
    {
      name: "Opportunity creation and risk prevention",
      levels: {
        NEEDS_IMPROVEMENT:
          "Outcomes may create avoidable risk, missed opportunity, or require others to step in to protect results.",
        ACHIEVER:
          "Produces the expected results needed from the role and contributes meaningfully to team and business goals.",
        STAND_OUT:
          "Creates outcomes that unlock new opportunities, prevent significant loss, or change the trajectory of the business or team.",
      },
    },
  ],

  // ─── HOW — three principles, nine anchors ───────────────────────────────
  howAnchors: [
    // Earn Trust
    {
      principle: "Earn Trust",
      name: "Create clarity",
      levels: {
        NEEDS_IMPROVEMENT:
          "Gives updates that are incomplete, inconsistent, or leave others unclear on priorities, expectations, or next steps.",
        ACHIEVER:
          "Communicates honestly, clearly, and consistently so expectations are aligned and shared goals are understood.",
        STAND_OUT:
          "Anticipates confusion before it happens, aligns stakeholders early, and creates shared understanding across teams.",
      },
    },
    {
      principle: "Earn Trust",
      name: "Listen deeply",
      levels: {
        NEEDS_IMPROVEMENT:
          "Appears distracted, interrupts, or focuses on defending their own view rather than understanding another person's perspective.",
        ACHIEVER:
          "Removes distractions, listens carefully, and focuses on understanding others before responding.",
        STAND_OUT:
          "Makes colleagues and clients feel genuinely heard, uses their input to improve outcomes, and follows up thoughtfully.",
      },
    },
    {
      principle: "Earn Trust",
      name: "Maintain humility / own mistakes",
      levels: {
        NEEDS_IMPROVEMENT:
          "Avoids admitting limits, does not ask for help when needed, or minimizes mistakes.",
        ACHIEVER:
          "Acknowledges limits, asks for help appropriately, challenges their own thinking, and owns mistakes.",
        STAND_OUT:
          "Models accountability by surfacing mistakes early, sharing lessons learned, and helping prevent repeat issues.",
      },
    },
    // Improve Relentlessly
    {
      principle: "Improve Relentlessly",
      name: "Seek feedback",
      levels: {
        NEEDS_IMPROVEMENT:
          "Rarely asks for feedback or reacts defensively when constructive input is offered.",
        ACHIEVER:
          "Asks for feedback explicitly, broadly, and often to sharpen self-awareness.",
        STAND_OUT:
          "Actively seeks feedback from multiple stakeholders and uses it to improve their own performance and team effectiveness.",
      },
    },
    {
      principle: "Improve Relentlessly",
      name: "Act on feedback / learn fast",
      levels: {
        NEEDS_IMPROVEMENT:
          "Receives feedback but does not consistently change behavior or repeats the same issues.",
        ACHIEVER:
          "Takes note of constructive feedback, takes action, and applies lessons from experience.",
        STAND_OUT:
          "Converts feedback and setbacks into measurable improvement, builds expertise quickly, and shares learning with others.",
      },
    },
    {
      principle: "Improve Relentlessly",
      name: "Speak up",
      levels: {
        NEEDS_IMPROVEMENT:
          "Notices problems or opportunities but stays silent or waits for others to address them.",
        ACHIEVER:
          "Speaks up when they see an opportunity or problem and helps address it constructively.",
        STAND_OUT:
          "Challenges the status quo productively, invites different viewpoints, and drives meaningful progress.",
      },
    },
    // Do the Right Thing
    {
      principle: "Do the Right Thing",
      name: "Work as one",
      levels: {
        NEEDS_IMPROVEMENT:
          "Works mainly within their own area and does not involve partners needed to deliver the best outcome.",
        ACHIEVER:
          "Bridges teams and silos to co-create solutions with the customer or client at the core.",
        STAND_OUT:
          "Builds strong cross-team alignment, removes friction, and helps deliver strategic solutions that serve the broader organization.",
      },
    },
    {
      principle: "Do the Right Thing",
      name: "Demonstrate respect",
      levels: {
        NEEDS_IMPROVEMENT:
          "Shows inconsistent respect, overlooks contributions, or does not reliably keep promises.",
        ACHIEVER:
          "Treats people the way they want to be treated, recognizes contributions, looks out for others, and keeps promises.",
        STAND_OUT:
          "Creates a respectful team environment by consistently recognizing others, supporting colleagues, and reinforcing positive behaviors.",
      },
    },
    {
      principle: "Do the Right Thing",
      name: "Act with discipline",
      levels: {
        NEEDS_IMPROVEMENT:
          "Makes decisions without enough due diligence, data, or attention to risk, controls, conduct, or integrity.",
        ACHIEVER:
          "Follows the data, considers the greater good, and upholds standards of rigor, risk, controls, conduct, and integrity.",
        STAND_OUT:
          "Demonstrates strong judgment in complex situations and role-models disciplined decision-making even under pressure.",
      },
    },
  ],

  // ─── Per-grade content ──────────────────────────────────────────────────
  grades: {
    "502": {
      meta: {
        grade: "502",
        title: "Software Engineer I",
        blastRadius: "Journey of self-improvement",
        scopeDescription:
          "Early in the craft. Expected to deliver well-scoped tasks with reliable quality, take feedback well, and start contributing to small features end-to-end. Scope is the individual ticket; impact is the individual user-facing fix.",
      },
      examples: {
        WHAT: `Picked up the user-profile validation ticket independently and shipped it. So what? Cuts the #2 cause of new-user signup drop-off — new-account error rate went from 3.2% to 0.4%, removing ~400 support tickets/quarter. Complexity: had to align two service contracts and the QA edge-case suite. Outcome: delivered on the sprint commit, no rework, zero regressions in the first 30 days.`,
        HOW: `Uses AI for test scaffolding and PR drafts — review cycle on her PRs dropped from 2 days to under 1. Asks her mentor early instead of guessing; brought a recurring deployment confusion to the team retro instead of working around it silently. Visibly acts on feedback within one sprint.`,
        GROWTH: `You're learning fast — focus the next quarter on closing one full feature loop without mentor checkpoints. Pick a small but real surface, scope it yourself, and bring back the metric that proves it shipped. Goal isn't independence for its own sake; it's building the judgment muscle.`,
      },
    },
    "601": {
      meta: {
        grade: "601",
        title: "Software Engineer II (Early Career)",
        blastRadius: "Journey of self-improvement",
        scopeDescription:
          "Capable IC. Owns medium-sized features end-to-end with minimal oversight. Scope is a feature or service surface; impact is measured at the user-segment or service level. Should be building automation/AI habits, not just using them.",
      },
      examples: {
        WHAT: `Owned the search-results pagination feature end-to-end. So what? Replaces the #3 source of P95 latency complaints; her version sustains <200ms server responses against 8M-row tables, used by 12K daily searchers. Complexity: negotiated a new index strategy with the DBAs, broke the rollout into three feature-flagged stages, coordinated event-name compatibility with analytics. Outcome: shipped one week early, zero rollback escalations.`,
        HOW: `Wires up automation by default — added contract tests before opening the PR. Leverages AI for boilerplate so reviewers focus on logic; her PR descriptions now read like documentation. Acts on coaching the following sprint, with three concrete improvements traceable to last cycle's feedback.`,
        GROWTH: `Your delivery is solid; the next lever is influence outside your own ticket queue. Pick one cross-team friction point this half (deploy choreography, observability gaps, on-call handoffs) and propose a fix you'd own. Builds the muscle for the scope step-up to 602.`,
      },
    },
    "602": {
      meta: {
        grade: "602",
        title: "Senior Software Engineer (Mid-Career)",
        blastRadius: "Uplifting the team",
        scopeDescription:
          "Senior IC. Owns large multi-week projects that benefit the entire team's throughput. Scope is the team; impact is measured at team-velocity or cross-team-dependency level. Should be raising the team's bar (testing, patterns, mentorship), not just delivering own work.",
      },
      examples: {
        WHAT: `Owned the migration of the legacy event pipeline to the streaming framework end-to-end. So what? 80K events/sec now flow with 99.99% delivery, supporting $40M of daily transaction settlement for 25K downstream consumers; retired three legacy services and removed ~$180K/year of compute cost. Complexity: mapped 9 partner topic contracts, secured buy-in from three product teams and the platform org, paired with SRE on rollback and observability, coordinated UX on the operator console. Outcome: shipped two weeks under estimate, zero customer-facing incidents in 30 days, and the contract-test pattern she introduced was adopted team-wide.`,
        HOW: `Mentors two juniors on AI-assisted patterns: paired through one's first production refactor, ran a team lunch-and-learn on prompts that actually save time. Pushed back productively when a senior wanted to skip load tests on a "small" change; the test she insisted on caught a 4x regression. Surfaced her own schema bug from sprint 3 publicly and turned it into a team-wide checklist update.`,
        GROWTH: `Strong individual + team output this period. The next stretch is earlier risk-surfacing across the area — when a slip is two weeks out, you tend to catch it; when it's two quarters out, you don't yet. Build a quarterly "things I'm watching" memo to leadership; treat it as an instrument, not a chore.`,
      },
    },
    "603.1": {
      meta: {
        grade: "603.1",
        title: "VP (Late Career SWE)",
        blastRadius: "Uplifting the area product",
        scopeDescription:
          "Manages or technically leads a product area spanning multiple squads. Scope is the area product line; impact is measured at area-roadmap, area-velocity, area-quality level. Strategy-level decisions; aligning multiple managers/leads; visible cross-product accountability.",
      },
      examples: {
        WHAT: `Defined and executed the consolidation of three legacy services into a unified composable layer across the area. So what? Cut new-feature lead time from 6 weeks to 9 days across four squads; unblocked the international expansion roadmap (~$8M ARR depended on it); reduced area-wide on-call paging by 40%. Complexity: aligned four engineering leads, two product directors, security and compliance; sequenced a 9-month rollout that kept consumer apps green; negotiated contractor budget with finance. Outcome: delivered ahead of the half-year commit, under contractor budget, platform stayed at 99.97% SLO through migration.`,
        HOW: `Standardized AI tooling across the area — authored the principles doc, drove rollout, owns the dashboards. Earned trust by being direct about migration risks early; when one workstream slipped a quarter, the org was prepared, not surprised. Creates clarity at scale — her monthly area memo is now the canonical reference for engineering leadership decisions.`,
        GROWTH: `Your area is in great shape. The growth edge is portfolio-level thinking: which of your three bets is the one that creates compounding value for the product line, and what are you doing differently with the other two? Develop a public point of view on this; that's the VP2 lens.`,
      },
    },
    "603.2": {
      meta: {
        grade: "603.2",
        title: "Senior VP (Senior Technical Leader)",
        blastRadius: "Impact across the entire product",
        scopeDescription:
          "Cross-area / cross-product technical leader. Scope is the entire product line; impact is measured in multi-quarter strategic bets, leadership trust, capacity-level decisions, and the bench they're growing. Output is judgment + influence at the org level.",
      },
      examples: {
        WHAT: `Shaped the product line's multi-year bet on AI-native workflows. So what? Materially changed two product areas through a single architectural decision (the unified embedding store), now serving 60M API calls/day across consumer and enterprise; unblocked three sibling teams whose features ride on top, contributing an estimated $35M ARR over 18 months. Complexity: aligned six engineering directors, two product VPs, the data org, and external infra partners on a multi-year capacity model; negotiated platform commitments with two cloud vendors. Outcome: shipped on the original target quarter, under the multi-year capex envelope; skip-level pulse data shows org confidence in his judgment trending up.`,
        HOW: `Set the "North Star" for AI and large-scale automation across the product line; that framing is now the language the org uses. Modeled disciplined trade-off thinking when speed and long-term tech health were in tension — his "reversible vs. not" lens was adopted by other VPs. Surfaced his own mistakes (the early agent rollout misfire) publicly and turned them into lessons that prevented two follow-on missteps in sibling orgs.`,
        GROWTH: `At your scope, the highest-leverage investment is in your bench. Name the two ICs and the one EM you think could be doing your role in three years, and write down what's between them and that. Make the development of leaders a tracked output, the way you track product bets.`,
      },
    },
  },

  fallbackExample:
    "Be specific. State what shipped, then 'so what?' — quantify impact (customers, $, error rates). Cover complexity (cross-team buy-in, partners, design surface). Close with the outcome (on time, under budget, post-launch quality).",
};
