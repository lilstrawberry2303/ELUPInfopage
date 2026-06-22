import { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BlockChart } from "./BlockChart";
import { CSScheduler, CWScheduler } from "./CSScheduler";
import { WorkCalendar } from "./WorkCalendar";
import { UnitDrawer } from "./UnitDrawer";
import { PrecinctFilter } from "./PrecinctFilter";
import { AccountManagement } from "./AccountManagement";
import { OptOutRecords } from "./OptOutRecords";
import { OptOutForm } from "./SurveyorView";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useElup, useActiveBlock } from "@/lib/elup/store";
import { usePrecincts } from "@/lib/elup/firestore";
import {
  Activity, Building, CalendarPlus, CheckCircle2, ClipboardList,
  Plus, PieChart as PieIcon, Zap, Flag, Settings2, Pencil, Trash2, CalendarDays} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { toast } from "sonner";

export function ManagerDashboard() {
  const { dispatch } = useElup();
  const block = useActiveBlock();
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);

  const stats = computeStats(block);

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Plan, monitor and coordinate the ELUP rollout across precincts.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SurveyFormCustomizer />
          <NewBlockDialog />
          <AddPrecinctDialog />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat icon={CheckCircle2} label="CW Completion Rate" value={`${stats.cwPct}%`} tone="indigo" sub={`${stats.cwDone}/${stats.total} done`} />
        <Stat icon={Flag} label="Flagged Units" value={stats.flagged} tone="rose" sub="need attention" />
        <Stat icon={ClipboardList} label="CS Today" value={stats.csToday} tone="sky" sub="appointments" />
        <Stat icon={Zap} label="CW Today" value={stats.cwToday} tone="orange" sub="appointments" />
        <Stat icon={CheckCircle2} label="Opt Outs" value={stats.optOut} tone="yellow" />
      </div>

      <PrecinctFilter />

      <BlockChart onCellClick={setSelectedUnit} />

      <Tabs defaultValue="appointments">
        <TabsList>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="calendar"><CalendarDays className="mr-1.5 h-3.5 w-3.5" />Work Calendar</TabsTrigger>
          <TabsTrigger value="optout">Opt-Out Records</TabsTrigger>
        </TabsList>
        <TabsContent value="appointments" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <CSScheduler />
            <CWScheduler />
          </div>
        </TabsContent>
        <TabsContent value="accounts" className="mt-4">
          <AccountManagement />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <WorkCalendar />
        </TabsContent>

        <TabsContent value="optout" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <OptOutForm
              onSubmit={(blockId, unitKey, reason, sig) =>
                dispatch({ type: "REQUEST_OPT_OUT", blockId, unitKey, reason, signature: sig })
              }
            />
            <OptOutRecords />
          </div>
        </TabsContent>
      </Tabs>




      <div className="grid gap-4 lg:grid-cols-2">
        <CompletionRateCard />
        <RecentActivityCard />
      </div>


      <UnitDrawer unitKey={selectedUnit} onClose={() => setSelectedUnit(null)} />
    </div>
  );
}

