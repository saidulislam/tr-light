import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export default async function TemplatesPage() {
  const templates = await db.template.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      questions: { orderBy: { order: "asc" } },
      creator: { select: { name: true, email: true } },
      _count: { select: { reviewPeriods: true } },
    },
  });

  return (
    <div className="px-10 py-10 max-w-5xl mx-auto">
      <header className="space-y-2 mb-8">
        <h1 className="text-[32px] font-semibold tracking-[-0.02em] leading-tight">
          Templates
        </h1>
        <p className="text-[13px] text-muted-foreground">
          The question sets used to build a review period. Today templates are
          read-only — the WHAT / HOW rubric in <code className="text-[12px] font-mono">lib/rubric/</code>{" "}
          is the live surface.
        </p>
      </header>

      {templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 py-16 px-6 flex flex-col items-center text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <FileText className="size-5 text-muted-foreground" />
          </div>
          <p className="text-[14px] font-medium">No templates yet</p>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-sm">
            Templates are seeded via <code className="text-[11px] font-mono">scripts/seed.mts</code>. Once
            template editing ships, you'll create them here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border/70 rounded-lg border border-border overflow-hidden">
          {templates.map((t) => (
            <li key={t.id}>
              <Link
                href={`/app/templates/${t.id}`}
                className="group flex items-center gap-4 px-4 py-4 hover:bg-muted/40 transition-colors duration-150"
              >
                <div className="size-9 rounded-md bg-foreground/[0.07] flex items-center justify-center shrink-0">
                  <FileText className="size-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[14px] font-medium truncate">{t.name}</p>
                  <p className="text-[12px] text-muted-foreground mt-0.5">
                    {t.questions.length} {t.questions.length === 1 ? "question" : "questions"} ·{" "}
                    {t._count.reviewPeriods} {t._count.reviewPeriods === 1 ? "review period" : "review periods"} ·{" "}
                    created {DATE_FMT.format(t.createdAt)} by {t.creator.name ?? t.creator.email}
                  </p>
                </div>
                <ChevronRight className="size-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-all duration-150 shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
