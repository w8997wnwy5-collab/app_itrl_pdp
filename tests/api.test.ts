import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addDays, today, weighInDayOnOrBefore } from "../shared/dates";
import type { AdminSettings, Leaderboard, NotificationItem, PublicProfile, Recap, WeighInResult } from "../shared/types";
import { Client, startServer, type TestServer } from "./helpers";

let server: TestServer;
let admin: Client;
let bob: Client;
let carla: Client;
let inviteCode = "";
let bobId = 0;
let carlaId = 0;

const thisWeek = weighInDayOnOrBefore(today());
const lastWeek = addDays(thisWeek, -7);

beforeAll(async () => {
  server = await startServer();
  admin = new Client(server.url);
  bob = new Client(server.url);
  carla = new Client(server.url);
});

afterAll(async () => {
  await server.close();
});

describe("API", () => {
  it("reports an empty session without failing", async () => {
    const res = await admin.get<{ me: null }>("/auth/session");
    expect(res.status).toBe(200);
    expect(res.body.me).toBeNull();
  });

  it("makes the first user the organizer without an invite code", async () => {
    const res = await admin.post<{ isAdmin: boolean }>("/auth/register", { name: "Anna Admin", email: "anna@test.it", password: "segreto1" });
    expect(res.status).toBe(201);
    expect(res.body.isAdmin).toBe(true);
    const settings = await admin.get<AdminSettings>("/admin/settings");
    inviteCode = settings.body.inviteCode;
    expect(inviteCode).toMatch(/^[A-Z0-9]{6}$/);
  });

  it("requires the invite code for everybody else", async () => {
    const bad = await bob.post("/auth/register", { name: "Bob", email: "bob@test.it", password: "segreto1", inviteCode: "NOPE" });
    expect(bad.status).toBe(403);
    const ok = await bob.post<{ id: number; isAdmin: boolean }>("/auth/register", { name: "Bob Bianchi", email: "bob@test.it", password: "segreto1", inviteCode: inviteCode.toLowerCase() });
    expect(ok.status).toBe(201);
    expect(ok.body.isAdmin).toBe(false);
    bobId = ok.body.id;
    const c = await carla.post<{ id: number }>("/auth/register", { name: "Carla Conti", email: "carla@test.it", password: "segreto1", inviteCode });
    carlaId = c.body.id;
    const dup = await new Client(server.url).post("/auth/register", { name: "Bob 2", email: "BOB@test.it", password: "segreto1", inviteCode });
    expect(dup.status).toBe(409);
  });

  it("logs in and rejects wrong passwords", async () => {
    const c = new Client(server.url);
    expect((await c.post("/auth/login", { email: "bob@test.it", password: "sbagliata" })).status).toBe(401);
    expect((await c.post("/auth/login", { email: "Bob@Test.it", password: "segreto1" })).status).toBe(200);
  });

  it("validates weigh-ins", async () => {
    expect((await bob.post("/weighins", { weightKg: 12 })).status).toBe(400);
    expect((await bob.post("/weighins", { weightKg: 80, date: addDays(today(), 1) })).status).toBe(400);
    expect((await bob.post("/weighins", { weightKg: 80, date: "2026-02-30" })).status).toBe(400);
  });

  it("records weigh-ins and ranks people", async () => {
    await bob.post("/weighins", { weightKg: 92.4, date: lastWeek });
    const res = await bob.post<WeighInResult>("/weighins", { weightKg: 90.9 });
    expect(res.status).toBe(201);
    expect(res.body.delta).toBe(-1.5);
    expect(res.body.weighIn.date).toBe(thisWeek);
    expect(res.body.newBadges).toContain("big_week");

    await carla.post("/weighins", { weightKg: 70, date: lastWeek });
    await carla.post("/weighins", { weightKg: 68.2, date: thisWeek });

    const board = await admin.get<Leaderboard>("/leaderboard");
    expect(board.body.entries.map((e) => e.name).slice(0, 2)).toEqual(["Carla Conti", "Bob Bianchi"]);
    expect(board.body.entries[0]!.lostKg).toBe(1.8);
    const pct = await admin.get<Leaderboard>("/leaderboard?mode=pct");
    expect(pct.body.mode).toBe("pct");
  });

  it("never exposes absolute weights to colleagues", async () => {
    const board = await carla.get<Leaderboard>("/leaderboard");
    expect(board.text).not.toMatch(/weightKg|currentWeight|startWeight/);
    expect(board.text).not.toContain("92.4");
    expect(board.text).not.toContain("90.9");
    const profile = await carla.get<PublicProfile>(`/users/${bobId}`);
    expect(profile.status).toBe(200);
    expect(profile.text).not.toMatch(/weightKg|currentWeight|startWeight/);
    expect(profile.body.lossHistory.at(-1)!.lostKg).toBe(1.5);
  });

  it("notifies the person who has been overtaken", async () => {
    const n = await bob.get<{ items: NotificationItem[] }>("/notifications");
    expect(n.body.items.some((i) => i.kind === "overtake" && i.body.includes("Carla Conti"))).toBe(true);
  });

  it("sends anonymous snack sightings with limits", async () => {
    expect((await bob.post("/snacks", { targetId: bobId, snack: "merendina" })).status).toBe(400);
    expect((await bob.post("/snacks", { targetId: carlaId, snack: "caviale" })).status).toBe(400);
    const ok = await bob.post<{ remaining: number }>("/snacks", { targetId: carlaId, snack: "merendina" });
    expect(ok.status).toBe(201);
    expect(ok.body.remaining).toBe(4);
    expect((await bob.post("/snacks", { targetId: carlaId, snack: "pizza" })).status).toBe(429);

    const n = await carla.get<{ items: NotificationItem[] }>("/notifications");
    const sighting = n.body.items.find((i) => i.kind === "snack");
    expect(sighting?.body).toContain("mangi merendine");
    expect(sighting?.body).not.toContain("Bob"); // anonymous
    const board = await carla.get<Leaderboard>("/leaderboard");
    expect(board.body.entries.find((e) => e.id === carlaId)!.mood).toBe("guilty");
  });

  it("delivers signed cheers", async () => {
    expect((await carla.post("/cheers", { targetId: bobId, kind: "forza" })).status).toBe(201);
    const n = await bob.get<{ items: NotificationItem[] }>("/notifications");
    expect(n.body.items[0]!.title).toBe("Messaggio da Carla Conti");
  });

  it("keeps admin endpoints for organizers", async () => {
    expect((await bob.get("/admin/settings")).status).toBe(403);
    expect((await bob.get("/admin/users")).status).toBe(403);
    expect((await admin.get("/admin/users")).status).toBe(200);
  });

  it("lets the organizer record the weigh-ins of the whole office", async () => {
    const res = await admin.post<{ saved: number }>("/admin/weighins", {
      date: thisWeek,
      entries: [
        { userId: bobId, weightKg: 89.8 },
        { userId: carlaId, weightKg: null },
      ],
    });
    expect(res.status).toBe(200);
    expect(res.body.saved).toBe(2);
    const n = await bob.get<{ items: NotificationItem[] }>("/notifications");
    expect(n.body.items.some((i) => i.kind === "result" && i.body.includes("−2,6 kg"))).toBe(true);
    const board = await admin.get<Leaderboard>("/leaderboard");
    expect(board.body.entries[0]!.name).toBe("Bob Bianchi");
  });

  it("publishes the weekly recap (template without AI)", async () => {
    const res = await admin.post<Recap>("/admin/recap", {});
    expect(res.status).toBe(200);
    expect(res.body.source).toBe("template");
    expect(res.body.text).toContain("Bob Bianchi");
  });

  it("refuses cross-site requests", async () => {
    const res = await bob.post("/weighins", { weightKg: 80 }, { Origin: "https://evil.example" });
    expect(res.status).toBe(403);
  });

  it("validates admin settings", async () => {
    const bad = await admin.req("PUT", "/admin/settings", { seasonStart: "2026-12-31", seasonEnd: "2026-01-01" });
    expect(bad.status).toBe(400);
    const ok = await admin.req<AdminSettings>("PUT", "/admin/settings", { rankingMode: "pct", inviteCode: "giovedi-26" });
    expect(ok.status).toBe(200);
    expect(ok.body.inviteCode).toBe("GIOVEDI-26");
  });
});
