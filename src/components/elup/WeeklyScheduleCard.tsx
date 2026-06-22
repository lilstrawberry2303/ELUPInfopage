import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarRange, Printer } from "lucide-react";
import { useAppointments } from "@/lib/elup/firestore";
import { useElup } from "@/lib/elup/store";

/**
 * Weekly Schedule Generator (Manager): printable list of CW appointments
 * scheduled within the upcoming 7 days, sourced from the /appointments
 * collection via the firestore facade.
 */
export function WeeklyScheduleCard() {
  const { state } = useElup();
  const now = new Date();
  const in7 = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const appts = useAppointments({
    type: "CW",
    status: "Scheduled",
    fromIso: now.toISOString().slice(0, 19),
    toIso: in7.toISOString().slice(0, 19),
  });

  const rows = useMemo(() => {
    return [...appts]
      .sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate))
      .map((a) => {
        const block = state.blocks.find((b) => b.id === a.blockId);
        const [floor, unit] = a.unitId.split("_");
        const u = block?.units[`${floor}-${unit}`];
        return {
          id: a.id,
          when: a.appointmentDate.replace("T", " "),
          block: block?.name ?? a.blockId,
          unit: `#${floor}-${unit}${u?.lobby ? ` · Lobby ${u.lobby}` : ""}`,
          assignee: a.assignedWorkerId,
        };
      });
  }, [appts, state.blocks]);

  return (
    <Card className="print:shadow-none">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <CalendarRange className="h-4 w-4 text-orange-500" />
          Weekly CW Schedule
          <Badge variant="outline" className="text-[10px]">Next 7 days</Badge>
          <Badge className="ml-1 bg-orange-500 hover:bg-orange-500">{rows.length}</Badge>
        </CardTitle>
        <Button size="sm" variant="outline" onClick={() => window.print()} className="print:hidden">
          <Printer className="mr-2 h-3.5 w-3.5" /> Print
        </Button>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            No scheduled cable work in the next 7 days.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr><th className="py-2">Date / Time</th><th>Block</th><th>Unit</th><th>Technician</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="py-2 font-medium">{r.when}</td>
                    <td>{r.block}</td>
                    <td>{r.unit}</td>
                    <td className="text-muted-foreground">{r.assignee}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
