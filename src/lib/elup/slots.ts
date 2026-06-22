// Standard 1-hour CS/CW timeslot ranges
export const TIME_SLOTS: string[] = [
  "08:00-09:00",
  "09:00-10:00",
  "10:00-11:00",
  "11:00-12:00",
  "12:00-13:00",
  "13:00-14:00",
  "14:00-15:00",
  "15:00-16:00",
  "16:00-17:00",
  "17:00-18:00",
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
  return [s, s + 60];
}

// Build hourly slot rows (08:00 - 18:00) for the day timetable
export function hourlySlots(): { label: string; start: number; end: number }[] {
  const out: { label: string; start: number; end: number }[] = [];
  for (let h = 8; h < 18; h++) {
    out.push({
      label: `${String(h).padStart(2, "0")}:00-${String(h + 1).padStart(2, "0")}:00`,
      start: h * 60,
      end: (h + 1) * 60,
    });
  }
  return out;
}

export function rangeOverlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1];
}
