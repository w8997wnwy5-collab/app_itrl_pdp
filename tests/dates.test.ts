import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatLongDate,
  isISODate,
  weekdayOf,
  weighInDayOnOrAfter,
  weighInDayOnOrBefore,
  zonedParts,
} from "../shared/dates";

describe("dates", () => {
  it("validates ISO dates", () => {
    expect(isISODate("2026-11-19")).toBe(true);
    expect(isISODate("2026-02-30")).toBe(false);
    expect(isISODate("19/11/2026")).toBe(false);
  });

  it("adds days across month, year and DST boundaries", () => {
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26"); // DST ends 25 Oct in Italy
    expect(addDays("2026-12-30", 3)).toBe("2027-01-02");
    expect(daysBetween("2026-11-19", "2026-12-31")).toBe(42);
  });

  it("maps any day to the Thursday of its weigh-in week", () => {
    expect(weekdayOf("2026-11-19")).toBe(4);
    expect(weighInDayOnOrBefore("2026-11-19")).toBe("2026-11-19");
    expect(weighInDayOnOrBefore("2026-11-20")).toBe("2026-11-19"); // Friday
    expect(weighInDayOnOrBefore("2026-11-25")).toBe("2026-11-19"); // Wednesday
    expect(weighInDayOnOrAfter("2026-11-20")).toBe("2026-11-26");
    expect(weighInDayOnOrAfter("2026-11-19")).toBe("2026-11-19");
  });

  it("reads wall-clock time in Rome", () => {
    // 07:30 UTC in November = 08:30 in Rome (CET)
    const p = zonedParts(new Date("2026-11-19T07:30:00Z"));
    expect(p).toMatchObject({ date: "2026-11-19", weekday: 4, hour: 8, minute: 30 });
    // 23:30 UTC on a summer Wednesday is already Thursday 01:30 in Rome (CEST)
    const s = zonedParts(new Date("2026-07-01T23:30:00Z"));
    expect(s).toMatchObject({ date: "2026-07-02", weekday: 4, hour: 1 });
  });

  it("formats Italian dates", () => {
    expect(formatLongDate("2026-11-19")).toBe("giovedì 19 novembre");
  });
});
