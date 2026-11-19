import { describe, expect, it } from "vitest";
import { computeStandings, earnedBadges, withPreviousRanks, type StandingsInput } from "../server/stats";

const now = new Date("2026-11-20T10:00:00Z");

function input(rows: [number, string, number][], extra: Partial<StandingsInput> = {}): StandingsInput {
  return {
    userIds: [1, 2, 3, 4],
    weighins: rows.map(([userId, date, weightKg], i) => ({ id: i + 1, userId, date, weightKg })),
    snacks: [],
    mode: "kg",
    now,
    ...extra,
  };
}

describe("computeStandings", () => {
  const rows: [number, string, number][] = [
    [1, "2026-11-05", 90],
    [1, "2026-11-12", 89],
    [1, "2026-11-19", 88],
    [2, "2026-11-05", 60],
    [2, "2026-11-12", 58],
    [2, "2026-11-19", 57.5],
    [3, "2026-11-05", 80],
    [3, "2026-11-19", 81],
  ];

  it("computes losses, streaks and ranks in kg", () => {
    const s = computeStandings(input(rows));
    const u1 = s.byUser.get(1)!;
    const u2 = s.byUser.get(2)!;
    const u3 = s.byUser.get(3)!;
    expect(u1.lostKg).toBe(2);
    expect(u2.lostKg).toBe(2.5);
    expect(u3.lostKg).toBe(-1);
    expect(u1.streak).toBe(2);
    expect(u2.bestWeekLoss).toBe(2);
    expect(u3.everGained).toBe(true);
    expect(s.order).toEqual([2, 1, 3, 4]);
    expect([u2.rank, u1.rank, u3.rank]).toEqual([1, 2, 3]);
    expect(s.byUser.get(4)!.rank).toBeNull(); // no weigh-ins yet
    expect(s.latestWeek).toBe("2026-11-19");
  });

  it("ranks by percentage when asked", () => {
    const s = computeStandings(input(rows, { mode: "pct" }));
    // user 2: 2.5/60 = 4.17%, user 1: 2/90 = 2.22%
    expect(s.order.slice(0, 2)).toEqual([2, 1]);
    expect(s.byUser.get(2)!.lostPct).toBeCloseTo(4.17, 2);
  });

  it("gives tied users the same rank", () => {
    const s = computeStandings(
      input([
        [1, "2026-11-12", 80],
        [1, "2026-11-19", 79],
        [2, "2026-11-12", 70],
        [2, "2026-11-19", 69],
      ]),
    );
    expect(s.byUser.get(1)!.rank).toBe(1);
    expect(s.byUser.get(2)!.rank).toBe(1);
  });

  it("derives the mood from the latest week and recent snack sightings", () => {
    const s = computeStandings(
      input(rows, { snacks: [{ reporterId: 2, targetId: 3, snack: "pizza", createdAt: "2026-11-20T08:00:00Z" }] }),
    );
    expect(s.byUser.get(1)!.mood).toBe("ecstatic"); // -1 kg this week
    expect(s.byUser.get(2)!.mood).toBe("happy"); // -0.5 kg
    expect(s.byUser.get(3)!.mood).toBe("guilty"); // caught 2 hours ago
    expect(s.byUser.get(3)!.snacksCaught).toBe(1);
    expect(s.byUser.get(2)!.snacksReported).toBe(1);
  });

  it("computes the previous ranking to show movements", () => {
    const s = withPreviousRanks(
      input([
        [1, "2026-11-12", 80],
        [2, "2026-11-12", 70],
        [1, "2026-11-19", 80],
        [2, "2026-11-05", 72],
        [2, "2026-11-19", 69.5],
      ]),
    );
    expect(s.byUser.get(2)!.rank).toBe(1);
    expect(s.byUser.get(2)!.prevRank).toBe(1);
    expect(s.byUser.get(1)!.prevRank).toBe(2);
  });

  it("awards badges", () => {
    const s = withPreviousRanks(
      input([
        [1, "2026-10-01", 100],
        [1, "2026-10-08", 98.8],
        [1, "2026-10-15", 97],
        [1, "2026-10-22", 96],
        [1, "2026-10-29", 95],
        [1, "2026-11-05", 94.2],
        [2, "2026-10-01", 70],
      ]),
    );
    const badges = earnedBadges(s.byUser.get(1)!);
    expect(badges).toEqual(expect.arrayContaining(["first_weighin", "streak_3", "streak_5", "big_week", "kg_3", "kg_5", "pct_5", "leader", "podium", "iron"]));
    expect(badges).not.toContain("kg_10");
    expect(earnedBadges(s.byUser.get(2)!)).toEqual(["first_weighin"]);
  });
});
