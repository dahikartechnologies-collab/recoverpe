import { onAuthStateChanged, User } from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase";

let authReadyPromise: Promise<User | null> | null = null;

export function resetFirebaseAuthReadyState(): void {
  authReadyPromise = null;
}

export function waitForFirebaseAuth(): Promise<User | null> {
  if (typeof window === "undefined") {
    return Promise.resolve(null);
  }

  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (currentUser) {
    return Promise.resolve(currentUser);
  }

  if (!authReadyPromise) {
    authReadyPromise = new Promise<User | null>((resolve) => {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  return authReadyPromise;
}
