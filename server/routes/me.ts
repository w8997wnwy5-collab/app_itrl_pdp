import { Router } from "express";
import { z } from "zod";
import { sanitizeAvatar } from "../../shared/avatar";
import { daysBetween, today, weighInDayOnOrAfter, weighInDayOnOrBefore } from "../../shared/dates";
import type { Dashboard, Neighbor } from "../../shared/types";
import { analyzePhoto } from "../ai";
import { currentUser, destroyAllSessions, hashPassword, rateLimiter, verifyPassword } from "../auth";
import { config } from "../config";
import { run } from "../db";
import { HttpError, parse } from "../http";
import { unreadCount } from "../notify";
import { latestRecap } from "../recap";
import { getSeasonInfo } from "../settings";
import { badgesOf, loadStandings, toStatsCore } from "../stats";
import { getUser, listUsers, toMe, toPublicUser } from "../users";

export const meRouter = Router();

meRouter.get("/me", (req, res) => {
  res.json(toMe(currentUser(req)));
});

meRouter.patch("/me", (req, res) => {
  const user = currentUser(req);
  const body = parse(
    z.object({
      name: z.string().trim().min(2, { message: "Il nome è troppo corto" }).max(40).optional(),
      title: z.string().trim().max(40).nullable().optional(),
      goalKg: z.number().min(0.5).max(100).nullable().optional(),
      teaseLevel: z.enum(["off", "soft", "normal", "spicy"]).optional(),
      avatar: z.record(z.string(), z.unknown()).optional(),
    }),
    req.body,
  );
  if (body.name !== undefined) run("UPDATE users SET name = ? WHERE id = ?", body.name, user.id);
  if (body.title !== undefined) run("UPDATE users SET title = ? WHERE id = ?", body.title || null, user.id);
  if (body.goalKg !== undefined) run("UPDATE users SET goal_kg = ? WHERE id = ?", body.goalKg, user.id);
  if (body.teaseLevel !== undefined) run("UPDATE users SET tease_level = ? WHERE id = ?", body.teaseLevel, user.id);
  if (body.avatar !== undefined) {
    run("UPDATE users SET avatar = ? WHERE id = ?", JSON.stringify(sanitizeAvatar(body.avatar)), user.id);
  }
  res.json(toMe(getUser(user.id)!));
});

meRouter.post("/me/onboarded", (req, res) => {
  const user = currentUser(req);
  run("UPDATE users SET onboarded = 1 WHERE id = ?", user.id);
  res.json(toMe(getUser(user.id)!));
});

meRouter.post("/me/password", async (req, res) => {
  const user = currentUser(req);
  const body = parse(
    z.object({
      current: z.string().max(200),
      next: z.string().min(6, { message: "La nuova password deve avere almeno 6 caratteri" }).max(200),
    }),
    req.body,
  );
  if (!(await verifyPassword(body.current, user.password_hash))) {
    throw new HttpError(400, "La password attuale non è corretta");
  }
  run("UPDATE users SET password_hash = ? WHERE id = ?", await hashPassword(body.next), user.id);
  destroyAllSessions(user.id);
  res.json({ ok: true });
});

const analyzeLimiter = rateLimiter(8, 60 * 60 * 1000);

meRouter.post("/avatar/analyze", async (req, res) => {
  const user = currentUser(req);
  if (!config.aiEnabled) throw new HttpError(501, "Analisi AI non configurata");
  if (!analyzeLimiter(String(user.id))) throw new HttpError(429, "Troppe analisi: riprova tra un po'");
  const { image } = parse(z.object({ image: z.string().max(4_000_000) }), req.body);
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!match) throw new HttpError(400, "Formato immagine non supportato");
  const result = await analyzePhoto(match[2]!, match[1] as "image/jpeg" | "image/png" | "image/webp");
  res.json(result);
});

meRouter.get("/dashboard", (req, res) => {
  const user = currentUser(req);
  const standings = loadStandings();
  const s = standings.byUser.get(user.id);
  if (!s) throw new HttpError(404, "Utente non trovato");
  const date = today();
  const season = getSeasonInfo(date);
  const users = new Map(listUsers().map((u) => [u.id, u]));

  const participants = standings.order.filter((id) => standings.byUser.get(id)?.rank !== null);
  const idx = participants.indexOf(user.id);
  const neighbor = (otherId: number | undefined): Neighbor | null => {
    if (otherId === undefined) return null;
    const other = standings.byUser.get(otherId);
    const u = users.get(otherId);
    if (!other || !u || other.score === null || s.score === null) return null;
    return { ...toPublicUser(u), gap: Math.round(Math.abs(other.score - s.score) * 100) / 100 };
  };

  const currentWeek = weighInDayOnOrBefore(date);
  const next = weighInDayOnOrAfter(date);
  const winnerId = season.ended ? standings.order.find((id) => standings.byUser.get(id)?.rank === 1) : undefined;
  const winner = winnerId !== undefined ? users.get(winnerId) : undefined;

  const dashboard: Dashboard = {
    me: toMe(user),
    stats: {
      ...toStatsCore(s),
      startWeight: s.startWeight,
      currentWeight: s.currentWeight,
      history: s.history.map((h) => ({ id: h.id, date: h.date, weightKg: h.weightKg })),
    },
    neighbors: {
      ahead: idx > 0 ? neighbor(participants[idx - 1]) : null,
      behind: idx >= 0 ? neighbor(participants[idx + 1]) : null,
      total: participants.length,
    },
    badges: badgesOf(user.id),
    season,
    nextWeighIn: {
      date: next,
      daysUntil: daysBetween(date, next),
      isToday: next === date,
      currentWeek,
      doneThisWeek: s.history.some((h) => h.date === currentWeek),
    },
    unreadCount: unreadCount(user.id),
    recap: latestRecap(),
    winner: winner ? toPublicUser(winner) : null,
    aiEnabled: config.aiEnabled,
  };
  res.json(dashboard);
});
