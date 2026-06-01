import { db } from "@/lib/db";

export async function GET() {
  const users = await db.user.count();
  return Response.json({ ok: true, users });
}
