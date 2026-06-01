"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Fragment } from "react";
import {
  CalendarRange,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  Inbox,
  LayoutGrid,
  Loader2,
  Settings,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/ui/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { setDemoUser } from "@/app/_actions/set-demo-user";
import { ThemeToggle } from "@/components/theme-toggle";

interface CurrentUser {
  name: string | null;
  email: string;
  role: string;
  title: string | null;
}

const NAV = [
  { label: "Your reviews", href: "/app/reviews", icon: Inbox },
  { label: "Calibration", href: "/app/calibration", icon: LayoutGrid },
  { label: "Review periods", href: "/app/review-periods", icon: CalendarRange },
  { label: "People", href: "/app/people", icon: Users },
  { label: "Templates", href: "/app/templates", icon: FileText },
  { label: "Settings", href: "/app/settings", icon: Settings },
];

const SOON: { label: string; href: string; icon: typeof Inbox }[] = [];

const ROLE_LABEL: Record<string, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  ADMIN: "Admin",
};

function initials(name: string | null, email: string) {
  const source = name ?? email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
}

interface OpenPeriod {
  name: string;
  endsAt: Date;
}

export interface PickerUser {
  email: string;
  name: string | null;
  title: string | null;
  grade: string | null;
  directReportCount: number;
}

function gradeRank(grade: string | null): number {
  if (!grade) return 999;
  const num = parseFloat(grade);
  if (Number.isNaN(num)) return 999;
  return -num;
}

