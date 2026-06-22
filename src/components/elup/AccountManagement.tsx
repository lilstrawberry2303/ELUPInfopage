import { useState } from "react";
import { useElup } from "@/lib/elup/store";
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
import { UserPlus, Pencil, Trash2, Users, Eye, EyeOff } from "lucide-react";
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
                <DeleteAccountDialog account={a} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

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

function EditAccountDialog({ account }: { account: Account }) {
  const { dispatch } = useElup();
  const [open, setOpen] = useState(false);

  const [name, setName] = useState(account.name);
  const [username, setUsername] = useState(account.username);
  const [role, setRole] = useState<Account["role"]>(account.role);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const reset = () => {
    setName(account.name);
    setUsername(account.username);
    setRole(account.role);
    setPassword("");
    setShowPw(false);
  };

  const submit = () => {
    const newUsername = username.trim().toLowerCase();
    const newName = name.trim();

    if (!newName || !newUsername) {
      toast.error("Name and username are required");
      return;
    }

    const usernameChanged = newUsername !== account.username.trim().toLowerCase();

    if (usernameChanged) {
      // Delete old doc (doc ID = old username) and create a new one
      dispatch({ type: "DELETE_ACCOUNT", id: account.id });
      dispatch({
        type: "ADD_ACCOUNT",
        account: {
          id: newUsername,
          name: newName,
          username: newUsername,
          role,
          password: password.trim() || account.password,
        },
      });
    } else {
      // Same username — patch in place
      const patch: Partial<Account> = { name: newName, role };
      if (password.trim()) patch.password = password.trim();
      dispatch({ type: "UPDATE_ACCOUNT", id: account.id, patch });
    }

    toast.success("Account updated");
    setOpen(false);
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
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
            />
          </div>
          <div>
            <Label>Username</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="username"
            />
            {username.trim().toLowerCase() !== account.username.trim().toLowerCase() && (
              <p className="mt-1 text-[11px] text-amber-600">
                ⚠ Changing the username will delete the old account and create a new one.
              </p>
            )}
          </div>
          <div>
            <Label>New password <span className="text-muted-foreground">(leave blank to keep current)</span></Label>
            <div className="relative">
              <Input
                type={showPw ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to keep unchanged"
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
          <Button className="bg-sky-600 hover:bg-sky-700" onClick={submit}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
            This will permanently remove <strong>{account.name}</strong> (@{account.username}).
            This action cannot be undone.
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
