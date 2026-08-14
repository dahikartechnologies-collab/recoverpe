import { getFirebaseAuth } from "@/lib/firebase";
import { IMPERSONATE_USER_HEADER } from "@/lib/impersonate";
import { useWorkspaceStore } from "@/store/workspace-store";

export async function getAuthHeaders(): Promise<HeadersInit> {
  const user = getFirebaseAuth().currentUser;

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
