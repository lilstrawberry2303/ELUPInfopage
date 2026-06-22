import { createFileRoute } from "@tanstack/react-router";
import { AppProvider, useApp } from "@/lib/app-context";
import { ElupProvider, useElup } from "@/lib/elup/store";
import { LoginPage } from "@/components/elup/LoginPage";
import { RoleSwitcher } from "@/components/elup/RoleSwitcher";
import { ManagerDashboard } from "@/components/elup/ManagerDashboard";
import { SurveyorView } from "@/components/elup/SurveyorView";
import { TechnicianView } from "@/components/elup/TechnicianView";
import { ClientView } from "@/components/elup/ClientView";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ELUP Management — Electrical Load Upgrading Programme" },
      { name: "description", content: "Plan, survey and execute the Electrical Load Upgrading Programme across HDB high-rise blocks." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <AppProvider>
      <AppShell />
      <Toaster richColors position="top-right" />
    </AppProvider>
  );
}

function AppShell() {
  const { state: appState } = useApp();

  if (!appState.user) {
    return <LoginPage />;
  }

  return (
    <ElupProvider initialRole={appState.user.role}>
      <div className="min-h-screen bg-muted/30">
        <RoleSwitcher />
        <RoleRouter />
      </div>
    </ElupProvider>
  );
}

function RoleRouter() {
  const { state } = useElup();
  switch (state.role) {
    case "manager": return <ManagerDashboard />;
    case "surveyor": return <SurveyorView />;
    case "technician": return <TechnicianView />;
    case "client": return <ClientView />;
  }
}
