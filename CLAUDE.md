# CLAUDE.md — Talent Review (tr-light)

@AGENTS.md

A smart, simple, and stunningly gorgeous performance review web application.

## Product Vision

**Talent Review** is a modern performance review platform that replaces clunky HR tools with something people actually want to use. Managers, peers, and self-reviewers complete cycles in minutes — not hours — and leadership gets calibration views that surface real signal.

### Product Pillars
1. **Smart** — AI-assisted writing, bias detection, summarization, calibration insights. The app does the thinking so humans can focus on judgment.
2. **Simple** — One screen, one decision. Zero training required. Every workflow under 5 clicks.
3. **Stunningly Gorgeous** — Pixel-perfect typography, generous whitespace, subtle motion, restrained color. Linear/Vercel/Stripe-grade polish.

## Workflow Orchestration

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding
**Don't assume. Don't hide confusion. Surface tradeoffs.**
- State assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Plan Mode Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 3. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 4. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 5. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness
- **For UI work**: open the page in a browser before claiming done. Type-checks and tests don't prove a screen looks right.
- **Turn vague asks into verifiable goals** — weak criteria force constant clarification:
  - "Add validation" → "Write tests for invalid inputs, then make them pass"
  - "Fix the bug" → "Write a test that reproduces it, then make it pass"
  - "Refactor X" → "Ensure tests pass before and after"

### 6. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes — don't over-engineer
- Challenge your own work before presenting it

### 7. Surgical Changes
**Touch only what you must. Clean up only your own mess.**
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.
- Remove imports/variables/functions that YOUR changes made unused; leave pre-existing dead code alone unless asked.
- **The test**: every changed line should trace directly to the user's request.

### 8. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Minimum code that solves the problem. Nothing speculative. If you write 200 lines and it could be 50, rewrite it. Ask: "Would a senior engineer say this is overcomplicated?" If yes, simplify.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Every changed line should trace directly to the user's request. No features beyond what was asked. No abstractions for single-use code. No error handling for impossible scenarios.

## Product Personality

**Talent Review is calm, candid, and on the manager's side.** It treats writing a review as serious work that deserves care — never gamified, never cheerful. Visually it borrows from Linear and Plain: restrained type-driven hierarchy, generous whitespace, one perfect accent reserved for AI, motion that confirms decisions rather than decorates them.

This is the editorial north star. Every UI decision, every line of copy, every animation should make this product feel **more** like that, not less.

## Voice & Tone

- **Direct, never preachy.** "Pick a rating to submit." Not "Please be sure to select a rating before submitting."
- **Active voice, present tense.** "Saved." Not "Has been saved."
- **No HR euphemisms.** "Where to grow next" beats "Opportunity for growth."
- **Trust the reader.** Skip "Please" and "Kindly." Assume professional adults.
- **Honest about uncertainty.** When AI is heuristic, say so once, quietly, in dev — never to end users.
- **Numbers are facts.** State them. Don't soften them.
- **The product is a colleague, not a coach.** It surfaces things; the manager decides.

## Design Principles (UI/UX)

These are non-negotiable for this product. Treat them with the same rigor as the engineering principles above.

- **Restraint over decoration** — every pixel earns its place. If it doesn't communicate, remove it.
- **Type-driven hierarchy** — use weight, size, and color of text to create structure before reaching for borders, boxes, or dividers.
- **Generous whitespace** — crowding is the #1 sign of an amateur UI. Err on the side of more space.
- **Motion with meaning** — animations clarify state changes (use `--dur-base` 220ms with `--ease-out-quad`). Never decorative. Honor `prefers-reduced-motion`.
- **One primary action per screen** — the user should never wonder what to do next.
- **Accessible by default** — WCAG AA contrast, keyboard navigable, screen-reader labeled. No exceptions.
- **Empty states are features** — every list/table has a designed empty state with a clear next action.
- **Loading states are designed** — skeleton screens, not spinners. Optimistic UI where safe.

## Design Tokens

These live in `app/globals.css` `:root`. Always use the token, never the raw value.

### Typography ladder (use these exact classes)
| Role | Class | Use |
|---|---|---|
| Display | `text-[32px] font-semibold tracking-[-0.02em]` | Page h1 (long pages); shorter pages can use `text-[40px]` |
| Section H2 | `text-xl font-semibold tracking-[-0.015em]` | Section titles ("What they achieved") |
| H3 | `text-base font-medium` | Sub-section / card titles |
| Body | `text-[15px] leading-[1.65]` | Paragraph / entry body text |
| Meta | `text-[13px]` | Metadata, captions, hints |
| Eyebrow | `text-[11px] font-semibold uppercase tracking-[0.1em]` | Section labels (PROFILE, WHAT, HOW, etc.) — always all-caps |
| Mono | `text-[12px] tabular-nums` | Inline numbers, dates in tables |

### Spacing (strict 4pt scale)
Use only: `1, 2, 3, 4, 6, 10, 16` (Tailwind units) → 4, 8, 12, 16, 24, 40, 64 px. Anything outside this scale needs a reason.

