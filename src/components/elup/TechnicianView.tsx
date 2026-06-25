import { useMemo, useState } from "react";
import { useElup } from "@/lib/elup/store";
import { useApp } from "@/lib/app-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, MapPin, Wrench } from "lucide-react";
import { PhotoUploader } from "./PhotoUploader";
import { syncUnit, logActivity } from "@/lib/firebase";
import { toast } from "sonner";
import type { UnitData } from "@/lib/elup/types";

interface ApptEntry {
  blockId: string;
  blockName: string;
  precinct: string;
  precinctId: string;
  unitKey: string;
  u: UnitData;
}

function parseDmy(d?: string): number {
  if (!d) return 0;
  const [dd, mm, yy] = d.split(/[/.]/);
  return new Date(2000 + Number(yy), Number(mm) - 1, Number(dd)).getTime();
}

function todayDmy() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

function ApptRow({
  blockName, precinct, unitKey, u, active, onClick,
}: {
  blockId: string; blockName: string; precinct: string; precinctId: string;
  unitKey: string; u: UnitData; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`mt-1 w-full rounded-md border bg-white px-2.5 py-2 text-sm text-left transition ${
        active ? "border-orange-500 ring-1 ring-orange-200" : "hover:bg-muted"
      }`}
    >
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold leading-snug sm:text-sm">{blockName} #{u.floor}-{u.unitNo}</div>
          <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">{precinct} · Lobby {u.lobby}</div>
        </div>
        <span className="shrink-0 rounded bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-700 sm:text-xs">
          {u.cwTime ?? "—"}
        </span>
      </div>
      <div className="mt-0.5 text-[10px] text-muted-foreground sm:text-xs">{u.cwDate}</div>
    </button>
  );
}

