import { useRef, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Settings, Moon, Sun, Upload, X, KeyRound, Check, Loader2 } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { toast } from "sonner";
import {
  auth, uploadLogo, saveLogoUrl,
  reauthenticate, updateOwnPassword, updateUsernameInFirestore,
} from "@/lib/firebase";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export function SettingsDialog() {
  const { state, dispatch } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // Account change state
  const [newUsername, setNewUsername] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setLogoUploading(true);
    try {
      const url = await uploadLogo(file);
      await saveLogoUrl(url);
      dispatch({ type: "SET_LOGO", url });
      toast.success("Logo uploaded");
    } catch (err: any) {
      toast.error("Logo upload failed", { description: String(err?.message ?? err) });
    } finally {
      setLogoUploading(false);
    }
  };

  const saveCredentials = async () => {
    const user = state.user!;
    if (!currentPassword) {
      toast.error("Current password is required to save changes.");
      return;
    }
    if (newPassword && newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    const targetUsername = newUsername.trim().toLowerCase() || user.username.toLowerCase();
    const usernameChanged = targetUsername !== user.username.toLowerCase();

    // Check username conflict
    if (usernameChanged && state.credentials.some(
      (c) => c.username.toLowerCase() === targetUsername && c.org === user.org,
    )) {
      toast.error("That username is already taken.");
      return;
    }

    setSaving(true);
    try {
      const firebaseUser = auth().currentUser;

      // Step 1 — verify current password
      if (firebaseUser) {
        // Firebase Auth account: reauthenticate properly
        try {
          await reauthenticate(currentPassword);
        } catch {
          toast.error("Current password is incorrect.");
          return;
        }
      } else {
        // Legacy account: compare against Firestore credential
        const existing = state.credentials.find(
          (c) => c.org === user.org && c.username.toLowerCase() === user.username.toLowerCase(),
        );
        if (!existing || existing.password !== currentPassword) {
          toast.error("Current password is incorrect.");
          return;
        }
      }

      // Step 2 — update username in Firestore (if changed)
      if (usernameChanged) {
        const docId = user.uid ?? user.username.toLowerCase();
        if (firebaseUser) {
          await updateUsernameInFirestore(docId, targetUsername);
        } else {
          // Legacy: create new doc, remove old
          const existing = state.credentials.find(
            (c) => c.org === user.org && c.username.toLowerCase() === user.username.toLowerCase(),
          )!;
          await setDoc(doc(db(), "users", targetUsername), {
            username: targetUsername,
            password: newPassword || existing.password,
            role: existing.role,
            name: existing.displayName,
          });
          const { deleteDoc } = await import("firebase/firestore");
          await deleteDoc(doc(db(), "users", user.username.toLowerCase()));
        }
        dispatch({
          type: "UPDATE_CREDENTIAL",
          org: user.org,
          oldUsername: user.username,
          newUsername: targetUsername,
          newPassword: newPassword || currentPassword,
        });
      }

      // Step 3 — update password
      if (newPassword) {
        if (firebaseUser) {
          try {
            await updateOwnPassword(newPassword);
          } catch (e: any) {
            if ((e?.code as string) === "auth/requires-recent-login") {
              toast.error(
                "Your session has expired for security reasons. Please sign out and sign back in, then try changing your password again.",
                { duration: 8000 },
              );
              return;
            }
            throw e;
          }
        } else {
          // Legacy: update password field in Firestore
          const existing = state.credentials.find(
            (c) => c.org === user.org && c.username.toLowerCase() === (usernameChanged ? targetUsername : user.username.toLowerCase()),
          );
          if (existing) {
            await setDoc(doc(db(), "users", usernameChanged ? targetUsername : user.username.toLowerCase()), {
              username: usernameChanged ? targetUsername : user.username.toLowerCase(),
              password: newPassword,
              role: existing.role,
              name: existing.displayName,
            });
          }
          dispatch({
            type: "UPDATE_CREDENTIAL",
            org: user.org,
            oldUsername: usernameChanged ? targetUsername : user.username,
            newUsername: usernameChanged ? targetUsername : user.username,
            newPassword,
          });
        }
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setNewUsername("");
      toast.success("Account details updated.");
    } catch (e: any) {
      toast.error("Failed to save changes", { description: String(e?.message ?? e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="Settings">
          <Settings className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* Company Logo — manager only */}
          {state.user?.role === "manager" && (
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">Company Logo</Label>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Upload your company logo to replace the default icon in the navigation bar.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg border overflow-hidden ${state.settings.logoUrl ? "bg-white" : "bg-muted/30"}`}>
                  {state.settings.logoUrl ? (
                    <img
                      src={state.settings.logoUrl}
                      alt="Company logo"
                      className="h-full w-full object-contain p-1"
                    />
                  ) : (
                    <span className="text-[10px] text-muted-foreground">None</span>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/gif,image/webp"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={logoUploading}>
                  {logoUploading ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-2 h-3.5 w-3.5" />}
                  {logoUploading ? "Uploading\u2026" : "Upload Logo"}
                </Button>
                {state.settings.logoUrl && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      try {
                        await saveLogoUrl(null);
                        dispatch({ type: "SET_LOGO", url: null });
                      } catch (err: any) {
                        toast.error("Failed to remove logo", { description: String(err?.message ?? err) });
                      }
                    }}
                  >
                    <X className="mr-1 h-3.5 w-3.5" /> Remove
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Night Mode */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div>
              <Label className="text-sm font-semibold">Night Mode</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Switch to a dark colour scheme across the entire application.
              </p>
            </div>
            <Button
              variant={state.settings.darkMode ? "default" : "outline"}
              size="sm"
              className="ml-4 shrink-0 gap-1.5"
              onClick={() => dispatch({ type: "SET_DARK_MODE", dark: !state.settings.darkMode })}
            >
              {state.settings.darkMode ? (
                <><Moon className="h-4 w-4" /> Dark</>
              ) : (
                <><Sun className="h-4 w-4" /> Light</>
              )}
            </Button>
          </div>

          {/* Account */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Change Account Details</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{state.user?.username}</span>.
              Fill in only the fields you want to change.
            </p>
            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label className="text-xs">New username</Label>
                <Input
                  placeholder={state.user?.username ?? ""}
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  autoComplete="username"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Current password <span className="text-destructive">*</span></Label>
                <Input
                  type="password"
                  placeholder="Required to save changes"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">New password</Label>
                <Input
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="h-8 text-sm"
                />
              </div>
              {newPassword && (
                <div className="space-y-1">
                  <Label className="text-xs">Confirm new password</Label>
                  <Input
                    type="password"
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                    className="h-8 text-sm"
                  />
                </div>
              )}
              <Button
                size="sm"
                className="w-full gap-1.5"
                disabled={!currentPassword || saving}
                onClick={saveCredentials}
              >
                {saving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="h-3.5 w-3.5" /> Save Changes</>
                )}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogTrigger asChild>
            <Button variant="outline">Close</Button>
          </DialogTrigger>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
