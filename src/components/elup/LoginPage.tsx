import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Zap, Database } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { toast } from "sonner";
import { seedDemoData } from "@/lib/elup/seed";

export function LoginPage() {
  const { state, dispatch } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const login = () => {
    setError("");
    const cred = state.credentials.find(
      (c) =>
        c.username.toLowerCase() === username.trim().toLowerCase() &&
        c.password === password,
    );
    if (!cred) {
      setError("Invalid username or password.");
      return;
    }
    dispatch({
      type: "LOGIN",
      user: { org: cred.org, username: cred.username, displayName: cred.displayName, role: cred.role },
    });
    toast.success(`Welcome, ${cred.displayName}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
            <Zap className="h-7 w-7" />
          </div>
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
              <Button type="submit" className="w-full">
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="flex justify-center">
          <SeedDemoDialog />
        </div>
      </div>
    </div>
  );
}

function SeedDemoDialog() {
  const [seeding, setSeeding] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [open, setOpen] = useState(false);

  async function handleSeed() {
    setSeeding(true);
    setProgress("Starting…");
    try {
      await seedDemoData((msg) => setProgress(msg));
      toast.success("Demo data seeded successfully! You can now sign in with the credentials below.");
      setOpen(false);
    } catch (err) {
      console.error("[Seed]", err);
      toast.error("Seeding failed — check the console for details.");
    } finally {
      setSeeding(false);
      setProgress("");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Database className="h-4 w-4" /> Seed Demo Data
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Seed demo data into Firestore?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              This will write two HDB blocks (406A, 408B) with realistic unit statuses, a set of
              recent activity events, and the following login credentials into your Firestore
              database:
            </span>
            <span className="block rounded-md border bg-muted/50 px-3 py-2 font-mono text-xs leading-relaxed">
              pm / 12345@ — Manager<br />
              surveyor / 12345@ — Surveyor<br />
              technician / 12345@ — Technician<br />
              hdb / 12345@ — HDB Officer
            </span>
            <span className="block text-sm">
              Existing documents at the same paths will be overwritten. This is safe to run
              multiple times.
            </span>
            {seeding && progress && (
              <span className="block rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-700 dark:bg-sky-950 dark:text-sky-300">
                ⏳ {progress}
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={seeding}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); handleSeed(); }} disabled={seeding}>
            {seeding ? "Seeding…" : "Seed Demo Data"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
