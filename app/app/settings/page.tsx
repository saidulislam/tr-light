import {
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Sparkles,
  KeySquare,
} from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import {
  DISABLED_GRADE_PREFIXES,
  HIDE_DIRECT_REPORTS_OF_TOP,
} from "@/lib/visibility";
import { AiGlyph } from "@/components/ui/ai-glyph";

export default async function SettingsPage() {
  const [me, counts] = await Promise.all([
    getCurrentUser(),
    Promise.all([
      db.user.count(),
      db.review.count(),
      db.evidenceEntry.count(),
      db.quintileAssignment.count(),
      db.quintileMove.count(),
      db.reviewPeriod.count(),
    ]),
  ]);
  const [
    userCount,
    reviewCount,
    evidenceCount,
    assignmentCount,
    moveCount,
    periodCount,
  ] = counts;

  const aiKey = process.env.AI_API_KEY ?? "";
  const aiKeyShort = aiKey ? `${aiKey.slice(0, 6)}…${aiKey.slice(-4)}` : null;

  return (
    <div className="px-10 py-10 max-w-3xl mx-auto">
      <header className="space-y-2 mb-10">
        <h1 className="text-[32px] font-semibold tracking-[-0.02em] leading-tight">
          Settings
        </h1>
        <p className="text-[13px] text-muted-foreground">
          App-wide configuration. Most of these are read-only for now — flip
          them in <code className="text-[12px] font-mono">lib/visibility.ts</code> and reload.
        </p>
      </header>

      <div className="space-y-10">
        <Section
          title="Signed in"
          eyebrow="Identity"
          icon={KeySquare}
        >
          <Row label="Name">{me.name ?? "—"}</Row>
          <Row label="Email">{me.email}</Row>
          <Row label="Title">{me.title ?? "—"}</Row>
          <Row label="Role">{me.role}</Row>
          <Row label="Grade">{me.grade ?? "—"}</Row>
          <p className="text-[12px] text-muted-foreground pt-2">
            Switch user from the sidebar chip — cookie-based, no password.
          </p>
        </Section>

        <Section title="AI" eyebrow="Suggestions" icon={Sparkles}>
          <Row label="AI_API_KEY">
            {aiKey ? (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="size-3.5 text-[--color-positive]" />
                <span className="font-mono text-[12px]">{aiKeyShort}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">
                Not set — AI suggestions fall back to deterministic mocks
              </span>
            )}
          </Row>
          <Row label="Model (drafting)">
            <span className="font-mono text-[12px]">claude-sonnet-4-6</span>
          </Row>
          <p className="text-[12px] text-muted-foreground pt-2 flex items-center gap-1.5">
            <AiGlyph className="size-3 text-[--color-ai]" />
            Every AI suggestion requires human accept-and-save. Nothing is persisted without your sign-off.
          </p>
        </Section>

        <Section title="Visibility" eyebrow="Filters" icon={Eye}>
          <Row label="Disabled grade prefixes">
            {DISABLED_GRADE_PREFIXES.length === 0 ? (
              <span className="text-muted-foreground">None</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {DISABLED_GRADE_PREFIXES.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/30 px-2 py-0.5 text-[11px] font-mono tabular-nums"
                  >
                    <EyeOff className="size-2.5 text-muted-foreground" />
                    {p}*
                  </span>
                ))}
              </div>
            )}
          </Row>
          <Row label="Hide direct reports of top">
            {HIDE_DIRECT_REPORTS_OF_TOP ? "On" : "Off"}
          </Row>
          <p className="text-[12px] text-muted-foreground pt-2">
            These hide subjects from calibration and the reviews inbox. Data is
            untouched — set the constants in{" "}
            <code className="text-[11px] font-mono">lib/visibility.ts</code> to
            re-enable.
          </p>
        </Section>

        <Section title="Database" eyebrow="Snapshot" icon={Database}>
          <Row label="Users">{userCount.toLocaleString()}</Row>
          <Row label="Review periods">{periodCount.toLocaleString()}</Row>
          <Row label="Reviews">{reviewCount.toLocaleString()}</Row>
          <Row label="Evidence entries">{evidenceCount.toLocaleString()}</Row>
          <Row label="Quintile assignments">{assignmentCount.toLocaleString()}</Row>
          <Row label="Quintile moves (audit log)">{moveCount.toLocaleString()}</Row>
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  eyebrow,
  icon: Icon,
  children,
}: {
  title: string;
  eyebrow: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Icon className="size-3.5 text-muted-foreground" />
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {eyebrow}
        </p>
      </div>
      <h2 className="text-xl font-semibold tracking-[-0.015em]">{title}</h2>
      <div className="space-y-2 rounded-lg border border-border bg-background p-4">
        {children}
      </div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 first:pt-0 last:pb-0">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <div className="text-[13px] tabular-nums">{children}</div>
    </div>
  );
}
