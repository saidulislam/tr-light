# Talent Review (tr-light)

A smart, simple, and stunningly gorgeous performance review web application for ACME Inc — a demo of what HR tooling can feel like when it respects the manager's time.

> Built with Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4 + Prisma 7 (SQLite) + Anthropic Claude.

## What's in here

- **Reviews** — Manager writes a WHAT/HOW rubric review with an evidence timeline, AI-drafted rationale, and bias-aware suggestions.
- **Calibration** — Per-grade Kanban board with drag-and-drop force ranking, rationale required for every move, full audit log. Any manager can recalibrate anyone in their subtree.
- **Review Periods** — Ad-hoc / Monthly / Quarterly / Semiannual / Annual cadences.
- **People** — Searchable directory, grade filter, Excel upload/download (MD only on this page).
- **Templates / Settings** — Read-only at the moment; templates are seeded.
- **User switching** — Cookie-based demo auth. Click your avatar in the sidebar to sign in as anyone.
- **Dark mode** — Light / Dark / System toggle at the bottom of the sidebar.
- **Excel import/export** — Matches a fixed column schema; updates by Standard ID, creates by Email + Manager Email; per-row change diff in the import results dialog.

## Quick start

```bash
# 1. Install
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env if you want AI suggestions to call Anthropic (optional — mocks are honest)

# 3. Create the SQLite database
pnpm prisma db push

# 4. Seed demo data (65 users, 3 review periods, rich evidence for one review)
pnpm tsx scripts/seed.mts

# 5. Run dev server
pnpm dev
```

Open <http://localhost:3000>. Pick any user from the dropdown to sign in.

> **Tip**: log in as `john.doe@acme.com` (Managing Director) to see the full org. Or sign in as anyone — the breadcrumb at the top of the page shows you your management chain.

## Roles in the seed

- **John Doe** — Managing Director (605). Full upload/download on People page.
- **Rue Oberi / Jessica Morales / Robert Marzetti** — Engineering Directors (604.x).
- **Rick Mojave / Jane Kruznetz / Joy Rohan / etc.** — Senior VPs / VPs (603.x).
- **Aaron Yamamoto** — Principal Engineer (603.2 IC). Reports to Rue.
- **Sophia Lindberg** — Tech Lead (603.1 IC). Reports to Jessica.
- ~50 ICs across grades 502, 601, 602.

## Project structure

- `app/` — Next.js routes
  - `app/app/*` — authed surfaces (reviews, calibration, people, templates, settings, review periods)
  - `app/api/data/*` — Excel import/export/sample routes
  - `app/_actions/*` — server actions (set demo user, set theme, create period)
- `components/` — UI components, including `manager-review-form.tsx` (the main rubric form) and `calibration-board.tsx` (the dnd-kit Kanban)
- `lib/` — `auth.ts`, `db.ts`, `ai.ts`, `permissions.ts`, `visibility.ts`, `rubric/*`, `excel-schema.ts`, `calibration.ts`, `theme.ts`
- `prisma/schema.prisma` — schema
- `scripts/seed.mts` — deterministic seed

## Notes

- The local SQLite file at `prisma/dev.db` is gitignored. Run `pnpm prisma db push && pnpm tsx scripts/seed.mts` after cloning to get a fresh demo database.
- `AI_API_KEY` is optional. Without it, AI suggestions return deterministic mocks so every flow still works end-to-end.
- The visibility filter (`lib/visibility.ts`) hides Grade 604.x and the MD's direct reports from calibration. Flip the flags to re-enable.
- Calibration data and reviews respect each viewer's subtree; the People directory is org-wide.

## Development conventions

See `CLAUDE.md` for the design system, voice & tone, and engineering principles followed throughout.
