import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { db, auth } from "./firebase";
import type { Role } from "./elup/types";

export interface Credential {
  org: string;
  uid?: string;
  username: string;
  password: string;
  role: Role;
  displayName: string;
}

export interface AppUser {
  org: string;
  uid?: string;
  username: string;
  displayName: string;
  role: Role;
}

interface AppSettings {
  logoUrl: string | null;
  darkMode: boolean;
}

interface AppState {
  user: AppUser | null;
  settings: AppSettings;
  credentials: Credential[];
  /** True once onAuthStateChanged has fired at least once — safe to open Firestore listeners */
  authReady: boolean;
}

type AppAction =
  | { type: "LOGIN"; user: AppUser }
  | { type: "LOGOUT" }
  | { type: "SET_LOGO"; url: string | null }
  | { type: "SET_DARK_MODE"; dark: boolean }
  | { type: "SET_CREDENTIALS"; credentials: Credential[] }
  | { type: "UPDATE_CREDENTIAL"; org: string; uid?: string; oldUsername: string; newUsername: string; newPassword: string }
  | { type: "AUTH_READY" };

const SESSION_KEY = "elup_session";

function readSession(): AppUser | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<AppUser>;
    if (p?.username && p?.role) return p as AppUser;
    return null;
  } catch {
    return null;
  }
}

const DEFAULT_CREDENTIALS: Credential[] = [];

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "LOGIN":
      return { ...state, user: action.user };
    case "LOGOUT":
      return { ...state, user: null };
    case "SET_LOGO":
      return { ...state, settings: { ...state.settings, logoUrl: action.url } };
    case "SET_DARK_MODE":
      return { ...state, settings: { ...state.settings, darkMode: action.dark } };
    case "SET_CREDENTIALS":
      return { ...state, credentials: action.credentials };
    case "AUTH_READY":
      return { ...state, authReady: true };
    case "UPDATE_CREDENTIAL": {
      const updatedCredentials = state.credentials.map((c) =>
        c.org === action.org && c.username.toLowerCase() === action.oldUsername.toLowerCase()
          ? { ...c, username: action.newUsername, password: action.newPassword }
          : c,
      );
      const updatedUser =
        state.user &&
        state.user.org === action.org &&
        state.user.username.toLowerCase() === action.oldUsername.toLowerCase()
          ? { ...state.user, username: action.newUsername }
          : state.user;
      return { ...state, credentials: updatedCredentials, user: updatedUser };
    }
    default:
      return state;
  }
}

const initialState: AppState = {
  user: null,
  settings: { logoUrl: null, darkMode: false },
  credentials: DEFAULT_CREDENTIALS,
  authReady: false,
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Dark mode side-effect
  useEffect(() => {
    if (state.settings.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [state.settings.darkMode]);

  // Restore session from localStorage after client-side hydration (SSR-safe)
  useEffect(() => {
    if (!state.user) {
      const saved = readSession();
      if (saved) dispatch({ type: 'LOGIN', user: saved });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist / clear session in localStorage whenever the logged-in user changes
  useEffect(() => {
    if (state.user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(state.user));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [state.user]);

  // Wait for Firebase Auth to settle before opening Firestore listeners.
  // onAuthStateChanged fires once the SDK has resolved the cached token from
  // IndexedDB — until then, currentUser is null and Firestore rules reject
  // any request, permanently killing the listener on error.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth(), () => {
      dispatch({ type: "AUTH_READY" });
      unsub(); // only need the first callback — auth state is now known
    });
    return () => unsub();
  }, []);

  // Sync logo URL from Firestore settings/app — only after auth is ready
  useEffect(() => {
    if (!state.authReady) return;
    const unsub = onSnapshot(
      doc(db(), "settings", "app"),
      (snap) => {
        const data = snap.data();
        const url = (data?.logoUrl as string | null | undefined) ?? null;
        dispatch({ type: "SET_LOGO", url });
      },
      (err) => console.error("[AppContext] settings listener:", err),
    );
    return () => unsub();
  }, [state.authReady]);

  // Sync login credentials from Firestore /users — only after auth is ready
  useEffect(() => {
    if (!state.authReady) return;
    const unsub = onSnapshot(
      collection(db(), "users"),
      (snap) => {
        const creds: Credential[] = snap.docs
          .map((d) => {
            const data = d.data();
            const role = data.role as Role | undefined;
            if (!role) return null;
            const uid = data.uid as string | undefined;
            const rec: Credential = {
              org:         "HS",
              username:    (data.username as string | undefined) ?? d.id,
              password:    (data.password as string | undefined) ?? "",
              role,
              displayName: (data.name as string | undefined) ?? (data.username as string | undefined) ?? d.id,
            };
            if (uid) rec.uid = uid;
            return rec;
          })
          .filter((c): c is Credential => c !== null);

        dispatch({ type: "SET_CREDENTIALS", credentials: creds });
      },
      (err) => console.error("[AppContext] users listener:", err),
    );
    return () => unsub();
  }, [state.authReady]);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
