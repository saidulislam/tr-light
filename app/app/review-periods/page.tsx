import Link from "next/link";
import { CalendarRange, ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { NewPeriodDialog } from "@/components/new-period-dialog";

type PeriodStatus = "DRAFT" | "OPEN" | "CLOSED";

const STATUS_LABEL: Record<PeriodStatus, string> = {
  DRAFT: "Draft",
  OPEN: "Open",
  CLOSED: "Closed",
};

const CADENCE_LABEL: Record<string, string> = {
  AD_HOC: "Ad hoc",
  MONTHLY: "Monthly",
  QUARTERLY: "Quarterly",
  SEMIANNUAL: "Every 6 months",
  ANNUAL: "Annual",
};

function statusVariant(status: string): "secondary" | "default" | "outline" {
  if (status === "OPEN") return "default";
  if (status === "DRAFT") return "secondary";
  return "outline";
}

const DATE_FMT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const DATE_FMT_SHORT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

function formatRange(start: Date, end: Date) {
  return `${DATE_FMT_SHORT.format(start)} – ${DATE_FMT.format(end)}`;
}

export default async function ReviewPeriodsPage() {
  const [me, periods] = await Promise.all([
    getCurrentUser(),
    db.reviewPeriod.findMany({
      orderBy: { startsAt: "desc" },
      include: { _count: { select: { reviews: true } }, owner: true },
    }),
  ]);

  const canCreate = isAdmin(me);

  return (
    <div className="px-10 py-10 max-w-5xl">
      <header className="flex items-end justify-between mb-10">
        <div className="space-y-1">
          <h1 className="text-3xl font-semibold tracking-tight">
            Review periods
          </h1>
          <p className="text-sm text-muted-foreground">
            {periods.length} {periods.length === 1 ? "period" : "periods"}{" "}
            across your organization.
          </p>
        </div>
        {canCreate && <NewPeriodDialog />}
      </header>

      {periods.length === 0 ? (
        <EmptyState canCreate={canCreate} />
      ) : (
        <ul className="rounded-lg border bg-background divide-y">
          {periods.map((p) => (
            <li key={p.id}>
              <Link
                href={`/app/review-periods/${p.id}`}
                className="group flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{p.name}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {formatRange(p.startsAt, p.endsAt)} · {p._count.reviews}{" "}
                    {p._count.reviews === 1 ? "review" : "reviews"} ·{" "}
                    {p.owner.name ?? p.owner.email}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] font-medium">
                  {CADENCE_LABEL[p.cadence] ?? p.cadence}
                </Badge>
                <Badge variant={statusVariant(p.status)}>
                  {STATUS_LABEL[p.status as PeriodStatus] ?? p.status}
                </Badge>
                <ChevronRight className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EmptyState({ canCreate }: { canCreate: boolean }) {
  return (
    <div className="rounded-lg border border-dashed bg-background py-16 px-6 flex flex-col items-center text-center">
      <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <CalendarRange className="size-5 text-muted-foreground" />
      </div>
      <h2 className="font-medium text-base">No review periods yet</h2>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        A review period is a defined window — like &quot;H1 2026&quot; — when
        everyone completes self-reviews and managers write reviews of their
        reports.
      </p>
      {canCreate && (
        <div className="mt-5">
          <NewPeriodDialog label="Create your first review period" />
        </div>
      )}
    </div>
  );
}
