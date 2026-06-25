import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, deleteField,
  collection, serverTimestamp, getDocs, query, orderBy, writeBatch, arrayUnion, type Firestore,
} from "firebase/firestore";
import type { UnitActivityEntry } from "@/lib/elup/types";
import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _storage: FirebaseStorage | null = null;

export function fbApp(): FirebaseApp {
  if (_app) return _app;
  _app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return _app;
}
export function db(): Firestore {
  if (!_db) _db = getFirestore(fbApp());
  return _db;
}
export function storage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(fbApp());
  return _storage;
}

/** Strip undefined values — Firestore rejects them */
function clean(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Upload a single jpg/png photo to Firebase Storage. Returns download URL. */
export async function uploadPhoto(file: File, pathPrefix: string): Promise<string> {
  const allowed = ["image/jpeg", "image/jpg", "image/png"];
  if (!allowed.includes(file.type)) throw new Error("Only JPG or PNG images are allowed");
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectRef = ref(storage(), `${pathPrefix}/${Date.now()}-${safeName}`);
  await uploadBytes(objectRef, file, { contentType: file.type });
  return await getDownloadURL(objectRef);
}

/**
 * Write/merge a unit document into Firestore.
 *
 * Path: /precincts/{precinctId}/blocks/{blockId}/units/{unitKey}
 */
export async function syncUnit(
  precinctId: string,
  blockId: string,
  unitKey: string,
  data: Record<string, unknown>,
): Promise<void> {
  const docRef = doc(db(), "precincts", precinctId, "blocks", blockId, "units", unitKey);
  await setDoc(docRef, { ...clean(data), updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Patch a single unit document.
 *
 * Path: /precincts/{precinctId}/blocks/{blockId}/units/{unitKey}
 */
export async function updateUnitStatus(
  precinctId: string,
  blockId: string,
  unitKey: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const docRef = doc(db(), "precincts", precinctId, "blocks", blockId, "units", unitKey);
  await setDoc(docRef, { ...clean(patch), updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Log an activity event, keeping at most 100 records in /recentActivity.
 * Oldest records beyond 100 are deleted in a batch.
 *
 * Path: /recentActivity/{auto-id}
 */
export async function logActivity(
  type: string,
  description: string,
  operator: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await addDoc(collection(db(), "recentActivity"), {
    type,
    description,
    operator,
    metadata: metadata ?? {},
    timestamp: serverTimestamp(),
  });

  // Enforce max 100 records — delete oldest beyond the limit
  try {
    const snap = await getDocs(query(collection(db(), "recentActivity"), orderBy("timestamp", "asc")));
    const excess = snap.docs.length - 100;
    if (excess > 0) {
      const batch = writeBatch(db());
      snap.docs.slice(0, excess).forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch {
    // Non-critical — don't surface cleanup errors to the caller
  }
}

/**
 * Create or overwrite a user account document.
 *
 * Path: /users/{username}  (document ID is the lowercased username)
 */
export async function onboardUser(account: {
  username: string;
  password: string;
  role: string;
  name?: string;
}): Promise<void> {
  const username = account.username.trim().toLowerCase();
  await setDoc(doc(db(), "users", username), clean({
    username,
    password: account.password,
    role: account.role,
    name: account.name ?? username,
  }));
}

/**
 * Delete a user account document.
 *
 * Path: /users/{username}
 */
export async function removeUser(username: string): Promise<void> {
  await deleteDoc(doc(db(), "users", username.trim().toLowerCase()));
}

/** Upload a base64 PNG data URL to Firebase Storage. Returns the download URL. */
export async function uploadSignatureToStorage(dataUrl: string, storagePath: string): Promise<string> {
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const objectRef = ref(storage(), `${storagePath}/sig-${Date.now()}.png`);
  await uploadBytes(objectRef, blob, { contentType: "image/png" });
  return await getDownloadURL(objectRef);
}

/**
 * Save (or merge-update) an opt-out record in the block's optOuts subcollection.
 *
 * Path: /precincts/{precinctId}/blocks/{blockId}/optOuts/{unitKey}
 */
export async function saveOptOutRecord(
  precinctId: string,
  blockId: string,
  unitKey: string,
  data: Record<string, unknown>,
): Promise<void> {
  const docRef = doc(db(), "precincts", precinctId, "blocks", blockId, "optOuts", unitKey);
  await setDoc(docRef, { ...clean(data), updatedAt: serverTimestamp() }, { merge: true });
}
/** Remove the CS form draft stored for a unit (called after successful submit). */
export async function clearCsDraft(
  precinctId: string,
  blockId: string,
  unitKey: string,
): Promise<void> {
  const docRef = doc(db(), "precincts", precinctId, "blocks", blockId, "units", unitKey);
  await updateDoc(docRef, { csDraft: deleteField(), updatedAt: serverTimestamp() });
}
/** Persist the CS form customiser state (custom fields + hidden groups) to Firestore. */
const SURVEY_CFG_KEY = "elup_survey_config";

/** Save CS form customisation to localStorage (instant) and Firestore (best-effort). */
export async function saveSurveyConfig(
  customSurveyFields: unknown[],
  hiddenSurveyGroups: string[],
): Promise<void> {
  // Firestore rejects undefined values - strip them from each field object
  const cleanedFields = customSurveyFields.map((f) => {
    const field = f as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(field)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  });
  const payload = { customSurveyFields: cleanedFields, hiddenSurveyGroups };
  try { localStorage.setItem(SURVEY_CFG_KEY, JSON.stringify(payload)); } catch { /* ignore */ }
  try {
    await setDoc(doc(db(), "config", "survey"), payload);
  } catch (e) {
    console.warn("[firebase] config/survey write failed:", e);
  }
}

/** Load CS form config — Firestore first, localStorage fallback. */
export async function loadSurveyConfig(): Promise<{
  customSurveyFields: unknown[];
  hiddenSurveyGroups: string[];
} | null> {
  // Try Firestore first
  try {
    const snap = await getDoc(doc(db(), "config", "survey"));
    if (snap.exists()) {
      const d = snap.data();
      return {
        customSurveyFields: Array.isArray(d.customSurveyFields) ? d.customSurveyFields : [],
        hiddenSurveyGroups: Array.isArray(d.hiddenSurveyGroups) ? d.hiddenSurveyGroups : [],
      };
    }
  } catch { /* fall through to localStorage */ }
  // Fallback: localStorage
  try {
    const raw = localStorage.getItem(SURVEY_CFG_KEY);
    if (raw) {
      const d = JSON.parse(raw) as { customSurveyFields: unknown[]; hiddenSurveyGroups: string[] };
      return {
        customSurveyFields: Array.isArray(d.customSurveyFields) ? d.customSurveyFields : [],
        hiddenSurveyGroups: Array.isArray(d.hiddenSurveyGroups) ? d.hiddenSurveyGroups : [],
      };
    }
  } catch { /* ignore */ }
  return null;
}

/** Save blocked-out dates to Firestore (config/blockedDates). */
export async function saveBlockedDates(dates: unknown[]): Promise<void> {
  try {
    await setDoc(doc(db(), "config", "blockedDates"), { dates });
  } catch (e) {
    console.warn("[firebase] config/blockedDates write failed:", e);
  }
}

/** Upload a document (PDF/DOCX/etc.) to Firebase Storage and return the download URL. */
export async function uploadDocument(file: File, pathPrefix: string): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const objectRef = ref(storage(), `${pathPrefix}/${Date.now()}-${safeName}`);
  await uploadBytes(objectRef, file, { contentType: file.type || "application/octet-stream" });
  return await getDownloadURL(objectRef);
}

/** Upload company logo to Firebase Storage and return the download URL. */
export async function uploadLogo(file: File): Promise<string> {
  const objectRef = ref(storage(), "logos/company-logo");
  await uploadBytes(objectRef, file, { contentType: file.type });
  return await getDownloadURL(objectRef);
}

/** Persist logo URL in Firestore settings/app document (null = cleared). */
export async function saveLogoUrl(url: string | null): Promise<void> {
  await setDoc(doc(db(), "settings", "app"), { logoUrl: url ?? null }, { merge: true });
}

/**
 * Append a single activity log entry to a unit's activityLog array.
 * Uses arrayUnion so concurrent writes don't overwrite each other.
 * Strips undefined values — Firestore rejects them and they cause silent failures.
 *
 * Path: /precincts/{precinctId}/blocks/{blockId}/units/{unitKey}
 */
export async function appendUnitActivity(
  precinctId: string,
  blockId: string,
  unitKey: string,
  entry: UnitActivityEntry,
): Promise<void> {
  const docRef = doc(db(), "precincts", precinctId, "blocks", blockId, "units", unitKey);
  const cleanEntry = clean(entry as unknown as Record<string, unknown>);
  await setDoc(docRef, { activityLog: arrayUnion(cleanEntry), updatedAt: serverTimestamp() }, { merge: true });
}

/**
 * Append a CS reminder date string to a unit's csReminders array.
 * Uses arrayUnion so concurrent writes don't overwrite each other.
 *
 * Path: /precincts/{precinctId}/blocks/{blockId}/units/{unitKey}
 */
export async function appendCsReminder(
  precinctId: string,
  blockId: string,
  unitKey: string,
  date: string,
): Promise<void> {
  const docRef = doc(db(), "precincts", precinctId, "blocks", blockId, "units", unitKey);
  await setDoc(docRef, { csReminders: arrayUnion(date), updatedAt: serverTimestamp() }, { merge: true });
}
