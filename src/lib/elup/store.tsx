import {
  createContext, useCallback, useContext, useEffect, useMemo,
  useReducer, useRef, useState, type ReactNode,
} from "react";
import {
  collection, collectionGroup, doc, setDoc, updateDoc, deleteDoc,
  addDoc, writeBatch, onSnapshot, serverTimestamp,
} from "firebase/firestore";
import { db, uploadSignatureToStorage, saveOptOutRecord, saveSurveyConfig, saveBlockedDates } from "@/lib/firebase";
import type { Block, Role, Appointment, UnitData, Account, CustomSurveyField, DefaultSurveyGroup, BlockedDate } from "./types";

// ---- Helpers ----
function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "default";
}

function cleanObj(data: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}

// ---- Block metadata shape from Firestore ----
interface BlockMeta {
  name: string;
  precinct: string;
  precinctId: string;
  floors: number;
  floorLabels?: Record<string, string>;
  lobbies: { name: string; stacks: string[] }[];
}

// ---- Full state interface (backwards-compatible with all consumers) ----
interface State {
  role: Role;
  activeBlockId: string;
  chartView: "CS" | "CW";
  blocks: Block[];
  accounts: Account[];
  appointments: Appointment[];
  optOutRequests: Array<{
    blockId: string;
    unitKey: string;
    reason: string;
    requestedDate: string;
    signature?: string;
    approved: boolean;
  }>;
  customSurveyFields: CustomSurveyField[];
  hiddenSurveyGroups: DefaultSurveyGroup[];
  blockedDates: BlockedDate[];
  loading: boolean;
}

// ---- Action types (identical contract to previous store) ----
type Action =
  | { type: "SET_ROLE"; role: Role }
  | { type: "SET_BLOCK"; blockId: string }
  | { type: "SET_VIEW"; view: "CS" | "CW" }
  | { type: "UPDATE_UNIT"; blockId: string; unitKey: string; patch: Partial<UnitData> }
  | { type: "ADD_APPOINTMENT"; appt: Appointment }
  | { type: "REQUEST_OPT_OUT"; blockId: string; unitKey: string; reason: string; signature: string }
  | { type: "APPROVE_OPT_OUT"; blockId: string; unitKey: string; signature: string }
  | { type: "REVERT_OPT_OUT"; blockId: string; unitKey: string }
  | { type: "ADD_BLOCK"; block: Omit<Block, "precinctId"> }
  | { type: "ADD_ACCOUNT"; account: Account }
  | { type: "UPDATE_ACCOUNT"; id: string; patch: Partial<Account> }
  | { type: "DELETE_ACCOUNT"; id: string }
  | { type: "RENAME_STACK"; blockId: string; lobbyName: string; oldStack: string; newStack: string }
  | { type: "UPDATE_BLOCK_META"; blockId: string; name: string; precinct: string; floors: number; lobbies: { name: string; stacks: string[] }[]; renames: { oldStack: string; newStack: string }[]; floorRenames: { oldFloor: string; newFloor: string }[]; floorLabels: Record<string, string> }
  | { type: "DELETE_BLOCK"; blockId: string }
  | { type: "ADD_SURVEY_FIELD"; field: CustomSurveyField }
  | { type: "DELETE_SURVEY_FIELD"; id: string }
  | { type: "TOGGLE_SURVEY_GROUP"; group: DefaultSurveyGroup }
  | { type: "ADD_BLOCKED_DATE"; date: BlockedDate }
  | { type: "REMOVE_BLOCKED_DATE"; id: string };

// ---- Local-only UI state (never touches Firestore) ----
interface LocalState {
  role: Role;
  activeBlockId: string;
  chartView: "CS" | "CW";
  customSurveyFields: CustomSurveyField[];
  hiddenSurveyGroups: DefaultSurveyGroup[];
  blockedDates: BlockedDate[];
}

