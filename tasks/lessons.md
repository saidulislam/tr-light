# tasks/lessons.md

Capture corrections and validated approaches here. One per heading. Read at session start.

## Restart the dev server after resetting the SQLite DB

If you run `rm prisma/dev.db && prisma migrate dev` (or `prisma migrate reset`) while `pnpm dev` is running, the dev server's `better-sqlite3` connection becomes stale. It still holds the deleted file's inode — reads from cache appear to work, but every write fails with **"attempt to write a readonly database"**. New processes (`tsx scripts/seed.mts`) work fine because they open fresh connections, which masks the problem.

**Why:** the singleton in `lib/db.ts` opens the DB once per process. Deleting the file underneath it leaves the open file descriptor pointing at a ghost.

**How to apply:** any time you reset the DB during development, restart the dev server (`TaskStop` + `pnpm dev`). After a `prisma migrate dev` that recreates the file, restart. The seed script's success is NOT proof the dev server can write — they use different connections.

## Don't claim "shipped end-to-end" without exercising the codepath

Per CLAUDE.md "Verification Before Done": run the new flow before saying it works. When automation (e.g. kapture) can't click hover-only buttons, find another way — fire a server action from a `tsx` script, navigate to a state where the button is visible, force-display in devtools, or be honest that you didn't verify and ask the user to test.

**Why:** I shipped delete-evidence-entry saying "end-to-end" but had only inspected the code. The user hit a "readonly database" error on the first real click. Cost: their time + trust.

**How to apply:** before writing "shipped" or "works", point to a concrete observation that proves the codepath ran successfully — a screenshot of the result state, a tsx-script log line, or a curl response. "The code looks correct" is not verification.

## Next.js 16 — read the docs

This project uses Next.js 16, which has breaking changes from Next.js 14/15 conventions baked into model training data. Before editing routing, data fetching, caching, server actions, or `next.config.ts` — check `node_modules/next/dist/docs/` and the `AGENTS.md` warning.

**Why:** Pre-16 patterns (e.g. default fetch caching, `unstable_*` APIs, params/searchParams as sync objects) silently break or are removed.

**How to apply:** If a Next.js API "feels familiar," verify it against the installed version before using it.

## Prisma 7 — driver adapters are mandatory

`new PrismaClient()` with no arguments throws in Prisma 7. So does passing `datasourceUrl` or `datasources.db.url` — those options were removed. You MUST construct the client with a driver adapter (or `accelerateUrl`).

**Why:** Prisma 7 replaced the Rust Query Engine with a JS Query Compiler that runs through driver adapters. The old client-reads-connection-string flow no longer exists.

**How to apply:** For SQLite use `@prisma/adapter-better-sqlite3` (the class is `PrismaBetterSqlite3` — lowercase `q`):
```ts
const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });
```
For Postgres swap to `@prisma/adapter-pg`. For Turso/libSQL use `@prisma/adapter-libsql`.

## Prisma 7 — client output is .ts only

The new `prisma-client` generator emits `.ts` files with extensionless internal imports (`from './enums'`). Plain `node` can't resolve these — you'll get `ERR_MODULE_NOT_FOUND`.

**Why:** Prisma moved away from generating .js + .d.ts to TS-source-only output.

**How to apply:** Inside Next.js everything works (Next compiles TS). For standalone scripts (seeds, smoke tests, migrations), use `pnpm tsx` and `.mts` extension if you want top-level await.

## pnpm 10 — postinstall scripts are blocked by default

`pnpm install` will NOT run postinstall scripts for native modules (better-sqlite3, esbuild, @prisma/engines) unless they're listed in `pnpm.onlyBuiltDependencies` in package.json.

**Why:** Supply-chain hardening default in pnpm 10+.

**How to apply:** When adding a native dep, append it to the `onlyBuiltDependencies` array and re-run `pnpm install`. Symptom of missing this: `TransformError` from esbuild, "engine not found" from Prisma, or compile errors at runtime.

## SQLite DATABASE_URL resolves from cwd

`file:./prisma/dev.db` is interpreted relative to the process working directory (project root), not relative to `schema.prisma`. So set the URL with the `prisma/` prefix to keep the db file co-located with the schema.

**Why:** Prisma 7's `prisma.config.ts` resolves env vars at the project-root level.

**How to apply:** Use `DATABASE_URL="file:./prisma/dev.db"` in `.env`.
