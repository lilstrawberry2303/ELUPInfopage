export type Role = "manager" | "surveyor" | "technician" | "client";

export type UnitStatus =
  | "pending"
  | "cs_scheduled"
  | "cs_completed"
  | "cw_scheduled"
  | "cw_in_progress"
  | "completed"
  | "opt_out"
  | "disabled";

export type GateType = "alum" | "mild_steel" | "wrought" | "ss";
export type DoorFrameCondition = "crack" | "chipped" | "scratch" | "warped" | "ok";
export type MainDoorType = "original" | "replaced" | "fire_rated";
export type ElectDBBoxLocation = "cornice" | "false_ceiling" | "cabinet" | "obstruction";
export type WallCondition = "uneven" | "plastered" | "rockstone" | "wallpaper";
export type CeilingCondition = "cornice" | "false_ceiling" | "rockstone" | "wallpaper";

export interface UnitData {
  unitNo: string;
  floor: number;
  lobby: string;
  exists: boolean;
  csStatus: "pending" | "scheduled" | "completed" | "opt_out";
  csDate?: string;
  csTime?: string;
  csAssignee?: string;
  csNotes?: string;
  csReminder1?: string;
  csReminder2?: string;
  cwStatus: "pending" | "scheduled" | "in_progress" | "completed" | "opt_out";
  cwDate?: string;
  cwTime?: string;
  cwAssignee?: string;
  cwNotes?: string;
  flagged?: boolean;
  flagNote?: string;
  flagForAttention?: string;
  documents?: { name: string; url: string }[];
  resident?: { name: string; phone: string };
  survey?: {
    surveyDateTime?: string;
    existingLoadAmps: number;
    condition: "good" | "fair" | "poor";
    gateTypes?: GateType[];
    doorFrame?: DoorFrameCondition[];
    mainDoor?: MainDoorType[];
    electDBBox?: ElectDBBoxLocation[];
    wall?: WallCondition[];
    ceiling?: CeilingCondition[];
    notes: string;
    photos: string[];
    residentSignature?: string;
    signature?: string;
    ownerName?: string;
    ownerPhone?: string;
    scheduledCableWorkDate?: string;
    scheduledCableWorkTime?: string;
    custom?: Record<string, string | boolean | string[]>;
  };
  cableWork?: {
    scheduledDate?: string;
    scheduledTime?: string;
    technician: string;
    cableType?: string;
    photos?: string[];
    beforePhoto?: string;
    afterPhoto?: string;
    notes: string;
  };
  optOutRequest?: {
    reason: string;
    requestedDate: string;
    signature?: string;
    approved: boolean;
    hdbApprovedAt?: string;
    hdbSignoffUrl?: string;
  };
  csDraft?: {
    ownerName?: string;
    ownerPhone?: string;
    surveyDateTime?: string;
    amps?: number;
    condition?: "good" | "fair" | "poor";
    notes?: string;
    photos?: string[];
    gateTypes?: string[];
    doorFrame?: string[];
    mainDoor?: string[];
    electDBBox?: string[];
    wall?: string[];
    ceiling?: string[];
    scheduledCableWorkDate?: string;
    scheduledCableWorkTime?: string;
    scheduledCableWorkTechnician?: string;
    customValues?: Record<string, string | boolean | string[]>;
  } | null;
}

export interface Block {
  id: string;
  name: string;
  precinct: string;
  /** Firestore document ID of the parent precinct — used to build write paths */
  precinctId: string;
  floors: number;
  /** Custom display label for each floor (key = floor number as string) */
  floorLabels?: Record<string, string>;
  lobbies: { name: string; stacks: string[] }[];
  units: Record<string, UnitData>;
}

export interface Appointment {
  id: string;
  blockId: string;
  unitKey: string;
  type: "CS" | "CW";
  date: string;
  time: string;
  assignee: string;
}

export interface Account {
  id: string;
  name: string;
  role: "manager" | "surveyor" | "technician" | "client";
  username: string;
  password: string;
}

export type DefaultSurveyGroup = "gate" | "doorFrame" | "mainDoor" | "electDBBox" | "wall" | "ceiling" | "scheduledCableWork";

export interface CustomSurveyField {
  id: string;
  label: string;
  type: "text" | "checkbox" | "checkbox_group";
  options?: string[];
}

export interface BlockedDate {
  id: string;
  date: string; // "DD/MM/YY"
  reason: string;
  type: "CS" | "CW" | "both";
}
