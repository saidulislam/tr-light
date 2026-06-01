# tasks/todo.md

Working plan. Check items off as you go. Update the **Review** section when a chunk is done.

## In flight

- [x] Scaffold Next.js 16 + TS + Tailwind v4 + shadcn/ui
- [x] Landing page with brand-aligned hero
- [x] Database: SQLite via Prisma 7 + better-sqlite3 driver adapter (will swap to Postgres/Turso for production)
- [x] Prisma schema: User, Cycle, Template, Question, Review, Answer
- [x] Singleton Prisma client at `lib/db.ts`
- [x] `/api/health` proves Next.js → Prisma → SQLite works end-to-end
- [x] Seed script (`scripts/seed.mts`) — 1 admin, 1 template, 3 cycles in DRAFT/OPEN/CLOSED
- [x] `/app` dashboard shell — sidebar nav + user footer, redirect from `/app` → `/app/cycles`
- [x] `/app/review-periods` list page reading from Prisma with status badges + designed empty state
- [x] Renamed domain entity `Cycle` → `ReviewPeriod` everywhere (schema, routes, copy, CLAUDE.md domain model) — HR jargon "cycle" gone
- [x] Auth stub at `lib/auth.ts` — hardcoded as Ada Lovelace (employee) for demo; sidebar reads from it
- [x] `/app/reviews` inbox — lists reviews assigned to current user
- [x] `/app/reviews/[id]` writing surface — textareas, rating chips with semantic labels, Save Draft + Submit
- [x] Server action `saveReview` — handles both draft save and submit, with reviewer authorization
- [x] Manager review rubric form (`components/manager-review-form.tsx`) — person card + read-only context strip (2024/2025 ratings, code contributions, AI usage) + WHAT/HOW evidence + 3-level rating chips (Needs Improvement / Achiever / Stand Out)
- [x] AI suggestion per dimension via Claude (Anthropic SDK + tool_use for structured output) with deterministic mock fallback when `AI_API_KEY` is unset. Env var is provider-agnostic on purpose — easy to swap models / providers later.
- [x] Demo user switched Ada → Bob (manager); Bob now has 4 direct reports (Ada, Linus, Grace, Margaret) with varied profile data
- [x] Page branches on `review.kind`: MANAGER → new rubric form, SELF/PEER/UPWARD → existing question/answer form
- [x] Inline edit modals on the review form — person card opens an "Edit profile" modal (name, job family, grade, grade level, tenure, city, country). Saves call `updateSubjectProfile` server action, refreshes via `router.refresh()`.
- [x] Performance context strip — single "Edit" button opens a unified modal for all four fields (2024/2025 ratings as chips, code contributions and AI usage as numeric inputs). Cleaner than per-card buttons; one trip per refresh.
- [x] Authorization: only the subject's direct manager can edit their profile fields.
- [x] Evidence is now a **dated timeline per dimension**. Schema dropped `Review.whatEvidence`/`howEvidence`, added `EvidenceEntry { reviewId, dimension, body, authorId, createdAt }`. New `EvidenceTimeline` component with vertical rail + dots, newest first, "+ Add entry" at top, per-row Edit (visible on hover, only for the entry's author, hidden when review is SUBMITTED). Server actions `addEvidenceEntry` / `updateEvidenceEntry` with authorization + frozen-on-submit checks. AI Generate now reads ALL entries newest-first with date headers so it sees the trajectory.
- [x] Per-grade example write-up hover hint next to each dimension heading. Small ⓘ icon → on hover, popover shows "Grade X · Title · Effective scope: ..." and a paragraph-length example modeling the "what shipped → so what? → complexity → outcome" rigor (numbers, customers, $, cross-team breadth, post-launch quality). Content lives in `lib/grade-examples.ts` (5 grades × 2 dimensions = 10 examples), easy to tune. Falls back to generic guidance if subject has no grade set.
- [x] Effective blast radius: derived from grade by default, **AI-suggested override** based on this review's evidence with manager confirm. Schema field `User.effectiveBlastRadius` (nullable, overrides grade default when set). Server action `suggestBlastRadius` calls Claude with all entries + rubric, returns one of the four standard scopes + rationale. Modal shows AI pick + rationale + 4 selectable chips (default tagged) + "Reset to grade default" if currently overridden. Hover hint and Profile card both read the effective scope, so the override propagates everywhere.
- [x] **Rating commit model**: AI suggestion and user's rating persist as separate fields. AI's pick is shown in the AI card + flagged on the chip with a sparkle + dashed border, but does NOT auto-fill the rating. The user MUST click a chip to commit. Re-clicking Suggest from evidence clears the user's commit (per "permanent until you click another chip or Suggest"). Save Draft allowed without a rating; Submit blocked without both ratings (server-side enforced).
- [x] **Concern entries**: `EvidenceEntry.type` field (POSITIVE default | CONCERN). Add/Edit modal has a "Mark as a concern" toggle. Timeline visual: amber dot + ⚠ Concern pill on the date row. Both AI prompts (rating + blast radius) prefix concern entries with `[CONCERN]` and instruct the model to weight them honestly. Existing entries default to POSITIVE on migration.
- [x] **Delete evidence entries**: trash icon + "Delete" label on each timeline row (visible on hover, only for the author, hidden when review is SUBMITTED). Server action `deleteEvidenceEntry` enforces author-only + not-submitted. Confirmation modal shows the entry preview (date + concern tag if any + body excerpt), requires typing `DELETE` to enable the destructive button — full GitHub-style irreversible-action pattern.
- [x] **Opportunity for growth section** below WHAT/HOW (separated by a hairline). Same timeline UI (vertical rail, dots, dates, Add entry, Edit, Delete) but **no rating chips, no rating AI** — purely qualitative coaching notes. A dedicated "✨ Suggest from evidence" button calls `suggestGrowthDraft`, which reads ALL WHAT + HOW entries (concerns weighted explicitly), returns a 2–4 sentence draft. Draft opens the Add modal pre-filled — manager edits/saves or discards. Manual + AI-assisted both supported; entries are optional. Schema reuses `EvidenceEntry` with new `dimension="GROWTH"` value.
- [ ] Quintile derived from population distribution (10/25/30/25/10) — phase 4, deferred
- [ ] Real auth (Auth.js) — would replace the hardcoded user in `lib/auth.ts`
- [ ] Review period detail page `/app/review-periods/[id]` (rows currently link to a 404)
- [ ] Review period creation flow (admin) — "New review period" button is a no-op
- [ ] Review submission flow (assignee)
- [ ] Manager view of submitted self-review
- [ ] AI assist on a single textarea ("improve this draft")

## Backlog (post-MVP)

- Peer reviews
- Calibration view
- Goals
- Analytics / heatmaps
- Email notifications (Resend)

## Review

### Dashboard shell + cycles list
- **Changed:** `app/app/layout.tsx` (sidebar shell), `app/app/page.tsx` (redirect), `app/app/cycles/page.tsx` (list + empty state). Added shadcn `badge` + `separator`. Seed script with 3 cycles.
- **Verified:** Loaded `/app` in browser → redirects to `/app/cycles`, all 3 seeded cycles render with correct status badges, hover states work, dates display in UTC (Jun 1 – Jun 30, etc.) matching the seed values.
- **Deferred:** Cycle detail page (rows link to 404), New Cycle action (button is inert), Auth (hardcoded user in sidebar footer).
- **Fixed mid-task:** Date formatting was off by a day because `new Date("2026-06-01")` parses as UTC and rendered in local TZ. Locked formatters to `timeZone: "UTC"` since cycle dates are date-only fields with no time component.

### Database setup (SQLite via Prisma 7)
- **Changed:** Added Prisma 7.8 + `@prisma/adapter-better-sqlite3` + `better-sqlite3`. Schema covers `User / Cycle / Template / Question / Review / Answer`. Singleton client at `lib/db.ts`. Migration `20260530144734_init` applied. `/api/health` route.
- **Verified:** Wrote a user in one process, read it in a second process (proves persistence). `GET /api/health` returns `{"ok":true,"users":1}` through the live dev server.
- **Deferred:** Auth, seed data, prod DB. SQLite-as-file is local-dev-only; production needs Postgres (Neon) or libSQL (Turso) — single-line provider swap when we get there.
- **Gotchas captured in lessons.md:** Prisma 7 driver-adapter requirement, .ts-only client output, pnpm 10 build-script gating, DATABASE_URL cwd resolution.