### Color tokens (semantic — never use raw Tailwind palette)
- `text-foreground` / `bg-background` — base
- `text-muted-foreground` — meta, captions, hints
- `text-[--color-ai]` / `bg-[--color-ai]/10` — **all** AI affordances (Sparkles glyph, AI-drafted badges, AI rationale accents). One color, no exceptions.
- `text-[--color-positive]` / `border-[--color-positive]` — Stand Out ratings, above-bar metrics
- `text-[--color-attention]` / `bg-[--color-attention]/10` — Needs Improvement, concerns (orange-amber, distinct from `--ai`)
- Borders: `border-border` (default); avoid stacking borders — at most 2 visible on screen at once

### Motion
- `duration-150` → fast (hover, button press)
- `duration-200` → enters (modal/popover open, tooltip)
- `duration-300` → entrances + slide-ins (skeleton → real content)
- Ease: `ease-out` everywhere. Never `linear`.
- All transitions/animations must be no-ops under `prefers-reduced-motion` (global rule in `globals.css`).

## Rubric content — single source of truth, swappable

All rubric content (rating definitions, WHAT outcome areas, HOW behavioral anchors, per-grade examples, blast radius defaults) lives in `lib/rubric/v1-acme.ts`. The `RubricConfig` shape in `lib/rubric/types.ts` is the contract.

**Both** the hover hints (managers' UI) **and** the AI prompts (suggest rating / infer scope / draft growth) read from this single source via `lib/rubric/index.ts`. Anchors and grade-specific examples are injected into the system prompts so the model judges against the same bar shown to humans.

**Future: DB-backed configurable rubric** (the user explicitly asked for this). Migration path:
1. Add `RubricVersion { id, version, payload: Json, activatedAt }` Prisma model.
2. Replace the synchronous import in `lib/rubric/index.ts` with `await getActiveRubric()` (turn callers async or fetch at request entry).
3. Add `/app/rubric-admin` route — accepts JSON (or YAML) matching `RubricConfig`, validates with zod, inserts a new version, atomically flips `activatedAt`.
4. Add `rubricVersion: String` column to `Review` — snapshot the active version at submission time so historical reviews render against the rubric they were judged on.

As long as `RubricConfig` (the shape) stays stable, the swap is local to `lib/rubric/index.ts`.

## Domain Model (Talent Review)

Core entities the app revolves around. Keep these names consistent across schema, API, and UI.

- **User** — anyone with an account (employee, manager, admin)
- **ReviewPeriod** — a defined window (e.g., "H1 2026") when reviews are written. User-facing label: **"review period"** (avoid the HR jargon "cycle").
- **Review** — one person's assessment of another (self, peer, manager, upward), scoped to a review period
- **Question** — a prompt in a template (rating, free-text, behavior-anchored)
- **Template** — the set of questions used for a review period
- **Calibration** — leadership session where ratings are normalized across a team/org
- **Goal** — a tracked objective tied to a user and optionally a review period

## Tech Stack (Defaults)

Pick these unless there's a strong reason otherwise. Consistency > novelty.

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **State**: Server Components first; TanStack Query for client cache; Zustand only for true client-only state
- **Backend**: Next.js Route Handlers / Server Actions; tRPC if API surface grows
- **Database**: PostgreSQL via Prisma or Drizzle
- **Auth**: Auth.js (NextAuth) with email magic links + SSO providers
- **AI**: Anthropic Claude API (Sonnet 4.6 for drafting, Haiku 4.5 for fast assists)
- **Hosting**: Vercel (frontend) + Neon/Supabase (db)
- **Testing**: Vitest (unit), Playwright (e2e)

## Repo Conventions

- `app/` — Next.js routes and pages
- `components/` — reusable UI (shadcn/ui primitives in `components/ui/`)
- `lib/` — shared utilities, db client, AI client
- `server/` — server-only logic (actions, business rules)
- `tasks/` — `todo.md` (current plan) + `lessons.md` (mistakes-to-avoid)
- `prisma/` or `drizzle/` — schema and migrations
- Use kebab-case for file names, PascalCase for components, camelCase for functions

## What to Build First (MVP Slice)

Resist the urge to build everything. Ship this slice end-to-end first:

1. Auth + a User can sign in
2. Admin creates a Cycle with a basic Template
3. A User is assigned a Self Review and a Manager Review
4. User submits responses; manager sees them
5. Manager submits their review; user sees the summary
6. AI assist on a single textarea: "improve this draft"

Everything else (calibration, goals, peer reviews, analytics) comes after this loop works and feels delightful.

## When in Doubt

- **Cut scope, not polish.** A small surface that feels world-class beats a large surface that feels mediocre.
- **Show, don't tell.** Build a screenshot-able prototype before debating the abstraction.
- **The user is HR/managers.** They're not technical. Latency, jargon, and dead-ends are unacceptable.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
