import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, addDoc, deleteField,
  collection, serverTimestamp, getDocs, query, orderBy, where, writeBatch, arrayUnion, arrayRemove, type Firestore,
} from "firebase/firestore";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  updatePassword as fbUpdatePassword, reauthenticateWithCredential, EmailAuthProvider,
  deleteUser, signOut, type Auth, type User, type UserCredential,
} from "firebase/auth";
import type { UnitActivityEntry } from "@/lib/elup/types";
import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBTwAKpjqzO7LuNvdwqDqoUrw0sv-fkHpA",
  authDomain: "elup-management-system.firebaseapp.com",
  projectId: "elup-management-system",
  storageBucket: "elup-management-system.firebasestorage.app",
  messagingSenderId: "927153033648",
  appId: "1:927153033648:web:6716f21ba0fdacd05c8675",
};

let _app: FirebaseApp | null = null;
let _db: Firestore | null = null;
let _auth: Auth | null = null;
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
export function auth(): Auth {
  if (!_auth) _auth = getAuth(fbApp());
  return _auth;
}
export function storage(): FirebaseStorage {
  if (!_storage) _storage = getStorage(fbApp());
  return _storage;
}

/** Convert a plain username to a virtual Firebase Auth email. */
function toVirtualEmail(username: string): string {
  return `${username.toLowerCase().trim()}@elup.local`;
}

/**
 * Sign in via Firebase Authentication using the virtual email scheme.
 * Throws FirebaseError on bad credentials or network errors.
 */
export async function loginWithUsername(
  username: string,
  password: string,
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth(), toVirtualEmail(username), password);
}

/**
 * Create a Firebase Auth account + write the Firestore profile document.
 * Path: /users/{uid}  (document ID = Firebase Auth UID)
 */
export async function onboardUserWithAuth(account: {
  username: string;
  password: string;
  role: string;
  name?: string;
}): Promise<{ uid: string }> {
  const username = account.username.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth(), toVirtualEmail(username), account.password);
  const uid = cred.user.uid;
  await setDoc(doc(db(), "users", uid), clean({
    uid,
    username,
    role:     account.role,
    name:     account.name ?? username,
    password: account.password,
  }));
  return { uid };
}

/**
 * Re-authenticate the currently signed-in user.
 * Required before sensitive operations (password change) after a long session.
 * Throws FirebaseError (auth/wrong-password | auth/invalid-credential) on mismatch.
 */
export async function reauthenticate(currentPassword: string): Promise<void> {
  const user = auth().currentUser;
  if (!user?.email) throw new Error("No signed-in Firebase Auth user");
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
}

/**
 * Update the current user's own password via Firebase Auth.
 * Throws auth/requires-recent-login if the session is too old — callers must
 * catch that code and prompt the user to re-authenticate.
 */
export async function updateOwnPassword(newPassword: string): Promise<void> {
  const user = auth().currentUser;
  if (!user) throw new Error("No signed-in Firebase Auth user");
  await fbUpdatePassword(user, newPassword);
  // Keep the stored password in Firestore in sync so Force Reset & Delete continue to work
  try {
    await updateDoc(doc(db(), "users", user.uid), { password: newPassword });
  } catch { /* non-fatal — Firestore sync best-effort */ }
}

/**
 * Change a staff member's username using a delete-and-recreate strategy.
 * Because the Firebase Auth email is `username@elup.local`, a username change
 * requires creating a brand-new Auth account and migrating the Firestore profile.
 *
 * Strategy (identical to forceResetPassword but for a new email, same password):
 *  1. Secondary app signs in as the user to verify/delete their old Auth account.
 *  2. Third app creates a new Auth account with the new email and the same password.
 *  3. Firestore profile is migrated to the new UID with the updated username.
 *
 * Falls back to a simple Firestore field update for legacy accounts (no uid).
 */
