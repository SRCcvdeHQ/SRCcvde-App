export type Membership = { role: string; status: string } | null;

export function hasActiveAccess(
  member: Membership,
  aal: string | undefined,
): boolean {
  if (!member || member.status !== "active") return false;
  if (["owner", "admin", "staff"].includes(member.role)) return aal === "aal2";
  return ["client"].includes(member.role);
}
