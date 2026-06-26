import { useState } from "react";
import { useElup } from "@/lib/elup/store";
import { updateUsernameInFirestore, setTempPassword, forceResetPassword } from "@/lib/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { UserPlus, Pencil, Trash2, Users, Eye, EyeOff, Info, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { Account } from "@/lib/elup/types";

const ROLE_COLORS: Record<string, string> = {
  manager:    "text-violet-600",
  surveyor:   "text-sky-600",
  technician: "text-orange-600",
  client:     "text-emerald-600",
};

const ROLE_LABELS: Record<string, string> = {
  manager:    "Manager",
  surveyor:   "Surveyor",
  technician: "Technician",
  client:     "HDB Officer",
};

export function AccountManagement() {
  const { state } = useElup();

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-sky-500" /> Account Management
            <Badge variant="secondary">{state.accounts.length}</Badge>
          </span>
          <NewAccountDialog />
        </CardTitle>
      </CardHeader>
      <CardContent>
        {state.accounts.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            No accounts yet.
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {state.accounts.map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    @{a.username} ·{" "}
                    <span className={ROLE_COLORS[a.role] ?? "text-muted-foreground"}>
                      {ROLE_LABELS[a.role] ?? a.role}
                    </span>
                  </div>
                </div>
                <EditAccountDialog account={a} />
                {a.uid && <ForceResetDialog account={a} />}
                <DeleteAccountDialog account={a} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── New Account ──────────────────────────────────────────────────────────────

function NewAccountDialog() {
  const { dispatch } = useElup();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [role, setRole] = useState<Account["role"]>("surveyor");

  const reset = () => {
    setName(""); setUsername(""); setPassword(""); setRole("surveyor"); setShowPw(false);
  };

  const submit = () => {
    if (!name.trim() || !username.trim() || !password.trim()) {
      toast.error("All fields are required");
      return;
    }
    dispatch({
      type: "ADD_ACCOUNT",
      account: { id: `acc-${Date.now()}`, name: name.trim(), username: username.trim().toLowerCase(), password, role },
    });
    toast.success(`${name} added as ${role}`);
    setOpen(false);
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-sky-600 hover:bg-sky-700">
          <UserPlus className="mr-1 h-4 w-4" /> Add User
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add Account</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Account["role"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="surveyor">Surveyor</SelectItem>
                <SelectItem value="technician">Technician</SelectItem>
                <SelectItem value="client">HDB Officer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Aisha Lim" />
          </div>
          <div>
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="aisha.lim" />
          </div>
          <div>
            <Label>Password</Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Initial password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="bg-sky-600 hover:bg-sky-700" onClick={submit}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Edit Account ─────────────────────────────────────────────────────────────

function EditAccountDialog({ account }: { account: Account }) {
  const { dispatch } = useElup();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(account.name);
  const [username, setUsername] = useState(account.username);
  const [role, setRole] = useState<Account["role"]>(account.role);
  const [newPassword, setNewPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setName(account.name); setUsername(account.username);
    setRole(account.role); setNewPassword(""); setShowPw(false);
  };

  const submit = async () => {
    const newUsername = username.trim().toLowerCase();
    const newName = name.trim();
    if (!newName || !newUsername) { toast.error("Name and username are required"); return; }

    setSaving(true);
    try {
      const usernameChanged = newUsername !== account.username.trim().toLowerCase();
      const patch: Record<string, unknown> = { name: newName, role };
      if (usernameChanged) patch.username = newUsername;
      dispatch({ type: "UPDATE_ACCOUNT", id: account.id, patch });
      if (usernameChanged) await updateUsernameInFirestore(account.id, newUsername);

      if (newPassword.trim()) {
        await setTempPassword(account.id, newPassword.trim());
        toast.success(
          `Password reset queued for ${newName}. They will be prompted to use the new password after their next sign-in with their current one.`,
          { duration: 7000 },
        );
      } else {
        toast.success("Account updated");
      }
      setOpen(false);
    } catch (e: unknown) {
      toast.error("Failed to save", { description: String((e as Error)?.message ?? e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Edit account">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Account — {account.name}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as Account["role"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="surveyor">Surveyor</SelectItem>
                <SelectItem value="technician">Technician</SelectItem>
                <SelectItem value="client">HDB Officer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Full name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div>
            <Label>Username</Label>
            <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
            {username.trim().toLowerCase() !== account.username.trim().toLowerCase() && (
              <p className="mt-1 text-[11px] text-amber-600">
                ⚠ The login username will change — the user must sign in with the new username after this.
              </p>
            )}
          </div>
          <div className="border-t pt-3">
            <Label>
              Reset password{" "}
              <span className="font-normal text-muted-foreground">(leave blank to keep unchanged)</span>
            </Label>
            <div className="relative mt-1.5">
              <Input
                type={showPw ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="New password for this user"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="mt-2 flex items-start gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                The new password activates automatically the next time{" "}
                <strong>{account.name}</strong> signs in with their current password.
                Use <strong>Force Reset</strong> (key icon) if they've forgotten their current password.
              </span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className="bg-sky-600 hover:bg-sky-700" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Force Reset Password ──────────────────────────────────────────────────────

function ForceResetDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [newPw, setNewPw] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const reset = () => {
    setStep("form"); setNewPw("");
    setShowNew(false); setBusy(false); setProgress("");
  };

  const handleConfirm = async () => {
    if (!account.uid) return;
    setBusy(true);
    try {
      setProgress("Signing in as target user…");
      await new Promise((r) => setTimeout(r, 50));
      setProgress("Deleting old Auth account…");
      const { newUid } = await forceResetPassword({
        oldUid:          account.uid,
        username:        account.username,
        currentPassword: account.password,
        newPassword:     newPw,
      });
      toast.success(
        `Password for ${account.name} has been force-reset. New UID: ${newUid.slice(0, 8)}…`,
        { duration: 6000 },
      );
      setOpen(false);
    } catch (e: unknown) {
      const msg = (e as Error)?.message ?? String(e);
      toast.error("Force reset failed", { description: msg, duration: 8000 });
      setStep("form");
    } finally {
      setBusy(false);
      setProgress("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button
          size="sm"
          variant="ghost"
          title="Force reset password (delete & recreate Auth account)"
          className="text-amber-600 hover:bg-amber-50 hover:text-amber-700"
        >
          <KeyRound className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-amber-600" />
            Force Reset — {account.name}
          </DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <>
            <div className="grid gap-3">
              <div>
                <Label>Current password</Label>
                <div className="mt-1.5 flex items-center rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono text-muted-foreground">
                  {account.password || <span className="italic">not stored</span>}
                </div>
              </div>

              <div>
                <Label>New password</Label>
                <div className="relative mt-1.5">
                  <Input
                    type={showNew ? "text" : "password"}
                    value={newPw}
                    onChange={(e) => setNewPw(e.target.value)}
                    placeholder="Password they'll use going forward"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((s) => !s)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => {
                  if (!newPw.trim()) {
                    toast.error("New password is required");
                    return;
                  }
                  if (newPw.length < 6) {
                    toast.error("New password must be at least 6 characters");
                    return;
                  }
                  setStep("confirm");
                }}
              >
                Continue
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="space-y-3 text-sm">
              <p>You are about to:</p>
              <ol className="ml-4 list-decimal space-y-1 text-muted-foreground">
                <li>Delete <strong>{account.name}</strong>'s existing Firebase Auth account</li>
                <li>Create a new Auth account with the same username and your chosen password</li>
                <li>Migrate their Firestore profile to the new account UID</li>
              </ol>
              <p className="font-medium text-destructive">
                They will be signed out of any active sessions immediately.
              </p>
            </div>

            {busy && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {progress || "Working…"}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("form")} disabled={busy}>
                Back
              </Button>
              <Button
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleConfirm}
                disabled={busy}
              >
                {busy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resetting…</> : "Confirm Force Reset"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ── Delete Account ────────────────────────────────────────────────────────────

function DeleteAccountDialog({ account }: { account: Account }) {
  const { dispatch } = useElup();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="ghost" title="Delete account">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete account?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently remove <strong>{account.name}</strong> (@{account.username}) from the app.
            You will also need to delete <strong>{account.username}@elup.local</strong> from Firebase Console → Authentication to fully revoke their access.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              dispatch({ type: "DELETE_ACCOUNT", id: account.id });
              toast.success(`${account.name}'s account deleted`);
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
