import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { isISODate, today, weighInDayOnOrBefore } from "../../shared/dates";
import type { AdminUser, AdminWeighInRow } from "../../shared/types";
import { currentUser, destroyAllSessions, hashPassword } from "../auth";
import { all, get, run } from "../db";
import { recordWeighIns } from "../events";
import { HttpError, parse } from "../http";
import { notifyMany } from "../notify";
import { publishRecap } from "../recap";
import { getGameSettings, updateGameSettings } from "../settings";
import { getUser, listUsers, toPublicUser } from "../users";
import { weekDateFor, weightSchema } from "./game";

export const adminRouter = Router();

adminRouter.get("/settings", (_req, res) => {
  res.json(getGameSettings());
});

const isoDate = z.string().refine(isISODate, { message: "Data non valida" });

adminRouter.put("/settings", (req, res) => {
  const body = parse(
    z.object({
      challengeName: z.string().trim().min(2).max(60).optional(),
      seasonStart: isoDate.optional(),
      seasonEnd: isoDate.optional(),
      rankingMode: z.enum(["kg", "pct"]).optional(),
      inviteCode: z
        .string()
        .trim()
        .min(4, { message: "Il codice deve avere almeno 4 caratteri" })
        .max(24)
        .regex(/^[A-Za-z0-9-]+$/, { message: "Solo lettere, numeri e trattini" })
        .transform((s) => s.toUpperCase())
        .optional(),
      adminOnlyWeighins: z.boolean().optional(),
    }),
    req.body,
  );
  const merged = { ...getGameSettings(), ...body };
  if (merged.seasonStart >= merged.seasonEnd) throw new HttpError(400, "La fine della sfida deve essere dopo l'inizio");
  res.json(updateGameSettings(body));
});

adminRouter.get("/users", (_req, res) => {
  const rows = all<{ id: number; weighins: number; devices: number }>(
    `SELECT u.id,
       (SELECT COUNT(*) FROM weighins w WHERE w.user_id = u.id) AS weighins,
       (SELECT COUNT(*) FROM push_subscriptions p WHERE p.user_id = u.id) AS devices
     FROM users u`,
  );
  const counts = new Map(rows.map((r) => [r.id, r]));
  res.json(
    listUsers().map(
      (u): AdminUser => ({
        id: u.id,
        name: u.name,
        email: u.email,
        isAdmin: u.is_admin === 1,
        onboarded: u.onboarded === 1,
        createdAt: u.created_at,
        weighinCount: counts.get(u.id)?.weighins ?? 0,
        pushDevices: counts.get(u.id)?.devices ?? 0,
      }),
    ),
  );
});

function adminCount(): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE is_admin = 1")?.n ?? 0;
}

adminRouter.patch("/users/:id", (req, res) => {
  const me = currentUser(req);
  const target = getUser(Number(req.params.id));
  if (!target) throw new HttpError(404, "Utente non trovato");
  const body = parse(z.object({ isAdmin: z.boolean().optional(), name: z.string().trim().min(2).max(40).optional() }), req.body);
  if (body.isAdmin === false && target.is_admin === 1) {
    if (adminCount() <= 1) throw new HttpError(400, "Serve almeno un admin");
    if (target.id === me.id) throw new HttpError(400, "Non puoi toglierti i permessi da solo");
  }
  if (body.isAdmin !== undefined) run("UPDATE users SET is_admin = ? WHERE id = ?", body.isAdmin ? 1 : 0, target.id);
  if (body.name !== undefined) run("UPDATE users SET name = ? WHERE id = ?", body.name, target.id);
  res.json({ ok: true });
});

adminRouter.post("/users/:id/reset-password", async (req, res) => {
  const target = getUser(Number(req.params.id));
  if (!target) throw new HttpError(404, "Utente non trovato");
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const temp = [...crypto.randomBytes(10)].map((b) => alphabet[b % alphabet.length]).join("");
  run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(temp), target.id);
  destroyAllSessions(target.id);
  res.json({ temporaryPassword: temp });
});

adminRouter.delete("/users/:id", (req, res) => {
  const me = currentUser(req);
  const target = getUser(Number(req.params.id));
  if (!target) throw new HttpError(404, "Utente non trovato");
  if (target.id === me.id) throw new HttpError(400, "Non puoi eliminare il tuo account da qui");
  if (target.is_admin === 1 && adminCount() <= 1) throw new HttpError(400, "Serve almeno un admin");
  run("DELETE FROM users WHERE id = ?", target.id);
  res.json({ ok: true });
});

adminRouter.get("/weighins", (req, res) => {
  const raw = typeof req.query.date === "string" ? req.query.date : today();
  if (!isISODate(raw)) throw new HttpError(400, "Data non valida");
  const week = weighInDayOnOrBefore(raw);
  const weights = new Map(
    all<{ user_id: number; weight_kg: number }>("SELECT user_id, weight_kg FROM weighins WHERE week_date = ?", week).map(
      (w) => [w.user_id, w.weight_kg],
    ),
  );
  const previous = new Map(
    all<{ user_id: number; weight_kg: number }>(
      `SELECT w.user_id, w.weight_kg FROM weighins w
       WHERE w.week_date = (SELECT MAX(week_date) FROM weighins w2 WHERE w2.user_id = w.user_id AND w2.week_date < ?)`,
      week,
    ).map((w) => [w.user_id, w.weight_kg]),
  );
  const rows: AdminWeighInRow[] = listUsers().map((u) => ({
    userId: u.id,
    name: u.name,
    avatar: toPublicUser(u).avatar,
    weightKg: weights.get(u.id) ?? null,
    previousKg: previous.get(u.id) ?? null,
  }));
  res.json({ date: week, rows });
});

adminRouter.post("/weighins", (req, res) => {
  const me = currentUser(req);
  const body = parse(
    z.object({
      date: z.string(),
      entries: z
        .array(z.object({ userId: z.number().int(), weightKg: weightSchema.nullable() }))
        .min(1)
        .max(500),
    }),
    req.body,
  );
  const week = weekDateFor(body.date);
  const valid = new Set(listUsers().map((u) => u.id));
  const entries = body.entries.filter((e) => valid.has(e.userId)).map((e) => ({ ...e, date: week }));
  recordWeighIns(entries, me.id);
  res.json({ ok: true, date: week, saved: entries.length });
});

adminRouter.post("/announce", (req, res) => {
  const body = parse(
    z.object({ title: z.string().trim().min(2).max(60), body: z.string().trim().min(2).max(300) }),
    req.body,
  );
  notifyMany(
    listUsers().map((u) => u.id),
    { kind: "announcement", icon: "📣", title: body.title, body: body.body, url: "/notifiche" },
  );
  res.json({ ok: true });
});

adminRouter.post("/recap", async (req, res) => {
  const body = parse(z.object({ date: z.string().optional(), notify: z.boolean().optional() }), req.body ?? {});
  const date = body.date ?? today();
  if (!isISODate(date)) throw new HttpError(400, "Data non valida");
  const recap = await publishRecap(weighInDayOnOrBefore(date), { notify: body.notify ?? true });
  if (!recap) throw new HttpError(400, "Nessuna pesata registrata in quella settimana");
  res.json(recap);
});
