import { useState, useMemo } from "react";
import { useElup } from "@/lib/elup/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Ban, CalendarClock, ChevronLeft, ChevronRight, X, Zap } from "lucide-react";
import { toast } from "sonner";
import { formatUnit, type BlockedDate } from "@/lib/elup/types";
import { hourlySlots, parseRange, rangeOverlaps } from "@/lib/elup/slots";

// ---- Date helpers ----
function toDmy(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

function parseDmyMs(dmy: string): number {
  const [dd, mm, yy] = dmy.split(/[/.]/);
  if (!dd || !mm || !yy) return 0;
  return new Date(2000 + Number(yy), Number(mm) - 1, Number(dd)).getTime();
}

function buildCalendar(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const startDow = (first.getDay() + 6) % 7; // Mon = 0
  const cells: (Date | null)[] = Array(startDow).fill(null);
  for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

const DOW = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function WorkCalendar() {
  const { state, dispatch } = useElup();
  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const [year, setYear]           = useState(today.getFullYear());
  const [month, setMonth]         = useState(today.getMonth());
  const [selected, setSelected]   = useState<Date>(today);
  const [blockReason, setBlockReason] = useState("");
  const [blockType, setBlockType] = useState<"CS" | "CW" | "both">("both");

  // All appointments grouped by day (DD/MM/YY)
  const apptsByDay = useMemo(() => {
    const m = new Map<string, {
      cs: { label: string; time: string }[];
      cw: { label: string; time: string; assignee?: string }[];
    }>();
    state.blocks.forEach((b) => {
      Object.values(b.units).forEach((u) => {
        if (!u.exists) return;
        if (u.csDate && (u.csStatus === "scheduled" || u.csStatus === "completed")) {
          if (!m.has(u.csDate)) m.set(u.csDate, { cs: [], cw: [] });
          m.get(u.csDate)!.cs.push({ label: `${b.name} ${formatUnit(u.floor, u.unitNo)}`, time: u.csTime ?? "" });
        }
        if (u.cwDate && (u.cwStatus === "scheduled" || u.cwStatus === "in_progress" || u.cwStatus === "completed")) {
          if (!m.has(u.cwDate)) m.set(u.cwDate, { cs: [], cw: [] });
          m.get(u.cwDate)!.cw.push({
            label:    `${b.name} ${formatUnit(u.floor, u.unitNo)}`,
            time:     u.cwTime ?? "",
            assignee: u.cwAssignee,
          });
        }
      });
    });
    return m;
  }, [state.blocks]);

  // Blocked dates indexed by DD/MM/YY
  const blockedByDay = useMemo(() => {
    const m = new Map<string, BlockedDate>();
    state.blockedDates.forEach((bd) => m.set(bd.date, bd));
    return m;
  }, [state.blockedDates]);

  const selDmy    = toDmy(selected);
  const selAppts  = apptsByDay.get(selDmy) ?? { cs: [], cw: [] };
  const selBlocked = blockedByDay.get(selDmy);
  const weeks     = useMemo(() => buildCalendar(year, month), [year, month]);
  const slots     = useMemo(() => hourlySlots(), []);

  const prevMonth = () => { if (month === 0) { setYear((y) => y - 1); setMonth(11); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear((y) => y + 1); setMonth(0); } else setMonth((m) => m + 1); };

  const addBlock = () => {
    if (!blockReason.trim()) return toast.error("Enter a reason for the blockout");
    if (selBlocked) return toast.error("Date already blocked — remove existing blockout first");
    dispatch({
      type: "ADD_BLOCKED_DATE",
      date: { id: `bd-${Date.now()}`, date: selDmy, reason: blockReason.trim(), type: blockType },
    });
    setBlockReason("");
    toast.success(`${selDmy} blocked for ${blockType === "both" ? "CS & CW" : blockType}`);
  };

  const removeBlock = (id: string) => {
    dispatch({ type: "REMOVE_BLOCKED_DATE", id });
    toast.success("Blockout removed");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
      {/* ── Monthly calendar ── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center justify-between text-base">
            <Button size="icon" variant="ghost" onClick={prevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>{new Date(year, month).toLocaleString("en-SG", { month: "long", year: "numeric" })}</span>
            <Button size="icon" variant="ghost" onClick={nextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Weekday headers */}
          <div className="mb-1 grid grid-cols-7 text-center">
            {DOW.map((d) => (
              <div key={d} className="py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px">
            {weeks.flat().map((date, i) => {
              if (!date) return <div key={i} className="min-h-[62px]" />;
              const dmy      = toDmy(date);
              const appts    = apptsByDay.get(dmy);
              const blocked  = blockedByDay.get(dmy);
              const isToday  = date.getTime() === today.getTime();
              const isSel    = selDmy === dmy;
              const isPast   = date < today;

              return (
                <button
                  key={i}
                  onClick={() => setSelected(new Date(date))}
                  className={`flex min-h-[62px] flex-col rounded-lg p-1 text-left transition hover:bg-muted
                    ${isSel ? "ring-2 ring-sky-500 bg-sky-50" : ""}
                    ${isPast ? "opacity-55" : ""}
                    ${blocked && !isSel ? "bg-red-50" : ""}
                  `}
                >
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold
                    ${isToday ? "bg-sky-500 text-white" : isSel ? "text-sky-700" : ""}
                  `}>
                    {date.getDate()}
                  </span>
                  <div className="mt-0.5 space-y-0.5">
                    {appts?.cs.length ? (
                      <div className="rounded bg-sky-100 px-1 text-[9px] font-medium text-sky-700">
                        {appts.cs.length} CS
                      </div>
                    ) : null}
                    {appts?.cw.length ? (
                      <div className="rounded bg-orange-100 px-1 text-[9px] font-medium text-orange-700">
                        {appts.cw.length} CW
                      </div>
                    ) : null}
                    {blocked && (
                      <div className={`rounded px-1 text-[8px] font-bold ${
                        blocked.type === "CS"  ? "bg-sky-200 text-sky-900"
                        : blocked.type === "CW" ? "bg-orange-200 text-orange-900"
                        : "bg-red-200 text-red-900"
                      }`}>
                        {blocked.type === "both" ? "BLOCKED" : `${blocked.type} BLK`}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-3 flex flex-wrap gap-4 border-t pt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[9px] font-medium text-sky-700">n CS</span>
              CS appointments
            </span>
            <span className="flex items-center gap-1.5">
              <span className="rounded bg-orange-100 px-1.5 py-0.5 text-[9px] font-medium text-orange-700">n CW</span>
              CW appointments
            </span>
            <span className="flex items-center gap-1.5">
              <span className="rounded bg-red-200 px-1.5 py-0.5 text-[9px] font-bold text-red-900">BLOCKED</span>
              Blocked date
            </span>
          </div>
        </CardContent>
      </Card>

      {/* ── Day detail panel ── */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {selected.toLocaleDateString("en-SG", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Blockout banner or form */}
            {selBlocked ? (
              <div className={`rounded-md border p-2.5 text-xs ${
                selBlocked.type === "CS"  ? "border-sky-400 bg-sky-50 text-sky-900"
                : selBlocked.type === "CW" ? "border-orange-400 bg-orange-50 text-orange-900"
                : "border-red-400 bg-red-50 text-red-900"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-semibold">
                    <Ban className="h-3.5 w-3.5" />
                    Blocked — {selBlocked.type === "both" ? "CS & CW" : selBlocked.type}
                  </div>
                  <button
                    className="rounded p-0.5 opacity-60 hover:opacity-100"
                    title="Remove blockout"
                    onClick={() => removeBlock(selBlocked.id)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                {selBlocked.reason && (
                  <p className="mt-1 text-muted-foreground">{selBlocked.reason}</p>
                )}
              </div>
            ) : (
              <div className="space-y-2 rounded-md border bg-muted/30 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Block this date</p>
                <div>
                  <Label className="text-xs">Block for</Label>
                  <Select value={blockType} onValueChange={(v) => setBlockType(v as typeof blockType)}>
                    <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="both">CS &amp; CW (both)</SelectItem>
                      <SelectItem value="CS">CS only</SelectItem>
                      <SelectItem value="CW">CW only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Reason</Label>
                  <Input
                    value={blockReason}
                    onChange={(e) => setBlockReason(e.target.value)}
                    placeholder="e.g. Public holiday, site inspection…"
                    className="mt-1 h-7 text-xs"
                    onKeyDown={(e) => e.key === "Enter" && addBlock()}
                  />
                </div>
                <Button size="sm" variant="destructive" className="w-full text-xs" onClick={addBlock}>
                  <Ban className="mr-1.5 h-3 w-3" /> Block Date
                </Button>
              </div>
            )}

            {/* Day timetable */}
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Day Timetable
              </p>
              <div className="overflow-hidden rounded-md border">
                {slots.map((slot) => {
                  const csHere = selAppts.cs.filter(
                    (a) => a.time && rangeOverlaps(parseRange(a.time), [slot.start, slot.end]),
                  );
                  const cwHere = selAppts.cw.filter(
                    (a) => a.time && rangeOverlaps(parseRange(a.time), [slot.start, slot.end]),
                  );
                  const hasContent = csHere.length > 0 || cwHere.length > 0;
                  return (
                    <div
                      key={slot.label}
                      className={`flex min-h-[28px] gap-2 border-b px-2 py-1 last:border-0 ${hasContent ? "bg-muted/20" : ""}`}
                    >
                      <span className="w-12 shrink-0 font-mono text-[10px] leading-5 text-muted-foreground">
                        {slot.label}
                      </span>
                      <div className="flex-1 space-y-0.5">
                        {csHere.map((a, idx) => (
                          <div key={idx} className="flex items-center gap-1 rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-800">
                            <CalendarClock className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{a.label}</span>
                          </div>
                        ))}
                        {cwHere.map((a, idx) => (
                          <div key={idx} className="flex items-center gap-1 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-800">
                            <Zap className="h-2.5 w-2.5 shrink-0" />
                            <span className="truncate">{a.label}</span>
                            {a.assignee && (
                              <span className="ml-0.5 shrink-0 opacity-70">· {a.assignee}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              {selAppts.cs.length === 0 && selAppts.cw.length === 0 && !selBlocked && (
                <p className="mt-2 text-center text-xs text-muted-foreground">No appointments on this day.</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* All blocked dates list */}
        {state.blockedDates.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">All Blocked Dates</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {[...state.blockedDates]
                  .sort((a, b) => parseDmyMs(a.date) - parseDmyMs(b.date))
                  .map((bd) => (
                    <div
                      key={bd.id}
                      className="flex items-center justify-between rounded-md border px-2.5 py-1.5 text-xs"
                    >
                      <div className="min-w-0">
                        <span className="font-medium">{bd.date}</span>
                        <span className={`ml-2 rounded px-1 py-0.5 text-[9px] font-bold ${
                          bd.type === "CS"  ? "bg-sky-100 text-sky-800"
                          : bd.type === "CW" ? "bg-orange-100 text-orange-800"
                          : "bg-red-100 text-red-800"
                        }`}>
                          {bd.type === "both" ? "CS & CW" : bd.type}
                        </span>
                        {bd.reason && (
                          <span className="ml-2 truncate text-muted-foreground">{bd.reason}</span>
                        )}
                      </div>
                      <button
                        className="ml-2 shrink-0 rounded p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={() => removeBlock(bd.id)}
                        title="Remove blockout"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
