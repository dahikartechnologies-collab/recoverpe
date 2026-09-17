import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  hasAuthSession,
  isAuthorizedAdmin,
  resolveAdminActorUserId,
} from "@/lib/admin-access";

export async function enforceAdminRouteAccess(): Promise<void> {
  const cookieHeader = cookies()
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");

  if (!hasAuthSession(cookieHeader)) {
    redirect("/login");
  }

  const actorUserId = resolveAdminActorUserId(cookieHeader);

  if (!actorUserId) {
    redirect("/login");
  }

  const allowed = await isAuthorizedAdmin(actorUserId);

  if (!allowed) {
    redirect("/dashboard");
  }
}
