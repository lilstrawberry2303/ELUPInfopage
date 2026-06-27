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
  reauthenticate, updateOwnPassword,
} from "@/lib/firebase";

export function SettingsDialog() {
  const { state, dispatch } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [logoUploading, setLogoUploading] = useState(false);

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
    } catch (err: unknown) {
      toast.error("Logo upload failed", { description: String((err as Error)?.message ?? err) });
    } finally {
      setLogoUploading(false);
    }
  };

  const savePassword = async () => {
    if (!currentPassword) {
      toast.error("Current password is required.");
      return;
    }
    if (!newPassword) {
      toast.error("New password is required.");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("New password must be at least 6 characters.");
      return;
    }

    setSaving(true);
    try {
      const firebaseUser = auth().currentUser;
      if (firebaseUser) {
        try {
          await reauthenticate(currentPassword);
        } catch {
          toast.error("Current password is incorrect.");
          return;
        }
        try {
          await updateOwnPassword(newPassword);
        } catch (e: unknown) {
          if ((e as { code?: string })?.code === "auth/requires-recent-login") {
            toast.error(
              "Session expired — please sign out and back in, then try again.",
              { duration: 8000 },
            );
            return;
          }
          throw e;
        }
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated.");
    } catch (e: unknown) {
      toast.error("Failed to save changes", { description: String((e as Error)?.message ?? e) });
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
                  {logoUploading ? "Uploading…" : "Upload Logo"}
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
                      } catch (err: unknown) {
                        toast.error("Failed to remove logo", { description: String((err as Error)?.message ?? err) });
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

          {/* Change Password */}
          <div className="space-y-3 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Change Password</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Signed in as <span className="font-medium text-foreground">{state.user?.username}</span>.
            </p>
            <div className="space-y-2.5">
              <div className="space-y-1">
                <Label className="text-xs">Current password</Label>
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
                  placeholder="At least 6 characters"
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
                disabled={!currentPassword || !newPassword || saving}
                onClick={savePassword}
              >
                {saving ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</>
                ) : (
                  <><Check className="h-3.5 w-3.5" /> Save Password</>
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
