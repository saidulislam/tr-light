"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { isAdmin } from "@/lib/permissions";

const VALID_CADENCES = ["AD_HOC", "MONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"] as const;
const VALID_STATUSES = ["DRAFT", "OPEN", "CLOSED"] as const;

export async function createReviewPeriod(formData: FormData) {
  const me = await getCurrentUser();
  if (!isAdmin(me)) {
    throw new Error("Only the MD can create review periods.");
  }

  const name = String(formData.get("name") ?? "").trim();
  const cadence = String(formData.get("cadence") ?? "AD_HOC");
  const status = String(formData.get("status") ?? "DRAFT");
  const startsAtStr = String(formData.get("startsAt") ?? "");
  const endsAtStr = String(formData.get("endsAt") ?? "");

  if (!name) throw new Error("Name is required.");
  if (!startsAtStr) throw new Error("Start date is required.");
  if (!endsAtStr) throw new Error("End date is required.");
  if (!VALID_CADENCES.includes(cadence as (typeof VALID_CADENCES)[number])) {
    throw new Error(`Invalid cadence: ${cadence}`);
  }
  if (!VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
    throw new Error(`Invalid status: ${status}`);
  }

  const startsAt = new Date(startsAtStr);
  const endsAt = new Date(endsAtStr);
  if (Number.isNaN(startsAt.getTime())) throw new Error("Start date is invalid.");
  if (Number.isNaN(endsAt.getTime())) throw new Error("End date is invalid.");
  if (endsAt < startsAt) throw new Error("End date must be after the start date.");

  // Use the existing default template (the seed always creates one).
  const template = await db.template.findFirst({ orderBy: { createdAt: "desc" } });

  await db.reviewPeriod.create({
    data: {
      name,
      cadence,
      status,
      startsAt,
      endsAt,
      ownerId: me.id,
      templateId: template?.id,
    },
  });

  revalidatePath("/app/review-periods");
  revalidatePath("/", "layout");
}
