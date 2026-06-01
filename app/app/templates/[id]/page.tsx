import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { Badge } from "@/components/ui/badge";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function kindLabel(kind: string): string {
  if (kind === "TEXT") return "Free text";
  if (kind === "RATING") return "Rating";
  if (kind === "BEHAVIOR") return "Behavior-anchored";
  return kind;
}

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await db.template.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" } },
      creator: { select: { name: true, email: true } },
      reviewPeriods: { orderBy: { endsAt: "desc" } },
    },
  });
  if (!template) notFound();

  return (
    <div className="px-10 py-10 max-w-3xl mx-auto">
      <Link
        href="/app/templates"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors duration-150 mb-4"
      >
        <ArrowLeft className="size-3.5" />
        Templates
      </Link>

      <header className="space-y-2 mb-8">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-tight">
          {template.name}
        </h1>
        <p className="text-[13px] text-muted-foreground">
          {template.questions.length} {template.questions.length === 1 ? "question" : "questions"} ·{" "}
          created {DATE_FMT.format(template.createdAt)} by {template.creator.name ?? template.creator.email}
        </p>
      </header>

      <section className="space-y-3 mb-10">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          Questions
        </p>
        <ol className="space-y-2.5">
          {template.questions.map((q, i) => (
            <li
              key={q.id}
              className="flex items-start gap-3 rounded-md border border-border bg-background px-4 py-3"
            >
              <span className="text-[12px] font-mono tabular-nums text-muted-foreground shrink-0 pt-0.5">
                {i + 1}.
              </span>
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-[14px]">{q.prompt}</p>
                <Badge variant="outline" className="text-[10px] font-medium">
                  {kindLabel(q.kind)}
                </Badge>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {template.reviewPeriods.length > 0 && (
        <section className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
            Used by
          </p>
          <ul className="space-y-1.5">
            {template.reviewPeriods.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-md border border-border bg-background px-4 py-2.5 text-[13px]"
              >
                <span className="font-medium">{p.name}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums uppercase tracking-[0.08em]">
                  {p.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
