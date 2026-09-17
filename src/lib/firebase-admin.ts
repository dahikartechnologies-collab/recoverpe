import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { normalizeFirebasePrivateKey } from "@/lib/crypto-env";

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const privateKey = normalizeFirebasePrivateKey(
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  );

  if (clientEmail && privateKey && projectId) {
    try {
      return initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
    } catch (error) {
      console.error(
        "[Recoverpe Crypto] FIREBASE_ADMIN_PRIVATE_KEY failed to initialize Firebase Admin:",
        error instanceof Error ? error.message : error
      );
      throw new Error(
        "Firebase Admin credentials are misconfigured. Check FIREBASE_ADMIN_PRIVATE_KEY."
      );
    }
  }

  if (!projectId) {
    console.error(
      "[Recoverpe Crypto] Missing environment variable: NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    );
    throw new Error("NEXT_PUBLIC_FIREBASE_PROJECT_ID is not configured.");
  }

  if (!clientEmail) {
    console.error(
      "[Recoverpe Crypto] Missing environment variable: FIREBASE_ADMIN_CLIENT_EMAIL"
    );
  }

  if (!privateKey) {
    console.error(
      "[Recoverpe Crypto] Missing or malformed environment variable: FIREBASE_ADMIN_PRIVATE_KEY"
    );
  }

  return initializeApp({ projectId });
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminAppInstance(): App {
  return getAdminApp();
}

export async function verifyFirebaseIdToken(idToken: string) {
  try {
    return await getAdminAuth().verifyIdToken(idToken);
  } catch (error) {
    console.error(
      "[Recoverpe Crypto] Firebase JWT verification failed. Check FIREBASE_ADMIN_CLIENT_EMAIL and FIREBASE_ADMIN_PRIVATE_KEY:",
      error instanceof Error ? error.message : error
    );
    throw error;
  }
}
