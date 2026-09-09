import { BUSINESS_SELECT } from "@/lib/business-select";
import { createAdminSupabaseClient } from "@/lib/supabase-admin";
import { AccessibleBusinessOption, AppRole, Business } from "@/types";

function formatAssignedContextLabel(role: AppRole, businessName: string): string {
  switch (role) {
    case "admin":
      return `Admin · ${businessName}`;
    case "recovery_agent":
      return `Recovery Agent · ${businessName}`;
    case "accountant":
      return `Accountant · ${businessName}`;
    case "field_staff":
      return `Field Staff · ${businessName}`;
    default:
      return `${businessName}`;
  }
}

async function fetchBusinessesForWorkspace(
  workspaceUserId: string
): Promise<Business[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("user_id", workspaceUserId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to load businesses.");
  }

  return (data ?? []) as Business[];
}

async function fetchPrimaryBusiness(
  workspaceUserId: string
): Promise<Business | null> {
  const businesses = await fetchBusinessesForWorkspace(workspaceUserId);
  return businesses[0] ?? null;
}

async function fetchWorkspaceLabel(
  supabase: ReturnType<typeof createAdminSupabaseClient>,
  workspaceUserId: string
): Promise<string> {
  const { data: user } = await supabase
    .from("users")
    .select("full_name, email")
    .eq("id", workspaceUserId)
    .maybeSingle();

  return (
    (user?.full_name as string | undefined) ||
    (user?.email as string | undefined) ||
    "Shared workspace"
  );
}

export async function listAccessibleBusinesses(
  actorUserId: string
): Promise<AccessibleBusinessOption[]> {
  const supabase = createAdminSupabaseClient();
  const options: AccessibleBusinessOption[] = [];

  const ownBusinesses = await fetchBusinessesForWorkspace(actorUserId);
  const primaryOwnBusiness = ownBusinesses[0] ?? null;

  options.push({
    business_id: primaryOwnBusiness?.id ?? "",
    business_name: primaryOwnBusiness?.business_name ?? "My Account",
    workspace_user_id: actorUserId,
    workspace_label: "My Account",
    context_label: "My Account",
    role: "owner",
    is_own_workspace: true,
  });

  const { data: memberships, error } = await supabase
    .from("workspace_members")
    .select("role, workspace_user_id")
    .eq("member_user_id", actorUserId)
    .eq("status", "accepted");

  if (error) {
    throw new Error(error.message || "Failed to load workspace memberships.");
  }

  for (const membership of memberships ?? []) {
    const workspaceUserId = membership.workspace_user_id as string;
    const role = membership.role as AppRole;
    const primaryBusiness = await fetchPrimaryBusiness(workspaceUserId);

    if (!primaryBusiness) {
      const workspaceLabel = await fetchWorkspaceLabel(supabase, workspaceUserId);

      options.push({
        business_id: "",
        business_name: workspaceLabel,
        workspace_user_id: workspaceUserId,
        workspace_label: workspaceLabel,
        context_label: formatAssignedContextLabel(role, workspaceLabel),
        role,
        is_own_workspace: false,
      });
      continue;
    }

    options.push({
      business_id: primaryBusiness.id,
      business_name: primaryBusiness.business_name,
      workspace_user_id: workspaceUserId,
      workspace_label: primaryBusiness.business_name,
      context_label: formatAssignedContextLabel(role, primaryBusiness.business_name),
      role,
      is_own_workspace: false,
    });
  }

  return options;
}

export async function getBusinessesForEffectiveWorkspace(
  effectiveUserId: string
): Promise<Business[]> {
  return fetchBusinessesForWorkspace(effectiveUserId);
}

export async function getBusinessesForActorContext(
  actorUserId: string,
  effectiveUserId: string,
  scopedBusinessId: string | null
): Promise<Business[]> {
  if (actorUserId === effectiveUserId) {
    return fetchBusinessesForWorkspace(actorUserId);
  }

  if (scopedBusinessId) {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("businesses")
      .select(BUSINESS_SELECT)
      .eq("id", scopedBusinessId)
      .eq("user_id", effectiveUserId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "Failed to load assigned business.");
    }

    if (data) {
      return [data as Business];
    }
  }

  const primaryBusiness = await fetchPrimaryBusiness(effectiveUserId);
  return primaryBusiness ? [primaryBusiness] : [];
}
