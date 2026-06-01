import { ChevronRight } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUserEmail } from "@/lib/auth";
import { BrandMark } from "@/components/ui/brand-mark";
import { Button } from "@/components/ui/button";
import { setDemoUserForm } from "./_actions/set-demo-user";

// Sort grades so the most senior appear first in the picker.
function gradeRank(grade: string | null): number {
  if (!grade) return 999;
  const num = parseFloat(grade);
  if (Number.isNaN(num)) return 999;
  return -num;
}

export default async function Home() {
  const [users, currentEmail] = await Promise.all([
    db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        title: true,
        grade: true,
        managerId: true,
      },
      orderBy: [{ name: "asc" }],
    }),
    getCurrentUserEmail(),
  ]);

  // Count direct reports so the picker can label managers with their team size.
  const directReportCount = new Map<string, number>();
  for (const u of users) {
    if (u.managerId) {
      directReportCount.set(
        u.managerId,
        (directReportCount.get(u.managerId) ?? 0) + 1
      );
    }
  }

  // Group users by grade so the dropdown reads like an org chart.
  const byGrade = new Map<string, typeof users>();
  for (const u of users) {
    const key = u.grade ?? "?";
    if (!byGrade.has(key)) byGrade.set(key, []);
    byGrade.get(key)!.push(u);
  }
  const grades = [...byGrade.keys()].sort((a, b) => gradeRank(a) - gradeRank(b));

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-background">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-12 justify-center">
          <BrandMark className="size-9" />
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-medium">
              ACME
            </p>
            <p className="text-[15px] font-semibold tracking-tight">
              Talent Review
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <header className="space-y-2 text-center">
            <h1 className="text-[28px] font-semibold tracking-[-0.02em] leading-tight">
              Sign in
            </h1>
            <p className="text-[13px] text-muted-foreground">
              Pick a user to demo. You can switch any time from the sidebar.
            </p>
          </header>

          <form action={setDemoUserForm} className="space-y-3">
            <label
              htmlFor="email"
              className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
            >
              Sign in as
            </label>
            <select
              id="email"
              name="email"
              defaultValue={currentEmail}
              autoFocus
              className="w-full appearance-none rounded-md border border-border bg-background px-3 py-2.5 text-[14px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent bg-[length:14px] bg-[right_12px_center] bg-no-repeat pr-10"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
              }}
            >
              {grades.map((g) => (
                <optgroup key={g} label={`Grade ${g}`}>
                  {byGrade.get(g)!.map((u) => {
                    const count = directReportCount.get(u.id) ?? 0;
                    return (
                      <option key={u.email} value={u.email}>
                        {u.name ?? u.email}
                        {u.title ? ` — ${u.title}` : ""}
                        {count > 0 ? ` (${count})` : ""}
                      </option>
                    );
                  })}
                </optgroup>
              ))}
            </select>

            <Button type="submit" className="w-full gap-1.5">
              Continue
              <ChevronRight className="size-4" />
            </Button>
          </form>

          <p className="text-[11px] text-muted-foreground/70 text-center pt-2">
            Demo only — no password. Cookie-based; closes with the browser.
          </p>
        </div>
      </div>
    </main>
  );
}