type LocalAction =
  | { type: "SET_ROLE"; role: Role }
  | { type: "SET_BLOCK"; blockId: string }
  | { type: "SET_VIEW"; view: "CS" | "CW" }
  | { type: "ADD_SURVEY_FIELD"; field: CustomSurveyField }
  | { type: "DELETE_SURVEY_FIELD"; id: string }
  | { type: "TOGGLE_SURVEY_GROUP"; group: DefaultSurveyGroup }
  | { type: "SET_SURVEY_CONFIG"; customSurveyFields: CustomSurveyField[]; hiddenSurveyGroups: DefaultSurveyGroup[] }
  | { type: "ADD_BLOCKED_DATE"; date: BlockedDate }
  | { type: "REMOVE_BLOCKED_DATE"; id: string }
  | { type: "SET_BLOCKED_DATES"; dates: BlockedDate[] };

function localReducer(state: LocalState, action: LocalAction): LocalState {
  switch (action.type) {
    case "SET_ROLE":         return { ...state, role: action.role };
    case "SET_BLOCK":        return { ...state, activeBlockId: action.blockId };
    case "SET_VIEW":         return { ...state, chartView: action.view };
    case "ADD_SURVEY_FIELD": return { ...state, customSurveyFields: [...state.customSurveyFields, action.field] };
    case "DELETE_SURVEY_FIELD":
      return { ...state, customSurveyFields: state.customSurveyFields.filter((f) => f.id !== action.id) };
    case "TOGGLE_SURVEY_GROUP":
      return {
        ...state,
        hiddenSurveyGroups: state.hiddenSurveyGroups.includes(action.group)
          ? state.hiddenSurveyGroups.filter((g) => g !== action.group)
          : [...state.hiddenSurveyGroups, action.group],
      };
    case "SET_SURVEY_CONFIG":
      return { ...state, customSurveyFields: action.customSurveyFields, hiddenSurveyGroups: action.hiddenSurveyGroups };
    case "ADD_BLOCKED_DATE":
      return { ...state, blockedDates: [...state.blockedDates, action.date] };
    case "REMOVE_BLOCKED_DATE":
      return { ...state, blockedDates: state.blockedDates.filter((d) => d.id !== action.id) };
    case "SET_BLOCKED_DATES":
      return { ...state, blockedDates: action.dates };
  }
}

// Safe fallback when no blocks have loaded yet
const EMPTY_BLOCK: Block = { id: "", name: "Loading…", precinct: "", precinctId: "", floors: 0, lobbies: [], units: {} };

// ---- Context ----
const ElupContext = createContext<{
  state: State;
  dispatch: (action: Action) => void;
  updateUnitStatus: (precinctId: string, blockId: string, unitKey: string, patch: Record<string, unknown>) => Promise<void>;
  logActivity: (type: string, description: string, operator: string, metadata?: Record<string, unknown>) => Promise<void>;
  onboardUser: (account: { username: string; password: string; role: string; name?: string }) => Promise<void>;
  removeUser: (username: string) => Promise<void>;
} | null>(null);

