import { useMemo, useState } from "react";
import { useElup } from "@/lib/elup/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  CalendarClock, CalendarPlus, ClipboardCheck, Pencil, Printer, Trash2, User, Filter, Zap,
  ChevronLeft, ChevronRight, Search, MapPin, Building2,
} from "lucide-react";
import { toast } from "sonner";
import type { UnitData } from "@/lib/elup/types";
import { HOUR_OPTIONS, parseRange, hourlySlots, rangeOverlaps } from "@/lib/elup/slots";

interface Row {
  blockId: string;
  blockName: string;
  precinct: string;
  unitKey: string;
  unit: UnitData;
}

type Mode = "CS" | "CW";

function parseDmy(d?: string): number {
  if (!d) return Number.MAX_SAFE_INTEGER;
  const [dd, mm, yy] = d.split(/[/.]/);
  return new Date(2000 + Number(yy), Number(mm) - 1, Number(dd)).getTime();
}

function fmtDmy(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

function dmyToIso(d?: string): string {
  if (!d) return "";
  const [dd, mm, yy] = d.split(/[/.]/);
  return `20${yy}-${mm}-${dd}`;
}

export function CSScheduler({ onConductSurvey }: { onConductSurvey?: (blockId: string, unitKey: string) => void } = {}) {
  return <AppointmentScheduler mode="CS" onConductSurvey={onConductSurvey} />;
}

export function CWScheduler() {
  return <AppointmentScheduler mode="CW" />;
}

function AppointmentScheduler({ mode, onConductSurvey }: { mode: Mode; onConductSurvey?: (blockId: string, unitKey: string) => void }) {
  const { state, dispatch } = useElup();
  const [filter, setFilter] = useState<"all" | "today" | "week" | "unassigned" | "custom">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [filterPrecinct, setFilterPrecinct] = useState<string>("all");
  const [filterBlockId, setFilterBlockId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const PAGE_SIZE = 10;

  const isCS = mode === "CS";
  const accent = isCS
    ? { text: "text-sky-500", text2: "text-sky-700", btn: "bg-sky-600 hover:bg-sky-700", tab: "bg-sky-500" }
    : { text: "text-orange-500", text2: "text-orange-700", btn: "bg-orange-600 hover:bg-orange-700", tab: "bg-orange-500" };

  const getStatus = (u: UnitData) => (isCS ? u.csStatus : u.cwStatus);
  const getDate = (u: UnitData) => (isCS ? u.csDate : u.cwDate);
  const getTime = (u: UnitData) => (isCS ? u.csTime : u.cwTime);
  const getAssignee = (u: UnitData) => (isCS ? u.csAssignee : u.cwAssignee);
  const getNotes = (u: UnitData) => (isCS ? u.csNotes : u.cwNotes);

  // Derived precinct + block lists for the filter selects
  const precincts = useMemo(
    () => Array.from(new Set(state.blocks.map((b) => b.precinct))).sort(),
    [state.blocks],
  );

  const blocksInFilterPrecinct = useMemo(
    () => filterPrecinct === "all"
      ? state.blocks
      : state.blocks.filter((b) => b.precinct === filterPrecinct),
    [state.blocks, filterPrecinct],
  );

  // All scheduled rows across every block
  const rows: Row[] = useMemo(() => {
    return state.blocks.flatMap((b) =>
      Object.entries(b.units)
        .filter(([, u]) => u.exists && getStatus(u) === "scheduled")
        .map(([unitKey, unit]) => ({ blockId: b.id, blockName: b.name, precinct: b.precinct, unitKey, unit })),
    ).sort((a, b) => parseDmy(getDate(a.unit)) - parseDmy(getDate(b.unit)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.blocks, mode]);

  // Apply precinct / block filter first, then date/search/tab filters
  const filtered = useMemo(() => {
    const now = Date.now();
    const wk = now + 7 * 24 * 3600 * 1000;
    const q = search.trim().toLowerCase();
    const fromTs = dateFrom ? new Date(dateFrom).getTime() : null;
    const toTs = dateTo ? new Date(dateTo + "T23:59:59").getTime() : null;
    return rows.filter(({ unit, blockName, precinct, blockId }) => {
      // Precinct filter
      if (filterPrecinct !== "all" && precinct !== filterPrecinct) return false;
      // Block filter
      if (filterBlockId !== "all" && blockId !== filterBlockId) return false;
      // Search
      if (q) {
        const hay = `${unit.unitNo} ${unit.floor} ${unit.lobby} ${getAssignee(unit) ?? ""} ${getDate(unit) ?? ""} ${blockName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      // Tab filters
      if (filter === "unassigned") return !getAssignee(unit);
      if (filter === "today") {
        const t = parseDmy(getDate(unit));
        const today = new Date();
        const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        return t >= start && t < start + 24 * 3600 * 1000;
      }
      if (filter === "week") {
        const t = parseDmy(getDate(unit));
        return t >= now && t <= wk;
      }
      if (filter === "custom") {
        const t = parseDmy(getDate(unit));
        if (fromTs !== null && t < fromTs) return false;
        if (toTs !== null && t > toTs) return false;
        return true;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, filter, search, filterPrecinct, filterBlockId, dateFrom, dateTo, mode]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paged = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const unscheduled = state.blocks.flatMap((b) =>
    Object.entries(b.units)
      .filter(([, u]) => {
        if (!u.exists) return false;
        if (isCS) return u.csStatus === "pending";
        return u.cwStatus === "pending" && u.csStatus === "completed";
      })
      .map(([k, u]) => ({ k, blockId: b.id, blockName: b.name, precinct: b.precinct, u })),
  );

  const bookedSlots = useMemo(() => {
    return state.blocks.flatMap((b) =>
      Object.entries(b.units)
        .filter(([, u]) => u.exists && getStatus(u) === "scheduled" && getDate(u) && getTime(u))
        .map(([k, u]) => ({
          unitKey: k,
          date: getDate(u)!,
          time: getTime(u)!,
          assignee: getAssignee(u),
          label: `${b.name} #${u.floor}-${u.unitNo}`,
        })),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.blocks, mode]);

  function unschedule(blockId: string, unitKey: string) {
    dispatch({
      type: "UPDATE_UNIT",
      blockId,
      unitKey,
      patch: isCS
        ? { csStatus: "pending", csDate: undefined, csTime: undefined, csAssignee: undefined }
        : { cwStatus: "pending", cwDate: undefined, cwTime: undefined, cwAssignee: undefined },
    });
    toast.success("Appointment cancelled");
  }

  // Print uses the currently filtered rows so precinct/block filter is respected
  function printSchedule() {
    const assigneeHeader = isCS ? "Surveyor" : "Technician";
    const scopeLabel = filterBlockId !== "all"
      ? (state.blocks.find((b) => b.id === filterBlockId)?.name ?? "Selected Block")
      : filterPrecinct !== "all" ? `Precinct ${filterPrecinct}` : "All Blocks";
    const html = `<!DOCTYPE html>
<html><head><title>${mode} Appointments — ${scopeLabel}</title>
<style>
  body{font-family:sans-serif;font-size:12px;padding:16px}
  h2{font-size:15px;margin:0 0 2px}p{color:#666;font-size:11px;margin:0 0 12px}
  table{width:100%;border-collapse:collapse}
  th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}
  th{background:#f5f5f5;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.05em}
  @media print{body{padding:0}}
</style></head><body>
<h2>${mode} Appointments Schedule — ${scopeLabel}</h2>
<p>Printed: ${new Date().toLocaleString()}</p>
<table><thead><tr>
  <th>Date</th><th>Time</th><th>Block</th><th>Unit</th><th>Lobby</th><th>${assigneeHeader}</th>
</tr></thead><tbody>
${filtered.map(({ blockName, unit }) => `<tr>
  <td>${isCS ? (unit.csDate ?? "—") : (unit.cwDate ?? "—")}</td>
  <td>${isCS ? (unit.csTime ?? "—") : (unit.cwTime ?? "—")}</td>
  <td>${blockName}</td>
  <td>#${unit.floor}-${unit.unitNo}</td>
  <td>${unit.lobby}</td>
  <td>${isCS ? (unit.csAssignee ?? "—") : (unit.cwAssignee ?? "—")}</td>
</tr>`).join("")}
</tbody></table>
</body></html>`;
    const win = window.open("", "_blank", "width=800,height=600");
    if (!win) { toast.error("Pop-up blocked. Allow pop-ups and try again."); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  }

  const Icon = isCS ? CalendarClock : Zap;

  const isFiltered = filterPrecinct !== "all" || filterBlockId !== "all";

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Icon className={`h-4 w-4 ${accent.text}`} />
            {mode} Appointments
            <Badge variant="secondary" className="ml-1">
              {isFiltered || filter !== "all" ? `${filtered.length} / ${rows.length}` : rows.length}
            </Badge>
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              title={`Print ${mode} schedule`}
              onClick={printSchedule}
              disabled={filtered.length === 0}
              className="px-2"
            >
              <Printer className="h-4 w-4" />
            </Button>
            <ScheduleDialog
              mode={mode}
              bookedSlots={bookedSlots}
              trigger={
                <Button size="sm" className={`${accent.btn} px-2 sm:px-3`}>
                  <CalendarPlus className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Schedule {mode}</span>
                </Button>
              }
              unitOptions={unscheduled.map(({ k, blockId, blockName, precinct, u }) => ({
                k,
                blockId,
                blockName,
                precinct,
                label: `${blockName} · #${u.floor}-${u.unitNo}`,
                unitLabel: `#${u.floor}-${u.unitNo} · Lby ${u.lobby}`,
              }))}
              onSave={({ blockId, unitKey, date, time, assignee, notes }) => {
                const dateStr = fmtDmy(date);
                dispatch({
                  type: "UPDATE_UNIT",
                  blockId,
                  unitKey,
                  patch: isCS
                    ? { csStatus: "scheduled", csDate: dateStr, csTime: time, csAssignee: assignee, csNotes: notes }
                    : { cwStatus: "scheduled", cwDate: dateStr, cwTime: time, cwAssignee: assignee, cwNotes: notes },
                });
                dispatch({
                  type: "ADD_APPOINTMENT",
                  appt: {
                    id: crypto.randomUUID(),
                    blockId,
                    unitKey,
                    type: mode,
                    date: dateStr,
                    time,
                    assignee,
                  },
                });
                toast.success(`${mode} appointment scheduled`, {
                  description: `${dateStr} ${time} · ${assignee}`,
                });
              }}
            />
          </div>
        </CardTitle>

        {/* Unified filter bar: Precinct + Block + date tabs */}
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border bg-muted/20 px-3 py-2">
          {/* Precinct select */}
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <MapPin className="h-3 w-3" /> Precinct
          </div>
          <Select
            value={filterPrecinct}
            onValueChange={(v) => {
              setFilterPrecinct(v);
              setFilterBlockId("all");
              setPage(1);
            }}
          >
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Precincts</SelectItem>
              {precincts.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
            <Building2 className="h-3 w-3" /> Block
          </div>
          <Select
            value={filterBlockId}
            onValueChange={(v) => { setFilterBlockId(v); setPage(1); }}
          >
            <SelectTrigger className="h-7 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Blocks</SelectItem>
              {blocksInFilterPrecinct.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Divider */}
          <div className="mx-1 h-5 w-px bg-border" />

          {/* Date-range pills */}
          <Filter className="h-3 w-3 text-muted-foreground" />
          {(["all", "today", "week", "unassigned", "custom"] as const).map((f) => (
            <button
              key={f}
              onClick={() => { setFilter(f); setPage(1); }}
              className={`rounded px-2 py-0.5 text-[11px] capitalize transition ${
                filter === f ? `${accent.tab} text-white` : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}

          {/* Clear — only shown when any filter is active */}
          {(isFiltered || filter !== "all") && (
            <button
              onClick={() => {
                setFilterPrecinct("all");
                setFilterBlockId("all");
                setFilter("all");
                setDateFrom("");
                setDateTo("");
                setPage(1);
              }}
              className="ml-auto text-[11px] text-muted-foreground underline hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>

        {/* Custom date range pickers */}
        {filter === "custom" && (
          <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-dashed bg-muted/10 px-3 py-2">
            <span className="text-[11px] font-medium text-muted-foreground">Date range:</span>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-muted-foreground">From</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="h-7 w-36 text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-[11px] text-muted-foreground">To</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="h-7 w-36 text-xs"
              />
            </div>
            {(dateFrom || dateTo) && (
              <button
                onClick={() => { setDateFrom(""); setDateTo(""); setPage(1); }}
                className="text-[11px] text-muted-foreground underline hover:text-foreground"
              >
                Clear dates
              </button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder={`Search ${mode} by unit, block, floor, date, assignee…`}
            className="h-9 pl-8 text-sm"
          />
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
            No appointments match this filter.
          </div>
        ) : (
          <div className="divide-y rounded-md border">
            {paged.map(({ blockId, blockName, unitKey, unit }) => (
              <div
                key={`${blockId}::${unitKey}`}
                className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm hover:bg-muted/40"
              >
                <div className="flex w-20 flex-col">
                  <span className={`font-semibold ${accent.text2}`}>{getDate(unit) ?? "—"}</span>
                  <span className="text-[11px] text-muted-foreground">{getTime(unit) ?? "—"}</span>
                </div>
                <div className="flex w-32 flex-col">
                  <span className="font-medium text-xs">{blockName}</span>
                  <span className="text-[11px] text-muted-foreground">#{unit.floor}-{unit.unitNo} · Lby {unit.lobby}</span>
                </div>
                <div className="flex flex-1 flex-wrap items-center gap-1.5 text-[12px] text-muted-foreground">
                  <User className="h-3 w-3" />
                  {getAssignee(unit) ? (
                    <span className="text-foreground">{getAssignee(unit)}</span>
                  ) : (
                    <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700">
                      Unassigned
                    </Badge>
                  )}

                </div>
                <div className="flex items-center gap-1">
                  {isCS && onConductSurvey && (
                    <Button
                      size="sm"
                      variant="ghost"
                      title="Conduct Survey"
                      className="text-sky-600 hover:bg-sky-50"
                      onClick={() => onConductSurvey(blockId, unitKey)}
                    >
                      <ClipboardCheck className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <ScheduleDialog
                    mode={mode}
                    bookedSlots={bookedSlots}
                    trigger={
                      <Button size="sm" variant="ghost">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    }
                    initial={{
                      blockId,
                      unitKey,
                      date: dmyToIso(getDate(unit)),
                      time: getTime(unit) ?? "09:00-10:00",
                      assignee: getAssignee(unit) ?? "",
                      notes: getNotes(unit) ?? "",
                    }}
                    unitOptions={[{ k: unitKey, blockId, label: `${blockName} · #${unit.floor}-${unit.unitNo}` }]}
                    lockUnit
                    onSave={({ date, time, assignee, notes }) => {
                      dispatch({
                        type: "UPDATE_UNIT",
                        blockId,
                        unitKey,
                        patch: isCS
                          ? { csDate: fmtDmy(date), csTime: time, csAssignee: assignee, csNotes: notes }
                          : { cwDate: fmtDmy(date), cwTime: time, cwAssignee: assignee, cwNotes: notes },
                      });
                      dispatch({
                        type: "ADD_APPOINTMENT",
                        appt: {
                          id: crypto.randomUUID(),
                          blockId,
                          unitKey,
                          type: mode,
                          date: fmtDmy(date),
                          time,
                          assignee,
                        },
                      });
                      toast.success("Appointment updated");
                    }}
                  />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost">
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel {mode} appointment?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will unschedule {blockName} #{unit.floor}-{unit.unitNo} ({getDate(unit)} {getTime(unit)}).
                          The unit will revert to pending.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Keep</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          onClick={() => unschedule(blockId, unitKey)}
                        >
                          Cancel appointment
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="mt-3 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              Showing {((safePage - 1) * PAGE_SIZE) + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={safePage <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[3ch] text-center text-sm">{safePage} / {totalPages}</span>
              <Button size="sm" variant="outline" disabled={safePage >= totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface SaveData {
  blockId: string;
  unitKey: string;
  date: string;
  time: string;
  assignee: string;
  notes: string;
}

interface BookedSlot {
  unitKey: string;
  date: string;
  time: string;
  assignee?: string;
  label: string;
}

function ScheduleDialog({
  trigger,
  initial,
  unitOptions,
  lockUnit,
  onSave,
  mode,
  bookedSlots,
}: {
  trigger: React.ReactNode;
  initial?: Partial<SaveData>;
  unitOptions: { k: string; blockId: string; blockName?: string; precinct?: string; label: string; unitLabel?: string }[];
  lockUnit?: boolean;
  onSave: (data: SaveData) => void;
  mode: Mode;
  bookedSlots: BookedSlot[];
}) {
  const [open, setOpen] = useState(false);
  const [unitKey, setUnitKey] = useState(initial?.unitKey ?? "");
  const [blockId, setBlockId] = useState(initial?.blockId ?? "");
  const [date, setDate] = useState(initial?.date ?? "");
  const [slotStart, setSlotStart] = useState(() => {
    const t = initial?.time ?? "09:00-10:00";
    return t.includes("-") ? t.split("-")[0] : "09:00";
  });
  const [slotEnd, setSlotEnd] = useState(() => {
    const t = initial?.time ?? "09:00-10:00";
    return t.includes("-") ? t.split("-")[1] : "10:00";
  });
  const time = `${slotStart}-${slotEnd}`;
  const [assignee, setAssignee] = useState(initial?.assignee ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [selPrecinct, setSelPrecinct] = useState(() =>
    unitOptions.find((u) => u.blockId === (initial?.blockId ?? ""))?.precinct ?? ""
  );
  const [selBlockId, setSelBlockId] = useState(initial?.blockId ?? "");

  const availablePrecincts = useMemo(
    () => Array.from(new Set(unitOptions.map((u) => u.precinct ?? ""))).filter(Boolean).sort(),
    [unitOptions],
  );
  const blocksForPrecinct = useMemo(
    () => Array.from(
      new Map(
        unitOptions
          .filter((u) => u.precinct === selPrecinct)
          .map((u) => [u.blockId, { blockId: u.blockId, blockName: u.blockName ?? u.label }])
      ).values()
    ),
    [unitOptions, selPrecinct],
  );
  const unitsForBlock = useMemo(
    () => unitOptions.filter((u) => u.blockId === selBlockId),
    [unitOptions, selBlockId],
  );

  const { state: elupState } = useElup();
  const isCS = mode === "CS";
  const roleAccounts = useMemo(
    () => elupState.accounts.filter((a) => a.role === (isCS ? "surveyor" : "technician")),
    [elupState.accounts, isCS],
  );

  const submit = () => {
    if (!unitKey || !date) {
      toast.error("Unit and date are required");
      return;
    }
    if (blockedDate) {
      toast.error(
        `This date is blocked for ${
          blockedDate.type === "both" ? "CS & CW" : blockedDate.type
        }${ blockedDate.reason ? ` — ${blockedDate.reason}` : "" }`,
      );
      return;
    }
    onSave({ blockId, unitKey, date, time, assignee, notes });
    setOpen(false);
  };

  const btn = isCS ? "bg-sky-600 hover:bg-sky-700" : "bg-orange-600 hover:bg-orange-700";

  const dayBookings = useMemo(() => {
    if (!date) return [];
    const dmy = fmtDmy(date);
    return bookedSlots
      .filter((s) => s.date === dmy && s.unitKey !== unitKey)
      .sort((a, b) => parseRange(a.time)[0] - parseRange(b.time)[0]);
  }, [date, bookedSlots, unitKey]);

  const sel = parseRange(time);
  const clash = dayBookings.some(
    (s) => s.assignee && assignee && s.assignee === assignee && rangeOverlaps(parseRange(s.time), sel),
  );
  const blockedDate = date
    ? elupState.blockedDates?.find(
        (b) => b.date === fmtDmy(date) && (b.type === "both" || b.type === mode),
      )
    : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {initial?.unitKey ? `Reschedule ${mode} Appointment` : `Schedule ${mode} Appointment`}
          </DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="form">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">Details</TabsTrigger>
            <TabsTrigger value="timetable">
              Day Timetable {dayBookings.length > 0 && `(${dayBookings.length})`}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="form" className="mt-3">
            <div className="grid gap-3">
              {lockUnit ? (
                <div>
                  <Label>Unit</Label>
                  <Select value={unitKey} disabled>
                    <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {unitOptions.map((u) => (
                        <SelectItem key={`${u.blockId}::${u.k}`} value={u.k}>{u.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div>
                    <Label>Precinct</Label>
                    <Select
                      value={selPrecinct}
                      onValueChange={(v) => {
                        setSelPrecinct(v);
                        setSelBlockId("");
                        setBlockId("");
                        setUnitKey("");
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Select precinct" /></SelectTrigger>
                      <SelectContent>
                        {availablePrecincts.map((p) => (
                          <SelectItem key={p} value={p}>{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Block</Label>
                    <Select
                      value={selBlockId}
                      onValueChange={(v) => {
                        setSelBlockId(v);
                        setBlockId(v);
                        setUnitKey("");
                      }}
                      disabled={!selPrecinct}
                    >
                      <SelectTrigger><SelectValue placeholder="Select block" /></SelectTrigger>
                      <SelectContent>
                        {blocksForPrecinct.map((b) => (
                          <SelectItem key={b.blockId} value={b.blockId}>{b.blockName}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Unit</Label>
                    <Select
                      value={unitKey}
                      onValueChange={setUnitKey}
                      disabled={!selBlockId}
                    >
                      <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {unitsForBlock.map((u) => (
                          <SelectItem key={`${u.blockId}::${u.k}`} value={u.k}>
                            {u.unitLabel ?? u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={blockedDate ? "border-destructive ring-1 ring-destructive" : ""}
                />
                {blockedDate && (
                  <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                    <span>🚫</span>
                    <span>
                      Blocked for {blockedDate.type === "both" ? "CS \u0026 CW" : blockedDate.type}
                      {blockedDate.reason ? ` — ${blockedDate.reason}` : ""}
                    </span>
                  </p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Start time</Label>
                  <Select
                    value={slotStart}
                    onValueChange={(v) => {
                      setSlotStart(v);
                      if (slotEnd <= v) setSlotEnd(HOUR_OPTIONS.find((h) => h > v) ?? "18:00");
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.filter((h) => h < "18:00").map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>End time</Label>
                  <Select value={slotEnd} onValueChange={setSlotEnd}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {HOUR_OPTIONS.filter((h) => h > slotStart).map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-xs text-muted-foreground -mt-1">
                Selected: <span className="font-medium text-foreground">{time}</span>
                {slotEnd !== "" && slotStart !== "" && (
                  <span className="ml-2 text-muted-foreground">
                    ({Math.round((parseRange(time)[1] - parseRange(time)[0]) / 60)}h)
                  </span>
                )}
              </div>
              {clash && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  ⚠ Another {mode} appointment overlaps with this slot. Check the Day Timetable.
                </div>
              )}
              <div>
                <Label>{isCS ? "Surveyor" : "Technician"}</Label>
                <Select value={assignee} onValueChange={setAssignee}>
                  <SelectTrigger>
                    <SelectValue placeholder={`Select ${isCS ? "surveyor" : "technician"}`} />
                  </SelectTrigger>
                  <SelectContent>
                    {roleAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Access instructions, equipment needs…"
                  rows={2}
                />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="timetable" className="mt-3">
            <DayTimetable
              date={date}
              bookings={dayBookings}
              currentTime={time}
              mode={mode}
              assignee={assignee}
              onPick={(range) => {
                const [s, e] = range.split("-");
                if (s && e) { setSlotStart(s); setSlotEnd(e); }
              }}
            />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className={btn} onClick={submit} disabled={!!blockedDate}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DayTimetable({
  date, bookings, currentTime, mode, assignee, onPick,
}: {
  date: string;
  bookings: BookedSlot[];
  currentTime: string;
  mode: Mode;
  assignee?: string;
  onPick?: (range: string) => void;
}) {
  const [pickStart, setPickStart] = useState<string | null>(null);

  if (!date) {
    return (
      <div className="rounded-md border border-dashed py-8 text-center text-sm text-muted-foreground">
        Pick a date in the Details tab to see existing bookings.
      </div>
    );
  }
  const slots = hourlySlots();
  const accent = mode === "CS" ? "bg-sky-100 border-sky-300 text-sky-900" : "bg-orange-100 border-orange-300 text-orange-900";
  const accentOther = "bg-muted border-border text-muted-foreground";
  const ringClr = mode === "CS" ? "ring-sky-400 bg-sky-50" : "ring-orange-400 bg-orange-50";
  const cur = parseRange(currentTime);

  function handleRowClick(slotLabel: string) {
    if (!pickStart) {
      setPickStart(slotLabel);
    } else if (slotLabel <= pickStart) {
      setPickStart(slotLabel);
    } else {
      // End = end of the clicked slot (label + 1h), capped at 18:00
      const h = parseInt(slotLabel.split(":")[0], 10);
      const endStr = `${String(Math.min(h + 1, 18)).padStart(2, "0")}:00`;
      onPick?.(`${pickStart}-${endStr}`);
      setPickStart(null);
    }
  }

  return (
    <div className="space-y-1">
      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Bookings on <span className="font-semibold text-foreground">{fmtDmy(date)}</span>
        </span>
        <span className="italic">
          {pickStart ? (
            <span className="text-emerald-600 font-medium">Start: {pickStart} — now click end time</span>
          ) : (
            "Click start time, then end time"
          )}
        </span>
      </div>
      <div className="max-h-[320px] overflow-y-auto rounded-md border">
        {slots.map((slot) => {
          const items = bookings.filter((b) => rangeOverlaps(parseRange(b.time), [slot.start, slot.end]));
          const sameAssigneeItems = items.filter((b) => assignee && b.assignee === assignee);
          const isCurrent = rangeOverlaps(cur, [slot.start, slot.end]);
          const hasClash = isCurrent && sameAssigneeItems.length > 0;
          const isPickStart = pickStart === slot.label;
          const isInPickRange = pickStart !== null && slot.label > pickStart;

          let rowBg = "";
          if (isPickStart) rowBg = "bg-emerald-50 ring-1 ring-emerald-400";
          else if (isInPickRange && pickStart !== null) rowBg = "bg-emerald-50/40";
          else if (isCurrent) rowBg = `ring-1 ${ringClr}`;

          return (
            <button
              type="button"
              key={slot.label}
              onClick={() => handleRowClick(slot.label)}
              className={`flex w-full gap-2 border-b px-2 py-1.5 text-left text-xs transition last:border-0 hover:bg-muted/60 ${rowBg}`}
            >
              <div className={`w-16 shrink-0 font-mono font-semibold ${isPickStart ? "text-emerald-700" : "text-muted-foreground"}`}>
                {slot.label}
              </div>
              <div className="flex flex-1 flex-wrap gap-1">
                {items.length === 0 && (
                  <span className="text-muted-foreground/60">
                    {isPickStart ? "← start selected" : isCurrent ? "← your slot (free)" : "free"}
                  </span>
                )}
                {items.map((b, i) => {
                  const isSameAssignee = assignee && b.assignee === assignee;
                  return (
                    <span key={i} className={`rounded border px-1.5 py-0.5 font-medium ${isSameAssignee ? accent : accentOther}`}>
                      {b.label}{b.assignee ? ` · ${b.assignee}` : ""}
                      <span className="ml-1 opacity-60">({b.time})</span>
                    </span>
                  );
                })}
                {hasClash && (
                  <span className="rounded border border-destructive bg-destructive/10 px-1.5 py-0.5 font-semibold text-destructive">
                    OVERLAP
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {pickStart && (
        <p className="text-center text-xs text-muted-foreground">
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => setPickStart(null)}
          >
            Cancel selection
          </button>
        </p>
      )}
    </div>
  );
}
