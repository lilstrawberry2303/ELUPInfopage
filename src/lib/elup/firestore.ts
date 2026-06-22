/**
 * Firestore-shaped read facade over the in-memory ELUP store.
 *
 * The underlying reducer (see `store.tsx`) is the source of truth. This module
 * exposes the same data in the collection / document shape described by the
 * product spec so feature code can read it as if it were talking to Firestore:
 *
 *   /precincts/{precinctId}
 *   /blocks/{blockId}
 *   /blocks/{blockId}/units/{floor_unitNumber}
 *   /appointments/{appointmentId}
 *
 * Writes are routed back through the existing reducer actions so every screen
 * stays reactive.
 */

import { useMemo } from "react";
import { useElup } from "./store";
import type { Appointment, Block, UnitData } from "./types";

// ---------- Document shapes ----------

export interface PrecinctDoc {
  id: string;
  name: string;
}

export interface BlockDoc {
  id: string;
  precinctId: string;
  blockNumber: string;
  streetName: string;
  totalFloors: number;
  unitsPerFloor: number;
  csOverallStatus: "Pending" | "In Progress" | "Completed";
  cwOverallStatus: "Pending" | "In Progress" | "Completed";
}

export interface UnitDoc {
  id: string; // `${floor}_${unitNumber}`
  blockId: string;
  floorNumber: number;
  unitNumber: string;
  lobbyName: string;
  ownerName: string | null;
  contactNumber: string | null;
  isOptedOut: boolean;
  optOutDate: string | null;
  hdbSignoffUrl: string | null;
  hdbApprovedAt: string | null;
  csStatus: "Pending" | "Scheduled" | "Completed";
  csDate: string | null;
  cwStatus: "Pending" | "Scheduled" | "In Progress" | "Completed";
  cwDate: string | null;
}

export interface AppointmentDoc {
  id: string;
  type: "CS" | "CW";
  blockId: string;
  unitId: string; // `${floor}_${unitNumber}`
  appointmentDate: string;
  status: "Scheduled" | "In Progress" | "Completed" | "No Show";
  assignedWorkerId: string;
  workData: Record<string, unknown>;
}

// ---------- Mappers ----------

function precinctId(name: string) {
  return `pr-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}`;
}

function deriveOverall(units: UnitData[], kind: "cs" | "cw"): BlockDoc["csOverallStatus"] {
  const active = units.filter((u) => u.exists && u[`${kind}Status`] !== "opt_out");
  if (active.length === 0) return "Pending";
  const done = active.filter((u) => u[`${kind}Status`] === "completed").length;
  if (done === active.length) return "Completed";
  const started = active.some((u) => u[`${kind}Status`] !== "pending");
  return started ? "In Progress" : "Pending";
}

function blockToDoc(b: Block): BlockDoc {
  const units = Object.values(b.units);
  const perFloor = units.filter((u) => u.floor === 1).length || b.lobbies.reduce((n, l) => n + l.stacks.length, 0);
  return {
    id: b.id,
    precinctId: precinctId(b.precinct),
    blockNumber: b.name.replace(/^Blk\s+/i, ""),
    streetName: b.precinct,
    totalFloors: b.floors,
    unitsPerFloor: perFloor,
    csOverallStatus: deriveOverall(units, "cs"),
    cwOverallStatus: deriveOverall(units, "cw"),
  };
}

function statusToTitle(s: UnitData["csStatus"]): UnitDoc["csStatus"] {
  if (s === "scheduled") return "Scheduled";
  if (s === "completed") return "Completed";
  return "Pending";
}
function cwStatusToTitle(s: UnitData["cwStatus"]): UnitDoc["cwStatus"] {
  if (s === "scheduled") return "Scheduled";
  if (s === "in_progress") return "In Progress";
  if (s === "completed") return "Completed";
  return "Pending";
}

function unitToDoc(blockId: string, key: string, u: UnitData): UnitDoc {
  const opted = u.csStatus === "opt_out" || !!u.optOutRequest?.approved;
  return {
    id: key.replace("-", "_"),
    blockId,
    floorNumber: u.floor,
    unitNumber: u.unitNo,
    lobbyName: u.lobby,
    ownerName: u.resident?.name ?? null,
    contactNumber: u.resident?.phone ?? null,
    isOptedOut: opted,
    optOutDate: u.optOutRequest?.requestedDate ?? null,
    hdbSignoffUrl: u.optOutRequest?.signature ?? null,
    hdbApprovedAt: u.optOutRequest?.hdbApprovedAt ?? null,
    csStatus: opted ? "Pending" : statusToTitle(u.csStatus),
    csDate: u.csDate ?? null,
    cwStatus: opted ? "Pending" : cwStatusToTitle(u.cwStatus),
    cwDate: u.cwDate ?? null,
  };
}

