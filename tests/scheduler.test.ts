import { beforeAll, describe, expect, it } from "vitest";
import { all, run } from "../server/db";
import { tick } from "../server/scheduler";

function addUser(name: string, tease: string): number {
  return run(
    "INSERT INTO users (email, name, password_hash, tease_level) VALUES (?, ?, 'x', ?)",
    `${name.toLowerCase()}@test.it`,
    name,
    tease,
  ).lastInsertRowid;
}

const count = (userId: number, kind?: string) =>
  all<{ n: number }>(
    `SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?${kind ? " AND kind = ?" : ""}`,
    ...(kind ? [userId, kind] : [userId]),
  )[0]!.n;

let spicy = 0;
let off = 0;

beforeAll(() => {
  spicy = addUser("Piccante", "spicy");
  off = addUser("Tranquillo", "off");
});

describe("scheduler", () => {
  it("sends the Thursday morning reminder once to everybody", async () => {
    const thursday = new Date("2026-11-19T07:35:00Z"); // 08:35 in Rome
    expect(await tick(thursday)).toContain("thursday-morning");
    expect(count(spicy, "reminder")).toBe(1);
    expect(count(off, "reminder")).toBe(1);
    expect(await tick(new Date("2026-11-19T07:40:00Z"))).toEqual([]);
    expect(count(spicy, "reminder")).toBe(1);
  });

  it("teases only people who accept it", async () => {
    const monday = new Date("2026-11-23T09:31:00Z"); // 10:31 in Rome
    expect(await tick(monday, () => 0)).toContain("snack-morning");
    expect(count(spicy, "tease")).toBe(1);
    expect(count(off, "tease")).toBe(0);
  });

  it("does nothing outside the scheduled windows", async () => {
    expect(await tick(new Date("2026-11-24T02:00:00Z"))).toEqual([]);
  });
});
