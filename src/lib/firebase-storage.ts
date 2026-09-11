import { FirebaseStorage, getStorage } from "firebase/storage";
import { getFirebaseApp } from "@/lib/firebase";

export function getFirebaseStorage(): FirebaseStorage {
  return getStorage(getFirebaseApp());
}
