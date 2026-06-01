import { cookies } from "next/headers";
import { db } from "./db";

// TODO: replace with real auth (Auth.js). For the demo, the "current user"
// is whichever email is stored in the `tr-demo-user` cookie. The home page
// and sidebar both let you switch. When no cookie is set, we fall back to
// the Managing Director so a fresh visitor sees the full org.
export const DEFAULT_DEMO_EMAIL = "john.doe@acme.com";
export const DEMO_USER_COOKIE = "tr-demo-user";

export async function getCurrentUserEmail(): Promise<string> {
  const store = await cookies();
  const value = store.get(DEMO_USER_COOKIE)?.value;
  return value && value.includes("@") ? value : DEFAULT_DEMO_EMAIL;
}

export async function getCurrentUser() {
  const email = await getCurrentUserEmail();
  const user = await db.user.findUnique({ where: { email } });
  if (user) return user;
  // Cookie pointed at a user that no longer exists — fall back.
  const fallback = await db.user.findUnique({ where: { email: DEFAULT_DEMO_EMAIL } });
  if (!fallback) {
    throw new Error(
      `Demo user ${DEFAULT_DEMO_EMAIL} not found. Run \`pnpm tsx scripts/seed.mts\`.`,
    );
  }
  return fallback;
}
