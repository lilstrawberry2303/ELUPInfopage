import { useState } from "react";
import { useElup, useActiveBlock } from "@/lib/elup/store";
import { BlockChart } from "./BlockChart";
import { UnitDrawer } from "./UnitDrawer";
import { PrecinctFilter } from "./PrecinctFilter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { SignatureCanvas } from "./SignatureCanvas";
import { CheckCircle2, FileSignature, Inbox } from "lucide-react";
import { OptOutRecords } from "./OptOutRecords";
import { toast } from "sonner";

export function ClientView() {
  const { state, dispatch } = useElup();
  const block = useActiveBlock();
  const [drawerUnit, setDrawerUnit] = useState<string | null>(null);
  const [approving, setApproving] = useState<{ blockId: string; unitKey: string } | null>(null);
  const [sig, setSig] = useState("");

  const pending = state.blocks.flatMap((b) =>
    Object.entries(b.units)
      .filter(([, u]) => u.optOutRequest && !u.optOutRequest.approved)
      .map(([key, u]) => ({ block: b, unitKey: key, unit: u })),
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 px-4 py-6 md:px-8">
      <div>
        <Badge variant="outline" className="mb-2">HDB Officer · Read-only oversight</Badge>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">Programme Oversight</h1>
        <p className="text-sm text-muted-foreground">Monitor progress and approve resident opt-out requests.</p>
      </div>

      <PrecinctFilter />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BlockChart onCellClick={setDrawerUnit} />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Inbox className="h-4 w-4 text-yellow-600" /> Opt-Out Approvals
              <Badge className="ml-auto bg-yellow-500 hover:bg-yellow-500">{pending.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pending.length === 0 && (
              <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
                Inbox clear
              </p>
            )}
            {pending.map((p) => (
              <div key={`${p.block.id}-${p.unitKey}`} className="rounded-lg border-2 border-yellow-300 bg-yellow-50 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{p.block.name} · #{p.unit.floor}-{p.unit.unitNo}</div>
                    <div className="text-[11px] text-muted-foreground">Requested {p.unit.optOutRequest?.requestedDate}</div>
                  </div>
                  <FileSignature className="h-4 w-4 text-yellow-700" />
                </div>
                <p className="mt-2 text-xs">{p.unit.optOutRequest?.reason}</p>
                <Button
                  size="sm"
                  className="mt-2 w-full bg-yellow-600 hover:bg-yellow-700"
                  onClick={() => setApproving({ blockId: p.block.id, unitKey: p.unitKey })}
                >
                  Review & Sign
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <UnitDrawer unitKey={drawerUnit} onClose={() => setDrawerUnit(null)} readOnly />

      <Dialog open={!!approving} onOpenChange={(o) => { if (!o) { setApproving(null); setSig(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Approve Opt-Out Request</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Sign below to formally approve this opt-out. The unit will be locked as OPT OUT in both CS and CW charts.
          </p>
          <SignatureCanvas onChange={setSig} />
          <DialogFooter>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700"
              disabled={!sig}
              onClick={() => {
                if (!approving) return;
                dispatch({ type: "APPROVE_OPT_OUT", ...approving, signature: sig });
                toast.success("Opt-out approved and signed");
                setApproving(null);
                setSig("");
              }}
            >
              <CheckCircle2 className="mr-2 h-4 w-4" /> Approve & Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <OptOutRecords />
    </div>
  );
}
