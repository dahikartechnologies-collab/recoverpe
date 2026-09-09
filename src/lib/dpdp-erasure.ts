import { SupabaseClient } from "@supabase/supabase-js";
import { getAdminAuth } from "@/lib/firebase-admin";
import {
  ledgerInvoiceStoragePath,
  ledgerLegalNoticeStoragePath,
  ledgerSamadhaanDocketStoragePath,
} from "@/lib/document-storage";
import { getStorageBucket } from "@/lib/firebase-storage-admin";

export interface DpdpPurgeCandidate {
  id: string;
  email: string;
  firebase_uid: string;
}

export interface DpdpErasureResult {
  deleted_user_id: string;
  deleted_email: string;
  firebase_auth_deleted: boolean;
  storage_objects_deleted: number;
}

async function deleteStoragePrefix(prefix: string): Promise<number> {
  const bucket = getStorageBucket();

  if (!bucket) {
    return 0;
  }

  const [files] = await bucket.getFiles({ prefix });

  if (files.length === 0) {
    return 0;
  }

  await Promise.all(
    files.map((file) => file.delete({ ignoreNotFound: true }))
  );

  return files.length;
}

async function deleteStorageObject(path: string): Promise<boolean> {
  const bucket = getStorageBucket();

  if (!bucket) {
    return false;
  }

  const file = bucket.file(path);
  const [exists] = await file.exists();

  if (!exists) {
    return false;
  }

  await file.delete({ ignoreNotFound: true });
  return true;
}

export async function fetchDpdpPurgeCandidates(
  supabase: SupabaseClient
): Promise<DpdpPurgeCandidate[]> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);

  const { data, error } = await supabase
    .from("users")
    .select("id, email, firebase_uid")
    .eq("account_status", "pending_purge")
    .lt("updated_at", cutoff.toISOString())
    .eq("is_super_admin", false);

  if (error) {
    throw new Error(error.message || "Failed to load DPDP purge candidates.");
  }

  return (data ?? []) as DpdpPurgeCandidate[];
}

export async function eraseUserFirebaseStorage(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  let deletedCount = 0;

  const { data: ledgers, error: ledgerError } = await supabase
    .from("ledgers")
    .select("id")
    .eq("user_id", userId);

  if (ledgerError) {
    throw new Error(
      ledgerError.message || "Failed to resolve ledger storage for erasure."
    );
  }

  for (const ledger of ledgers ?? []) {
    const ledgerId = ledger.id as string;
    const canonicalPaths = [
      ledgerInvoiceStoragePath(ledgerId),
      ledgerLegalNoticeStoragePath(ledgerId),
      ledgerSamadhaanDocketStoragePath(ledgerId),
    ];

    for (const path of canonicalPaths) {
      if (await deleteStorageObject(path)) {
        deletedCount += 1;
      }
    }

    deletedCount += await deleteStoragePrefix(`secure/evidence/${ledgerId}/`);
    deletedCount += await deleteStoragePrefix(`secure/payment-proofs/${ledgerId}/`);
  }

  deletedCount += await deleteStoragePrefix(`users/${userId}/`);

  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId);

  if (businessError) {
    throw new Error(
      businessError.message || "Failed to resolve business storage for erasure."
    );
  }

  for (const business of businesses ?? []) {
    deletedCount += await deleteStoragePrefix(`businesses/${business.id as string}/`);
  }

  return deletedCount;
}

export async function deleteFirebaseAuthIdentity(firebaseUid: string): Promise<void> {
  if (!firebaseUid.trim()) {
    return;
  }

  try {
    await getAdminAuth().deleteUser(firebaseUid);
  } catch (error) {
    const code =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: string }).code === "string"
        ? (error as { code: string }).code
        : null;

    if (code === "auth/user-not-found") {
      return;
    }

    throw error;
  }
}

export async function eraseDpdpUser(
  supabase: SupabaseClient,
  candidate: DpdpPurgeCandidate
): Promise<DpdpErasureResult> {
  const storageObjectsDeleted = await eraseUserFirebaseStorage(
    supabase,
    candidate.id
  );

  await deleteFirebaseAuthIdentity(candidate.firebase_uid);

  const { error: deleteError } = await supabase
    .from("users")
    .delete()
    .eq("id", candidate.id);

  if (deleteError) {
    throw new Error(
      deleteError.message || "Failed to delete user record after external erasure."
    );
  }

  return {
    deleted_user_id: candidate.id,
    deleted_email: candidate.email,
    firebase_auth_deleted: true,
    storage_objects_deleted: storageObjectsDeleted,
  };
}
