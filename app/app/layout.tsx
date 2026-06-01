import { AppShell } from "@/components/app-shell";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const [openPeriod, allUsers] = await Promise.all([
    db.reviewPeriod.findFirst({
      where: { status: "OPEN" },
      orderBy: { endsAt: "asc" },
      select: { name: true, endsAt: true },
    }),
    db.user.findMany({
      select: {
        email: true,
        name: true,
        title: true,
        grade: true,
        managerId: true,
        id: true,
      },
      orderBy: [{ name: "asc" }],
    }),
  ]);

  const directReportCount = new Map<string, number>();
  for (const u of allUsers) {
    if (u.managerId) {
      directReportCount.set(
        u.managerId,
        (directReportCount.get(u.managerId) ?? 0) + 1
      );
    }
  }
  const pickerUsers = allUsers.map((u) => ({
    email: u.email,
    name: u.name,
    title: u.title,
    grade: u.grade,
    directReportCount: directReportCount.get(u.id) ?? 0,
  }));

  // Walk up the management chain from the current user to the top of the org.
  // Reversed so the rendered breadcrumb reads MD → … → you.
  const byId = new Map(allUsers.map((u) => [u.id, u] as const));
  const chain: Array<{ id: string; name: string; title: string | null; isMe: boolean }> = [];
  const seen = new Set<string>();
  let cursor: string | null = user.id;
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const u = byId.get(cursor);
    if (!u) break;
    chain.push({
      id: u.id,
      name: u.name ?? u.email,
      title: u.title,
      isMe: u.id === user.id,
    });
    cursor = u.managerId;
  }
  chain.reverse();

  return (
    <AppShell
      user={{
        name: user.name,
        email: user.email,
        role: user.role,
        title: user.title,
      }}
      openPeriod={openPeriod}
      allUsers={pickerUsers}
      orgChain={chain}
    >
      {children}
    </AppShell>
  );
}
