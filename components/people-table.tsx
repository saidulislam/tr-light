"use client";

import { useMemo, useState } from "react";
import { Search, Users as UsersIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PeopleRow {
  id: string;
  name: string;
  email: string;
  title: string;
  grade: string;
  location: string;
  managerName: string;
  directReports: number;
}

function initials(name: string, email: string) {
  const source = name || email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

export function PeopleTable({ rows }: { rows: PeopleRow[] }) {
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("");

  const grades = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) if (r.grade) set.add(r.grade);
    return [...set].sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (gradeFilter && r.grade !== gradeFilter) return false;
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.email.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.managerName.toLowerCase().includes(q) ||
        r.location.toLowerCase().includes(q)
      );
    });
  }, [rows, query, gradeFilter]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60 pointer-events-none" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, title, manager, location…"
            className="w-full rounded-md border border-border bg-background pl-9 pr-3 py-2 text-[14px] placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
          />
        </div>
        <select
          value={gradeFilter}
          onChange={(e) => setGradeFilter(e.target.value)}
          className="appearance-none rounded-md border border-border bg-background px-3 py-2 text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent pr-9 bg-[length:12px] bg-[right_10px_center] bg-no-repeat min-w-[140px]"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
          }}
        >
          <option value="">All grades</option>
          {grades.map((g) => (
            <option key={g} value={g}>
              Grade {g}
            </option>
          ))}
        </select>
        <span className="text-[12px] text-muted-foreground tabular-nums">
          {filtered.length} of {rows.length}
        </span>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 py-16 px-6 flex flex-col items-center text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <UsersIcon className="size-5 text-muted-foreground" />
          </div>
          <p className="text-[14px] font-medium">No people match</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Try a different search or clear the grade filter.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/80">
                <th className="text-left px-4 py-2.5 font-semibold">Name</th>
                <th className="text-left px-4 py-2.5 font-semibold">Title</th>
                <th className="text-left px-4 py-2.5 font-semibold">Grade</th>
                <th className="text-left px-4 py-2.5 font-semibold">Manager</th>
                <th className="text-left px-4 py-2.5 font-semibold">Location</th>
                <th className="text-right px-4 py-2.5 font-semibold tabular-nums">
                  Reports
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors duration-150",
                    i % 2 === 1 && "bg-muted/[0.08]"
                  )}
                >
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="size-7 rounded-full bg-foreground/[0.07] flex items-center justify-center text-[10px] font-medium shrink-0">
                        {initials(r.name, r.email)}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{r.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {r.email}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.title || "—"}
                  </td>
                  <td className="px-4 py-2.5 tabular-nums">{r.grade || "—"}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.managerName || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {r.location || "—"}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {r.directReports > 0 ? r.directReports : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
