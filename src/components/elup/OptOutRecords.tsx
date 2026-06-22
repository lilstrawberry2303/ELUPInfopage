import { useMemo, useState } from "react";
import { useElup } from "@/lib/elup/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Clock, FileText, X } from "lucide-react";

export function OptOutRecords() {
  const { state } = useElup();
  const [selPrecinct, setSelPrecinct] = useState("");
  const [selBlockId, setSelBlockId] = useState("");
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const precincts = useMemo(
    () => Array.from(new Set(state.blocks.map((b) => b.precinct))).sort(),
    [state.blocks],
  );
  const blocksForPrecinct = useMemo(
    () => state.blocks.filter((b) => b.precinct === selPrecinct),
    [state.blocks, selPrecinct],
  );
  const selectedBlock = useMemo(
    () => state.blocks.find((b) => b.id === selBlockId),
    [state.blocks, selBlockId],
  );

  const records = useMemo(() => {
    if (!selectedBlock) return [];
    return Object.entries(selectedBlock.units)
      .filter(([, u]) => u.exists && u.optOutRequest)
      .map(([key, u]) => ({ key, u }))
      .sort((a, b) => (a.u.optOutRequest?.requestedDate ?? "").localeCompare(b.u.optOutRequest?.requestedDate ?? ""));
  }, [selectedBlock]);

  const totalOptOuts = useMemo(
    () => state.blocks.reduce(
      (n, b) => n + Object.values(b.units).filter((u) => u.exists && u.optOutRequest).length,
      0,
    ),
    [state.blocks],
  );

  return (
    <>
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setLightboxUrl(null)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setLightboxUrl(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <img
            src={lightboxUrl}
            alt="Signature"
            className="max-h-[80vh] max-w-[90vw] rounded bg-white p-2 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4 text-yellow-600" /> Opt-Out Records
            <Badge className="ml-auto bg-yellow-500 hover:bg-yellow-500">{totalOptOuts} total</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Precinct</Label>
              <Select
                value={selPrecinct}
                onValueChange={(v) => { setSelPrecinct(v); setSelBlockId(""); }}
              >
                <SelectTrigger><SelectValue placeholder="Select precinct" /></SelectTrigger>
                <SelectContent>
                  {precincts.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Block</Label>
              <Select
                value={selBlockId}
                onValueChange={setSelBlockId}
                disabled={!selPrecinct}
              >
                <SelectTrigger><SelectValue placeholder="Select block" /></SelectTrigger>
                <SelectContent>
                  {blocksForPrecinct.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {!selBlockId && (
            <div className="rounded-md border border-dashed bg-muted/30 py-6 text-center text-sm text-muted-foreground">
              Select a precinct and block to view opt-out records.
            </div>
          )}

          {selBlockId && records.length === 0 && (
            <div className="rounded-md border border-dashed bg-muted/30 py-6 text-center text-sm text-muted-foreground">
              No opt-out records for {selectedBlock?.name}.
            </div>
          )}

          {records.map(({ key, u }) => {
            const req = u.optOutRequest!;
            return (
              <div
                key={key}
                className={`rounded-lg border p-4 space-y-3 ${
                  req.approved
                    ? "border-emerald-200 bg-emerald-50"
                    : "border-yellow-200 bg-yellow-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {selectedBlock?.name} · #{u.floor}-{u.unitNo}
                      <span className="ml-2 text-xs text-muted-foreground">Lobby {u.lobby}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">Requested {req.requestedDate}</div>
                  </div>
                  {req.approved ? (
                    <Badge className="bg-emerald-600 hover:bg-emerald-600 gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Approved
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="border-yellow-400 text-yellow-700 gap-1">
                      <Clock className="h-3 w-3" /> Pending
                    </Badge>
                  )}
                </div>

                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">Reason</div>
                  <p className="text-sm">{req.reason}</p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {req.signature && (
                    <button
                      className="flex items-center gap-1 text-xs text-sky-700 hover:underline"
                      onClick={() => setLightboxUrl(req.signature!)}
                    >
                      <FileText className="h-3 w-3" /> View resident signature
                    </button>
                  )}
                  {req.approved && req.hdbSignoffUrl && (
                    <button
                      className="flex items-center gap-1 text-xs text-emerald-700 hover:underline"
                      onClick={() => setLightboxUrl(req.hdbSignoffUrl!)}
                    >
                      <CheckCircle2 className="h-3 w-3" /> View HDB officer signature
                      {req.hdbApprovedAt && (
                        <span className="text-muted-foreground ml-1">
                          · {new Date(req.hdbApprovedAt).toLocaleDateString()}
                        </span>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </>
  );
}
