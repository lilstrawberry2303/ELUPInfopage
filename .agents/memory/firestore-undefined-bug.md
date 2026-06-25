---
name: Firestore undefined values bug
description: arrayUnion (and setDoc/updateDoc) silently fail when the object passed contains undefined-valued keys; .catch(() => {}) hides the error completely.
---

## The Rule
Before passing any object to `arrayUnion`, `setDoc`, or `updateDoc`, strip all keys whose value is `undefined`. Firestore rejects them with an error that is invisible when the call is wrapped in `.catch(() => {})`.

**Why:** The `mkEntry()` helper in `store.tsx` spread `opts` directly onto the entry object. Optional fields like `appointmentDate`, `appointmentTime`, `assignee`, and `notes` could be `undefined` when callers didn't supply them. This produced objects like `{ id, type, loggedAt, appointmentDate: undefined }` — valid TypeScript but rejected by the Firestore SDK at runtime.

**How to apply:**
- `appendUnitActivity` in `firebase.ts` now calls `clean(entry as Record<string, unknown>)` before passing to `arrayUnion`.
- `mkEntry` in `store.tsx` now conditionally sets each optional field only when truthy, instead of spreading `opts`.
- Any new Firestore write helper must use the `clean()` utility (already defined in `firebase.ts`) or an equivalent pattern.
- When a Firestore write seems to silently do nothing, the first thing to check is undefined values in the payload.
