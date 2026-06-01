/**
 * Authorization helpers. Today these are role-based; once real auth lands
 * they can be tightened to e.g. team-scoped checks.
 *
 * The seed assigns: ADMIN to the MD, MANAGER to anyone at grade 603+, and
 * EMPLOYEE to ICs (501–602). So `canManageData` is effectively "anyone above
 * the IC tier".
 */

export function canManageData(user: { role: string }): boolean {
  return user.role === "ADMIN" || user.role === "MANAGER";
}

/** Only the MD-level admin has org-wide upload/download access on the People
 *  page. Other managers download/upload via Calibration, scoped to their tree. */
export function isAdmin(user: { role: string }): boolean {
  return user.role === "ADMIN";
}
