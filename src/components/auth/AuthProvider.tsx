"use client";

import {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import {
  clearAuthSessionCookie,
  setAuthSessionCookie,
} from "@/lib/auth-cookies";
import { resetFirebaseAuthReadyState } from "@/lib/auth-session";
import { getFirebaseAuth } from "@/lib/firebase";

interface AuthContextValue {
  user: User | null;
  isAuthReady: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  isAuthReady: false,
});

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(getFirebaseAuth(), (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        setAuthSessionCookie();
      } else {
        clearAuthSessionCookie();
        resetFirebaseAuthReadyState();
      }

      setIsAuthReady(true);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthReady }}>
      {children}
    </AuthContext.Provider>
  );
}
