"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { DEMO_USER_COOKIE } from "@/lib/auth";

/** Set the demo user cookie and (optionally) redirect.
 *  Used by the home-page picker and the sidebar switcher. */
export async function setDemoUser(args: { email: string; redirectTo?: string }) {
  const user = await db.user.findUnique({
    where: { email: args.email },
    select: { id: true },
  });
  if (!user) {
    throw new Error(`Unknown user: ${args.email}`);
  }
  const store = await cookies();
  store.set(DEMO_USER_COOKIE, args.email, {
    path: "/",
    sameSite: "lax",
    // No maxAge — session cookie. Cleared when the browser closes.
  });
  revalidatePath("/", "layout");
  if (args.redirectTo) {
    redirect(args.redirectTo);
  }
}

/** Form-action wrapper. Used by the home-page picker (a plain HTML <form>). */
export async function setDemoUserForm(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  if (!email) throw new Error("Pick a user");
  await setDemoUser({ email, redirectTo: "/app/reviews" });
}
