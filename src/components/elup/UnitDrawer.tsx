import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useElup, useActiveBlock } from "@/lib/elup/store";
import {
  CalendarDays, Camera, Download, FileSignature, BellRing, CalendarPlus, Trash2,
  Phone, User, Wrench, Zap, ImageOff, Flag, Pencil, ChevronLeft, ChevronRight,
  X, Upload, CheckCircle2, FileText, History,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { TIME_SLOTS } from "@/lib/elup/slots";
import { PhotoUploader } from "./PhotoUploader";
import { DocumentUploader } from "./DocumentUploader";
import type {
  UnitData, GateType, DoorFrameCondition, MainDoorType,
  ElectDBBoxLocation, WallCondition, CeilingCondition, CustomSurveyField, UnitActivityEntry,
} from "@/lib/elup/types";

function activityLabel(type: UnitActivityEntry["type"]): string {
  const map: Record<UnitActivityEntry["type"], string> = {
    cs_scheduled:      "CS Scheduled",
    cs_cancelled:      "CS Cancelled",
    cs_completed:      "CS Completed",
    cw_scheduled:      "CW Scheduled",
    cw_cancelled:      "CW Cancelled",
    cw_completed:      "CW Completed",
    opt_out_requested: "Opt-Out Requested",
    opt_out_approved:  "Opt-Out Approved",
    opt_out_reverted:  "Opt-Out Reverted",
    cs_reminder_sent:  "CS Reminder Sent",
  };
  return map[type] ?? type;
}

function activityStyle(type: UnitActivityEntry["type"]): string {
  if (type === "cs_scheduled" || type === "cs_completed")
    return "border-sky-200 bg-sky-50 text-sky-900";
  if (type === "cw_scheduled" || type === "cw_completed")
    return "border-orange-200 bg-orange-50 text-orange-900";
  if (type === "cs_cancelled" || type === "cw_cancelled")
    return "border-red-200 bg-red-50 text-red-900";
  if (type === "cs_reminder_sent")
    return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-yellow-200 bg-yellow-50 text-yellow-900";
}

interface Props {
  unitKey: string | null;
  onClose: () => void;
  readOnly?: boolean;
}

function fmtDmy(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

function dmyToIso(d?: string): string {
  if (!d) return "";
  const [dd, mm, yy] = d.split(/[/.]/);
  return `20${yy}-${mm}-${dd}`;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function CsReminderSection({
  u, blockId, unitKey, readOnly,
}: { u: import("@/lib/elup/types").UnitData; blockId: string; unitKey: string; readOnly: boolean }) {
  const { dispatch } = useElup();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");

  const allReminders: string[] = [
    ...(u.csReminder1 ? [u.csReminder1] : []),
    ...(u.csReminder2 ? [u.csReminder2] : []),
    ...(u.csReminders ?? []),
  ];
  const nextNum = allReminders.length + 1;

  return (
    <>
      {allReminders.length === 0 ? (
        <p className="text-xs text-muted-foreground">No reminders sent yet.</p>
      ) : (
        <div className="space-y-1 mb-2">
          {allReminders.map((d, i) => (
            <div key={i} className="flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900">
              <BellRing className="h-3 w-3 shrink-0" />
              <span className="font-medium">{ordinal(i + 1)} Reminder</span>
              <span className="ml-auto">{d}</span>
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs">
              <BellRing className="h-3 w-3" />
              Send CS Reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Send CS Reminder</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <p className="text-sm text-muted-foreground">
                This will log the <span className="font-semibold text-foreground">{ordinal(nextNum)} reminder</span> for this unit in the History Log.
              </p>
              <div>
                <Label>Reminder Date</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpen(false); setDate(""); }}>Cancel</Button>
              <Button
                disabled={!date}
                onClick={() => {
                  dispatch({ type: "SEND_CS_REMINDER", blockId, unitKey, date: fmtDmy(date), notes: `${ordinal(nextNum)} reminder` });
                  toast.success(`${ordinal(nextNum)} CS reminder logged`);
                  setDate("");
                  setOpen(false);
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export function UnitDrawer({ unitKey, onClose, readOnly = false }: Props) {
  const { state, dispatch } = useElup();
  const customSurveyFields: CustomSurveyField[] = state.customSurveyFields;
  const block = useActiveBlock();
  const u = unitKey ? block.units[unitKey] : null;
  const isCS = readOnly ? true : state.chartView === "CS";
  const isManager = state.role === "manager";

  const [lightbox, setLightbox] = useState<{ urls: string[]; idx: number; bgWhite?: boolean } | null>(null);

  const openLightbox = (urls: string[], idx: number) => setLightbox({ urls, idx });
  const closeLightbox = () => setLightbox(null);
  const prevPhoto = () => setLightbox((l) => l ? { ...l, idx: Math.max(0, l.idx - 1) } : l);
  const nextPhoto = () => setLightbox((l) => l ? { ...l, idx: Math.min(l.urls.length - 1, l.idx + 1) } : l);

  function generatePdf() {
    if (!u || !unitKey) return;
    const surveyRows = u.survey ? [
      u.survey.ownerName ? `<tr><td>Owner</td><td>${u.survey.ownerName}${u.survey.ownerPhone ? ` · ${u.survey.ownerPhone}` : ""}</td></tr>` : "",
      u.survey.surveyDateTime ? `<tr><td>Survey Date/Time</td><td>${new Date(u.survey.surveyDateTime).toLocaleString()}</td></tr>` : "",
      `<tr><td>Existing Load</td><td>${u.survey.existingLoadAmps} A</td></tr>`,
      `<tr><td>Infrastructure</td><td>${u.survey.condition.toUpperCase()}</td></tr>`,
      u.survey.gateTypes?.length ? `<tr><td>Gate</td><td>${u.survey.gateTypes.join(", ")}</td></tr>` : "",
      u.survey.doorFrame?.length ? `<tr><td>Door Frame</td><td>${u.survey.doorFrame.join(", ")}</td></tr>` : "",
      u.survey.mainDoor?.length ? `<tr><td>Main Door</td><td>${u.survey.mainDoor.join(", ")}</td></tr>` : "",
      u.survey.electDBBox?.length ? `<tr><td>DB Box</td><td>${u.survey.electDBBox.join(", ")}</td></tr>` : "",
      u.survey.wall?.length ? `<tr><td>Wall</td><td>${u.survey.wall.join(", ")}</td></tr>` : "",
      u.survey.ceiling?.length ? `<tr><td>Ceiling</td><td>${u.survey.ceiling.join(", ")}</td></tr>` : "",
      u.survey.scheduledCableWorkDate ? `<tr><td>CW Scheduled</td><td>${u.survey.scheduledCableWorkDate}${u.survey.scheduledCableWorkTime ? ` · ${u.survey.scheduledCableWorkTime}` : ""}</td></tr>` : "",
      u.survey.notes ? `<tr><td>Notes</td><td>${u.survey.notes}</td></tr>` : "",
      u.survey.residentSignature ? `<tr><td>Signature</td><td><img src="${u.survey.residentSignature}" style="max-width:220px;height:auto;border:1px solid #ccc;border-radius:4px;background:#fff;" /></td></tr>` : "",
    ].filter(Boolean).join("") : "<tr><td colspan='2'>Survey not completed</td></tr>";

    const photoImgs = (u.survey?.photos ?? []).map((p) =>
      `<img src="${p}" style="width:120px;height:90px;object-fit:cover;border:1px solid #ccc;border-radius:4px;" />`
    ).join("");

    const cwPhotos = (u.cableWork?.photos ?? [u.cableWork?.beforePhoto, u.cableWork?.afterPhoto].filter(Boolean) as string[])
      .map((p) => `<img src="${p}" style="width:120px;height:90px;object-fit:cover;border:1px solid #ccc;border-radius:4px;" />`).join("");

    const html = `<!DOCTYPE html>
<html><head><title>ELUP Unit Report — ${block.name} #${u.floor}-${u.unitNo}</title>
<style>
  body{font-family:sans-serif;font-size:12px;padding:24px;color:#111}
  h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;font-weight:600;margin:16px 0 6px;border-bottom:1px solid #ddd;padding-bottom:4px;text-transform:uppercase;letter-spacing:.05em}
  .meta{color:#666;font-size:11px;margin-bottom:16px}
  table{width:100%;border-collapse:collapse;margin-bottom:12px}
  td{padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:11px}td:first-child{color:#666;width:160px}
  .photos{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px}
  @media print{body{padding:0}button{display:none}}
</style></head><body>
<h1>ELUP Unit Survey Report</h1>
<div class="meta">${block.name} · #${u.floor}-${u.unitNo} · Lobby ${u.lobby} · ${block.precinct}<br/>Generated: ${new Date().toLocaleString()}</div>
${u.resident ? `<h2>Resident</h2><table><tr><td>Name</td><td>${u.resident.name}</td></tr><tr><td>Phone</td><td>${u.resident.phone}</td></tr></table>` : ""}
<h2>CS Appointment</h2>
<table><tr><td>Status</td><td>${u.csStatus}</td></tr>${u.csDate ? `<tr><td>Date</td><td>${u.csDate}</td></tr>` : ""}${u.csTime ? `<tr><td>Time</td><td>${u.csTime}</td></tr>` : ""}${u.csAssignee ? `<tr><td>Surveyor</td><td>${u.csAssignee}</td></tr>` : ""}</table>
<h2>Survey Findings</h2><table>${surveyRows}</table>
${photoImgs ? `<h2>Survey Photos</h2><div class="photos">${photoImgs}</div>` : ""}
<h2>CW Appointment</h2>
<table><tr><td>Status</td><td>${u.cwStatus}</td></tr>${u.cwDate ? `<tr><td>Date</td><td>${u.cwDate}</td></tr>` : ""}${u.cwTime ? `<tr><td>Time</td><td>${u.cwTime}</td></tr>` : ""}${u.cwAssignee ? `<tr><td>Technician</td><td>${u.cwAssignee}</td></tr>` : ""}</table>
${u.cableWork ? `<h2>Cable Work</h2><table><tr><td>Technician</td><td>${u.cableWork.technician}</td></tr><tr><td>Notes</td><td>${u.cableWork.notes}</td></tr></table>` : ""}
${cwPhotos ? `<h2>Installation Photos</h2><div class="photos">${cwPhotos}</div>` : ""}
${u.optOutRequest ? `<h2>Opt-Out</h2><table><tr><td>Date</td><td>${u.optOutRequest.requestedDate}</td></tr><tr><td>Reason</td><td>${u.optOutRequest.reason}</td></tr><tr><td>Status</td><td>${u.optOutRequest.approved ? "Approved" : "Pending"}</td></tr></table>` : ""}
</body></html>`;
    const win = window.open("", "_blank", "width=800,height=700");
    if (!win) { toast.error("Pop-up blocked — allow pop-ups to download PDF"); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  return (
    <>
      <Sheet open={!!unitKey} onOpenChange={(o) => !o && onClose()}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-[480px]">
          {u && unitKey && (
            <>
              <SheetHeader className="pr-10">
                <div className="flex items-center gap-2">
                  <Badge className={isCS ? "bg-sky-500 hover:bg-sky-500" : "bg-orange-500 hover:bg-orange-500"}>
                    {isCS ? "CS" : "CW"} View
                  </Badge>
                  <Badge variant="outline">Lobby {u.lobby}</Badge>
                </div>
                <SheetTitle className="text-2xl">#{u.floor}-{u.unitNo}</SheetTitle>
                <SheetDescription>{block.name} — {block.precinct}</SheetDescription>
                {!readOnly && (
                  <div className="pt-2">
                    <ScheduleQuickDialog
                      isCS={isCS}
                      unit={u}
                      onSave={(patch) => {
                        dispatch({ type: "UPDATE_UNIT", blockId: block.id, unitKey, patch });
                        toast.success(`${isCS ? "CS" : "CW"} appointment saved`);
                      }}
                    />
                  </div>
                )}
              </SheetHeader>

              <div className="mt-6 space-y-6 px-1">
                {/* Resident */}
                <Section icon={User} title="Resident">
                  {u.resident ? (
                    <div className="space-y-1 text-sm">
                      <div className="font-medium">{u.resident.name}</div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Phone className="h-3 w-3" /> {u.resident.phone}
                      </div>
                    </div>
                  ) : (
                    <Empty text="No resident record yet" />
                  )}
                </Section>

                {/* Opt-out banner */}
                {u.optOutRequest && (
                  <div className="rounded-lg border-2 border-yellow-400 bg-yellow-50 p-3 text-yellow-950">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <FileSignature className="h-4 w-4" />
                      OPT OUT — {u.optOutRequest.requestedDate}
                      {u.optOutRequest.approved
                        ? <Badge className="ml-1 bg-emerald-600">Approved</Badge>
                        : <Badge variant="outline" className="ml-1">Pending</Badge>}
                      {isManager && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="ml-auto h-6 px-2 text-xs border-yellow-500 text-yellow-800 hover:bg-yellow-100">
                              Revert
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Revert opt-out?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will remove the opt-out record and reset the unit's CS and CW status back to <strong>Pending</strong>. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => dispatch({ type: "REVERT_OPT_OUT", blockId: block.id, unitKey })}
                              >
                                Yes, revert
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </div>
                    <p className="mt-1 text-xs">{u.optOutRequest.reason}</p>
                  </div>
                )}

                {isCS ? (
                  <>
                    {/* CS Appointment */}
                    <Section icon={CalendarDays} title="CS Appointment">
                      {u.csDate ? (
                        <div className="rounded-md border bg-sky-50 px-3 py-2 text-sm text-sky-900">
                          <div className="font-semibold">
                            {u.csDate}
                            {u.csTime && <span className="ml-2 text-sky-700">· {u.csTime}</span>}
                          </div>
                          <div className="text-xs">Status: {u.csStatus}</div>
                        </div>
                      ) : <Empty text="Not scheduled" />}
                    </Section>

                    <Section icon={BellRing} title="CS Reminders">
                      <CsReminderSection u={u} blockId={block.id} unitKey={unitKey} readOnly={readOnly} />
                    </Section>

                    {/* Survey Findings */}
                    <Section icon={Zap} title="Survey Findings">
                      <div className="flex items-center justify-between mb-2">
                        <span />
                        {isManager && (
                          <EditSurveyDialog
                            unit={u}
                            onSave={(surveyPatch) => {
                              dispatch({
                                type: "UPDATE_UNIT",
                                blockId: block.id,
                                unitKey,
                                patch: { survey: { ...(u.survey ?? { existingLoadAmps: 0, condition: "good" as const, notes: "", photos: [] }), ...surveyPatch } },
                              });
                              toast.success("Survey findings updated");
                            }}
                          />
                        )}
                      </div>
                      {u.survey ? (
                        <div className="space-y-2 text-sm">
                          {(u.survey.ownerName || u.survey.ownerPhone) && <Row k="Owner" v={`${u.survey.ownerName ?? "—"}${u.survey.ownerPhone ? ` · ${u.survey.ownerPhone}` : ""}`} />}
                          {u.survey.surveyDateTime && <Row k="Survey Date/Time" v={new Date(u.survey.surveyDateTime).toLocaleString()} />}
                          <Row k="Existing Load" v={`${u.survey.existingLoadAmps} A`} />
                          <Row k="Infrastructure" v={u.survey.condition.toUpperCase()} />
                          {u.survey.gateTypes?.length ? <Row k="Gate" v={u.survey.gateTypes.join(", ")} /> : null}
                          {u.survey.doorFrame?.length ? <Row k="Door Frame" v={u.survey.doorFrame.join(", ")} /> : null}
                          {u.survey.mainDoor?.length ? <Row k="Main Door" v={u.survey.mainDoor.join(", ")} /> : null}
                          {u.survey.electDBBox?.length ? <Row k="DB Box" v={u.survey.electDBBox.join(", ")} /> : null}
                          {u.survey.wall?.length ? <Row k="Wall" v={u.survey.wall.join(", ")} /> : null}
                          {u.survey.ceiling?.length ? <Row k="Ceiling" v={u.survey.ceiling.join(", ")} /> : null}
                          {u.survey.custom && customSurveyFields.map((f) => {
                            const val = u.survey!.custom![f.id];
                            if (val === undefined || val === "" || val === false) return null;
                            const display = Array.isArray(val)
                              ? (val as string[]).join(", ")
                              : val === true
                              ? "Yes"
                              : String(val);
                            return display ? <Row key={f.id} k={f.label} v={display} /> : null;
                          })}
                          {u.survey.scheduledCableWorkDate && <Row k="CW Scheduled" v={`${u.survey.scheduledCableWorkDate}${u.survey.scheduledCableWorkTime ? ` · ${u.survey.scheduledCableWorkTime}` : ""}`} />}
                          {u.survey.notes && <p className="rounded-md bg-muted/50 p-2 text-xs">{u.survey.notes}</p>}
                          {u.survey.residentSignature && (
                            <button
                              className="flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-900 hover:underline cursor-pointer"
                              onClick={() => setLightbox({ urls: [u.survey!.residentSignature!], idx: 0, bgWhite: true })}
                            >
                              <CheckCircle2 className="h-3 w-3" /> Resident signed · view signature
                            </button>
                          )}
                        </div>
                      ) : (
                        <Empty text="Survey not completed" />
                      )}
                    </Section>

                    {/* Survey Photos */}
                    <Section icon={Camera} title="Survey Photos">
                      <PhotoGallery
                        photos={u.survey?.photos ?? []}
                        onOpen={openLightbox}
                        onDelete={isManager ? (newPhotos) => dispatch({
                          type: "UPDATE_UNIT", blockId: block.id, unitKey,
                          patch: { survey: { ...(u.survey ?? { existingLoadAmps: 0, condition: "good" as const, notes: "", photos: [] }), photos: newPhotos } },
                        }) : undefined}
                        showUploader={isManager}
                        pathPrefix={`photos/${block.precinct}/${block.id}/${unitKey}/cs`}
                        onUpload={isManager ? (newPhotos) => dispatch({
                          type: "UPDATE_UNIT", blockId: block.id, unitKey,
                          patch: { survey: { ...(u.survey ?? { existingLoadAmps: 0, condition: "good" as const, notes: "", photos: [] }), photos: newPhotos } },
                        }) : undefined}
                        accent="sky"
                      />
                    </Section>
                  </>
                ) : (
                  <>
                    {/* CW Appointment */}
                    <Section icon={CalendarDays} title="CW Appointment">
                      {u.cwDate ? (
                        <div className="rounded-md border bg-orange-50 px-3 py-2 text-sm text-orange-900">
                          <div className="font-semibold">
                            {u.cwDate}
                            {u.cwTime && <span className="ml-2 text-orange-700">· {u.cwTime}</span>}
                          </div>
                          <div className="text-xs">Status: {u.cwStatus}</div>
                        </div>
                      ) : <Empty text="Not scheduled" />}
                    </Section>

                    {/* Cable Work */}
                    <Section icon={Wrench} title="Cable Work">
                      {u.cableWork ? (
                        <div className="space-y-2 text-sm">
                          <Row k="Technician" v={u.cableWork.technician} />
                          <p className="rounded-md bg-muted/50 p-2 text-xs">{u.cableWork.notes}</p>
                        </div>
                      ) : (
                        <Empty text="No work logged yet" />
                      )}
                    </Section>

                    {/* Installation Photos */}
                    <Section icon={Camera} title="Installation Photos">
                      {(() => {
                        const photos = u.cableWork?.photos
                          ?? [u.cableWork?.beforePhoto, u.cableWork?.afterPhoto].filter(Boolean) as string[];
                        return (
                          <PhotoGallery
                            photos={photos}
                            onOpen={openLightbox}
                            onDelete={isManager ? (newPhotos) => dispatch({
                              type: "UPDATE_UNIT", blockId: block.id, unitKey,
                              patch: { cableWork: { ...(u.cableWork ?? { technician: "", notes: "", photos: [] }), photos: newPhotos } },
                            }) : undefined}
                            showUploader={isManager}
                            pathPrefix={`photos/${block.precinct}/${block.id}/${unitKey}/cw`}
                            onUpload={isManager ? (newPhotos) => dispatch({
                              type: "UPDATE_UNIT", blockId: block.id, unitKey,
                              patch: { cableWork: { ...(u.cableWork ?? { technician: "", notes: "", photos: [] }), photos: newPhotos } },
                            }) : undefined}
                            accent="orange"
                          />
                        );
                      })()}
                    </Section>
                  </>
                )}

                {/* Flag */}
                {!readOnly && (
                  <Section icon={Flag} title="Flag for Attention">
                    <div className={`rounded-md border p-3 ${u.flagged ? "border-red-400 bg-red-50" : ""}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Flag className={`h-4 w-4 ${u.flagged ? "text-red-600" : "text-muted-foreground"}`} />
                          {u.flagged ? "Flagged — appears red in chart" : "Not flagged"}
                        </div>
                        <Switch
                          checked={!!u.flagged}
                          onCheckedChange={(v) => {
                            dispatch({ type: "UPDATE_UNIT", blockId: block.id, unitKey, patch: { flagged: v, flagNote: v ? (u.flagNote ?? "") : undefined } });
                            toast.success(v ? "Unit flagged" : "Flag removed");
                          }}
                        />
                      </div>
                      {u.flagged && (
                        <Textarea
                          className="mt-2 text-sm"
                          placeholder="Describe the situation…"
                          value={u.flagNote ?? ""}
                          onChange={(e) => dispatch({ type: "UPDATE_UNIT", blockId: block.id, unitKey, patch: { flagNote: e.target.value } })}
                        />
                      )}
                    </div>
                  </Section>
                )}

                {readOnly && u.flagged && (
                  <Section icon={Flag} title="Flagged">
                    <div className="rounded-md border border-red-400 bg-red-50 p-3 text-sm text-red-900">
                      {u.flagNote || "Unit flagged for attention."}
                    </div>
                  </Section>
                )}

                {/* History Log */}
                <Section icon={History} title="History Log">
                  {(u.activityLog ?? []).length === 0 ? (
                    <Empty text="No activity recorded yet" />
                  ) : (
                    <div className="space-y-2">
                      {[...(u.activityLog ?? [])]
                        .sort((a, b) => b.loggedAt.localeCompare(a.loggedAt))
                        .map((entry) => (
                          <div
                            key={entry.id}
                            className={`rounded-md border px-3 py-2 text-xs ${activityStyle(entry.type)}`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold">{activityLabel(entry.type)}</span>
                              <span className="shrink-0 text-[10px] opacity-70">
                                {new Date(entry.loggedAt).toLocaleString("en-SG", {
                                  day: "2-digit", month: "short", year: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </span>
                            </div>
                            {(entry.appointmentDate || entry.assignee) && (
                              <div className="mt-0.5 opacity-80">
                                {entry.appointmentDate}
                                {entry.appointmentTime ? ` · ${entry.appointmentTime}` : ""}
                                {entry.assignee ? ` · ${entry.assignee}` : ""}
                              </div>
                            )}
                            {entry.notes && (
                              <div className="mt-0.5 italic opacity-70">{entry.notes}</div>
                            )}
                          </div>
                        ))}
                    </div>
                  )}
                </Section>

                {/* Documents */}
                <Section icon={FileText} title="Documents">
                  <DocumentUploader
                    docs={u.documents ?? []}
                    pathPrefix={`documents/${block.precinct}/${block.id}/${unitKey}`}
                    onAdd={(doc) => {
                      dispatch({
                        type: "UPDATE_UNIT",
                        blockId: block.id,
                        unitKey,
                        patch: { documents: [...(u.documents ?? []), doc] },
                      });
                    }}
                    onRemove={!readOnly ? (idx) => {
                      const next = [...(u.documents ?? [])];
                      next.splice(idx, 1);
                      dispatch({
                        type: "UPDATE_UNIT",
                        blockId: block.id,
                        unitKey,
                        patch: { documents: next },
                      });
                      toast.success("Document removed");
                    } : undefined}
                  />
                </Section>

                <Separator />

                <div className="flex flex-col gap-2">
                  <Button variant="outline" className="justify-start" onClick={generatePdf}>
                    <Download className="mr-2 h-4 w-4" /> Download generated PDF form
                  </Button>
                  {!readOnly && state.role !== "surveyor" && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" className="justify-start text-destructive hover:text-destructive">
                          <Trash2 className="mr-2 h-4 w-4" /> Remove unit
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove this unit from the chart?</AlertDialogTitle>
                          <AlertDialogDescription>
                            #{u.floor}-{u.unitNo} will be hidden. You can re-add it later via Add Block.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Keep</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => {
                              dispatch({ type: "UPDATE_UNIT", blockId: block.id, unitKey, patch: { exists: false } });
                              toast.success("Unit removed");
                              onClose();
                            }}
                          >
                            Remove unit
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Lightbox */}
      {lightbox && (
        <Dialog open onOpenChange={closeLightbox}>
          <DialogContent className={`max-w-3xl p-0 border-none ${lightbox.bgWhite ? "bg-white" : "bg-black"}`} aria-describedby={undefined}>
            <DialogHeader className="sr-only">
              <DialogTitle>Photo {lightbox.idx + 1} of {lightbox.urls.length}</DialogTitle>
            </DialogHeader>
            <div className="relative flex items-center justify-center min-h-[60vh]">
              <img
                src={lightbox.urls[lightbox.idx]}
                alt={`Photo ${lightbox.idx + 1}`}
                className={`max-h-[80vh] max-w-full rounded object-contain${lightbox.bgWhite ? " p-4" : ""}`}
              />
              {lightbox.urls.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    disabled={lightbox.idx === 0}
                    className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 disabled:opacity-30"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <button
                    onClick={nextPhoto}
                    disabled={lightbox.idx === lightbox.urls.length - 1}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/60 p-2 text-white hover:bg-black/80 disabled:opacity-30"
                  >
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </>
              )}
              <button
                onClick={closeLightbox}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-xs text-white/70">
                {lightbox.idx + 1} / {lightbox.urls.length}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ─── Photo Gallery ────────────────────────────────────────────────────────────

function PhotoGallery({
  photos, onOpen, onDelete, showUploader, pathPrefix, onUpload, accent,
}: {
  photos: string[];
  onOpen: (urls: string[], idx: number) => void;
  onDelete?: (next: string[]) => void;
  showUploader?: boolean;
  pathPrefix?: string;
  onUpload?: (next: string[]) => void;
  accent?: "sky" | "orange";
}) {
  const [pendingDelete, setPendingDelete] = useState<number | null>(null);

  if (photos.length === 0 && !showUploader) {
    return <Empty text="No photos uploaded" />;
  }

  return (
    <>
      <AlertDialog open={pendingDelete !== null} onOpenChange={(o) => !o && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (pendingDelete !== null && onDelete)
                  onDelete(photos.filter((_, idx) => idx !== pendingDelete));
                setPendingDelete(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="space-y-2">
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p, i) => (
              <div key={p + i} className="group relative aspect-square overflow-hidden rounded-md border bg-muted">
                <img
                  src={p}
                  alt={`Photo ${i + 1}`}
                  className="h-full w-full cursor-pointer object-cover transition hover:opacity-90"
                  onClick={() => onOpen(photos, i)}
                />
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => setPendingDelete(i)}
                    className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 opacity-0 transition group-hover:opacity-100"
                  >
                    <X className="h-3 w-3 text-destructive" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {showUploader && pathPrefix && onUpload && (
          <PhotoUploader
            photos={[]}
            onChange={(newUrls) => onUpload([...photos, ...newUrls])}
            pathPrefix={pathPrefix}
            accent={accent}
            columns={4}
            uploadOnly
          />
        )}
      </div>
    </>
  );
}

// ─── Edit Survey Dialog ───────────────────────────────────────────────────────

const GATE_OPTIONS: { value: GateType; label: string }[] = [
  { value: "alum", label: "Aluminium" },
  { value: "mild_steel", label: "Mild Steel" },
  { value: "wrought", label: "Wrought Iron" },
  { value: "ss", label: "Stainless Steel" },
];
const DOOR_FRAME_OPTIONS: { value: DoorFrameCondition; label: string }[] = [
  { value: "crack", label: "Crack" }, { value: "chipped", label: "Chipped" },
  { value: "scratch", label: "Scratch" }, { value: "warped", label: "Warped" }, { value: "ok", label: "OK" },
];
const MAIN_DOOR_OPTIONS: { value: MainDoorType; label: string }[] = [
  { value: "original", label: "Original" }, { value: "replaced", label: "Replaced" }, { value: "fire_rated", label: "Fire-Rated" },
];
const DB_BOX_OPTIONS: { value: ElectDBBoxLocation; label: string }[] = [
  { value: "cornice", label: "Cornice" }, { value: "false_ceiling", label: "False Ceiling" },
  { value: "cabinet", label: "Cabinet" }, { value: "obstruction", label: "Obstruction" },
];
const WALL_OPTIONS: { value: WallCondition; label: string }[] = [
  { value: "uneven", label: "Uneven" }, { value: "plastered", label: "Plastered" },
  { value: "rockstone", label: "Rockstone" }, { value: "wallpaper", label: "Wallpaper" },
];
const CEILING_OPTIONS: { value: CeilingCondition; label: string }[] = [
  { value: "cornice", label: "Cornice" }, { value: "false_ceiling", label: "False Ceiling" },
  { value: "rockstone", label: "Rockstone" }, { value: "wallpaper", label: "Wallpaper" },
];

function CheckGroup<T extends string>({
  label, options, selected, onChange,
}: { label: string; options: { value: T; label: string }[]; selected?: T[]; onChange: (v: T[]) => void }) {
  const toggle = (v: T) => {
    const cur = selected ?? [];
    onChange(cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]);
  };
  return (
    <div>
      <Label className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            className={`rounded-full border px-2.5 py-0.5 text-[11px] transition ${(selected ?? []).includes(o.value) ? "bg-sky-600 border-sky-600 text-white" : "border-input text-muted-foreground hover:bg-muted"}`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditSurveyDialog({
  unit, onSave,
}: { unit: UnitData; onSave: (patch: Partial<NonNullable<UnitData["survey"]>>) => void }) {
  const s = unit.survey;
  const [open, setOpen] = useState(false);
  const [ownerName, setOwnerName] = useState(s?.ownerName ?? "");
  const [ownerPhone, setOwnerPhone] = useState(s?.ownerPhone ?? "");
  const [existingLoadAmps, setExistingLoadAmps] = useState(String(s?.existingLoadAmps ?? 0));
  const [condition, setCondition] = useState<"good" | "fair" | "poor">(s?.condition ?? "good");
  const [gateTypes, setGateTypes] = useState<GateType[]>(s?.gateTypes ?? []);
  const [doorFrame, setDoorFrame] = useState<DoorFrameCondition[]>(s?.doorFrame ?? []);
  const [mainDoor, setMainDoor] = useState<MainDoorType[]>(s?.mainDoor ?? []);
  const [electDBBox, setElectDBBox] = useState<ElectDBBoxLocation[]>(s?.electDBBox ?? []);
  const [wall, setWall] = useState<WallCondition[]>(s?.wall ?? []);
  const [ceiling, setCeiling] = useState<CeilingCondition[]>(s?.ceiling ?? []);
  const [cwDate, setCwDate] = useState(s?.scheduledCableWorkDate ?? "");
  const [cwTime, setCwTime] = useState(s?.scheduledCableWorkTime ?? "");
  const [notes, setNotes] = useState(s?.notes ?? "");

  const reset = () => {
    setOwnerName(s?.ownerName ?? ""); setOwnerPhone(s?.ownerPhone ?? "");
    setExistingLoadAmps(String(s?.existingLoadAmps ?? 0)); setCondition(s?.condition ?? "good");
    setGateTypes(s?.gateTypes ?? []); setDoorFrame(s?.doorFrame ?? []);
    setMainDoor(s?.mainDoor ?? []); setElectDBBox(s?.electDBBox ?? []);
    setWall(s?.wall ?? []); setCeiling(s?.ceiling ?? []);
    setCwDate(s?.scheduledCableWorkDate ?? ""); setCwTime(s?.scheduledCableWorkTime ?? "");
    setNotes(s?.notes ?? "");
  };

  const submit = () => {
    onSave({
      ownerName: ownerName || undefined,
      ownerPhone: ownerPhone || undefined,
      existingLoadAmps: Number(existingLoadAmps) || 0,
      condition,
      gateTypes: gateTypes.length ? gateTypes : undefined,
      doorFrame: doorFrame.length ? doorFrame : undefined,
      mainDoor: mainDoor.length ? mainDoor : undefined,
      electDBBox: electDBBox.length ? electDBBox : undefined,
      wall: wall.length ? wall : undefined,
      ceiling: ceiling.length ? ceiling : undefined,
      scheduledCableWorkDate: cwDate || undefined,
      scheduledCableWorkTime: cwTime || undefined,
      notes,
    });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-7 gap-1 px-2 text-xs">
          <Pencil className="h-3 w-3" /> Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Survey Findings</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-1">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Owner name</Label><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Owner name" className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Owner phone</Label><Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="Phone" className="h-8 text-sm" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Existing load (A)</Label>
              <Input type="number" value={existingLoadAmps} onChange={(e) => setExistingLoadAmps(e.target.value)} className="h-8 text-sm" />
            </div>
            <div>
              <Label className="text-xs">Infrastructure condition</Label>
              <Select value={condition} onValueChange={(v) => setCondition(v as "good" | "fair" | "poor")}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="good">Good</SelectItem>
                  <SelectItem value="fair">Fair</SelectItem>
                  <SelectItem value="poor">Poor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <CheckGroup label="Gate type" options={GATE_OPTIONS} selected={gateTypes} onChange={setGateTypes} />
          <CheckGroup label="Door frame" options={DOOR_FRAME_OPTIONS} selected={doorFrame} onChange={setDoorFrame} />
          <CheckGroup label="Main door" options={MAIN_DOOR_OPTIONS} selected={mainDoor} onChange={setMainDoor} />
          <CheckGroup label="DB Box" options={DB_BOX_OPTIONS} selected={electDBBox} onChange={setElectDBBox} />
          <CheckGroup label="Wall" options={WALL_OPTIONS} selected={wall} onChange={setWall} />
          <CheckGroup label="Ceiling" options={CEILING_OPTIONS} selected={ceiling} onChange={setCeiling} />
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">CW scheduled date</Label><Input type="date" value={cwDate} onChange={(e) => setCwDate(e.target.value)} className="h-8 text-sm" /></div>
            <div>
              <Label className="text-xs">CW scheduled time</Label>
              <Select value={cwTime || "none"} onValueChange={(v) => setCwTime(v === "none" ? "" : v)}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {TIME_SLOTS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Additional notes…" rows={3} className="text-sm" />
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Section({ icon: Icon, title, children }: { icon: typeof User; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {title}
      </div>
      {children}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b py-1.5 text-sm">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-medium">{v}</span>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
      <ImageOff className="h-4 w-4" /> {text}
    </div>
  );
}

function ScheduleQuickDialog({
  isCS, unit, onSave,
}: {
  isCS: boolean;
  unit: UnitData;
  onSave: (patch: Partial<UnitData>) => void;
}) {
  const { state: elupState } = useElup();
  const [open, setOpen] = useState(false);
  const existingDate = isCS ? unit.csDate : unit.cwDate;
  const existingTime = isCS ? unit.csTime : unit.cwTime;
  const existingAssignee = isCS ? unit.csAssignee : unit.cwAssignee;
  const [date, setDate] = useState(dmyToIso(existingDate));
  const [time, setTime] = useState(existingTime ?? "10:00");
  const [assignee, setAssignee] = useState(existingAssignee ?? "");
  const roleAccounts = elupState.accounts.filter((a) => a.role === (isCS ? "surveyor" : "technician"));

  const submit = () => {
    if (!date) { toast.error("Date required"); return; }
    const dateStr = fmtDmy(date);
    const patch: Partial<UnitData> = isCS
      ? { csStatus: "scheduled", csDate: dateStr, csTime: time, csAssignee: assignee }
      : { cwStatus: "scheduled", cwDate: dateStr, cwTime: time, cwAssignee: assignee };
    onSave(patch);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={isCS ? "bg-sky-600 hover:bg-sky-700" : "bg-orange-600 hover:bg-orange-700"}>
          <CalendarPlus className="mr-1 h-3.5 w-3.5" />
          Schedule {isCS ? "CS" : "CW"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existingDate ? `Reschedule ${isCS ? "CS" : "CW"}` : `Schedule ${isCS ? "CS" : "CW"}`}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div>
              <Label>Time</Label>
              <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={time} onChange={(e) => setTime(e.target.value)}>
                {TIME_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button className={isCS ? "bg-sky-600 hover:bg-sky-700" : "bg-orange-600 hover:bg-orange-700"} onClick={submit}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