export function ElupProvider({ children, initialRole = "manager" }: { children: ReactNode; initialRole?: Role }) {
  // ---- Local UI state ----
  const [local, localDispatch] = useReducer(localReducer, {
    role: initialRole,
    activeBlockId: "",
    chartView: "CS",
    customSurveyFields: [],
    hiddenSurveyGroups: [],
    blockedDates: [],
  });

  // ---- Firestore reactive state ----
  const [blockMetas, setBlockMetas] = useState<Map<string, BlockMeta>>(new Map());
  const [unitMap, setUnitMap]       = useState<Map<string, Record<string, UnitData>>>(new Map());
  const [accounts, setAccounts]     = useState<Account[]>([]);
  const [loading, setLoading]       = useState(true);

  // Refs so async handlers always see the latest values without re-creating callbacks
  const blockMetasRef = useRef(blockMetas);
  useEffect(() => { blockMetasRef.current = blockMetas; }, [blockMetas]);
  const localRef = useRef(local);
  useEffect(() => { localRef.current = local; }, [local]);

  // ---- Derive blocks from Firestore snapshots ----
  const blocks = useMemo<Block[]>(
    () =>
      Array.from(blockMetas.entries()).map(([blockId, meta]) => ({
        id: blockId,
        name: meta.name,
        precinct: meta.precinct,
        precinctId: meta.precinctId,
        floors: meta.floors,
        floorLabels: meta.floorLabels,
        lobbies: meta.lobbies,
        units: unitMap.get(blockId) ?? {},
      })),
    [blockMetas, unitMap],
  );

  const blocksRef = useRef(blocks);
  useEffect(() => { blocksRef.current = blocks; }, [blocks]);

  // Auto-select first block once data arrives
  useEffect(() => {
    if (blocks.length > 0 && !blocks.find((b) => b.id === local.activeBlockId)) {
      localDispatch({ type: "SET_BLOCK", blockId: blocks[0].id });
    }
  }, [blocks, local.activeBlockId]);

  // ---- Firestore real-time listeners ----
  useEffect(() => {
    let blocksDone = false;
    let unitsDone = false;
    const tryDone = () => { if (blocksDone && unitsDone) setLoading(false); };

    // Real-time listener for survey config (custom fields + hidden groups)
    const unsubSurveyConfig = onSnapshot(
      doc(db(), "config", "survey"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          localDispatch({
            type: "SET_SURVEY_CONFIG",
            customSurveyFields: Array.isArray(d.customSurveyFields) ? d.customSurveyFields as CustomSurveyField[] : [],
            hiddenSurveyGroups: Array.isArray(d.hiddenSurveyGroups) ? d.hiddenSurveyGroups as DefaultSurveyGroup[] : [],
          });
        } else {
          // Doc doesn't exist yet - try localStorage as initial seed
          try {
            const raw = localStorage.getItem("elup_survey_config");
            if (raw) {
              const d = JSON.parse(raw) as { customSurveyFields: CustomSurveyField[]; hiddenSurveyGroups: DefaultSurveyGroup[] };
              localDispatch({
                type: "SET_SURVEY_CONFIG",
                customSurveyFields: Array.isArray(d.customSurveyFields) ? d.customSurveyFields : [],
                hiddenSurveyGroups: Array.isArray(d.hiddenSurveyGroups) ? d.hiddenSurveyGroups : [],
              });
            }
          } catch { /* ignore */ }
        }
      },
      (err) => {
        console.warn("[elup] survey config listener:", err);
        // Firestore unavailable - fall back to localStorage
        try {
          const raw = localStorage.getItem("elup_survey_config");
          if (raw) {
            const d = JSON.parse(raw) as { customSurveyFields: CustomSurveyField[]; hiddenSurveyGroups: DefaultSurveyGroup[] };
            localDispatch({
              type: "SET_SURVEY_CONFIG",
              customSurveyFields: Array.isArray(d.customSurveyFields) ? d.customSurveyFields : [],
              hiddenSurveyGroups: Array.isArray(d.hiddenSurveyGroups) ? d.hiddenSurveyGroups : [],
            });
          }
        } catch { /* ignore */ }
      },
    );

    const unsubBlockedDates = onSnapshot(
      doc(db(), "config", "blockedDates"),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          localDispatch({
            type: "SET_BLOCKED_DATES",
            dates: Array.isArray(d.dates) ? d.dates as BlockedDate[] : [],
          });
        }
      },
      (err) => console.warn("[elup] blockedDates listener:", err),
    );

    const unsubBlocks = onSnapshot(
      collectionGroup(db(), "blocks"),
      (snap) => {
        const metas = new Map<string, BlockMeta>();
        snap.forEach((d) => {
          const data = d.data();
          const precinctId = d.ref.parent.parent?.id ?? "default";
          metas.set(d.id, {
            name:        data.name        ?? d.id,
            precinct:    data.precinct    ?? "",
            precinctId,
            floors:      data.floors      ?? 1,
            floorLabels: data.floorLabels ?? undefined,
            lobbies:     data.lobbies     ?? [],
          });
        });
        blockMetasRef.current = metas;
        setBlockMetas(metas);
        blocksDone = true;
        tryDone();
      },
      (err) => { console.error("[elup] blocks listener:", err); blocksDone = true; tryDone(); },
    );

    const unsubUnits = onSnapshot(
      collectionGroup(db(), "units"),
      (snap) => {
        const map = new Map<string, Record<string, UnitData>>();
        snap.forEach((d) => {
          const blockId = d.ref.parent.parent?.id ?? "";
          if (!blockId) return;
          if (!map.has(blockId)) map.set(blockId, {});
          map.get(blockId)![d.id] = d.data() as UnitData;
        });
        setUnitMap(map);
        unitsDone = true;
        tryDone();
      },
      (err) => { console.error("[elup] units listener:", err); unitsDone = true; tryDone(); },
    );

    const unsubUsers = onSnapshot(
      collection(db(), "users"),
      (snap) => {
        setAccounts(
          snap.docs.map((d) => {
            const data = d.data();
            return {
              id:       d.id,
              name:     data.name     ?? d.id,
              username: data.username ?? d.id,
              password: data.password ?? "",
              role:     data.role     ?? "surveyor",
            } as Account;
          }),
        );
      },
      (err) => console.error("[elup] users listener:", err),
    );

    return () => { unsubSurveyConfig(); unsubBlockedDates(); unsubBlocks(); unsubUnits(); unsubUsers(); };
  }, []);

  // ---- Utility functions (exposed in context value) ----
  const updateUnitStatus = useCallback(async (
    precinctId: string, blockId: string, unitKey: string, patch: Record<string, unknown>,
  ) => {
    await setDoc(
      doc(db(), "precincts", precinctId, "blocks", blockId, "units", unitKey),
      { ...cleanObj(patch), updatedAt: serverTimestamp() },
      { merge: true },
    );
  }, []);

  const logActivity = useCallback(async (
    type: string, description: string, operator: string, metadata?: Record<string, unknown>,
  ) => {
    await addDoc(collection(db(), "recentActivity"), {
      type, description, operator,
      metadata: metadata ?? {},
      timestamp: serverTimestamp(),
    });
  }, []);

  const onboardUser = useCallback(async (account: {
    username: string; password: string; role: string; name?: string;
  }) => {
    const username = account.username.trim().toLowerCase();
    await setDoc(doc(db(), "users", username), cleanObj({
      username,
      password: account.password,
      role:     account.role,
      name:     account.name ?? username,
    }));
  }, []);

  const removeUser = useCallback(async (username: string) => {
    await deleteDoc(doc(db(), "users", username.trim().toLowerCase()));
  }, []);

  // ---- Dispatch — routes local actions to useReducer, data actions to Firestore ----
  const dispatch = useCallback(
    (action: Action) => {
      (async () => {
        switch (action.type) {
          // Pure UI state — handled locally
          case "SET_ROLE":
          case "SET_BLOCK":
          case "SET_VIEW":
            localDispatch(action as LocalAction);
            break;
          case "ADD_SURVEY_FIELD": {
            localDispatch(action as LocalAction);
            const cur = localRef.current;
            saveSurveyConfig([...cur.customSurveyFields, action.field], cur.hiddenSurveyGroups);
            break;
          }
          case "DELETE_SURVEY_FIELD": {
            localDispatch(action as LocalAction);
            const cur = localRef.current;
            saveSurveyConfig(cur.customSurveyFields.filter((f) => f.id !== action.id), cur.hiddenSurveyGroups).catch(() => {});
            break;
          }
          case "TOGGLE_SURVEY_GROUP": {
            localDispatch(action as LocalAction);
            const cur = localRef.current;
            const newHidden = cur.hiddenSurveyGroups.includes(action.group)
              ? cur.hiddenSurveyGroups.filter((g) => g !== action.group)
              : [...cur.hiddenSurveyGroups, action.group];
            saveSurveyConfig(cur.customSurveyFields, newHidden).catch(() => {});
            break;
          }

          case "ADD_BLOCKED_DATE": {
            localDispatch(action as LocalAction);
            const curBd = localRef.current;
            saveBlockedDates([...curBd.blockedDates, action.date]).catch(() => {});
            break;
          }
          case "REMOVE_BLOCKED_DATE": {
            localDispatch(action as LocalAction);
            const curBdr = localRef.current;
            saveBlockedDates(curBdr.blockedDates.filter((d) => d.id !== action.id)).catch(() => {});
            break;
          }

          case "UPDATE_UNIT": {
            const meta = blockMetasRef.current.get(action.blockId);
            if (!meta) { console.warn("[dispatch] UPDATE_UNIT: unknown blockId", action.blockId); return; }
            await updateUnitStatus(meta.precinctId, action.blockId, action.unitKey, action.patch as Record<string, unknown>);
            break;
          }

          case "ADD_APPOINTMENT": {
            const { appt } = action;
            const meta = blockMetasRef.current.get(appt.blockId);
            if (!meta) return;
            const patch =
              appt.type === "CS"
                ? { csStatus: "scheduled", csDate: appt.date, csTime: appt.time, csAssignee: appt.assignee }
                : { cwStatus: "scheduled", cwDate: appt.date, cwTime: appt.time, cwAssignee: appt.assignee };
            await updateUnitStatus(meta.precinctId, appt.blockId, appt.unitKey, patch);
            await logActivity(
              appt.type === "CS" ? "CS_SCHEDULED" : "CW_SCHEDULED",
              `${appt.type} appointment scheduled for unit ${appt.unitKey}`,
              "system",
              { blockId: appt.blockId, unitKey: appt.unitKey, date: appt.date },
            );
            break;
          }

          case "REQUEST_OPT_OUT": {
            const meta = blockMetasRef.current.get(action.blockId);
            if (!meta) return;
            const d = new Date();
            const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
            const reqBlock = blocksRef.current.find((b) => b.id === action.blockId);
            const reqUnit = reqBlock?.units[action.unitKey];
            let residentSigUrl = action.signature;
            try {
              residentSigUrl = await uploadSignatureToStorage(
                action.signature,
                `optOuts/${meta.precinctId}/${action.blockId}/${action.unitKey}/resident`,
              );
            } catch (e) {
              console.warn("[elup] resident sig upload failed", e);
            }
            await updateUnitStatus(meta.precinctId, action.blockId, action.unitKey, {
              optOutRequest: {
                reason: action.reason,
                requestedDate: dateStr,
                signature: residentSigUrl,
                approved: false,
              },
            });
            await saveOptOutRecord(meta.precinctId, action.blockId, action.unitKey, {
              unitKey: action.unitKey,
              floor: reqUnit?.floor ?? null,
              unitNo: reqUnit?.unitNo ?? null,
              lobby: reqUnit?.lobby ?? null,
              reason: action.reason,
              requestedDate: dateStr,
              residentSignatureUrl: residentSigUrl,
              approved: false,
            }).catch((e: unknown) => console.warn("[elup] saveOptOutRecord failed", e));
            break;
          }

          case "APPROVE_OPT_OUT": {
            const meta = blockMetasRef.current.get(action.blockId);
            if (!meta) return;
            const block = blocksRef.current.find((b) => b.id === action.blockId);
            const existing = block?.units[action.unitKey]?.optOutRequest;
            const approvedAt = new Date().toISOString();
            let hdbSigUrl = action.signature;
            try {
              hdbSigUrl = await uploadSignatureToStorage(
                action.signature,
                `optOuts/${meta.precinctId}/${action.blockId}/${action.unitKey}/hdb`,
              );
            } catch (e) {
              console.warn("[elup] HDB sig upload failed", e);
            }
            await updateUnitStatus(meta.precinctId, action.blockId, action.unitKey, {
              csStatus: "opt_out",
              cwStatus: "opt_out",
              optOutRequest: {
                ...(existing ?? { reason: "", requestedDate: "" }),
                approved: true,
                signature: existing?.signature ?? action.signature,
                hdbApprovedAt: approvedAt,
                hdbSignoffUrl: hdbSigUrl,
              },
            });
            await saveOptOutRecord(meta.precinctId, action.blockId, action.unitKey, {
              approved: true,
              hdbOfficerSignatureUrl: hdbSigUrl,
              hdbApprovedAt: approvedAt,
            }).catch((e: unknown) => console.warn("[elup] saveOptOutRecord (approve) failed", e));
            break;
          }

          case "REVERT_OPT_OUT": {
            const meta = blockMetasRef.current.get(action.blockId);
            if (!meta) return;
            await updateUnitStatus(meta.precinctId, action.blockId, action.unitKey, {
              csStatus: "pending",
              cwStatus: "pending",
              optOutRequest: null,
            });
            break;
          }

          case "ADD_BLOCK": {
            const { block } = action;
            const precinctId = slugify(block.precinct) || `precinct-${Date.now()}`;
            await setDoc(
              doc(db(), "precincts", precinctId, "blocks", block.id),
              cleanObj({ name: block.name, precinct: block.precinct, floors: block.floors, lobbies: block.lobbies }),
            );
            const entries = Object.entries(block.units);
            for (let i = 0; i < entries.length; i += 499) {
              const batch = writeBatch(db());
              for (const [key, unit] of entries.slice(i, i + 499)) {
                batch.set(
                  doc(db(), "precincts", precinctId, "blocks", block.id, "units", key),
                  cleanObj(unit as unknown as Record<string, unknown>),
                );
              }
              await batch.commit();
            }
            break;
          }

          case "ADD_ACCOUNT": {
            const { account } = action;
            await onboardUser({
              username: account.username,
              password: account.password,
              role:     account.role,
              name:     account.name,
            });
            break;
          }

          case "UPDATE_ACCOUNT": {
            const patch = cleanObj(action.patch as Record<string, unknown>);
            if (Object.keys(patch).length === 0) return;
            await updateDoc(doc(db(), "users", action.id), patch);
            break;
          }

          case "DELETE_ACCOUNT": {
            await removeUser(action.id);
            break;
          }

          case "RENAME_STACK": {
            const meta = blockMetasRef.current.get(action.blockId);
            if (!meta) return;
            const block = blocksRef.current.find((b) => b.id === action.blockId);
            if (!block) return;
            const trimmed = action.newStack.trim();
            if (!trimmed) return;

            // Helper: split "floor-stackId" correctly even when stackId contains hyphens
            const stackFromKey = (k: string) => k.slice(k.indexOf("-") + 1);
            const floorFromKey = (k: string) => k.slice(0, k.indexOf("-"));

            const batch = writeBatch(db());
            for (const [key, unit] of Object.entries(block.units)) {
              // Match by stack ID only — lobby check omitted because unit.lobby may be
              // stale if the lobby was renamed after the units were originally created.
              if (stackFromKey(key) === action.oldStack) {
                const newKey = `${floorFromKey(key)}-${trimmed}`;
                batch.set(
                  doc(db(), "precincts", meta.precinctId, "blocks", action.blockId, "units", newKey),
                  cleanObj({ ...(unit as unknown as Record<string, unknown>), unitNo: trimmed }),
                );
                batch.delete(
                  doc(db(), "precincts", meta.precinctId, "blocks", action.blockId, "units", key),
                );
              }
            }
            // Update the lobbies array: replace oldStack with trimmed in every lobby
            // (handles the case where the same stack number appears in multiple lobbies)
            const updatedLobbies = block.lobbies.map((lo) => ({
              ...lo,
              stacks: lo.stacks.map((s) => (s === action.oldStack ? trimmed : s)),
            }));
            batch.update(
              doc(db(), "precincts", meta.precinctId, "blocks", action.blockId),
              { lobbies: updatedLobbies },
            );
            await batch.commit();
            break;
          }

          case "UPDATE_BLOCK_META": {
            const meta = blockMetasRef.current.get(action.blockId);
            if (!meta) return;
            const block = blocksRef.current.find((b) => b.id === action.blockId);
            if (!block) return;

            const { precinctId } = meta;
            const { blockId } = action;
            const _db = db();

            // Helper: extract stack ID from "floor-stackId" key (stackId may contain hyphens)
            const stackIdFromKey = (k: string) => k.slice(k.indexOf("-") + 1);
            const floorFromKey   = (k: string) => k.slice(0, k.indexOf("-"));

            // Build stack→lobby maps
            const oldStacks = new Map<string, string>();
            for (const l of block.lobbies) for (const s of l.stacks) oldStacks.set(s, l.name);
            const newStacks = new Map<string, string>();
            for (const l of action.lobbies) for (const s of l.stacks) newStacks.set(s, l.name);

            const oldFloors = block.floors;
            const newFloors = action.floors;

            // Rename sets — used to exclude renamed stacks from the add/remove logic
            const renamedFromSet    = new Set(action.renames.map((r) => r.oldStack));
            const renamedToSet      = new Set(action.renames.map((r) => r.newStack));
            const renamedFloorsFrom = new Set(action.floorRenames.map((r) => r.oldFloor));

            type Op = (b: ReturnType<typeof writeBatch>) => void;
            const ops: Op[] = [];

            // 1. Update block document metadata (including floorLabels)
            ops.push((b) => b.update(
              doc(_db, "precincts", precinctId, "blocks", blockId),
              cleanObj({ name: action.name, precinct: action.precinct, floors: newFloors, lobbies: action.lobbies, floorLabels: action.floorLabels }),
            ));

            // 2. Stack renames — copy unit docs to new key (preserving all data), delete old keys
            for (const { oldStack, newStack } of action.renames) {
              const newLobby = newStacks.get(newStack);
              for (const [key, unit] of Object.entries(block.units)) {
                if (stackIdFromKey(key) === oldStack) {
                  const newKey = `${floorFromKey(key)}-${newStack}`;
                  const _key = key; const _newKey = newKey; const _newStack = newStack;
                  ops.push((b) => b.set(
                    doc(_db, "precincts", precinctId, "blocks", blockId, "units", _newKey),
                    cleanObj({ ...(unit as unknown as Record<string, unknown>), unitNo: _newStack, ...(newLobby ? { lobby: newLobby } : {}) }),
                  ));
                  ops.push((b) => b.delete(doc(_db, "precincts", precinctId, "blocks", blockId, "units", _key)));
                }
              }
            }

            // 2.5. Floor renames — copy all units on the old floor to the new floor key, delete old
            for (const { oldFloor, newFloor } of action.floorRenames) {
              for (const [key, unit] of Object.entries(block.units)) {
                if (floorFromKey(key) !== oldFloor) continue;
                const stackId = stackIdFromKey(key);
                const newKey  = `${newFloor}-${stackId}`;
                const _key = key; const _newKey = newKey; const _nf = newFloor;
                ops.push((b) => b.set(
                  doc(_db, "precincts", precinctId, "blocks", blockId, "units", _newKey),
                  cleanObj({ ...(unit as unknown as Record<string, unknown>), floor: _nf }),
                ));
                ops.push((b) => b.delete(doc(_db, "precincts", precinctId, "blocks", blockId, "units", _key)));
              }
            }

            // 3. Mark genuinely removed stacks as exists: false (skip renamed-from stacks)
            for (const [stackId] of oldStacks) {
              if (!newStacks.has(stackId) && !renamedFromSet.has(stackId)) {
                for (const [key, unit] of Object.entries(block.units)) {
                  if (stackIdFromKey(key) === stackId && unit.exists) {
                    const _key = key;
                    ops.push((b) => b.update(doc(_db, "precincts", precinctId, "blocks", blockId, "units", _key), { exists: false }));
                  }
                }
              }
            }

            // 4. Update lobby name for stacks that moved to a different lobby (skip renamed-to, handled in step 2)
            for (const [stackId, newLobby] of newStacks) {
              if (renamedToSet.has(stackId)) continue;
              const oldLobby = oldStacks.get(stackId);
              if (oldLobby !== undefined && oldLobby !== newLobby) {
                for (const [key] of Object.entries(block.units)) {
                  if (stackIdFromKey(key) === stackId) {
                    const _key = key;
                    ops.push((b) => b.update(doc(_db, "precincts", precinctId, "blocks", blockId, "units", _key), { lobby: newLobby }));
                  }
                }
              }
            }

            // Helper: resolve label for a floor position (1-based)
            const floorLabel = (pos: number) => (action.floorLabels?.[String(pos)] || String(pos)).trim() || String(pos);

            // 5. Create units for genuinely new stacks (not renames) across ALL floors
            for (const [stackId, lobbyName] of newStacks) {
              if (!oldStacks.has(stackId) && !renamedToSet.has(stackId)) {
                for (let f = 1; f <= newFloors; f++) {
                  const fId = floorLabel(f);
                  const key = `${fId}-${stackId}`;
                  const _fId = fId; const _lobby = lobbyName; const _stack = stackId;
                  ops.push((b) => b.set(
                    doc(_db, "precincts", precinctId, "blocks", blockId, "units", key),
                    { unitNo: _stack, floor: _fId, lobby: _lobby, exists: true, csStatus: "pending", cwStatus: "pending" },
                  ));
                }
              }
            }

            // 6. Create units for new floors — existing and renamed stacks (genuinely new stacks covered above)
            if (newFloors > oldFloors) {
              for (let f = oldFloors + 1; f <= newFloors; f++) {
                const fId = floorLabel(f);
                for (const [stackId, lobbyName] of newStacks) {
                  const isGenuinelyNew = !oldStacks.has(stackId) && !renamedToSet.has(stackId);
                  if (!isGenuinelyNew) {
                    const key = `${fId}-${stackId}`;
                    const _fId = fId; const _lobby = lobbyName; const _stack = stackId;
                    ops.push((b) => b.set(
                      doc(_db, "precincts", precinctId, "blocks", blockId, "units", key),
                      { unitNo: _stack, floor: _fId, lobby: _lobby, exists: true, csStatus: "pending", cwStatus: "pending" },
                    ));
                  }
                }
              }
            }

            // 7. Mark units on removed floors as exists: false (skip floors that were just renamed)
            if (newFloors < oldFloors) {
              // Collect the label-based floor IDs that are still active (positions 1..newFloors)
              const activeFloorIds = new Set(
                Array.from({ length: newFloors }, (_, i) => floorLabel(i + 1))
              );
              for (const [key, unit] of Object.entries(block.units)) {
                const fId = floorFromKey(key);
                if (!activeFloorIds.has(fId) && !renamedFloorsFrom.has(fId) && unit.exists) {
                  const _key = key;
                  ops.push((b) => b.update(doc(_db, "precincts", precinctId, "blocks", blockId, "units", _key), { exists: false }));
                }
              }
            }

            // Commit in chunks of 400
            const CHUNK = 400;
            for (let i = 0; i < ops.length; i += CHUNK) {
              const batch = writeBatch(_db);
              ops.slice(i, i + CHUNK).forEach((op) => op(batch));
              await batch.commit();
            }
            break;
          }

          case "DELETE_BLOCK": {
            const meta = blockMetasRef.current.get(action.blockId);
            if (!meta) return;
            const block = blocksRef.current.find((b) => b.id === action.blockId);
            if (!block) return;

            const _db = db();
            const unitKeys = Object.keys(block.units);
            const CHUNK = 400;
            for (let i = 0; i < unitKeys.length; i += CHUNK) {
              const batch = writeBatch(_db);
              for (const key of unitKeys.slice(i, i + CHUNK)) {
                batch.delete(doc(_db, "precincts", meta.precinctId, "blocks", action.blockId, "units", key));
              }
              await batch.commit();
            }
            await deleteDoc(doc(_db, "precincts", meta.precinctId, "blocks", action.blockId));
            break;
          }
        }
      })().catch((e) => console.error("[dispatch]", action.type, e));
    },
    [updateUnitStatus, logActivity, onboardUser, removeUser],
  );

  // ---- Derive opt-out requests from live block data ----
  const optOutRequests = useMemo(
    () =>
      blocks.flatMap((b) =>
        Object.entries(b.units)
          .filter(([, u]) => u.optOutRequest)
          .map(([unitKey, u]) => ({
            blockId:       b.id,
            unitKey,
            reason:        u.optOutRequest!.reason,
            requestedDate: u.optOutRequest!.requestedDate,
            signature:     u.optOutRequest?.signature,
            approved:      u.optOutRequest!.approved,
          })),
      ),
    [blocks],
  );

  // ---- Assembled state ----
  const state: State = useMemo(
    () => ({
      role:               local.role,
      activeBlockId:      local.activeBlockId,
      chartView:          local.chartView,
      blocks,
      accounts,
      appointments:       [],
      optOutRequests,
      customSurveyFields: local.customSurveyFields,
      hiddenSurveyGroups: local.hiddenSurveyGroups,
      blockedDates: local.blockedDates,
      loading,
    }),
    [local, blocks, accounts, optOutRequests, loading],
  );

  const value = useMemo(
    () => ({ state, dispatch, updateUnitStatus, logActivity, onboardUser, removeUser }),
    [state, dispatch, updateUnitStatus, logActivity, onboardUser, removeUser],
  );

  return <ElupContext.Provider value={value}>{children}</ElupContext.Provider>;
}

export function useElup() {
  const ctx = useContext(ElupContext);
  if (!ctx) throw new Error("useElup must be used within ElupProvider");
  return ctx;
}

export function useActiveBlock(): Block {
  const { state } = useElup();
  return state.blocks.find((b) => b.id === state.activeBlockId) ?? state.blocks[0] ?? EMPTY_BLOCK;
}
