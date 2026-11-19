import { Router } from "express";
import { z } from "zod";
import { isISODate, today, weighInDayOnOrBefore } from "../../shared/dates";
import { MAX_WEIGHT_KG, MIN_WEIGHT_KG, roundKg } from "../../shared/game";
import type { Leaderboard, PublicProfile } from "../../shared/types";
import { currentUser } from "../auth";
import { all, get } from "../db";
import { recordWeighIns, reportSnack, sendCheer } from "../events";
import { HttpError, parse } from "../http";
import { getGameSettings, getSeasonInfo } from "../settings";
import { badgesOf, loadStandings, toStatsCore } from "../stats";
import { getUser, listUsers, toPublicUser } from "../users";

export const gameRouter = Router();

gameRouter.get("/leaderboard", (req, res) => {
  const mode = req.query.mode === "pct" ? "pct" : req.query.mode === "kg" ? "kg" : undefined;
  const standings = loadStandings({ mode });
  const users = new Map(listUsers().map((u) => [u.id, u]));
  const badges = all<{ user_id: number; badge: string }>("SELECT user_id, badge FROM user_badges ORDER BY awarded_at");
  const badgeMap = new Map<number, string[]>();
  for (const b of badges) badgeMap.set(b.user_id, [...(badgeMap.get(b.user_id) ?? []), b.badge]);

  const board: Leaderboard = {
    mode: standings.mode,
    latestWeek: standings.latestWeek,
    season: getSeasonInfo(),
    entries: standings.order.flatMap((id) => {
      const u = users.get(id);
      const s = standings.byUser.get(id);
      if (!u || !s) return [];
      return [
        {
          ...toPublicUser(u),
          ...toStatsCore(s),
          badges: badgeMap.get(id) ?? [],
          inLatestWeek: s.lastDate !== null && s.lastDate === standings.latestWeek,
        },
      ];
    }),
  };
  res.json(board);
});

gameRouter.get("/users", (_req, res) => {
  res.json(listUsers().map(toPublicUser));
});

gameRouter.get("/users/:id", (req, res) => {
  const me = currentUser(req);
  const id = Number(req.params.id);
  const user = Number.isInteger(id) ? getUser(id) : undefined;
  if (!user) throw new HttpError(404, "Collega non trovato");
  const standings = loadStandings();
  const s = standings.byUser.get(id)!;
  const start = s.history[0]?.weightKg;
  const profile: PublicProfile = {
    user: toPublicUser(user),
    stats: toStatsCore(s),
    badges: badgesOf(id),
    // Only relative values: nobody sees a colleague's actual weight.
    lossHistory: start
      ? s.history.map((h) => ({
          date: h.date,
          lostKg: roundKg(start - h.weightKg),
          lostPct: Math.round(((start - h.weightKg) / start) * 10000) / 100,
        }))
      : [],
    season: getSeasonInfo(),
    isMe: me.id === id,
  };
  res.json(profile);
});

gameRouter.get("/weighins", (req, res) => {
  const user = currentUser(req);
  const s = getGameSettings();
  res.json(
    all<{ id: number; week_date: string; weight_kg: number }>(
      "SELECT id, week_date, weight_kg FROM weighins WHERE user_id = ? AND week_date BETWEEN ? AND ? ORDER BY week_date DESC",
      user.id,
      s.seasonStart,
      s.seasonEnd,
    ).map((w) => ({ id: w.id, date: w.week_date, weightKg: w.weight_kg })),
  );
});

export const weightSchema = z
  .number({ message: "Inserisci il peso in kg" })
  .min(MIN_WEIGHT_KG, { message: `Il peso deve essere almeno ${MIN_WEIGHT_KG} kg` })
  .max(MAX_WEIGHT_KG, { message: `Il peso deve essere al massimo ${MAX_WEIGHT_KG} kg` })
  .transform(roundKg);

/** Validates a weigh-in date and maps it to its week's Thursday. */
export function weekDateFor(date: string | undefined): string {
  const settings = getGameSettings();
  const now = today();
  const day = date ?? now;
  if (!isISODate(day)) throw new HttpError(400, "Data non valida");
  if (day > now) throw new HttpError(400, "Non puoi registrare pesate nel futuro");
  const week = weighInDayOnOrBefore(day);
  if (week < settings.seasonStart || week > settings.seasonEnd) {
    throw new HttpError(400, "La data è fuori dal periodo della sfida");
  }
  return week;
}

gameRouter.post("/weighins", (req, res) => {
  const user = currentUser(req);
  const body = parse(z.object({ weightKg: weightSchema, date: z.string().optional() }), req.body);
  if (getGameSettings().adminOnlyWeighins && user.is_admin !== 1) {
    throw new HttpError(403, "Le pesate le registra l'organizzatore della sfida");
  }
  const week = weekDateFor(body.date);
  const result = recordWeighIns([{ userId: user.id, date: week, weightKg: body.weightKg }], user.id).get(user.id);
  res.status(201).json(result);
});

gameRouter.delete("/weighins/:id", (req, res) => {
  const user = currentUser(req);
  const row = get<{ id: number; user_id: number; week_date: string }>(
    "SELECT id, user_id, week_date FROM weighins WHERE id = ?",
    Number(req.params.id),
  );
  if (!row) throw new HttpError(404, "Pesata non trovata");
  if (row.user_id !== user.id && user.is_admin !== 1) throw new HttpError(403, "Non puoi cancellare questa pesata");
  if (getGameSettings().adminOnlyWeighins && user.is_admin !== 1) {
    throw new HttpError(403, "Le pesate le gestisce l'organizzatore della sfida");
  }
  recordWeighIns([{ userId: row.user_id, date: row.week_date, weightKg: null }], user.id);
  res.json({ ok: true });
});

gameRouter.post("/snacks", (req, res) => {
  const user = currentUser(req);
  const body = parse(z.object({ targetId: z.number().int(), snack: z.string().max(30) }), req.body);
  res.status(201).json(reportSnack(user.id, body.targetId, body.snack));
});

gameRouter.post("/cheers", (req, res) => {
  const user = currentUser(req);
  const body = parse(z.object({ targetId: z.number().int(), kind: z.string().max(30) }), req.body);
  sendCheer(user.id, body.targetId, body.kind);
  res.status(201).json({ ok: true });
});
