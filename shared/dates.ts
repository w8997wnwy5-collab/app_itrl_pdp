// Date helpers shared by server and client.
// All "dates" are plain calendar days as ISO strings (YYYY-MM-DD) in the
// office time zone (Europe/Rome). Weigh-ins are grouped by the Thursday of
// their week: a weigh-in done on Friday or Monday still counts for the most
// recent Thursday.

export const TIME_ZONE = "Europe/Rome";
export const WEIGH_IN_WEEKDAY = 4; // Thursday (0 = Sunday)

const DAY_MS = 24 * 60 * 60 * 1000;

export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function toUTC(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

function fromUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return fromUTC(new Date(toUTC(date).getTime() + days * DAY_MS));
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((toUTC(b).getTime() - toUTC(a).getTime()) / DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekdayOf(date: string): number {
  return toUTC(date).getUTCDay();
}

/** The weigh-in day (Thursday) on or before the given date. */
export function weighInDayOnOrBefore(date: string): string {
  const diff = (weekdayOf(date) - WEIGH_IN_WEEKDAY + 7) % 7;
  return addDays(date, -diff);
}

/** The weigh-in day (Thursday) on or after the given date. */
export function weighInDayOnOrAfter(date: string): string {
  const diff = (WEIGH_IN_WEEKDAY - weekdayOf(date) + 7) % 7;
  return addDays(date, diff);
}

export interface ZonedParts {
  date: string; // YYYY-MM-DD
  year: number;
  month: number; // 1-12
  day: number;
  weekday: number; // 0 = Sunday
  hour: number;
  minute: number;
}

const partsFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  weekday: "short",
});

const WEEKDAYS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Calendar parts of an instant in the office time zone. */
export function zonedParts(at: Date = new Date()): ZonedParts {
  const parts: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(at)) parts[p.type] = p.value;
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    year,
    month,
    day,
    weekday: WEEKDAYS[parts.weekday] ?? 0,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

export function today(at: Date = new Date()): string {
  return zonedParts(at).date;
}

const MONTHS = [
  "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
  "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre",
];
const MONTHS_SHORT = ["gen", "feb", "mar", "apr", "mag", "giu", "lug", "ago", "set", "ott", "nov", "dic"];
const WEEKDAY_NAMES = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

/** "giovedì 19 novembre" */
export function formatLongDate(date: string): string {
  const d = toUTC(date);
  return `${WEEKDAY_NAMES[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "19 nov" */
export function formatShortDate(date: string): string {
  const d = toUTC(date);
  return `${d.getUTCDate()} ${MONTHS_SHORT[d.getUTCMonth()]}`;
}

/** "19 novembre 2026" */
export function formatFullDate(date: string): string {
  const d = toUTC(date);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
