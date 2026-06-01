import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";
import { PeopleTable } from "@/components/people-table";
import { DataIO } from "@/components/data-io";

export default async function PeoplePage() {
  const me = await getCurrentUser();
  const [users, openPeriod] = await Promise.all([
    db.user.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        email: true,
        name: true,
        title: true,
        grade: true,
        city: true,
        country: true,
        managerId: true,
      },
    }),
    db.reviewPeriod.findFirst({
      where: { status: "OPEN" },
      orderBy: { endsAt: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const managerNameById = new Map(
    users.map((u) => [u.id, u.name ?? u.email] as const)
  );
  const directReportCount = new Map<string, number>();
  for (const u of users) {
    if (u.managerId) {
      directReportCount.set(
        u.managerId,
        (directReportCount.get(u.managerId) ?? 0) + 1
      );
    }
  }

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name ?? u.email,
    email: u.email,
    title: u.title ?? "",
    grade: u.grade ?? "",
    location: [u.city, u.country].filter(Boolean).join(", "),
    managerName: u.managerId ? managerNameById.get(u.managerId) ?? "" : "",
    directReports: directReportCount.get(u.id) ?? 0,
  }));

  return (
    <div className="px-10 py-10 max-w-7xl mx-auto">
      <header className="space-y-2 mb-8 flex items-start justify-between gap-6">
        <div>
          <h1 className="text-[32px] font-semibold tracking-[-0.02em] leading-tight">
            People
          </h1>
          <p className="text-[13px] text-muted-foreground">
            {rows.length} people across the org
            {openPeriod ? ` · open period: ${openPeriod.name}` : ""}
          </p>
        </div>
        {isAdmin(me) && <DataIO canManage />}
      </header>

      <PeopleTable rows={rows} />
    </div>
  );
}
