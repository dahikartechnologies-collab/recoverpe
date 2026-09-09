import { createShortLivedSignedUrl } from "@/lib/firebase-storage-admin";
import {
  LedgerDocumentType,
  resolveLedgerDocumentPath,
} from "@/lib/document-storage";

export async function resolveDocumentLinkForWhatsApp(
  storedValue: string | null | undefined,
  type: LedgerDocumentType,
  ledgerId: string
): Promise<string | null> {
  if (!storedValue) {
    return null;
  }

  const storagePath = resolveLedgerDocumentPath(storedValue, type, ledgerId);

  if (!storagePath) {
    return null;
  }

  return createShortLivedSignedUrl(storagePath);
}
