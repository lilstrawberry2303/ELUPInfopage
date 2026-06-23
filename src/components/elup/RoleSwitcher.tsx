import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { SettingsDialog } from "./SettingsDialog";
import { useApp } from "@/lib/app-context";
import { toast } from "sonner";

const roleLabels: Record<string, string> = {
  manager: "Project Manager · Operations",
  surveyor: "Surveyor · Field",
  technician: "Technician · Cable Work",
  client: "HDB Officer · Client",
};

export function RoleSwitcher() {
  const { state, dispatch } = useApp();
  const user = state.user!;

  const logout = () => {
    dispatch({ type: "LOGOUT" });
    toast.info("Signed out");
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-4 py-3 md:px-6">
        {/* Logo + app name */}
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg shadow-sm overflow-hidden ${state.settings.logoUrl ? "bg-white border border-border/40" : "bg-primary text-primary-foreground"}`}>
            {state.settings.logoUrl ? (
              <img
                src={state.settings.logoUrl}
                alt="Company logo"
                className="h-full w-full object-contain"
              />
            ) : (
              <Zap className="h-5 w-5" />
            )}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold tracking-tight">ELUP Management</div>
            <div className="text-[11px] text-muted-foreground">
              Electrical Load Upgrading Programme
            </div>
          </div>
        </div>

        {/* Right side: user info + settings + logout */}
        <div className="flex items-center gap-1 sm:gap-2">
          <div className="hidden text-right sm:block">
            <div className="text-xs font-medium">{user.displayName}</div>
            <div className="text-[11px] text-muted-foreground">{roleLabels[user.role] ?? user.role}</div>
          </div>
          <SettingsDialog />
          <Button variant="ghost" size="icon" title="Sign out" onClick={logout}>
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