function Stat({
  icon: Icon, label, value, tone, sub,
}: { icon: typeof Building; label: string; value: number | string; tone: string; sub?: string }) {
  const tones: Record<string, string> = {
    slate: "from-slate-500 to-slate-600",
    sky: "from-sky-500 to-sky-600",
    orange: "from-orange-500 to-orange-600",
    yellow: "from-yellow-400 to-yellow-500",
    indigo: "from-indigo-500 to-indigo-600",
    rose: "from-rose-500 to-rose-600",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-bold">{value}</div>
            {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br ${tones[tone]} text-white`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function computeStats(block: ReturnType<typeof useActiveBlock>) {
  const units = Object.values(block.units).filter((u) => u.exists);
  const total = units.length || 1;
  const csDone = units.filter((u) => u.csStatus === "completed").length;
  const cwDone = units.filter((u) => u.cwStatus === "completed").length;
  const csOutstanding = units.filter((u) => u.csStatus === "pending" || u.csStatus === "scheduled").length;
  const cwOutstanding = units.filter((u) => u.cwStatus === "pending" || u.cwStatus === "scheduled").length;
  const optOut = units.filter((u) => u.csStatus === "opt_out").length;
  const flagged = units.filter((u) => u.flagged).length;
  const d = new Date();
  const todayDmy = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
  const csToday = units.filter((u) => u.csStatus === "scheduled" && u.csDate === todayDmy).length;
  const cwToday = units.filter((u) => u.cwStatus === "scheduled" && u.cwDate === todayDmy).length;
  return {
    total, csDone, cwDone, optOut, csOutstanding, cwOutstanding, csToday, cwToday, flagged,
    csPct: Math.round((csDone / total) * 100),
    cwPct: Math.round((cwDone / total) * 100),
    csOutPct: Math.round((csOutstanding / total) * 100),
    cwOutPct: Math.round((cwOutstanding / total) * 100),
  };
}

function AddPrecinctDialog() {
  const { dispatch } = useElup();
  const [open, setOpen] = useState(false);
  const [precinct, setPrecinct] = useState("");

  const submit = () => {
    if (!precinct.trim()) return toast.error("Precinct name required");
    // Create an empty placeholder block under the new precinct so it appears in filters.
    dispatch({
      type: "ADD_BLOCK",
      block: {
        id: `blk-${Date.now()}`,
        name: `${precinct} — New Block`,
        precinct: precinct.trim(),
        floors: 1,
        lobbies: [{ name: "A", stacks: ["0001"] }],
        units: {
          "1-0001": {
            unitNo: "0001", floor: 1, lobby: "A", exists: true,
            csStatus: "pending", cwStatus: "pending",
          },
        },
      },
    });
    toast.success(`Precinct "${precinct}" added`);
    setOpen(false);
    setPrecinct("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Precinct
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add New Precinct</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Precinct name</Label>
            <Input
              value={precinct}
              onChange={(e) => setPrecinct(e.target.value)}
              placeholder="e.g. Tampines North Precinct B"
            />
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


function NewBlockDialog() {
  const { dispatch } = useElup();
  const precincts = usePrecincts();
  const [open, setOpen] = useState(false);
  const [blockNumber, setBlockNumber] = useState("");
  const [precinct, setPrecinct] = useState("");
  const [floors, setFloors] = useState(10);
  const [unitsPerFloor, setUnitsPerFloor] = useState(8);
  const [lobbies, setLobbies] = useState(4);

  const submit = () => {
    if (!blockNumber.trim()) return toast.error("Block number required");
    if (!precinct) return toast.error("Precinct required");
    const name = `Blk ${blockNumber.trim()}`;
    const lobs = Array.from({ length: lobbies }, (_, i) => {
      const stacksPerLobby = Math.max(1, Math.floor(unitsPerFloor / lobbies));
      const startNum = 2000 + i * stacksPerLobby * 2;
      return {
        name: String.fromCharCode(65 + i),
        stacks: Array.from({ length: stacksPerLobby }, (_, j) => String(startNum + j * 2 + 1)),
      };
    });
    const units: Record<string, import("@/lib/elup/types").UnitData> = {};
    for (let f = 1; f <= floors; f++) {
      lobs.forEach((lob) =>
        lob.stacks.forEach((s) => {
          units[`${f}-${s}`] = {
            unitNo: s, floor: f, lobby: lob.name, exists: true,
            csStatus: "pending", cwStatus: "pending",
          };
        }),
      );
    }
    dispatch({
      type: "ADD_BLOCK",
      block: { id: `blk-${Date.now()}`, name, precinct, floors, lobbies: lobs, units },
    });
    toast.success(`${name} added`);
    setBlockNumber("");
    setPrecinct("");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Building className="mr-2 h-4 w-4" /> Add Block
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Define Block Structure</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Block number</Label>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">Blk</span>
              <Input value={blockNumber} onChange={(e) => setBlockNumber(e.target.value)} placeholder="1699" />
            </div>
          </div>
          <div>
            <Label>Precinct</Label>
            <Select value={precinct} onValueChange={setPrecinct}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select a precinct" />
              </SelectTrigger>
              <SelectContent>
                {precincts.length === 0 ? (
                  <SelectItem value="_none" disabled>No precincts available</SelectItem>
                ) : (
                  precincts.map((p) => (
                    <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Floors</Label><Input type="number" value={floors} onChange={(e) => setFloors(+e.target.value)} /></div>
            <div><Label>Units / floor</Label><Input type="number" value={unitsPerFloor} onChange={(e) => setUnitsPerFloor(+e.target.value)} /></div>
            <div><Label>Lobbies</Label><Input type="number" value={lobbies} onChange={(e) => setLobbies(+e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter><Button onClick={submit}>Create</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompletionRateCard() {
  const { state } = useElup();
  const [mode, setMode] = useState<"CS" | "CW">("CS");

  const precincts = new Map<string, { done: number; total: number }>();
  state.blocks.forEach((b) => {
    const units = Object.values(b.units).filter((u) => u.exists);
    const done = units.filter((u) =>
      mode === "CS" ? u.csStatus === "completed" : u.cwStatus === "completed",
    ).length;
    const prev = precincts.get(b.precinct) ?? { done: 0, total: 0 };
    precincts.set(b.precinct, { done: prev.done + done, total: prev.total + units.length });
  });

  const entries = Array.from(precincts.entries());
  const doneColor = mode === "CS" ? "hsl(199 89% 48%)" : "hsl(25 95% 53%)";
  const remColor = "hsl(220 13% 91%)";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <PieIcon className={`h-4 w-4 ${mode === "CS" ? "text-sky-500" : "text-orange-500"}`} />
          Completion Rate by Precinct
        </CardTitle>
        <Tabs value={mode} onValueChange={(v) => setMode(v as "CS" | "CW")}>
          <TabsList className="h-8">
            <TabsTrigger value="CS" className="h-6 px-2 text-xs">CS</TabsTrigger>
            <TabsTrigger value="CW" className="h-6 px-2 text-xs">CW</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent>
        <div className="max-h-80 overflow-y-auto overflow-x-hidden pr-1">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
            {entries.map(([precinct, { done, total }]) => {
              const pct = total ? Math.round((done / total) * 100) : 0;
              const data = [
                { name: "Done", value: done },
                { name: "Remaining", value: Math.max(0, total - done) },
              ];
              return (
                <div key={precinct} className="flex flex-col items-center rounded-lg border bg-card p-2">
                  <div className="truncate max-w-full text-[11px] font-semibold" title={precinct}>{precinct}</div>
                  <div className="text-[10px] text-muted-foreground">{done}/{total}</div>
                  <div className="relative h-20 w-20">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={data} dataKey="value" innerRadius={22} outerRadius={34} stroke="none" paddingAngle={2}>
                          <Cell fill={doneColor} />
                          <Cell fill={remColor} />
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] font-bold">
                      {pct}%
                    </div>
                  </div>
                </div>
              );
            })}
            {entries.length === 0 && (
              <div className="col-span-full py-8 text-center text-sm text-muted-foreground">
                No precincts yet.
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: doneColor }} /> Done</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: remColor }} /> Left</span>
        </div>
      </CardContent>
    </Card>
  );
}


const DEFAULT_GROUPS: { id: import("@/lib/elup/types").DefaultSurveyGroup; label: string }[] = [
  { id: "gate", label: "Gate Types" },
  { id: "doorFrame", label: "Door Frame" },
  { id: "mainDoor", label: "Main Door" },
  { id: "electDBBox", label: "Electrical DB Box" },
  { id: "wall", label: "Wall" },
  { id: "ceiling", label: "Ceiling" },
  { id: "scheduledCableWork", label: "Scheduled Cable Work" },
];

function SurveyFormCustomizer() {
  const { state, dispatch } = useElup();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [type, setType] = useState<"text" | "checkbox" | "checkbox_group">("text");
  // For checkbox_group: option name input + list
  const [optionInput, setOptionInput] = useState("");
  const [options, setOptions] = useState<string[]>([]);

  const addOption = () => {
    const v = optionInput.trim();
    if (!v) return;
    if (options.includes(v)) return toast.error("Option already added");
    setOptions((prev) => [...prev, v]);
    setOptionInput("");
  };

  const removeOption = (o: string) => setOptions((prev) => prev.filter((x) => x !== o));

  const add = () => {
    if (!label.trim()) return toast.error("Label required");
    if (type === "checkbox_group" && options.length === 0)
      return toast.error("Add at least one option for Checkbox Group");
    dispatch({
      type: "ADD_SURVEY_FIELD",
      field: {
        id: `cf-${Date.now()}`,
        label: label.trim(),
        type,
        options: type === "checkbox_group" ? options : undefined,
      },
    });
    setLabel("");
    setOptions([]);
    setOptionInput("");
    toast.success("Field added");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Settings2 className="mr-2 h-4 w-4" /> Survey Form
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Customize CS Survey Form</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-semibold">Default Sections</Label>
            <p className="mb-2 text-xs text-muted-foreground">Toggle off to hide from surveyor form.</p>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_GROUPS.map((g) => {
                const hidden = state.hiddenSurveyGroups.includes(g.id);
                return (
                  <Button
                    key={g.id}
                    variant={hidden ? "outline" : "default"}
                    size="sm"
                    onClick={() => dispatch({ type: "TOGGLE_SURVEY_GROUP", group: g.id })}
                  >
                    {hidden ? "Hidden" : "Shown"}: {g.label}
                  </Button>
                );
              })}
            </div>
          </div>
          <div>
            <Label className="text-sm font-semibold">Custom Fields</Label>
            <div className="mt-2 max-h-48 space-y-1 overflow-y-auto">
              {state.customSurveyFields.length === 0 && (
                <p className="text-xs text-muted-foreground">No custom fields yet.</p>
              )}
              {state.customSurveyFields.map((f) => (
                <div key={f.id} className="flex items-start justify-between rounded border p-2 text-sm">
                  <div>
                    <span className="font-medium">{f.label}</span>{" "}
                    <span className="text-xs text-muted-foreground">({f.type})</span>
                    {f.options && f.options.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {f.options.map((o) => (
                          <span key={o} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{o}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="shrink-0"
                    onClick={() => dispatch({ type: "DELETE_SURVEY_FIELD", id: f.id })}
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="New field label / title"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                />
                <select
                  className="rounded-md border bg-background px-2 text-sm"
                  value={type}
                  onChange={(e) => {
                    setType(e.target.value as "text" | "checkbox" | "checkbox_group");
                    setOptions([]);
                    setOptionInput("");
                  }}
                >
                  <option value="text">Text</option>
                  <option value="checkbox">Checkbox</option>
                  <option value="checkbox_group">Checkbox Group</option>
                </select>
              </div>
              {type === "checkbox_group" && (
                <div className="rounded-md border bg-muted/20 p-2 space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Add checkbox options for this group</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Option name (e.g. Crack, Chipped…)"
                      value={optionInput}
                      className="h-8 text-xs"
                      onChange={(e) => setOptionInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addOption()}
                    />
                    <Button size="sm" variant="outline" onClick={addOption}><Plus className="h-3.5 w-3.5" /></Button>
                  </div>
                  {options.length > 0 && (
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {options.map((o) => (
                        <span key={o} className="flex items-center gap-1 rounded-full border bg-background px-2 py-0.5 text-xs">
                          {o}
                          <button
                            type="button"
                            className="ml-0.5 text-muted-foreground hover:text-destructive"
                            onClick={() => removeOption(o)}
                          >×</button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button className="w-full" onClick={add}>
                <Plus className="mr-2 h-4 w-4" /> Add Field
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---- Recent Activity (live Firestore feed) ----

interface ActivityEntry {
  id: string;
  type: string;
  description: string;
  operator: string;
  timestamp: Timestamp | null;
  metadata: Record<string, unknown>;
}

const TYPE_META: Record<string, { tag: string; className: string }> = {
  CS_SCHEDULED:  { tag: "CS",   className: "bg-sky-500 text-white" },
  CS_COMPLETED:  { tag: "CS✓",  className: "bg-emerald-500 text-white" },
  CW_SCHEDULED:  { tag: "CW",   className: "bg-orange-500 text-white" },
  CW_COMPLETED:  { tag: "CW✓",  className: "bg-indigo-500 text-white" },
  OPT_OUT:       { tag: "OPT",  className: "bg-yellow-400 text-yellow-950" },
  OPT_APPROVED:  { tag: "OPT✓", className: "bg-yellow-600 text-white" },
  SURVEY:        { tag: "SV",   className: "bg-sky-500 text-white" },
};

function tagMeta(type: string) {
  if (TYPE_META[type]) return TYPE_META[type];
  if (type.startsWith("CS")) return { tag: "CS", className: "bg-sky-500 text-white" };
  if (type.startsWith("CW")) return { tag: "CW", className: "bg-orange-500 text-white" };
  return { tag: type.slice(0, 3), className: "bg-slate-500 text-white" };
}

function relativeTime(ts: Timestamp | null): string {
  if (!ts) return "";
  const diff = Math.floor((Date.now() - ts.toMillis()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function RecentActivityCard() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(
      collection(db(), "recentActivity"),
      orderBy("timestamp", "desc"),
      limit(20),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        setEntries(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              type:        data.type        ?? "",
              description: data.description ?? "",
              operator:    data.operator    ?? "",
              timestamp:   data.timestamp   ?? null,
              metadata:    data.metadata    ?? {},
            };
          }),
        );
        setLoading(false);
      },
      (err) => {
        console.error("[RecentActivity]", err);
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-orange-500" /> Recent Activity
          {!loading && entries.length > 0 && (
            <span className="ml-auto text-xs font-normal text-muted-foreground">
              {entries.length} event{entries.length !== 1 ? "s" : ""}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="h-5 w-8 animate-pulse rounded bg-muted" />
                <div className="h-4 flex-1 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        )}
        {!loading && entries.length === 0 && (
          <div className="rounded-md border border-dashed bg-muted/30 py-8 text-center text-sm text-muted-foreground">
            No activity recorded yet.
            <br />
            <span className="text-xs">Events appear here as surveys, appointments and cable work are logged.</span>
          </div>
        )}
        {!loading && entries.length > 0 && (
          <div className="max-h-64 space-y-0 overflow-y-auto">
            {entries.map((e) => {
              const { tag, className } = tagMeta(e.type);
              return (
                <div key={e.id} className="flex items-start gap-2 border-b py-2 last:border-0">
                  <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${className}`}>
                    {tag}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm leading-snug">{e.description}</p>
                    {e.operator && e.operator !== "system" && (
                      <p className="text-[11px] text-muted-foreground">{e.operator}</p>
                    )}
                  </div>
                  {e.timestamp && (
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {relativeTime(e.timestamp)}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
