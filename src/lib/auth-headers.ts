import { getFirebaseAuth } from "@/lib/firebase";
import { waitForFirebaseAuth } from "@/lib/auth-session";
import { IMPERSONATE_USER_HEADER } from "@/lib/impersonate";
import { useWorkspaceStore } from "@/store/workspace-store";

async function resolveCurrentUser() {
  const auth = getFirebaseAuth();
  return auth.currentUser ?? (await waitForFirebaseAuth());
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  const user = await resolveCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to continue.");
  }

  const idToken = await user.getIdToken();
  const ghostModeUserId = useWorkspaceStore.getState().ghostModeUserId;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
  };

  if (ghostModeUserId) {
    headers[IMPERSONATE_USER_HEADER] = ghostModeUserId;
  }

  return headers;
}

export async function getAuthHeadersForUpload(): Promise<HeadersInit> {
  const user = await resolveCurrentUser();

  if (!user) {
    throw new Error("You must be signed in to continue.");
  }

  const idToken = await user.getIdToken();
  const ghostModeUserId = useWorkspaceStore.getState().ghostModeUserId;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${idToken}`,
  };

  if (ghostModeUserId) {
    headers[IMPERSONATE_USER_HEADER] = ghostModeUserId;
  }

  return headers;
}
