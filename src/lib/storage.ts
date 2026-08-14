import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"];

export async function uploadBusinessLogo(
  file: File,
  firebaseUid: string
): Promise<string> {
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    throw new Error("Logo must be a PNG, JPG, or WEBP image.");
  }

  if (file.size > MAX_LOGO_SIZE_BYTES) {
    throw new Error("Logo must be 2MB or smaller.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "png";
  const objectPath = `public/logos/${firebaseUid}/${Date.now()}.${extension}`;
  const storageRef = ref(storage, objectPath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
  });

  return getDownloadURL(storageRef);
}
