---
name: Firebase Auth migration
description: How Firebase Auth was layered onto the existing Firestore-only user system.
---

## Auth scheme
Virtual email: `${username.toLowerCase().trim()}@elup.local`. UI login form unchanged.

## Dual data architecture (backward compat)
- Legacy docs: `/users/{username}` — contain `password` (plaintext), no `uid` field.
- New docs: `/users/{uid}` — contain `uid`, no `password` field.
- Credentials `onSnapshot` accepts either; filters only on `role` presence.
- `Account.uid` is optional; undefined = legacy account.

## Login flow (LoginPage.tsx)
1. Try Firebase Auth `loginWithUsername`. On success include `uid` in session.
2. On failure fall back to Firestore plaintext password comparison (legacy).

## Self-service credential edit (SettingsDialog.tsx)
- Verify: `reauthenticate(currentPassword)` (Firebase Auth) or Firestore compare (legacy).
- Username: `updateUsernameInFirestore(docId, newUsername)` patches field; legacy uses delete+recreate.
- Password: `updateOwnPassword(newPassword)`. Catches `auth/requires-recent-login` and shows logout prompt.

## Manager editing staff (AccountManagement.tsx)
- uid-based accounts: username → field update; password → Firestore field only with info toast (client SDK limitation).
- Legacy accounts: existing delete+recreate behaviour preserved.

## Key functions in firebase.ts
`auth()`, `loginWithUsername`, `onboardUserWithAuth`, `reauthenticate`, `updateOwnPassword`, `updateUsernameInFirestore`, `signOutUser`.

**Why:** Client SDK cannot call `updatePassword` on another user — Admin SDK required for that. Info toast is correct UX.
