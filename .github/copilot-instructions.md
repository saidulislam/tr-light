# Copilot — repo-wide instructions

This file is auto-loaded by GitHub Copilot in VS Code. It mirrors the
load-bearing conventions from `CLAUDE.md` (the equivalent file Claude Code
reads). Keep the two roughly in sync; CLAUDE.md is the longer source of truth.

> This is **Next.js 16 + React 19 + Tailwind v4 + Prisma 7**. APIs and
> conventions may differ from your training data. When in doubt, check
> `node_modules/next/dist/docs/` or the files already in the repo.

## Product

Talent Review is a calm, candid performance review app. Three pillars:
**Smart** (AI assists; humans decide), **Simple** (one screen, one decision),
**Stunningly Gorgeous** (Linear / Vercel / Stripe-grade polish).

The product is a colleague on the manager's side — never gamified, never
cheerful. It surfaces things; the manager decides.

## Voice & Tone

- **Direct, never preachy.** "Pick a rating to submit." Not "Please be sure
  to select a rating before submitting."
- **Active voice, present tense.** "Saved." Not "Has been saved."
- **No HR euphemisms.** "Where to grow next" beats "Opportunity for growth."
- **Trust the reader.** Skip "Please" and "Kindly."
- **Honest about uncertainty.** When AI is heuristic, say so once, quietly.
- **Numbers are facts.** State them; don't soften them.

Use **"review period"**, never "cycle".

## Design principles (non-negotiable)

- **Restraint over decoration.** If a pixel doesn't communicate, remove it.
- **Type-driven hierarchy.** Reach for weight/size/color before borders/boxes.
- **Generous whitespace.** Crowding is the #1 sign of an amateur UI.
- **Motion with meaning.** Animations confirm state changes. Never decorative.
  Honor `prefers-reduced-motion` (handled globally in `app/globals.css`).
- **One primary action per screen.**
- **Accessible by default.** WCAG AA contrast, keyboard navigable, SR-labeled.
- **Empty states are features.** Every list/table has a designed empty state.
- **Loading states are designed.** Skeletons over spinners. Optimistic UI where safe.

## Design tokens (live in `app/globals.css`)

### Typography ladder — use these exact classes

| Role | Class |
|---|---|
| Display (page h1) | `text-[32px] font-semibold tracking-[-0.02em]` |
| Section h2 | `text-xl font-semibold tracking-[-0.015em]` |
| h3 | `text-base font-medium` |
| Body | `text-[15px] leading-[1.65]` |
| Meta | `text-[13px]` |
| Eyebrow | `text-[11px] font-semibold uppercase tracking-[0.1em]` |
| Mono | `text-[12px] tabular-nums` |

### Spacing — strict 4pt scale

Use only Tailwind units `1, 2, 3, 4, 6, 10, 16` → `4, 8, 12, 16, 24, 40, 64 px`.
Anything outside this needs a reason.

### Color — semantic tokens only, never raw Tailwind palette

- `text-foreground` / `bg-background` — base
- `text-muted-foreground` — meta, captions
- `text-[--color-ai]` / `bg-[--color-ai]/10` — **all** AI affordances
- `text-[--color-positive]` — Stand Out ratings, above-bar metrics
- `text-[--color-attention]` — Needs Improvement, concerns
- Borders: `border-border`. Avoid stacking — at most 2 visible at once.

### Motion

- `duration-150` fast (hover, press)
- `duration-200` enters (modal/popover open)
- `duration-300` entrances + skeleton → real content
- Ease: `ease-out` everywhere. Never `linear`.

## Surgical changes — touch only what you must

- Every changed line should trace directly to the user's request.
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style even if you'd do it differently.
- Remove imports/variables/functions YOUR changes made unused. Leave
  pre-existing dead code alone unless asked.
- Default to writing no comments. Only add one when the WHY is non-obvious.

## Engineering principles

- **Simplicity first.** Minimum code that solves the problem. Nothing
  speculative. If 200 lines could be 50, rewrite it.
- **No laziness.** Find root causes, not symptoms. Senior-engineer standards.
- **No error handling for impossible cases.** Validate at system boundaries
  (user input, external APIs). Trust internal code.
- **No backwards-compatibility shims** when you can just change the code.

## Domain model — name things consistently

- **User** — anyone with an account (employee, manager, admin)
- **ReviewPeriod** — defined window (e.g. "H1 2026"). User-facing label:
  **"review period"** (avoid "cycle").
- **Review** — one person's assessment of another. `kind ∈
  {SELF, MANAGER, PEER, UPWARD}`.
- **Question** — a prompt in a template (rating / text / behavior-anchored)
- **Template** — set of questions for a period
- **Calibration** — leadership session that normalizes ratings across a team
- **Goal** — a tracked objective tied to a user and optionally a period

Ratings: `STAND_OUT | ACHIEVER | NEEDS_IMPROVEMENT`. Quintiles: per-grade,
never cross-grade. Distribution target: 10/25/30/25/10.

## Rubric — single source of truth, swappable

All rubric content lives in `lib/rubric/v1-acme.ts` and conforms to
`RubricConfig` in `lib/rubric/types.ts`. The shape is designed to swap to a
DB-backed JSON blob later without changing any consumer. Don't inline rubric
strings in components — read from `lib/rubric/index.ts` helpers.

## Repo layout

- `app/` — Next.js routes (App Router)
  - `app/app/*` — authed surfaces
  - `app/api/data/*` — Excel import/export/sample
  - `app/_actions/*` — server actions
- `components/` — UI, including shadcn primitives in `components/ui/`
- `lib/` — `auth.ts`, `db.ts`, `ai.ts`, `permissions.ts`, `visibility.ts`,
  `rubric/*`, `excel-schema.ts`, `calibration.ts`, `theme.ts`
- `prisma/` — schema + migrations + seed via `scripts/seed.mts`
- `tasks/` — `todo.md` (current plan) + `lessons.md` (mistakes-to-avoid)

Naming: kebab-case for files, PascalCase for components, camelCase for functions.

## Tech defaults

- **Frontend**: Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **State**: Server Components first; TanStack Query for client cache;
  Zustand only for true client-only state
- **Backend**: Route Handlers / Server Actions; tRPC if API surface grows
- **Database**: SQLite local, PostgreSQL prod (via Prisma)
- **Auth**: Cookie-based demo today; Auth.js with magic links + SSO planned
- **AI**: Anthropic Claude (Sonnet 4.6 for drafting, Haiku 4.5 for fast assists)
- **Testing**: Vitest (unit), Playwright (e2e)

## Verification before "done"

- For UI work: open the page in a browser before claiming done. Type-checks
  and tests don't prove a screen looks right.
- Diff behavior before/after when relevant.
- Ask yourself: "would a staff engineer approve this?"

## When in doubt

- **Cut scope, not polish.** A small surface that feels world-class beats a
  large surface that feels mediocre.
- **The user is HR/managers** — not technical. Latency, jargon, and
  dead-ends are unacceptable.