// ---------- Read hooks ----------

export function usePrecincts(): PrecinctDoc[] {
  const { state } = useElup();
  return useMemo(() => {
    const map = new Map<string, PrecinctDoc>();
    state.blocks.forEach((b) => {
      const id = precinctId(b.precinct);
      if (!map.has(id)) map.set(id, { id, name: b.precinct });
    });
    return Array.from(map.values());
  }, [state.blocks]);
}

export function useBlocks(filterPrecinctId?: string): BlockDoc[] {
  const { state } = useElup();
  return useMemo(() => {
    const all = state.blocks.map(blockToDoc);
    return filterPrecinctId ? all.filter((b) => b.precinctId === filterPrecinctId) : all;
  }, [state.blocks, filterPrecinctId]);
}

export function useUnits(blockId: string): UnitDoc[] {
  const { state } = useElup();
  return useMemo(() => {
    const b = state.blocks.find((x) => x.id === blockId);
    if (!b) return [];
    return Object.entries(b.units).map(([k, u]) => unitToDoc(b.id, k, u));
  }, [state.blocks, blockId]);
}

/**
 * Derives the universal /appointments timeline. Combines explicit
 * `appointments` log entries with scheduled/completed unit state so the
 * timeline reflects everything the UI shows, even when units were seeded
 * directly without a corresponding appointment doc.
 */
export function useAppointments(filter?: {
  type?: "CS" | "CW";
  status?: AppointmentDoc["status"];
  fromIso?: string;
  toIso?: string;
}): AppointmentDoc[] {
  const { state } = useElup();
  return useMemo(() => {
    const out: AppointmentDoc[] = [];

    // Explicit appointment docs
    state.appointments.forEach((a) => {
      out.push(toAppointmentDoc(a));
    });

    // Derived from unit scheduling state
    state.blocks.forEach((b) => {
      Object.entries(b.units).forEach(([k, u]) => {
        const unitId = k.replace("-", "_");
        if (u.csStatus === "scheduled" || u.csStatus === "completed") {
          out.push({
            id: `derived-cs-${b.id}-${unitId}`,
            type: "CS",
            blockId: b.id,
            unitId,
            appointmentDate: isoFromDmy(u.csDate, u.csTime),
            status: u.csStatus === "completed" ? "Completed" : "Scheduled",
            assignedWorkerId: u.csAssignee ?? "unassigned",
            workData: u.survey ? { survey: u.survey } : {},
          });
        }
        if (u.cwStatus === "scheduled" || u.cwStatus === "in_progress" || u.cwStatus === "completed") {
          out.push({
            id: `derived-cw-${b.id}-${unitId}`,
            type: "CW",
            blockId: b.id,
            unitId,
            appointmentDate: isoFromDmy(u.cwDate, u.cwTime),
            status:
              u.cwStatus === "completed" ? "Completed" : u.cwStatus === "in_progress" ? "In Progress" : "Scheduled",
            assignedWorkerId: u.cwAssignee ?? "unassigned",
            workData: u.cableWork ? { cableWork: u.cableWork } : {},
          });
        }
      });
    });

    return out.filter((a) => {
      if (filter?.type && a.type !== filter.type) return false;
      if (filter?.status && a.status !== filter.status) return false;
      if (filter?.fromIso && a.appointmentDate < filter.fromIso) return false;
      if (filter?.toIso && a.appointmentDate > filter.toIso) return false;
      return true;
    });
  }, [state.appointments, state.blocks, filter?.type, filter?.status, filter?.fromIso, filter?.toIso]);
}

function toAppointmentDoc(a: Appointment): AppointmentDoc {
  return {
    id: a.id,
    type: a.type,
    blockId: a.blockId,
    unitId: a.unitKey.replace("-", "_"),
    appointmentDate: isoFromDmy(a.date, a.time),
    status: "Scheduled",
    assignedWorkerId: a.assignee,
    workData: {},
  };
}

export function isoFromDmy(dmy?: string, time?: string): string {
  if (!dmy) return "";
  const [dd, mm, yy] = dmy.split(/[/.]/);
  if (!dd || !mm || !yy) return "";
  const t = (time ?? "00:00").split("-")[0];
  return `20${yy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}T${t}:00`;
}
