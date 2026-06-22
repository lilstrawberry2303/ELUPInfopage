import { useMemo } from "react";
import { useElup } from "@/lib/elup/store";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Filter, MapPin, Building } from "lucide-react";

export function PrecinctFilter() {
  const { state, dispatch } = useElup();
  const active = state.blocks.find((b) => b.id === state.activeBlockId) ?? state.blocks[0];

  const precincts = useMemo(
    () => Array.from(new Set(state.blocks.map((b) => b.precinct))),
    [state.blocks],
  );
  if (!active) return null;

  const blocksInPrecinct = state.blocks.filter((b) => b.precinct === active.precinct);

  return (
    <Card>
      <CardContent className="p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Filter className="h-3.5 w-3.5 text-sky-500" /> Filter View
        </div>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <div className="min-w-0">
            <Label className="flex items-center gap-1 text-[10px] sm:text-xs">
              <MapPin className="h-3 w-3" /> Precinct
            </Label>
            <Select
              value={active.precinct}
              onValueChange={(precinct) => {
                const first = state.blocks.find((b) => b.precinct === precinct);
                if (first) dispatch({ type: "SET_BLOCK", blockId: first.id });
              }}
            >
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {precincts.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-0">
            <Label className="flex items-center gap-1 text-[10px] sm:text-xs">
              <Building className="h-3 w-3" /> Block
            </Label>
            <Select
              value={active.id}
              onValueChange={(blockId) => dispatch({ type: "SET_BLOCK", blockId })}
            >
              <SelectTrigger className="h-9 text-xs sm:text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {blocksInPrecinct.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
