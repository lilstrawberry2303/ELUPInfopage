import { doc, setDoc, writeBatch, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const PRECINCT_ID   = "ang-mo-kio-neighborhood-4";
const PRECINCT_NAME = "Ang Mo Kio Neighborhood 4";

type Log = (msg: string) => void;

// ── helpers ──────────────────────────────────────────────────────────────────

function baseUnit(
  floor: number,
  unitNo: string,
  lobby: string,
  exists = true,
): Record<string, unknown> {
  return { unitNo, floor, lobby, exists, csStatus: "pending", cwStatus: "pending" };
}

function withCSScheduled(
  u: Record<string, unknown>,
  csDate: string,
  csTime: string,
  residentName: string,
): Record<string, unknown> {
  return {
    ...u,
    csStatus: "scheduled",
    csDate,
    csTime,
    resident: { name: residentName, phone: "9123 4567" },
  };
}

function withCSCompleted(
  u: Record<string, unknown>,
  residentName: string,
  surveyDate: string,
): Record<string, unknown> {
  return {
    ...u,
    csStatus: "completed",
    csDate: surveyDate,
    resident: { name: residentName, phone: "9123 4567" },
    survey: {
      surveyDateTime: `20${surveyDate.slice(6, 8)}-${surveyDate.slice(3, 5)}-${surveyDate.slice(0, 2)}T10:00`,
      existingLoadAmps: 30,
      condition: "fair",
      gateTypes: ["mild_steel"],
      doorFrame: ["ok"],
      mainDoor: ["original"],
      electDBBox: ["cabinet"],
      wall: ["plastered"],
      ceiling: ["false_ceiling"],
      notes: "Existing single-phase. Distribution board accessible. Resident present.",
      photos: [],
      residentSignature: "signed",
    },
  };
}

function withCWScheduled(
  u: Record<string, unknown>,
  cwDate: string,
  cwTime: string,
  assignee = "Rajesh Kumar",
): Record<string, unknown> {
  return { ...u, cwStatus: "scheduled", cwDate, cwTime, cwAssignee: assignee };
}

function withCWCompleted(
  u: Record<string, unknown>,
  cwDate: string,
  assignee = "Rajesh Kumar",
): Record<string, unknown> {
  return {
    ...u,
    cwStatus: "completed",
    cwDate,
    cwAssignee: assignee,
    cableWork: {
      technician: assignee,
      scheduledDate: cwDate,
      notes: "Upgraded to 3-phase. Tested OK. Resident briefed.",
      photos: [],
    },
  };
}

// ── Block 406A ────────────────────────────────────────────────────────────────

async function seedBlock406A(log: Log): Promise<void> {
  const blockId  = "blk-406a";
  const lobbies  = [
    { name: "A", stacks: ["101", "103", "105"] },
    { name: "B", stacks: ["107", "109", "111"] },
    { name: "C", stacks: ["113", "115", "117"] },
    { name: "D", stacks: ["119", "121", "123"] },
  ];
  const floors = 13;

  log("Writing 406A metadata…");
  await setDoc(doc(db(), "precincts", PRECINCT_ID, "blocks", blockId), {
    name: "Blk 406A", precinct: PRECINCT_NAME, floors, lobbies,
  });

  // Build unit map
  const units: Record<string, Record<string, unknown>> = {};
  for (let f = 1; f <= floors; f++) {
    for (const lobby of lobbies) {
      for (const stack of lobby.stacks) {
        const exists = !(f === 1 && lobby.name === "D");
        units[`${f}-${stack}`] = baseUnit(f, stack, lobby.name, exists);
      }
    }
  }

  // CS scheduled
  units["12-107"] = withCSScheduled(units["12-107"], "22/04/26", "09:00-10:00", "Mr Tan Ah Kow");
  units["12-109"] = withCSScheduled(units["12-109"], "22/04/26", "10:00-11:00", "Mdm Lee Bee Geok");
  units["11-103"] = withCSScheduled(units["11-103"], "25/04/26", "10:00-11:00", "Mr Lim Chee Keong");
  units["10-101"] = withCSScheduled(units["10-101"], "02/05/26", "09:00-10:00", "Mdm Wong Siew Lin");
  units["10-103"] = withCSScheduled(units["10-103"], "02/05/26", "10:00-11:00", "Mr Soh Beng Teck");
  units["9-101"]  = withCSScheduled(units["9-101"],  "08/05/26", "09:00-10:00", "Mdm Ng Ah Moey");

  // CS completed → no CW yet
  units["11-101"] = withCSCompleted(units["11-101"], "Mr Goh Chok Tong", "25/04/26");
  units["11-105"] = withCSCompleted(units["11-105"], "Mdm Chua Li Fen", "25/04/26");

  // CS completed + CW scheduled
  units["12-101"] = withCWScheduled(
    withCSCompleted(units["12-101"], "Mr Chan Ah Seng", "20/04/26"),
    "15/06/26", "09:00-10:00",
  );
  units["12-103"] = withCWScheduled(
    withCSCompleted(units["12-103"], "Mdm Ho Bee Lian", "20/04/26"),
    "15/06/26", "11:00-12:00",
  );

  // CS completed + CW completed
  units["12-105"] = withCWCompleted(
    withCSCompleted(units["12-105"], "Mr Yeo Teck Heng", "20/04/26"),
    "10/06/26",
  );

  // Flagged unit
  units["8-113"] = { ...units["8-113"], flagged: true, flagForAttention: "Access refused on two attempts. Follow up with town council." };

  log("Writing 406A units (batch)…");
  const entries = Object.entries(units);
  for (let i = 0; i < entries.length; i += 499) {
    const batch = writeBatch(db());
    for (const [key, unit] of entries.slice(i, i + 499)) {
      batch.set(doc(db(), "precincts", PRECINCT_ID, "blocks", blockId, "units", key), unit);
    }
    await batch.commit();
  }
}

// ── Block 408B ────────────────────────────────────────────────────────────────

async function seedBlock408B(log: Log): Promise<void> {
  const blockId = "blk-408b";
  const lobbies = [
    { name: "A", stacks: ["201", "203", "205"] },
    { name: "B", stacks: ["207", "209", "211"] },
    { name: "C", stacks: ["213", "215", "217"] },
  ];
  const floors = 10;

  log("Writing 408B metadata…");
  await setDoc(doc(db(), "precincts", PRECINCT_ID, "blocks", blockId), {
    name: "Blk 408B", precinct: PRECINCT_NAME, floors, lobbies,
  });

  const units: Record<string, Record<string, unknown>> = {};
  for (let f = 1; f <= floors; f++) {
    for (const lobby of lobbies) {
      for (const stack of lobby.stacks) {
        units[`${f}-${stack}`] = baseUnit(f, stack, lobby.name);
      }
    }
  }

  // A few scheduled CS to make the chart interesting
  units["10-201"] = withCSScheduled(units["10-201"], "12/05/26", "09:00-10:00", "Mr Rajan Pillai");
  units["10-203"] = withCSScheduled(units["10-203"], "12/05/26", "10:00-11:00", "Mdm Fatimah Bte Hassan");
  units["9-207"]  = withCSScheduled(units["9-207"],  "19/05/26", "09:00-10:00", "Mr Kumar Suresh");
  units["8-213"]  = withCSScheduled(units["8-213"],  "26/05/26", "14:00-15:00", "Mdm Chen Xiu Ying");

  // One completed
  units["10-205"] = withCSCompleted(units["10-205"], "Mr Ali Bin Osman", "12/05/26");

  log("Writing 408B units (batch)…");
  const entries = Object.entries(units);
  for (let i = 0; i < entries.length; i += 499) {
    const batch = writeBatch(db());
    for (const [key, unit] of entries.slice(i, i + 499)) {
      batch.set(doc(db(), "precincts", PRECINCT_ID, "blocks", blockId, "units", key), unit);
    }
    await batch.commit();
  }
}

// ── Activity log ──────────────────────────────────────────────────────────────

async function seedActivity(log: Log): Promise<void> {
  log("Writing activity log…");
  const events = [
    { type: "CS_COMPLETED", description: "Survey completed — Blk 406A #105 Floor 12", operator: "Aisha Lim" },
    { type: "CW_COMPLETED", description: "Cable work completed — Blk 406A #105 Floor 12", operator: "Rajesh Kumar" },
    { type: "CS_COMPLETED", description: "Survey completed — Blk 406A #103 Floor 12", operator: "Aisha Lim" },
    { type: "CW_SCHEDULED", description: "CW appointment scheduled for unit 12-103", operator: "system" },
    { type: "CS_COMPLETED", description: "Survey completed — Blk 406A #101 Floor 12", operator: "Aisha Lim" },
    { type: "CW_SCHEDULED", description: "CW appointment scheduled for unit 12-101", operator: "system" },
    { type: "OPT_OUT",      description: "Opt-out requested — Blk 406A #123 Floor 12", operator: "Aisha Lim" },
    { type: "CS_COMPLETED", description: "Survey completed — Blk 406A #101 Floor 11", operator: "Aisha Lim" },
    { type: "CS_SCHEDULED", description: "CS appointment scheduled for unit 12-107", operator: "system" },
    { type: "CS_SCHEDULED", description: "CS appointment scheduled for unit 12-109", operator: "system" },
  ];

  // Write sequentially so Firestore timestamps are distinct enough to order correctly
  for (const e of events) {
    await addDoc(collection(db(), "recentActivity"), {
      ...e,
      metadata: {},
      timestamp: serverTimestamp(),
    });
    // Small delay so server timestamps differ
    await new Promise((r) => setTimeout(r, 60));
  }
}

// ── Main entry ────────────────────────────────────────────────────────────────

export async function seedDemoData(onProgress?: (msg: string) => void): Promise<void> {
  const log: Log = (msg) => { onProgress?.(msg); console.log("[seed]", msg); };

  log("Seeding user credentials…");
  const users = [
    { username: "pm",         password: "12345@", role: "manager",    name: "Project Manager" },
    { username: "surveyor",   password: "12345@", role: "surveyor",   name: "Aisha Lim" },
    { username: "technician", password: "12345@", role: "technician", name: "Rajesh Kumar" },
    { username: "hdb",        password: "12345@", role: "client",     name: "HDB Officer" },
  ];
  await Promise.all(users.map((u) => setDoc(doc(db(), "users", u.username), u)));

  await seedBlock406A(log);
  await seedBlock408B(log);
  await seedActivity(log);

  log("Seed complete.");
}
