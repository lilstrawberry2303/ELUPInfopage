import { createContext, useContext, useEffect, useReducer, type ReactNode } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "./firebase";
import type { Role } from "./elup/types";

export interface Credential {
  org: string;
  username: string;
  password: string;
  role: Role;
  displayName: string;
}

export interface AppUser {
  org: string;
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
}

type AppAction =
  | { type: "LOGIN"; user: AppUser }
  | { type: "LOGOUT" }
  | { type: "SET_LOGO"; url: string | null }
  | { type: "SET_DARK_MODE"; dark: boolean }
  | { type: "SET_CREDENTIALS"; credentials: Credential[] }
  | { type: "UPDATE_CREDENTIAL"; org: string; oldUsername: string; newUsername: string; newPassword: string };

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

const DEFAULT_CREDENTIALS: Credential[] = [
  { org: "HS", username: "PM",         password: "12345@", role: "manager",    displayName: "Project Manager" },
  { org: "HS", username: "surveyor",   password: "12345@", role: "surveyor",   displayName: "Surveyor" },
  { org: "HS", username: "technician", password: "12345@", role: "technician", displayName: "Technician" },
  { org: "HS", username: "HDB",        password: "12345@", role: "client",     displayName: "HDB Officer" },
];

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

  // Sync login credentials from Firestore /users collection.
  // Hardcoded defaults remain active until Firestore has at least one valid user doc.
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db(), "users"),
      (snap) => {
        const creds: Credential[] = snap.docs
          .map((d) => {
            const data = d.data();
            const role = data.role as Role | undefined;
            if (!role || !data.password) return null;
            return {
              org:         "HS",
              username:    data.username ?? d.id,
              password:    data.password as string,
              role,
              displayName: (data.name as string | undefined) ?? (data.username as string | undefined) ?? d.id,
            } satisfies Credential;
          })
          .filter((c): c is Credential => c !== null);

        if (creds.length > 0) {
          dispatch({ type: "SET_CREDENTIALS", credentials: creds });
        }
      },
      (err) => console.error("[AppContext] users listener:", err),
    );
    return () => unsub();
  }, []);

  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