export async function changeUsernameWithAuth(params: {
  oldUid: string;
  oldUsername: string;
  newUsername: string;
  password: string;
}): Promise<{ newUid: string }> {
  const { oldUid, oldUsername, newUsername, password } = params;
  const oldEmail = toVirtualEmail(oldUsername);
  const newEmail = toVirtualEmail(newUsername);
  const tag = Date.now();

  const signInApp  = initializeApp(firebaseConfig, `cu-signin-${tag}`);
  const createApp  = initializeApp(firebaseConfig, `cu-create-${tag}`);
  const signInAuth = getAuth(signInApp);
  const createAuth = getAuth(createApp);

  try {
    // ── Step 1: Authenticate as the target user ───────────────────────────────
    let targetCred: UserCredential;
    try {
      targetCred = await signInWithEmailAndPassword(signInAuth, oldEmail, password);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        throw new Error(
          "Stored password is incorrect — username not changed. " +
          "Use Force Reset to resync the stored password first.",
        );
      }
      throw e;
    }

    // ── Step 2: Read old Firestore profile ────────────────────────────────────
    const oldRef  = doc(db(), "users", oldUid);
    const oldSnap = await getDoc(oldRef);
    const oldData = oldSnap.exists() ? oldSnap.data() : {};

    // ── Step 3: Delete old Auth account ──────────────────────────────────────
    await deleteUser(targetCred.user);

    // ── Step 4: Create new Auth account (new email, same password) ───────────
    let newUid: string;
    try {
      const newCred = await createUserWithEmailAndPassword(createAuth, newEmail, password);
      newUid = newCred.user.uid;
    } catch {
      throw new Error(
        `Old Auth account was removed but the new one could not be created. ` +
        `Please add the user in Firebase Console → Authentication ` +
        `with email ${newEmail} and the existing password.`,
      );
    }

    // ── Step 5: Migrate Firestore profile ─────────────────────────────────────
    const { tempPassword: _tp, uid: _ou, username: _un, ...rest } =
      oldData as Record<string, unknown>;
    const newRef = doc(db(), "users", newUid);
    await setDoc(newRef, {
      ...clean(rest),
      uid:       newUid,
      username:  newUsername.trim().toLowerCase(),
      password,
      updatedAt: serverTimestamp(),
    });
    await deleteDoc(oldRef);

    return { newUid };
  } finally {
    try { await signInApp.delete(); } catch { /* ignore */ }
    try { await createApp.delete(); } catch { /* ignore */ }
  }
}

/**
 * Patch the `username` field in the user's Firestore document.
 * Used as a fallback for legacy accounts that have no Firebase Auth uid.
 */
export async function updateUsernameInFirestore(
  docId: string,
  newUsername: string,
): Promise<void> {
  await updateDoc(doc(db(), "users", docId), {
    username: newUsername.trim().toLowerCase(),
  });
}

/** Sign out the currently authenticated user from Firebase Auth. */
export async function signOutUser(): Promise<void> {
  await signOut(auth());
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
 * Delete a user account document by its Firestore document ID (UID for Auth accounts).
 *
 * Path: /users/{docId}
 */
export async function removeUser(docId: string): Promise<void> {
  await deleteDoc(doc(db(), "users", docId.trim()));
}

/**
 * Write a manager-set temporary password to a user's Firestore document.
 * The employee must sign in once with their PREVIOUS Auth password to activate it,
 * at which point the app calls activateTempPasswordIfPending() to update Firebase Auth.
 *
 * Path: /users/{docId}
 */
export async function setTempPassword(docId: string, newPassword: string): Promise<void> {
  await updateDoc(doc(db(), "users", docId.trim()), { tempPassword: newPassword });
}

/**
 * If the authenticated user has a pending tempPassword in their Firestore document,
 * update their Firebase Auth password to that value and delete the field.
 * Returns the activated password string, or null if none was pending.
 *
 * Must be called AFTER a successful signInWithEmailAndPassword so auth().currentUser is valid.
 */
export async function activateTempPasswordIfPending(
  fbUser: User,
  uid: string,
): Promise<string | null> {
  const userRef = doc(db(), "users", uid.trim());
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  const tempPassword = snap.data().tempPassword as string | undefined;
  if (!tempPassword) return null;
  await fbUpdatePassword(fbUser, tempPassword);
  await updateDoc(userRef, { tempPassword: deleteField() });
  return tempPassword;
}

/**
 * Query the users collection for a document whose `username` matches and whose
 * `tempPassword` field matches the typed password.
 * Returns the matching document ID (uid) if found, null otherwise.
 * Used when Firebase Auth login fails to detect a pending manager password reset.
 */
export async function findPendingPasswordReset(
  username: string,
  typedPassword: string,
): Promise<string | null> {
  const snap = await getDocs(
    query(collection(db(), "users"), where("username", "==", username.trim().toLowerCase())),
  );
  for (const d of snap.docs) {
    const data = d.data();
    if (data.tempPassword && data.tempPassword === typedPassword) {
      return d.id;
    }
  }
  return null;
}

/**
 * Force-reset a staff member's Firebase Auth password using a delete-and-recreate
 * strategy, without affecting the currently signed-in manager's session.
 *
 * Strategy:
 *  1. A secondary Firebase app signs in as the target user (requires their current password).
 *  2. That secondary session deletes the target's Auth account.
 *  3. A third Firebase app instance creates a brand-new Auth account with the same
 *     virtual email and the new password — manager's primary session is untouched.
 *  4. Firestore: read old /users/{oldUid}, write to /users/{newUid}, delete old doc.
 *
 * Throws with a descriptive message on any step failure.
 * Both secondary app instances are always cleaned up in a finally block.
 */
export async function forceResetPassword(params: {
  oldUid: string;
  username: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ newUid: string }> {
  const { oldUid, username, currentPassword, newPassword } = params;
  const email = toVirtualEmail(username);
  const tag = Date.now();

  const signInApp  = initializeApp(firebaseConfig, `fr-signin-${tag}`);
  const createApp  = initializeApp(firebaseConfig, `fr-create-${tag}`);
  const signInAuth = getAuth(signInApp);
  const createAuth = getAuth(createApp);

  try {
    // ── Step 1: Authenticate as the target user on a secondary instance ──────
    let targetCred: UserCredential;
    try {
      targetCred = await signInWithEmailAndPassword(signInAuth, email, currentPassword);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        throw new Error("Current password is incorrect. The reset was not performed.");
      }
      throw e;
    }

    // ── Step 2: Read old Firestore profile before deleting anything ──────────
    const oldRef  = doc(db(), "users", oldUid);
    const oldSnap = await getDoc(oldRef);
    const oldData = oldSnap.exists() ? oldSnap.data() : {};

    // ── Step 3: Delete the target's Auth account via the secondary session ───
    await deleteUser(targetCred.user);

    // ── Step 4: Re-create the Auth account with the new password ─────────────
    // Using a third app instance so the manager's primary session is unaffected.
    let newUid: string;
    try {
      const newCred = await createUserWithEmailAndPassword(createAuth, email, newPassword);
      newUid = newCred.user.uid;
    } catch (createErr: unknown) {
      // Auth account was deleted but creation failed — surface a recovery message.
      throw new Error(
        "The old account was removed but the new one could not be created. " +
        "Please add the user manually in Firebase Console → Authentication " +
        `with email ${email} and the new password.`,
      );
    }

    // ── Step 5: Migrate Firestore profile ─────────────────────────────────────
    // Strip tempPassword (and uid) from old data before writing to new path.
    const { tempPassword: _tp, uid: _oldUid, ...rest } = oldData as Record<string, unknown>;
    const newRef = doc(db(), "users", newUid);
    await setDoc(newRef, {
      ...clean(rest),
      uid:      newUid,
      password: newPassword,
      updatedAt: serverTimestamp(),
    });
    await deleteDoc(oldRef);

    return { newUid };
  } finally {
    // Always clean up secondary app instances
    try { await signInApp.delete(); }  catch { /* ignore */ }
    try { await createApp.delete(); }  catch { /* ignore */ }
  }
}

/**
 * Delete a staff member's Firebase Auth account using their stored password,
 * then delete their Firestore profile document.
 * Uses a secondary app instance so the manager's session is unaffected.
 */
export async function deleteUserCompletely(params: {
  uid: string;
  username: string;
  password: string;
}): Promise<void> {
  const { uid, username, password } = params;
  const email = toVirtualEmail(username);
  const tag = Date.now();
  const signInApp  = initializeApp(firebaseConfig, `del-${tag}`);
  const signInAuth = getAuth(signInApp);
  try {
    let cred: UserCredential;
    try {
      cred = await signInWithEmailAndPassword(signInAuth, email, password);
    } catch (e: unknown) {
      const code = (e as { code?: string })?.code ?? "";
      if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        throw new Error(
          "Stored password is incorrect — Auth account was not deleted. " +
          "Use Force Reset to update the stored password first.",
        );
      }
      throw e;
    }
    await deleteUser(cred.user);
    await deleteDoc(doc(db(), "users", uid));
  } finally {
    try { await signInApp.delete(); } catch { /* ignore */ }
  }
}

