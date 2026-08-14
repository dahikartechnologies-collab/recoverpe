import { getStorage } from "firebase-admin/storage";
import { getAdminAppInstance } from "@/lib/firebase-admin";

export async function uploadSecureInvoicePdf(
  ledgerId: string,
  pdfBuffer: Buffer
): Promise<string> {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;

  if (!bucketName) {
    throw new Error("Firebase storage bucket is not configured.");
  }

  const bucket = getStorage(getAdminAppInstance()).bucket(bucketName);
  const filePath = `secure/invoices/${ledgerId}.pdf`;
  const file = bucket.file(filePath);

  await file.save(pdfBuffer, {
    metadata: {
      contentType: "application/pdf",
    },
  });

  const [signedUrl] = await file.getSignedUrl({
    action: "read",
    expires: Date.now() + 1000 * 60 * 60 * 24 * 365 * 10,
  });

  return signedUrl;
}
