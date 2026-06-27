// 1-hour CS timeslots
export const CS_TIME_SLOTS: string[] = [
  "08:00-09:00", "09:00-10:00", "10:00-11:00", "11:00-12:00", "12:00-13:00",
  "13:00-14:00", "14:00-15:00", "15:00-16:00", "16:00-17:00", "17:00-18:00",
];

// 2-hour overlapping CW slots (8-10, 9-11, 10-12 … 16-18)
export const CW_TIME_SLOTS: string[] = [
  "08:00-10:00", "09:00-11:00", "10:00-12:00", "11:00-13:00", "12:00-14:00",
  "13:00-15:00", "14:00-16:00", "15:00-17:00", "16:00-18:00",
];

// Backward-compat alias — CS slots wherever TIME_SLOTS is used for CS
export const TIME_SLOTS = CS_TIME_SLOTS;

// Individual hour marks 08:00 – 18:00 for start/end time pickers
export const HOUR_OPTIONS: string[] = [
  "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

// Parse "9:00am" or "09:00" to minutes from midnight
function parseClock(s: string): number {
  const m = s.trim().match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return 0;
  let h = Number(m[1]);
  const mins = Number(m[2] ?? 0);
  const ap = (m[3] ?? "").toLowerCase();
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  return h * 60 + mins;
}

// Parse a time slot string (range or single) into [startMin, endMin]
export function parseRange(t?: string): [number, number] {
  if (!t) return [0, 0];
  if (t.includes("-")) {
    const [s, e] = t.split("-");
    return [parseClock(s), parseClock(e)];
  }
  const s = parseClock(t);
  return [s, s + 120]; // default 2-hour span for bare hour strings
}

// Build individual hour rows (08:00 – 18:00) for the day timetable.
// Label shows just the hour mark ("08:00"), not a range.
export function hourlySlots(): { label: string; start: number; end: number }[] {
  const out: { label: string; start: number; end: number }[] = [];
  for (let h = 8; h <= 18; h++) {
    out.push({
      label: `${String(h).padStart(2, "0")}:00`,
      start: h * 60,
      end: (h + 1) * 60,
    });
  }
  return out;
}

export function rangeOverlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}
