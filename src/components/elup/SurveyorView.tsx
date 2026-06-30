import { useMemo, useState, useEffect, useRef } from "react";
import { useElup, useActiveBlock } from "@/lib/elup/store";
import { useApp } from "@/lib/app-context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SignatureCanvas } from "./SignatureCanvas";
import { BlockChart } from "./BlockChart";
import { CSScheduler } from "./CSScheduler";
import { PrecinctFilter } from "./PrecinctFilter";
import { UnitDrawer } from "./UnitDrawer";
import { PhotoUploader } from "./PhotoUploader";
import { syncUnit, logActivity, uploadSignatureToStorage, clearCsDraft, uploadSignatureFile } from "@/lib/firebase";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  FileText, MapPin, Search, ClipboardCheck, FileSignature,
  CalendarClock, ArrowRight, Zap, Upload, Loader2, X, Info,
} from "lucide-react";
import { InformationTab } from "./InformationTab";
import { toast } from "sonner";
import type {
  GateType, DoorFrameCondition, MainDoorType, ElectDBBoxLocation,
  WallCondition, CeilingCondition,
} from "@/lib/elup/types";
import { HOUR_OPTIONS, parseRange, hourlySlots, rangeOverlaps } from "@/lib/elup/slots";

function todayDmy() {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

export function SurveyorView() {
  const { dispatch } = useElup();
  const block = useActiveBlock();
  const [search, setSearch] = useState("");
  const [selectedUnit, setSelectedUnit] = useState<string | null>(null);
  const [drawerUnit, setDrawerUnit] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("survey");

  const filtered = Object.entries(block.units)
    .filter(([, u]) => u.exists)
    .filter(([, u]) => !search || u.unitNo.includes(search) || String(u.floor) === search)
    .slice(0, 12);

  const today = todayDmy();
  const todaysAppts = useMemo(
    () =>
      Object.entries(block.units)
        .filter(([, u]) => u.exists && u.csStatus === "scheduled" && u.csDate === today)
        .sort(([, a], [, b]) => (a.csTime ?? "").localeCompare(b.csTime ?? "")),
    [block.units, today],
  );

  // Fallback: if none today, show next upcoming (for demo data dated in 2026)
  const upcomingAppts = useMemo(() => {
    if (todaysAppts.length > 0) return [];
    return Object.entries(block.units)
      .filter(([, u]) => u.exists && u.csStatus === "scheduled")
      .sort(([, a], [, b]) => (a.csDate ?? "").localeCompare(b.csDate ?? ""))
      .slice(0, 5);
  }, [block.units, todaysAppts.length]);

  const activeUnit = selectedUnit ? block.units[selectedUnit] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 py-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <MapPin className="h-4 w-4 text-sky-500" />
        <span className="font-medium text-foreground">{block.name}</span>
        <span>·</span>
        <span>{block.precinct}</span>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="survey">Survey</TabsTrigger>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="optout">Opt-Out</TabsTrigger>
          <TabsTrigger value="chart">Chart</TabsTrigger>
          <TabsTrigger value="info" className="flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Info</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="survey" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4" /> Find Unit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Search by unit # or floor…" value={search} onChange={(e) => setSearch(e.target.value)} />

              {/* My appointments today */}
              <div className="rounded-lg border bg-sky-50/40 dark:bg-sky-950/20 p-3">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-sky-700">
                  <CalendarClock className="h-4 w-4" />
                  My Appointments Today
                  <Badge variant="outline" className="ml-auto border-sky-400 bg-background dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 text-xs">
                    {today}
                  </Badge>
                </div>
                {todaysAppts.length === 0 && upcomingAppts.length === 0 && (
                  <div className="rounded-md border border-dashed bg-background/60 dark:bg-muted/20 p-3 text-center text-sm text-muted-foreground">
                    No appointments scheduled for today.
                  </div>
                )}
                {(todaysAppts.length > 0 ? todaysAppts : upcomingAppts).map(([key, u]) => (
                  <div
                    key={key}
                    className="mt-1 rounded-md border bg-card px-2.5 py-2 text-sm"
                  >
                    {/* Top row: time badge + unit number */}
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] font-bold leading-snug sm:text-sm">{block.name} #{u.floor}-{u.unitNo}</div>
                        <div className="mt-0.5 truncate text-[10px] text-muted-foreground sm:text-xs">Lobby {u.lobby}{u.csAssignee ? ` · ${u.csAssignee}` : ""}</div>
                      </div>
                      <span className="shrink-0 rounded bg-sky-100 dark:bg-sky-900/50 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300 sm:text-xs">
                        {u.csTime ?? "—"}
                      </span>
                    </div>
                    {/* Bottom row: date + button (button full-width on mobile) */}
                    <div className="mt-1.5 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="text-[10px] text-muted-foreground sm:text-xs">{u.csDate}</span>
                      <Button
                        size="sm"
                        className="h-7 w-full bg-sky-600 hover:bg-sky-700 text-[10px] sm:h-7 sm:w-auto sm:px-3 sm:text-xs"
                        onClick={() => {
                          setSelectedUnit(key);
                          setTimeout(
                            () => document.getElementById("cs-survey-form")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                            50,
                          );
                        }}
                      >
                        Conduct Survey <ArrowRight className="ml-1 h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
                {todaysAppts.length === 0 && upcomingAppts.length > 0 && (
                  <p className="mt-2 text-xs italic text-muted-foreground">
                    Showing next upcoming appointments (no items dated today).
                  </p>
                )}
              </div>

            </CardContent>
          </Card>

          {activeUnit && selectedUnit && (
            <div id="cs-survey-form">
              <SurveyForm
                key={selectedUnit}
                unitKey={selectedUnit}
                onComplete={(patch) => {
                  dispatch({
                    type: "UPDATE_UNIT",
                    blockId: block.id,
                    unitKey: selectedUnit,
                    patch: { csStatus: "completed", ...patch },
                  });
                  toast.success(`Survey submitted for #${activeUnit.floor}-${activeUnit.unitNo}`, {
                    description: "Form cleared. Ready for the next unit.",
                  });
                  setSelectedUnit(null);
                }}
              />
            </div>
          )}
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <CSScheduler
            onConductSurvey={(blockId, unitKey) => {
              dispatch({ type: "SET_BLOCK", blockId });
              setSelectedUnit(unitKey);
              setActiveTab("survey");
              setTimeout(() =>
                document.getElementById("cs-survey-form")?.scrollIntoView({ behavior: "smooth", block: "start" }),
                100,
              );
            }}
          />
        </TabsContent>

        <TabsContent value="optout" className="mt-4">
          <OptOutForm onSubmit={(blockId, unitKey, reason, signature) => {
            dispatch({ type: "REQUEST_OPT_OUT", blockId, unitKey, reason, signature });
            toast.success("Opt-out submitted to HDB Officer for approval");
          }} />
        </TabsContent>

        <TabsContent value="chart" className="mt-4 space-y-4">
          <PrecinctFilter />
          <BlockChart onCellClick={setDrawerUnit} />
        </TabsContent>

        <TabsContent value="info" className="mt-4">
          <InformationTab />
        </TabsContent>
      </Tabs>

      <UnitDrawer unitKey={drawerUnit} onClose={() => setDrawerUnit(null)} />
    </div>
  );
}

// ---- Checkbox group helper ----
function CheckGroup<T extends string>({
  label, options, value, onChange,
}: {
  label: string;
  options: { v: T; l: string }[];
  value: T[];
  onChange: (next: T[]) => void;
}) {
  const toggle = (v: T) =>
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
        {options.map((o) => (
          <label
            key={o.v}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition ${
              value.includes(o.v) ? "border-sky-500 bg-sky-50" : "hover:bg-muted"
            }`}
          >
            <Checkbox
              checked={value.includes(o.v)}
              onCheckedChange={() => toggle(o.v)}
            />
            <span>{o.l}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function SurveyForm({ unitKey, onComplete }: { unitKey: string; onComplete: (patch: any) => void }) {
  const { state } = useElup();
  const { state: appState } = useApp();
  const block = useActiveBlock();
  const u = block.units[unitKey];
  const hidden = state.hiddenSurveyGroups;
  const customFields = state.customSurveyFields;
  const draft = u.csDraft ?? null;
  const [ownerName, setOwnerName] = useState(draft?.ownerName ?? u.resident?.name ?? "");
  const [ownerPhone, setOwnerPhone] = useState(draft?.ownerPhone ?? u.resident?.phone ?? "");
  const [surveyDateTime, setSurveyDateTime] = useState(() => {
    if (draft?.surveyDateTime) return draft.surveyDateTime;
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [amps, setAmps] = useState(draft?.amps ?? 30);
  const [condition, setCondition] = useState<"good" | "fair" | "poor">(draft?.condition ?? "fair");
  const [notes, setNotes] = useState(draft?.notes ?? "");
  const [photos, setPhotos] = useState<string[]>(draft?.photos ?? []);
  const [gateTypes, setGateTypes] = useState<GateType[]>((draft?.gateTypes ?? []) as GateType[]);
  const [doorFrame, setDoorFrame] = useState<DoorFrameCondition[]>((draft?.doorFrame ?? []) as DoorFrameCondition[]);
  const [mainDoor, setMainDoor] = useState<MainDoorType[]>((draft?.mainDoor ?? []) as MainDoorType[]);
  const [electDBBox, setElectDBBox] = useState<ElectDBBoxLocation[]>((draft?.electDBBox ?? []) as ElectDBBoxLocation[]);
  const [wall, setWall] = useState<WallCondition[]>((draft?.wall ?? []) as WallCondition[]);
  const [ceiling, setCeiling] = useState<CeilingCondition[]>((draft?.ceiling ?? []) as CeilingCondition[]);
  const [scheduledCableWorkDate, setScheduledCableWorkDate] = useState(draft?.scheduledCableWorkDate ?? "");
  const [scheduledCableWorkTime, setScheduledCableWorkTime] = useState(draft?.scheduledCableWorkTime ?? "09:00-10:00");
  const [scheduledCableWorkTechnician, setScheduledCableWorkTechnician] = useState(draft?.scheduledCableWorkTechnician ?? "");
  const [residentSignature, setResidentSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [customValues, setCustomValues] = useState<Record<string, string | boolean | string[]>>(draft?.customValues ?? {});
  const _mounted = useRef(false);
  useEffect(() => {
    if (!_mounted.current) { _mounted.current = true; return; }
    const t = setTimeout(() => {
      syncUnit(block.precinctId, block.id, unitKey, {
        csDraft: { ownerName, ownerPhone, surveyDateTime, amps, condition, notes, photos,
          gateTypes, doorFrame, mainDoor, electDBBox, wall, ceiling,
          scheduledCableWorkDate, scheduledCableWorkTime, scheduledCableWorkTechnician, customValues },
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(t);
  }, [ownerName, ownerPhone, surveyDateTime, amps, condition, notes, photos,
    gateTypes, doorFrame, mainDoor, electDBBox, wall, ceiling,
    scheduledCableWorkDate, scheduledCableWorkTime, scheduledCableWorkTechnician, customValues]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span>#{u.floor}-{u.unitNo}</span>
          <Badge variant="outline" className="bg-sky-50 text-sky-700">Condition Survey</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Owner name</Label>
            <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="e.g. Tan Wei Ming" />
          </div>
          <div>
            <Label>Phone number</Label>
            <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="9123 4567" />
          </div>
        </div>

        <div>
          <Label>Date &amp; time of survey</Label>
          <Input type="datetime-local" value={surveyDateTime} onChange={(e) => setSurveyDateTime(e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Existing load (A)</Label>
            <Input type="number" value={amps} onChange={(e) => setAmps(+e.target.value)} />
          </div>
          <div>
            <Label>Infrastructure</Label>
            <Select value={condition} onValueChange={(v) => setCondition(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="poor">Poor — requires action</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {!hidden.includes("gate") && (
          <CheckGroup<GateType>
            label="Gate type"
            value={gateTypes}
            onChange={setGateTypes}
            options={[
              { v: "alum", l: "Aluminium" },
              { v: "mild_steel", l: "Mild steel" },
              { v: "wrought", l: "Wrought iron" },
              { v: "ss", l: "Stainless steel" },
            ]}
          />
        )}

        {!hidden.includes("doorFrame") && (
          <CheckGroup<DoorFrameCondition>
            label="Doorframe"
            value={doorFrame}
            onChange={setDoorFrame}
            options={[
              { v: "crack", l: "Crack" },
              { v: "chipped", l: "Chipped" },
              { v: "scratch", l: "Scratch" },
              { v: "warped", l: "Warped" },
              { v: "ok", l: "OK" },
            ]}
          />
        )}

        {!hidden.includes("mainDoor") && (
          <CheckGroup<MainDoorType>
            label="Main door"
            value={mainDoor}
            onChange={setMainDoor}
            options={[
              { v: "original", l: "Original" },
              { v: "replaced", l: "Replaced" },
              { v: "fire_rated", l: "Fire rated" },
            ]}
          />
        )}

        {!hidden.includes("electDBBox") && (
          <CheckGroup<ElectDBBoxLocation>
            label="Electrical DB box"
            value={electDBBox}
            onChange={setElectDBBox}
            options={[
              { v: "cornice", l: "Cornice" },
              { v: "false_ceiling", l: "False ceiling" },
              { v: "cabinet", l: "Cabinet" },
              { v: "obstruction", l: "Obstruction" },
            ]}
          />
        )}

        {!hidden.includes("wall") && (
          <CheckGroup<WallCondition>
            label="Wall"
            value={wall}
            onChange={setWall}
            options={[
              { v: "uneven", l: "Uneven" },
              { v: "plastered", l: "Plastered" },
              { v: "rockstone", l: "Rockstone" },
              { v: "wallpaper", l: "Wallpaper" },
            ]}
          />
        )}

        {!hidden.includes("ceiling") && (
          <CheckGroup<CeilingCondition>
            label="Ceiling"
            value={ceiling}
            onChange={setCeiling}
            options={[
              { v: "cornice", l: "Cornice" },
              { v: "false_ceiling", l: "False ceiling" },
              { v: "rockstone", l: "Rockstone" },
              { v: "wallpaper", l: "Wallpaper" },
            ]}
          />
        )}

        {customFields.map((f) => (
          <div key={f.id}>
            <Label>{f.label}</Label>
            {f.type === "checkbox" ? (
              <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs">
                <Checkbox
                  checked={!!customValues[f.id]}
                  onCheckedChange={(v) => setCustomValues({ ...customValues, [f.id]: !!v })}
                />
                <span>{f.label}</span>
              </label>
            ) : f.type === "checkbox_group" ? (
              <div className="mt-1 grid grid-cols-2 gap-1.5">
                {(f.options ?? []).map((opt) => {
                  const selected = ((customValues[f.id] as string[]) ?? []).includes(opt);
                  return (
                    <label
                      key={opt}
                      className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition ${
                        selected ? "border-sky-500 bg-sky-50" : "hover:bg-muted"
                      }`}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(v) => {
                          const cur = (customValues[f.id] as string[]) ?? [];
                          setCustomValues({
                            ...customValues,
                            [f.id]: v ? [...cur, opt] : cur.filter((x) => x !== opt),
                          });
                        }}
                      />
                      <span>{opt}</span>
                    </label>
                  );
                })}
              </div>
            ) : (
              <Input
                value={(customValues[f.id] as string) ?? ""}
                onChange={(e) => setCustomValues({ ...customValues, [f.id]: e.target.value })}
              />
            )}
          </div>
        ))}

        {!hidden.includes("scheduledCableWork") && (
          <div>
            <Label className="flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-orange-500" /> Schedule cable work
            </Label>
            <CableWorkScheduleDialog
              blockUnits={block.units}
              currentUnitKey={unitKey}
              date={scheduledCableWorkDate}
              time={scheduledCableWorkTime}
              onSave={(d, t, tech) => {
                setScheduledCableWorkDate(d);
                setScheduledCableWorkTime(t);
                setScheduledCableWorkTechnician(tech ?? "");
              }}
            />
          </div>
        )}


        <div>
          <Label>Notes</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Observations, tenant remarks…" />
        </div>

        <div>
          <Label>Photos ({photos.length})</Label>
          <div className="mt-1">
            <PhotoUploader
              photos={photos}
              onChange={setPhotos}
              pathPrefix={`photos/${block.precinct}/${block.id}/${unitKey}/cs`}
              accent="sky"
              columns={4}
            />
            <p className="mt-1 text-[10px] text-muted-foreground">JPG or PNG, uploaded to Firebase Storage.</p>
          </div>
        </div>

        <div>
          <Label className="flex items-center gap-1.5">
            <FileSignature className="h-3.5 w-3.5" /> Resident signature
          </Label>
          <SignatureCanvas onChange={setResidentSignature} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={() => toast.info("CS Form PDF generated")}>
            <FileText className="mr-1 h-4 w-4" /> CS Form
          </Button>
          <Button
            className="bg-sky-600 hover:bg-sky-700"
            disabled={!residentSignature || submitting}
            onClick={async () => {
              setSubmitting(true);
              try {
                const cwDmy = scheduledCableWorkDate
                  ? (() => {
                      const d = new Date(scheduledCableWorkDate);
                      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
                    })()
                  : undefined;
                let residentSigUrl = residentSignature;
                try {
                  residentSigUrl = await uploadSignatureToStorage(
                    residentSignature,
                    `surveys/${block.precinctId}/${block.id}/${unitKey}/resident`,
                  );
                } catch (e) {
                  console.warn("[cs] resident sig upload failed, using data URL", e);
                }
                const patch: any = {
                  resident: ownerName ? { name: ownerName, phone: ownerPhone } : undefined,
                  survey: {
                    existingLoadAmps: amps,
                    condition,
                    notes,
                    photos,
                    ownerName,
                    ownerPhone,
                    surveyDateTime,
                    gateTypes,
                    doorFrame,
                    mainDoor,
                    electDBBox,
                    wall,
                    ceiling,
                    scheduledCableWorkDate: cwDmy,
                    scheduledCableWorkTime: cwDmy ? scheduledCableWorkTime : undefined,
                    residentSignature: residentSigUrl,
                    custom: customValues,
                  },
                };
                if (cwDmy) {
                  patch.cwStatus = "scheduled";
                  patch.cwDate = cwDmy;
                  patch.cwTime = scheduledCableWorkTime;
                  if (scheduledCableWorkTechnician) patch.cwAssignee = scheduledCableWorkTechnician;
                }
                await syncUnit(block.precinctId, block.id, unitKey, {
                  blockId: block.id,
                  unitKey,
                  unitNo: u.unitNo,
                  floor: u.floor,
                  lobby: u.lobby,
                  csStatus: "completed",
                  ...patch,
                }).catch((e) => toast.error("Firestore sync failed", { description: String(e?.message ?? e) }));
                logActivity(
                  "CS_COMPLETED",
                  `Condition survey completed for Blk ${block.name} #${u.floor}-${u.unitNo}`,
                  appState.user?.username ?? "surveyor",
                  { blockId: block.id, unitKey, unitNo: u.unitNo, floor: u.floor, lobby: u.lobby },
                ).catch(() => {});
                onComplete(patch);
                clearCsDraft(block.precinctId, block.id, unitKey).catch(() => {});
              } finally {
                setSubmitting(false);
              }
            }}
          >
            <ClipboardCheck className="mr-1 h-4 w-4" />
            {submitting ? "Uploading..." : "Submit Survey"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function OptOutForm({ onSubmit }: { onSubmit: (blockId: string, unitKey: string, reason: string, sig: string) => void }) {
  const { state } = useElup();
  const [selPrecinct, setSelPrecinct] = useState("");
  const [selBlockId, setSelBlockId] = useState("");
  const [unitKey, setUnitKey] = useState("");
  const [reason, setReason] = useState("");
  const [signature, setSignature] = useState("");
  const [sigFileName, setSigFileName] = useState("");
  const [sigUploading, setSigUploading] = useState(false);
  const sigFileRef = useRef<HTMLInputElement>(null);

  const precincts = useMemo(
    () => Array.from(new Set(state.blocks.map((b) => b.precinct))).sort(),
    [state.blocks],
  );
  const blocksForPrecinct = useMemo(
    () => state.blocks.filter((b) => b.precinct === selPrecinct),
    [state.blocks, selPrecinct],
  );
  const selectedBlock = state.blocks.find((b) => b.id === selBlockId);
  const unitOpts = useMemo(
    () => selectedBlock
      ? Object.entries(selectedBlock.units).filter(([, u]) => u.exists && u.csStatus !== "opt_out")
      : [],
    [selectedBlock],
  );

  async function handleSigFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !selBlockId || !unitKey) return;
    e.target.value = "";
    setSigUploading(true);
    try {
      const url = await uploadSignatureFile(file, `signatures/optout/${selBlockId}/${unitKey}`);
      setSignature(url);
      setSigFileName(file.name);
    } catch (err: unknown) {
      toast.error("Upload failed", { description: String((err as Error)?.message ?? err) });
    } finally {
      setSigUploading(false);
    }
  }

  function clearSig() {
    setSignature("");
    setSigFileName("");
    if (sigFileRef.current) sigFileRef.current.value = "";
  }

  const isImage = signature && !sigFileName.toLowerCase().endsWith(".pdf");

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileSignature className="h-4 w-4" /> Resident Opt-Out Form
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label>Precinct</Label>
          <Select value={selPrecinct} onValueChange={(v) => { setSelPrecinct(v); setSelBlockId(""); setUnitKey(""); clearSig(); }}>
            <SelectTrigger><SelectValue placeholder="Select precinct" /></SelectTrigger>
            <SelectContent>
              {precincts.map((p) => (
                <SelectItem key={p} value={p}>{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Block</Label>
          <Select value={selBlockId} onValueChange={(v) => { setSelBlockId(v); setUnitKey(""); clearSig(); }} disabled={!selPrecinct}>
            <SelectTrigger><SelectValue placeholder="Select block" /></SelectTrigger>
            <SelectContent>
              {blocksForPrecinct.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Unit</Label>
          <Select value={unitKey} onValueChange={(v) => { setUnitKey(v); clearSig(); }} disabled={!selBlockId}>
            <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
            <SelectContent className="max-h-72">
              {unitOpts.map(([k, u]) => (
                <SelectItem key={k} value={k}>#{u.floor}-{u.unitNo} · Lby {u.lobby}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Reason for opting out</Label>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>

        <div>
          <Label>Resident signature</Label>
          <input
            ref={sigFileRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,application/pdf"
            className="hidden"
            onChange={handleSigFile}
          />
          {!signature ? (
            <button
              type="button"
              disabled={!unitKey || sigUploading}
              onClick={() => sigFileRef.current?.click()}
              className="mt-1 flex w-full cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border bg-muted/30 py-6 text-sm text-muted-foreground transition hover:border-primary/50 hover:bg-muted/50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {sigUploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="h-4 w-4" /> Click to upload signature image or PDF</>
              )}
            </button>
          ) : (
            <div className="mt-1 rounded-md border bg-muted/30 p-2">
              {isImage ? (
                <img
                  src={signature}
                  alt="Resident signature"
                  className="mx-auto max-h-28 max-w-full rounded bg-white object-contain"
                />
              ) : (
                <div className="flex items-center gap-2 px-2 py-1 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{sigFileName}</span>
                </div>
              )}
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  disabled={sigUploading}
                  onClick={() => sigFileRef.current?.click()}
                >
                  <Upload className="h-3 w-3" /> Replace
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-destructive hover:text-destructive"
                  onClick={clearSig}
                >
                  <X className="h-3 w-3" /> Remove
                </Button>
              </div>
            </div>
          )}
        </div>

        <Button
          className="w-full bg-yellow-500 hover:bg-yellow-600"
          disabled={!unitKey || !reason || !signature}
          onClick={() => {
            onSubmit(selBlockId, unitKey, reason, signature);
            setSelPrecinct(""); setSelBlockId(""); setUnitKey("");
            setReason(""); clearSig();
          }}
        >
          Submit Opt-Out for Approval
        </Button>
      </CardContent>
    </Card>
  );
}

interface CWBookedSlot {
  unitKey: string;
  date: string; // dmy
  time: string;
  assignee?: string;
  label: string;
}

function fmtDmy(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

function CableWorkScheduleDialog({
  blockUnits,
  currentUnitKey,
  date,
  time,
  onSave,
}: {
  blockUnits: Record<string, any>;
  currentUnitKey: string;
  date: string;
  time: string;
  onSave: (date: string, time: string, technician: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [d, setD] = useState(date);
  const [cwStart, setCwStart] = useState(() => {
    const tt = time || "09:00-10:00";
    return tt.includes("-") ? tt.split("-")[0] : "09:00";
  });
  const [cwEnd, setCwEnd] = useState(() => {
    const tt = time || "09:00-10:00";
    return tt.includes("-") ? tt.split("-")[1] : "10:00";
  });
  const t = `${cwStart}-${cwEnd}`;
  const [tech, setTech] = useState("");
  const { state } = useElup();
  const technicians = useMemo(
    () => state.accounts.filter((a) => a.role === "technician"),
    [state.accounts],
  );

  const bookedSlots: CWBookedSlot[] = useMemo(() => {
    return Object.entries(blockUnits)
      .filter(([k, u]: [string, any]) =>
        u.exists && u.cwStatus === "scheduled" && u.cwDate && u.cwTime && k !== currentUnitKey,
      )
      .map(([k, u]: [string, any]) => ({
        unitKey: k,
        date: u.cwDate,
        time: u.cwTime,
        assignee: u.cwAssignee,
        label: `#${u.floor}-${u.unitNo}`,
      }));
  }, [blockUnits, currentUnitKey]);

  const dayBookings = useMemo(() => {
    if (!d) return [];
    const dmy = fmtDmy(d);
    return bookedSlots
      .filter((s) => s.date === dmy)
      .sort((a, b) => parseRange(a.time)[0] - parseRange(b.time)[0]);
  }, [d, bookedSlots]);

  const sel = parseRange(t);
  const clash = dayBookings.some(
    (s) => s.assignee && tech && s.assignee === tech && rangeOverlaps(parseRange(s.time), sel),
  );
  const blockedDate = d
    ? state.blockedDates?.find(
        (b) => b.date === fmtDmy(d) && (b.type === "both" || b.type === "CW"),
      )
    : undefined;

  const summary = date
    ? `${fmtDmy(date)} · ${time}`
    : "Click to schedule cable work";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className={`mt-1 w-full justify-start ${
            date ? "border-orange-300 bg-orange-50 text-orange-900 hover:bg-orange-100" : ""
          }`}
        >
          <CalendarClock className="mr-2 h-4 w-4" />
          {summary}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule Cable Work</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="form">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="form">Details</TabsTrigger>
            <TabsTrigger value="timetable">
              Day Timetable {dayBookings.length > 0 && `(${dayBookings.length})`}
            </TabsTrigger>
          </TabsList>
          <TabsContent value="form" className="mt-3 space-y-3">
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={d}
                onChange={(e) => setD(e.target.value)}
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
                  value={cwStart}
                  onValueChange={(v) => {
                    setCwStart(v);
                    if (cwEnd <= v) setCwEnd(HOUR_OPTIONS.find((h) => h > v) ?? "18:00");
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
                <Select value={cwEnd} onValueChange={setCwEnd}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HOUR_OPTIONS.filter((h) => h > cwStart).map((h) => (
                      <SelectItem key={h} value={h}>{h}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="text-xs text-muted-foreground -mt-1">
              Selected: <span className="font-medium text-foreground">{t}</span>
              <span className="ml-2 text-muted-foreground">
                ({Math.round((parseRange(t)[1] - parseRange(t)[0]) / 60)}h)
              </span>
            </div>
            {clash && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                ⚠ Another CW appointment overlaps with this slot. Check the Day Timetable.
              </div>
            )}
            <div>
              <Label>Technician</Label>
              <Select value={tech} onValueChange={setTech}>
                <SelectTrigger><SelectValue placeholder="Select technician" /></SelectTrigger>
                <SelectContent>
                  {technicians.map((a) => (
                    <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
          <TabsContent value="timetable" className="mt-3">
            <CWDayTimetable
              date={d}
              bookings={dayBookings}
              currentTime={t}
              assignee={tech}
              onPick={(range) => {
                const [s, e] = range.split("-");
                if (s && e) { setCwStart(s); setCwEnd(e); }
              }}
            />
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={() => {
            const initStart = (time || "09:00-10:00").split("-")[0];
            const initEnd = (time || "09:00-10:00").split("-")[1] ?? "10:00";
            setD(date); setCwStart(initStart); setCwEnd(initEnd); setTech(""); setOpen(false);
          }}>
            Cancel
          </Button>
          <Button
            className="bg-orange-600 hover:bg-orange-700"
            disabled={!!blockedDate}
            onClick={() => {
              if (!d) {
                toast.error("Date is required");
                return;
              }
              if (blockedDate) {
                toast.error(
                  `This date is blocked for ${
                    blockedDate.type === "both" ? "CS & CW" : blockedDate.type
                  }${blockedDate.reason ? ` — ${blockedDate.reason}` : ""}`,
                );
                return;
              }
              onSave(d, t, tech);
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CWDayTimetable({
  date, bookings, currentTime, assignee, onPick,
}: {
  date: string;
  bookings: CWBookedSlot[];
  currentTime: string;
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
        <span>CW bookings on <span className="font-semibold text-foreground">{fmtDmy(date)}</span></span>
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
          else if (isInPickRange) rowBg = "bg-emerald-50/40";
          else if (isCurrent) rowBg = "bg-orange-50 ring-1 ring-orange-400";

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
                    <span
                      key={i}
                      className={`rounded border px-1.5 py-0.5 font-medium ${
                        isSameAssignee
                          ? "border-orange-300 bg-orange-100 text-orange-900"
                          : "border-border bg-muted text-muted-foreground"
                      }`}
                    >
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

