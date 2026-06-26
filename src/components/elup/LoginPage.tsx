import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Zap, Loader2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { toast } from "sonner";
import {
  loadLogoUrl,
  loginWithUsername,
  activateTempPasswordIfPending,
  findPendingPasswordReset,
} from "@/lib/firebase";

export function LoginPage() {
  const { state, dispatch } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    loadLogoUrl().then(setLogoUrl).catch(() => {});
  }, []);

  const login = async () => {
    setError("");
    const u = username.trim().toLowerCase();
    if (!u || !password) {
      setError("Please enter your username and password.");
      return;
    }
    setLoading(true);
    try {
      let fbUser: { uid: string; firebaseUser: import("firebase/auth").User } | null = null;

      try {
        const fbCred = await loginWithUsername(u, password);
        fbUser = { uid: fbCred.user.uid, firebaseUser: fbCred.user };
      } catch {
        fbUser = null;
      }

      if (fbUser) {
        const { uid, firebaseUser } = fbUser;

        // ── Activate any manager-set temporary password ──────────────────────
        // If a manager wrote a tempPassword to Firestore, apply it to Firebase
        // Auth now while the user is authenticated, then clean up the field.
        try {
          const activated = await activateTempPasswordIfPending(firebaseUser, uid);
          if (activated) {
            toast.info(
              "Your manager set a new password for your account. It is now active — use it from your next sign-in.",
              { duration: 8000 },
            );
          }
        } catch {
          // Non-critical — don't block login if the activation step fails
        }

        const profile =
          state.credentials.find((c) => c.uid === uid) ??
          state.credentials.find((c) => c.username.toLowerCase() === u);

        if (profile) {
          dispatch({
            type: "LOGIN",
            user: {
              org: profile.org,
              uid,
              username: profile.username,
              displayName: profile.displayName,
              role: profile.role,
            },
          });
          toast.success(`Welcome, ${profile.displayName}`);
        } else {
          setError("Account profile not found. Please contact your manager.");
        }
      } else {
        // ── Firebase Auth failed — check for a pending manager password reset ─
        // This happens when the employee tries the manager-set password before
        // signing in once with their previous Auth password to activate it.
        try {
          const pendingReset = await findPendingPasswordReset(u, password);
          if (pendingReset) {
            setError(
              "A password reset is pending for your account. " +
              "Sign in once with your previous password to activate the new one. " +
              "If you don't remember your previous password, ask your manager to update it directly in the Firebase Console.",
            );
            return;
          }
        } catch {
          // Ignore query errors — fall through to generic error
        }
        setError("Invalid username or password.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt="Company Logo"
              className="h-16 w-auto max-w-[200px] object-contain"
              onError={() => setLogoUrl(null)}
            />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Zap className="h-7 w-7" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold tracking-tight">ELUP Management</h1>
            <p className="text-sm text-muted-foreground">Electrical Load Upgrading Programme</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-center text-lg">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                login();
              }}
            >
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {error && (
                <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in…</>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