/** Upload a signature image/PDF file to Firebase Storage. Returns the download URL. */
export async function uploadSignatureFile(file: File, storagePath: string): Promise<string> {
  const allowed = [
    "image/png", "image/jpeg", "image/jpg", "image/gif",
    "image/webp", "image/bmp", "application/pdf",
  ];
  if (!allowed.includes(file.type)) {
    throw new Error("Only image files (PNG, JPG, GIF, WebP) or PDF are allowed for signatures");
  }
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
  const objectRef = ref(storage(), `${storagePath}/sig-${Date.now()}.${ext}`);
  await uploadBytes(objectRef, file, { contentType: file.type });
  return await getDownloadURL(objectRef);
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

/**
 * Remove a CS reminder from a unit.
 * Handles legacy fields (csReminder1/csReminder2) via deleteField(),
 * and new csReminders array entries via arrayRemove().
 */
export async function removeCsReminder(
  precinctId: string,
  blockId: string,
  unitKey: string,
  target: { type: "legacy1" | "legacy2" | "new"; date?: string },
): Promise<void> {
  const docRef = doc(db(), "precincts", precinctId, "blocks", blockId, "units", unitKey);
  if (target.type === "legacy1") {
    await updateDoc(docRef, { csReminder1: deleteField(), updatedAt: serverTimestamp() });
  } else if (target.type === "legacy2") {
    await updateDoc(docRef, { csReminder2: deleteField(), updatedAt: serverTimestamp() });
  } else if (target.type === "new" && target.date) {
    await updateDoc(docRef, { csReminders: arrayRemove(target.date), updatedAt: serverTimestamp() });
  }
}

/** Load the company logo URL from Firestore settings/app. Returns null if not set. */
export async function loadLogoUrl(): Promise<string | null> {
  try {
    const snap = await getDoc(doc(db(), "settings", "app"));
    if (snap.exists()) return (snap.data().logoUrl as string | null) ?? null;
  } catch { /* ignore */ }
  return null;
}
