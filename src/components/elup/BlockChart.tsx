import { useEffect, useState } from "react";
import { useElup, useActiveBlock } from "@/lib/elup/store";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Printer, SlidersHorizontal, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  onCellClick?: (unitKey: string) => void;
  readOnly?: boolean;
}

export function BlockChart({ onCellClick }: Props) {
  const { state, dispatch } = useElup();
  const block = useActiveBlock();
  const view = state.chartView;

  // Use floor labels as actual floor identifiers (falls back to numeric position string)
  const floorIds = Array.from({ length: block.floors }, (_, i) => {
    const pos = block.floors - i;
    return (block.floorLabels?.[String(pos)] || String(pos)).trim() || String(pos);
  });

  const [blockOptionsOpen, setBlockOptionsOpen] = useState(false);
  const [readding, setReadding] = useState<string | null>(null);

  function handleCellClick(unitKey: string) {
    const u = block.units[unitKey];
    if (u && !u.exists && state.role === "manager") {
      setReadding(unitKey);
      return;
    }
    if (u?.exists) {
      onCellClick?.(unitKey);
    }
  }

  function confirmReadd() {
    if (!readding) return;
    dispatch({
      type: "UPDATE_UNIT",
      blockId: block.id,
      unitKey: readding,
      patch: { exists: true },
    });
    toast.success(`Unit #${readding} re-added to the block`);
    setReadding(null);
  }

  function cellInfo(unitKey: string) {
    const u = block.units[unitKey];
    if (!u) {
      return { className: "bg-neutral-800 text-neutral-700", label: "", sub: "", color: "#262626" };
    }
    if (!u.exists) {
      return { className: "bg-neutral-800 text-neutral-700", label: "", sub: "", color: "#262626" };
    }
    if (u.flagged) {
      return { className: "bg-red-500 text-white border-red-700 animate-pulse", label: "⚑ FLAG", sub: (view === "CS" ? u.csDate : u.cwDate) ?? "Attn", color: "#ef4444" };
    }
    if (u.optOutRequest?.approved || u.csStatus === "opt_out") {
      return { className: "bg-yellow-300 text-yellow-950 border-yellow-500", label: "OPT OUT", sub: u.optOutRequest?.requestedDate ?? "", color: "#fde047" };
    }
    if (view === "CS") {
      if (u.csStatus === "completed") return { className: "bg-emerald-500 text-white border-emerald-600", label: "✓ CS", sub: u.csDate ?? "Done", color: "#10b981" };
      if (u.csStatus === "scheduled") return { className: "bg-sky-500 text-white border-sky-600", label: "CS", sub: u.csDate ?? "", color: "#0ea5e9" };
      return { className: "bg-card hover:bg-muted text-muted-foreground", label: "—", sub: "", color: "#f1f5f9" };
    }
    if (u.cwStatus === "completed") return { className: "bg-emerald-500 text-white border-emerald-600", label: "✓ CW", sub: u.cwDate ?? "Done", color: "#10b981" };
    if (u.cwStatus === "in_progress") return { className: "bg-orange-600 text-white border-orange-700", label: "WIP", sub: u.cwDate ?? "", color: "#ea580c" };
    if (u.cwStatus === "scheduled") return { className: "bg-orange-500 text-white border-orange-600", label: "CW", sub: u.cwDate ?? "", color: "#f97316" };
    return { className: "bg-card hover:bg-muted text-muted-foreground", label: "—", sub: "", color: "#f1f5f9" };
  }

  function printChart() {
    const allStacks = block.lobbies.flatMap((l) => l.stacks.map((s) => ({ lobby: l.name, stack: s })));

    const headerLobby = block.lobbies.map((l) =>
      `<th colspan="${l.stacks.length}" style="padding:4px 8px;background:#f8fafc;text-align:center;font-size:11px;border:1px solid #e2e8f0">Lobby ${l.name}</th>`
    ).join("");

    const headerStacks = allStacks.map(({ stack }) =>
      `<th style="padding:4px 6px;background:#f8fafc;text-align:center;font-size:10px;min-width:72px;border:1px solid #e2e8f0">#${stack}</th>`
    ).join("");

    const bodyRows = floorIds.map((fId) => {
      const cells = allStacks.map(({ stack }) => {
        const key = `${fId}-${stack}`;
        const info = cellInfo(key);
        const textColor = info.color === "#f1f5f9" || info.color === "#fde047" ? "#1e293b" : (info.color === "#262626" ? "#525252" : "#fff");
        return `<td style="text-align:center;padding:3px 2px;border:1px solid #e2e8f0;background:${info.color};color:${textColor};font-size:9px;font-weight:600">
          ${info.label || ""}${info.sub ? `<br/><span style="font-size:8px;opacity:.85">${info.sub}</span>` : ""}
        </td>`;
      }).join("");
      return `<tr><td style="font-weight:600;font-size:10px;padding:3px 8px;text-align:center;background:#f8fafc;border:1px solid #e2e8f0">${fId}</td>${cells}</tr>`;
    }).join("");

    const legendItems = view === "CS"
      ? [["#f1f5f9","Pending"],["#0ea5e9","CS Scheduled"],["#10b981","CS Completed"],["#fde047","Opt Out"],["#ef4444","Flagged"],["#262626","N/A"]]
      : [["#f1f5f9","Pending"],["#f97316","CW Scheduled"],["#ea580c","CW In Progress"],["#10b981","Handed Over"],["#fde047","Opt Out"],["#ef4444","Flagged"]];

    const legend = legendItems.map(([color, label]) =>
      `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:#475569;margin-right:12px">
        <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${color};border:1px solid #e2e8f0"></span>${label}
      </span>`
    ).join("");

    const html = `<!DOCTYPE html>
<html><head><title>Block Chart — ${block.name} (${view})</title>
<style>
  body{font-family:sans-serif;padding:16px;font-size:12px}
  h1{font-size:16px;margin:0 0 2px}
  .meta{color:#64748b;font-size:11px;margin-bottom:12px}
  table{border-collapse:collapse}
  @media print{body{padding:0}}
</style></head><body>
<h1>${block.name} — ${view} Chart</h1>
<div class="meta">${block.precinct} · Generated: ${new Date().toLocaleString()}</div>
<table>
  <thead>
    <tr><th style="padding:4px 8px;background:#f8fafc;font-size:10px;border:1px solid #e2e8f0">Floor</th>${headerLobby}</tr>
    <tr><th style="background:#f8fafc;border:1px solid #e2e8f0"></th>${headerStacks}</tr>
  </thead>
  <tbody>${bodyRows}</tbody>
</table>
<div style="margin-top:12px;display:flex;flex-wrap:wrap;gap:2px;border-top:1px solid #e2e8f0;padding-top:10px">${legend}</div>
</body></html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) { toast.error("Pop-up blocked — allow pop-ups to print"); return; }
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 400);
  }

  return (
    <div className="space-y-4">
      {/* Re-add unit dialog */}
      <Dialog open={!!readding} onOpenChange={(o) => !o && setReadding(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Re-add Unit #{readding}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This unit was previously removed. Do you want to mark it as active again?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReadding(null)}>Cancel</Button>
            <Button onClick={confirmReadd}>Re-add Unit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="text-lg font-bold">{block.name}</div>
          <Badge variant="outline" className="text-[11px]">
            {block.precinct}
          </Badge>
          {state.role === "manager" && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => setBlockOptionsOpen(true)}
              title="Block Options"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Options
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Tabs value={view} onValueChange={(v) => dispatch({ type: "SET_VIEW", view: v as "CS" | "CW" })}>
            <TabsList>
              <TabsTrigger value="CS" className="data-[state=active]:bg-sky-500 data-[state=active]:text-white">
                CS Chart
              </TabsTrigger>
              <TabsTrigger value="CW" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white">
                CW Chart
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <Button variant="outline" size="sm" onClick={printChart} title="Print / Save as PDF">
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-card p-3 shadow-sm md:p-5">
        <div className="overflow-x-auto">
          <table className="border-separate border-spacing-1">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 bg-card px-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                  Floor
                </th>
                {block.lobbies.map((lobby) => (
                  <th
                    key={lobby.name}
                    colSpan={lobby.stacks.length}
                    className="px-1 pb-1 text-center text-[11px] font-semibold text-muted-foreground"
                  >
                    <div className="rounded-md border border-dashed border-border bg-muted/40 px-2 py-1">
                      Lift Lobby {lobby.name}
                    </div>
                  </th>
                ))}
              </tr>
              <tr>
                <th className="sticky left-0 z-10 bg-card" />
                {block.lobbies.flatMap((lobby) =>
                  lobby.stacks.map((s) => (
                    <th
                      key={`${lobby.name}-${s}`}
                      className="min-w-[78px] px-1 pb-1 text-center text-[10px] font-medium text-muted-foreground"
                    >
                      #{s}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {floorIds.map((fId) => (
                <tr key={fId}>
                  <td className="sticky left-0 z-10 bg-card px-2 text-center text-xs font-semibold text-muted-foreground">
                    {fId}
                  </td>
                  {block.lobbies.flatMap((lobby) =>
                    lobby.stacks.map((s) => {
                      const key = `${fId}-${s}`;
                      const info = cellInfo(key);
                      const u = block.units[key];
                      const clickable = u?.exists || (u && !u.exists && state.role === "manager");
                      return (
                        <td key={`${lobby.name}-${fId}-${s}`} className="p-0">
                          <button
                            type="button"
                            disabled={!clickable}
                            onClick={() => clickable && handleCellClick(key)}
                            className={cn(
                              "h-14 w-full min-w-[78px] rounded-md border text-left transition-all",
                              "flex flex-col items-center justify-center px-1 text-[10px] font-semibold leading-tight",
                              clickable
                                ? "cursor-pointer hover:scale-[1.04] hover:shadow-md active:scale-100"
                                : "cursor-not-allowed",
                              info.className,
                            )}
                          >
                            <span className="text-[10px]">{info.label}</span>
                            {info.sub && <span className="text-[9px] font-medium opacity-90">{info.sub}</span>}
                          </button>
                        </td>
                      );
                    }),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ChartLegend view={view} />
      </div>

      <BlockOptionsDialog open={blockOptionsOpen} onClose={() => setBlockOptionsOpen(false)} />
    </div>
  );
}

function BlockOptionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dispatch } = useElup();
  const block = useActiveBlock();

  const [tab, setTab] = useState("general");
  const [name, setName] = useState(block.name);
  const [precinct, setPrecinct] = useState(block.precinct);
  const [floors, setFloors] = useState(block.floors);
  const [lobbies, setLobbies] = useState(block.lobbies.map((l) => ({ name: l.name, stacks: [...l.stacks] })));
  const [initialLobbies, setInitialLobbies] = useState(block.lobbies.map((l) => ({ name: l.name, stacks: [...l.stacks] })));
  const [floorLabels, setFloorLabels] = useState<Record<string, string>>(block.floorLabels ?? {});
  const [initialFloorLabels, setInitialFloorLabels] = useState<Record<string, string>>(block.floorLabels ?? {});
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setName(block.name);
      setPrecinct(block.precinct);
      setFloors(block.floors);
      const snap = block.lobbies.map((l) => ({ name: l.name, stacks: [...l.stacks] }));
      setLobbies(snap);
      setInitialLobbies(snap);
      const labelSnap = block.floorLabels ?? {};
      setFloorLabels(labelSnap);
      setInitialFloorLabels(labelSnap);
      setConfirmDelete(false);
      setTab("general");
    }
  }, [open, block.id]);

  function addLobby() {
    const nextLetter = String.fromCharCode(65 + lobbies.length);
    setLobbies([...lobbies, { name: nextLetter, stacks: [""] }]);
  }
  function removeLobby(i: number) {
    setLobbies(lobbies.filter((_, idx) => idx !== i));
  }
  function updateLobbyName(i: number, v: string) {
    const updated = [...lobbies];
    updated[i] = { ...updated[i], name: v };
    setLobbies(updated);
  }
  function addStack(li: number) {
    const updated = [...lobbies];
    updated[li] = { ...updated[li], stacks: [...updated[li].stacks, ""] };
    setLobbies(updated);
  }
  function removeStack(li: number, si: number) {
    const updated = [...lobbies];
    updated[li] = { ...updated[li], stacks: updated[li].stacks.filter((_, i) => i !== si) };
    setLobbies(updated);
  }
  function updateStack(li: number, si: number, v: string) {
    const updated = [...lobbies];
    const stacks = [...updated[li].stacks];
    stacks[si] = v;
    updated[li] = { ...updated[li], stacks };
    setLobbies(updated);
  }

  function save() {
    const cleanLobbies = lobbies
      .filter((l) => l.name.trim())
      .map((l) => ({ name: l.name.trim(), stacks: l.stacks.map((s) => s.trim()).filter(Boolean) }))
      .filter((l) => l.stacks.length > 0);

    if (cleanLobbies.length === 0) {
      toast.error("At least one lobby with one stack is required.");
      return;
    }
    if (floors < 1) {
      toast.error("Floors must be at least 1.");
      return;
    }

    // Detect position-based renames within each lobby (index i changed value → rename)
    const renames: { oldStack: string; newStack: string }[] = [];
    for (let li = 0; li < Math.min(cleanLobbies.length, initialLobbies.length); li++) {
      const origStacks = initialLobbies[li]?.stacks ?? [];
      const newS = cleanLobbies[li]?.stacks ?? [];
      for (let si = 0; si < Math.min(newS.length, origStacks.length); si++) {
        if (origStacks[si] && newS[si] && origStacks[si] !== newS[si]) {
          renames.push({ oldStack: origStacks[si], newStack: newS[si] });
        }
      }
    }

    // Strip empty labels before saving
    const cleanLabels: Record<string, string> = {};
    for (const [k, v] of Object.entries(floorLabels)) {
      if (v.trim()) cleanLabels[k] = v.trim();
    }

    // Detect floor renames by comparing initial label vs current label for each position
    const floorRenames: { oldFloor: string; newFloor: string }[] = [];
    for (let pos = 1; pos <= block.floors; pos++) {
      const oldLabel = (initialFloorLabels[String(pos)] || String(pos)).trim();
      const newLabel = (floorLabels[String(pos)] || String(pos)).trim();
      if (oldLabel !== newLabel && newLabel) {
        floorRenames.push({ oldFloor: oldLabel, newFloor: newLabel });
      }
    }

    dispatch({
      type: "UPDATE_BLOCK_META",
      blockId: block.id,
      name: name.trim() || block.name,
      precinct: precinct.trim() || block.precinct,
      floors,
      lobbies: cleanLobbies,
      renames,
      floorRenames,
      floorLabels: cleanLabels,
    });
    toast.success("Block options saved.");
    onClose();
  }

  function deleteBlock() {
    dispatch({ type: "DELETE_BLOCK", blockId: block.id });
    toast.success(`${block.name} deleted.`);
    onClose();
  }

  return (
    <>
      <Dialog open={open && !confirmDelete} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Block Options — {block.name}</DialogTitle>
          </DialogHeader>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="floors">Floors</TabsTrigger>
              <TabsTrigger value="lobbies">Lobbies & Stacks</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>Block number / name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Blk 406a" />
              </div>
              <div className="space-y-1">
                <Label>Precinct</Label>
                <Input value={precinct} onChange={(e) => setPrecinct(e.target.value)} placeholder="e.g. Precinct 12" />
              </div>
              <div className="border-t pt-3">
                <Button
                  variant="destructive"
                  className="w-full gap-1.5"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="h-4 w-4" /> Delete Block
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="floors" className="mt-4 space-y-3">
              <div className="space-y-1">
                <Label>Number of floors</Label>
                <Input
                  type="number"
                  min={1}
                  value={floors}
                  onChange={(e) => setFloors(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              {floors < block.floors && (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-2.5 text-sm text-amber-700">
                  ⚠ Reducing floors will hide units above floor {floors}. Data is preserved but marked inactive.
                </p>
              )}
              {floors > block.floors && (
                <p className="rounded-md border border-emerald-200 bg-emerald-50 p-2.5 text-sm text-emerald-700">
                  New units will be created for floors {block.floors + 1}–{floors}.
                </p>
              )}
              <div className="space-y-1">
                <Label className="text-sm">Floor numbers <span className="font-normal text-muted-foreground">(editing renames units — e.g. 1 → G makes #1-174 become #G-174)</span></Label>
                <div className="max-h-[220px] overflow-y-auto rounded-md border divide-y">
                  {Array.from({ length: floors }, (_, i) => floors - i).map((pos) => (
                    <div key={pos} className="flex items-center gap-2 px-3 py-1.5">
                      <span className="shrink-0 text-xs text-muted-foreground">Floor</span>
                      <Input
                        value={floorLabels[String(pos)] ?? String(pos)}
                        onChange={(e) => setFloorLabels({ ...floorLabels, [String(pos)]: e.target.value })}
                        className="h-6 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="lobbies" className="mt-4 space-y-3">
              <p className="text-[11px] text-muted-foreground">Editing a stack number renames it and preserves all its unit data.</p>
              <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                {lobbies.map((lobby, li) => (
                  <div key={li} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Lobby name</Label>
                        <Input
                          value={lobby.name}
                          onChange={(e) => updateLobbyName(li, e.target.value)}
                          placeholder="A, B, C…"
                          className="h-8 text-sm"
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="mt-5 shrink-0 text-muted-foreground hover:text-destructive"
                        onClick={() => removeLobby(li)}
                        title="Remove lobby"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Stacks (unit numbers)</Label>
                      <div className="space-y-1.5">
                        {lobby.stacks.map((stack, si) => (
                          <div key={si} className="flex items-center gap-1.5">
                            <Input
                              value={stack}
                              onChange={(e) => updateStack(li, si, e.target.value)}
                              placeholder="e.g. 222"
                              className="h-7 text-sm"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                              onClick={() => removeStack(li, si)}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ))}
                        <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={() => addStack(li)}>
                          <Plus className="mr-1 h-3 w-3" /> Add Stack
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" className="w-full gap-1.5" onClick={addLobby}>
                <Plus className="h-4 w-4" /> Add Lobby
              </Button>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {block.name}?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            This will permanently delete the block and all {Object.keys(block.units).length} unit records. This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            <Button variant="destructive" onClick={deleteBlock}>Delete Block</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ChartLegend({ view }: { view: "CS" | "CW" }) {
  const items =
    view === "CS"
      ? [
          { c: "bg-card border", l: "Pending" },
          { c: "bg-sky-500", l: "CS Scheduled" },
          { c: "bg-emerald-500", l: "CS Completed" },
          { c: "bg-yellow-300", l: "Opt Out" },
          { c: "bg-red-500", l: "Flagged" },
          { c: "bg-neutral-800", l: "N/A" },
        ]
      : [
          { c: "bg-card border", l: "Pending" },
          { c: "bg-orange-500", l: "CW Scheduled" },
          { c: "bg-orange-600", l: "CW In Progress" },
          { c: "bg-emerald-500", l: "Handed Over" },
          { c: "bg-yellow-300", l: "Opt Out" },
          { c: "bg-red-500", l: "Flagged" },
        ];

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3 border-t pt-3">
      {items.map((it) => (
        <div key={it.l} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className={cn("h-3 w-3 rounded", it.c)} />
          {it.l}
        </div>
      ))}
    </div>
  );
}