function periodChip(p: OpenPeriod): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(p.endsAt);
  due.setHours(0, 0, 0, 0);
  const days = Math.round(
    (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  return `${days}d left`;
}

interface OrgChainEntry {
  id: string;
  name: string;
  title: string | null;
  isMe: boolean;
}

export function AppShell({
  user,
  openPeriod,
  allUsers,
  orgChain,
  children,
}: {
  user: CurrentUser;
  openPeriod: OpenPeriod | null;
  allUsers: PickerUser[];
  orgChain: OrgChainEntry[];
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  useEffect(() => setMounted(true), []);

  function isActive(href: string) {
    if (!mounted) return false;
    if (href === "/app/reviews") {
      return pathname === href || pathname.startsWith("/app/reviews/");
    }
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-60 border-r bg-background flex flex-col shrink-0">
        <div className="px-4 pt-4 pb-3 border-b space-y-3">
          <Link
            href="/app"
            className="flex items-center gap-2.5 -mx-1 px-1 py-1 rounded-md hover:bg-muted/60 transition-colors duration-150"
          >
            <BrandMark className="size-6 shrink-0" />
            <div className="leading-tight">
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70 font-medium">
                ACME
              </p>
              <p className="text-[13px] font-semibold tracking-tight">
                Talent Review
              </p>
            </div>
          </Link>
          {openPeriod && (
            <div className="rounded-md bg-muted/50 px-2.5 py-2 space-y-0.5">
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70 font-medium">
                Open period
              </p>
              <p className="text-[12px] font-medium truncate">
                {openPeriod.name}
              </p>
              <p className="text-[11px] text-muted-foreground tabular-nums">
                {periodChip(openPeriod)}
              </p>
            </div>
          )}
        </div>
        <div className="p-3 border-b">
          <button
            type="button"
            onClick={() => setSwitcherOpen(true)}
            aria-label="Switch user"
            className="group w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-muted/60 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="size-7 rounded-full bg-foreground/10 flex items-center justify-center text-xs font-medium shrink-0">
              {initials(user.name, user.email)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-medium truncate">
                {user.name ?? user.email}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {user.title ?? ROLE_LABEL[user.role] ?? user.role}
              </p>
            </div>
            <ChevronsUpDown className="size-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
          </button>
        </div>
        <nav aria-label="Primary" className="flex-1 p-3 space-y-0.5">
          {NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors duration-150",
                  active
                    ? "bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}

          {SOON.length > 0 && (
            <>
              <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70 px-3 mt-6 mb-1.5">
                Coming soon
              </p>
              {SOON.map((item) => {
                const Icon = item.icon;
                return (
                  <span
                    key={item.href}
                    role="link"
                    aria-disabled="true"
                    tabIndex={-1}
                    title="Not yet available"
                    className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground/50 cursor-not-allowed select-none"
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </span>
                );
              })}
            </>
          )}
        </nav>
        <div className="p-3 border-t flex items-center justify-between px-4">
          <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70 font-medium">
            Theme
          </span>
          <ThemeToggle />
        </div>
      </aside>
      <main
        id="main"
        tabIndex={-1}
        aria-label="Main"
        className="flex-1 min-w-0 outline-none flex flex-col"
      >
        {orgChain.length > 0 && (
          <div
            aria-label="Viewing org"
            className="border-b border-border bg-muted/20 px-10 py-2 flex items-center gap-1.5 text-[12px] flex-wrap"
          >
            <span className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/70 font-semibold mr-2">
              Viewing
            </span>
            {orgChain.map((entry, i) => (
              <Fragment key={entry.id}>
                {i > 0 && (
                  <ChevronRight
                    aria-hidden="true"
                    className="size-3 text-muted-foreground/40"
                  />
                )}
                <span
                  className={cn(
                    "truncate",
                    entry.isMe
                      ? "font-medium text-foreground"
                      : "text-muted-foreground"
                  )}
                  title={entry.title ?? undefined}
                >
                  {entry.name}
                  {entry.isMe && (
                    <span className="ml-1 text-[10px] text-muted-foreground/70 font-normal">
                      (you)
                    </span>
                  )}
                </span>
              </Fragment>
            ))}
          </div>
        )}
        <div className="flex-1 min-h-0">{children}</div>
      </main>

      {switcherOpen && (
        <UserSwitcherDialog
          currentEmail={user.email}
          allUsers={allUsers}
          onClose={() => setSwitcherOpen(false)}
        />
      )}
    </div>
  );
}

function UserSwitcherDialog({
  currentEmail,
  allUsers,
  onClose,
}: {
  currentEmail: string;
  allUsers: PickerUser[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentEmail);
  const [pending, startTransition] = useTransition();

  const byGrade = new Map<string, PickerUser[]>();
  for (const u of allUsers) {
    const key = u.grade ?? "?";
    if (!byGrade.has(key)) byGrade.set(key, []);
    byGrade.get(key)!.push(u);
  }
  const grades = [...byGrade.keys()].sort((a, b) => gradeRank(a) - gradeRank(b));

  function handleSwitch() {
    if (selected === currentEmail) {
      onClose();
      return;
    }
    startTransition(async () => {
      try {
        await setDemoUser({ email: selected });
        onClose();
        router.refresh();
      } catch (e) {
        alert(e instanceof Error ? e.message : "Switch failed");
      }
    });
  }

  return (
    <Dialog open={true} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Switch user</DialogTitle>
          <DialogDescription>
            Pick any user to view the app from their perspective. Cookie-based; closes with the browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label
            htmlFor="user-switch-select"
            className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
          >
            Sign in as
          </label>
          <select
            id="user-switch-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            disabled={pending}
            autoFocus
            className="w-full appearance-none rounded-md border border-border bg-background px-3 py-2.5 text-[14px] font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent pr-10 bg-[length:14px] bg-[right_12px_center] bg-no-repeat disabled:opacity-50"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>\")",
            }}
          >
            {grades.map((g) => (
              <optgroup key={g} label={`Grade ${g}`}>
                {byGrade.get(g)!.map((u) => (
                  <option key={u.email} value={u.email}>
                    {u.name ?? u.email}
                    {u.title ? ` — ${u.title}` : ""}
                    {u.directReportCount > 0
                      ? ` (${u.directReportCount})`
                      : ""}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={handleSwitch} disabled={pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Switch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