export function TechnicianView() {
  const { state, dispatch } = useElup();
  const { state: appState } = useApp();
  const [active, setActive] = useState<{ blockId: string; unitKey: string } | null>(null);
  const [conductPrecinct, setConductPrecinct] = useState("");
  const [conductBlockId, setConductBlockId] = useState("");
  const [conductUnitKey, setConductUnitKey] = useState("");

  const techName = appState.user?.displayName ?? appState.user?.username ?? "Technician";
  const today = todayDmy();

  // All scheduled CW appointments across ALL blocks (assigned to this technician only)
  const allScheduled = useMemo<ApptEntry[]>(() => {
    return state.blocks.flatMap((b) =>
      Object.entries(b.units)
        .filter(([, u]) => u.exists && u.cwStatus === "scheduled" && u.cwDate && u.cwAssignee === techName)
        .map(([unitKey, u]) => ({
          blockId: b.id,
          blockName: b.name,
          precinct: b.precinct,
          precinctId: b.precinctId,
          unitKey,
          u,
        }))
    ).sort((a, b) => parseDmy(a.u.cwDate) - parseDmy(b.u.cwDate));
  }, [state.blocks]);

  const todaysAppts = useMemo(
    () => allScheduled.filter((a) => a.u.cwDate === today),
    [allScheduled, today],
  );

  const [weekOffset, setWeekOffset] = useState(0);

  const weekRange = useMemo(() => {
    const now = new Date();
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setHours(0, 0, 0, 0);
    monday.setDate(now.getDate() - (day - 1) + weekOffset * 7);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { monday, sunday };
  }, [weekOffset]);

  const upcomingAppts = useMemo(() => {
    const { monday, sunday } = weekRange;
    const items = allScheduled.filter((a) => {
      const t = parseDmy(a.u.cwDate);
      return t >= monday.getTime() && t <= sunday.getTime();
    });
    const fmt = (d: Date) =>
      d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    const label = `${fmt(monday)} – ${fmt(sunday)} ${sunday.getFullYear()}`;
    return { items, label };
  }, [allScheduled, weekRange]);

  // Emergency conduct CW — cascading selects
  const conductPrecincts = useMemo(
    () => Array.from(new Set(state.blocks.map((b) => b.precinct))).sort(),
    [state.blocks],
  );
  const conductBlocksForPrecinct = useMemo(
    () => state.blocks.filter((b) => b.precinct === conductPrecinct),
    [state.blocks, conductPrecinct],
  );
  const conductBlock = state.blocks.find((b) => b.id === conductBlockId);
  const conductUnits = useMemo(
    () =>
      conductBlock
        ? Object.entries(conductBlock.units).filter(
            ([, u]) => u.exists && u.csStatus === "completed" && u.cwStatus !== "completed",
          )
        : [],
    [conductBlock],
  );

  const isActive = (blockId: string, unitKey: string) =>
    active?.blockId === blockId && active?.unitKey === unitKey;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 text-orange-500" />
        <span className="font-medium text-foreground">{techName}</span>
        <span>·</span>
        <span>CW Technician</span>
      </div>

      {/* ── Today's appointments ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarClock className="h-3.5 w-3.5 text-orange-500" />
            My CW Appointments Today
            <Badge variant="outline" className="ml-auto border-orange-400 bg-white text-orange-700 text-xs">
              {today}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {todaysAppts.length === 0 ? (
            <div className="rounded-md border border-dashed bg-muted/30 p-3 text-center text-sm text-muted-foreground">
              No CW appointments scheduled for today.
            </div>
          ) : (
            todaysAppts.map((a) => (
              <ApptRow
                key={`${a.blockId}::${a.unitKey}`}
                {...a}
                active={isActive(a.blockId, a.unitKey)}
                onClick={() => setActive({ blockId: a.blockId, unitKey: a.unitKey })}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Weekly CW appointments ───────────────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-3.5 w-3.5 text-orange-500" />
            CW Appointments
            {weekOffset === 0 && (
              <Badge variant="outline" className="text-[10px] border-orange-300 text-orange-700">This week</Badge>
            )}
            <Badge className="ml-auto bg-orange-500 hover:bg-orange-500">{upcomingAppts.items.length}</Badge>
          </CardTitle>
          {/* Week navigator */}
          <div className="mt-2 flex items-center justify-between rounded-md border bg-muted/20 px-3 py-1.5">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setWeekOffset((o) => o - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs font-medium text-muted-foreground">{upcomingAppts.label}</span>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={() => setWeekOffset((o) => o + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {upcomingAppts.items.length === 0 ? (
            <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              No CW appointments this week
            </p>
          ) : (
            upcomingAppts.items.map((a) => (
              <ApptRow
                key={`${a.blockId}::${a.unitKey}`}
                {...a}
                active={isActive(a.blockId, a.unitKey)}
                onClick={() => setActive({ blockId: a.blockId, unitKey: a.unitKey })}
              />
            ))
          )}
        </CardContent>
      </Card>

      {/* ── Work logger (for scheduled appointments) ─────── */}
      {active && (
        <WorkLogger
          key={`${active.blockId}::${active.unitKey}`}
          blockId={active.blockId}
          unitKey={active.unitKey}
          techName={techName}
          onComplete={(patch) => {
            dispatch({
              type: "UPDATE_UNIT",
              blockId: active.blockId,
              unitKey: active.unitKey,
              patch: { cwStatus: "completed", ...patch },
            });
            toast.success("Cable work logged and marked complete");
            setActive(null);
          }}
        />
      )}

      {/* ── Conduct CW ─────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Wrench className="h-4 w-4 text-orange-500" /> Conduct CW
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Precinct</Label>
            <Select
              value={conductPrecinct}
              onValueChange={(v) => { setConductPrecinct(v); setConductBlockId(""); setConductUnitKey(""); }}
            >
              <SelectTrigger><SelectValue placeholder="Select precinct" /></SelectTrigger>
              <SelectContent>
                {conductPrecincts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Block</Label>
            <Select
              value={conductBlockId}
              onValueChange={(v) => { setConductBlockId(v); setConductUnitKey(""); }}
              disabled={!conductPrecinct}
            >
              <SelectTrigger><SelectValue placeholder="Select block" /></SelectTrigger>
              <SelectContent>
                {conductBlocksForPrecinct.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Unit</Label>
            <Select value={conductUnitKey} onValueChange={setConductUnitKey} disabled={!conductBlockId}>
              <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {conductUnits.map(([k, u]) => (
                  <SelectItem key={k} value={k}>
                    #{(u as UnitData).floor}-{(u as UnitData).unitNo} · Lby {(u as UnitData).lobby}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {conductBlockId && conductUnitKey && (
            <WorkLogger
              key={`emergency::${conductBlockId}::${conductUnitKey}`}
              blockId={conductBlockId}
              unitKey={conductUnitKey}
              techName={techName}
              emergency
              onComplete={(patch) => {
                dispatch({
                  type: "UPDATE_UNIT",
                  blockId: conductBlockId,
                  unitKey: conductUnitKey,
                  patch: { cwStatus: "completed", ...patch },
                });
                toast.success("Cable work completed");
                setConductPrecinct("");
                setConductBlockId("");
                setConductUnitKey("");
              }}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function WorkLogger({
  blockId, unitKey, techName, emergency, onComplete,
}: {
  blockId: string;
  unitKey: string;
  techName: string;
  emergency?: boolean;
  onComplete: (patch: any) => void;
}) {
  const { state } = useElup();
  const block = state.blocks.find((b) => b.id === blockId);
  const u = block?.units[unitKey];
  const [photos, setPhotos] = useState<string[]>([]);
  const [notes, setNotes] = useState("");

  if (!block || !u) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>{block.name} #{u.floor}-{u.unitNo}</span>
          <Badge className={emergency ? "bg-amber-500 hover:bg-amber-500" : "bg-orange-500 hover:bg-orange-500"}>
            {emergency ? "Unscheduled CW" : "Logging"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Installation photos ({photos.length})</Label>
          <div className="mt-2">
            <PhotoUploader
              photos={photos}
              onChange={setPhotos}
              pathPrefix={`photos/${block.precinct}/${block.id}/${unitKey}/cw`}
              accent="orange"
              columns={3}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">JPG or PNG, uploaded to Firebase Storage.</p>
          </div>
        </div>
        <div>
          <Label>Installation notes</Label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tests, deviations, tenant remarks…"
          />
        </div>
        <Button
          className="w-full bg-orange-600 hover:bg-orange-700"
          disabled={photos.length === 0}
          onClick={() => {
            const patch = { cableWork: { technician: techName, photos, notes } };
            syncUnit(block.precinctId, block.id, unitKey, {
              blockId: block.id,
              unitKey,
              unitNo: u.unitNo,
              floor: u.floor,
              lobby: u.lobby,
              cwStatus: "completed",
              ...patch,
            }).catch((e) => toast.error("Firestore sync failed", { description: String(e?.message ?? e) }));
            logActivity(
              "CW_COMPLETED",
              `Cable work completed for ${block.name} #${u.floor}-${u.unitNo}`,
              techName,
              { blockId: block.id, unitKey, unitNo: u.unitNo, floor: u.floor, lobby: u.lobby },
            ).catch(() => {});
            onComplete(patch);
          }}
        >
          <CheckCircle2 className="mr-2 h-4 w-4" /> Mark Completed
        </Button>
      </CardContent>
    </Card>
  );
}
