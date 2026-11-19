import { Router } from "express";
import { z } from "zod";
import type { NotificationItem } from "../../shared/types";
import { currentUser, rateLimiter } from "../auth";
import { all, run } from "../db";
import { HttpError, parse } from "../http";
import { getVapidKeys, notify, unreadCount } from "../notify";

export const notificationsRouter = Router();

interface NotificationRow {
  id: number;
  kind: NotificationItem["kind"];
  title: string;
  body: string;
  icon: string;
  url: string | null;
  read_at: string | null;
  created_at: string;
}

notificationsRouter.get("/notifications", (req, res) => {
  const user = currentUser(req);
  const items = all<NotificationRow>(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 100",
    user.id,
  ).map(
    (n): NotificationItem => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      body: n.body,
      icon: n.icon,
      url: n.url,
      readAt: n.read_at,
      createdAt: n.created_at,
    }),
  );
  res.json({ items, unreadCount: unreadCount(user.id) });
});

notificationsRouter.post("/notifications/read", (req, res) => {
  const user = currentUser(req);
  const body = parse(z.object({ ids: z.array(z.number().int()).max(200).optional() }), req.body ?? {});
  const now = new Date().toISOString();
  if (body.ids?.length) {
    for (const id of body.ids) {
      run("UPDATE notifications SET read_at = ? WHERE id = ? AND user_id = ? AND read_at IS NULL", now, id, user.id);
    }
  } else {
    run("UPDATE notifications SET read_at = ? WHERE user_id = ? AND read_at IS NULL", now, user.id);
  }
  res.json({ unreadCount: unreadCount(user.id) });
});

notificationsRouter.get("/push/key", (_req, res) => {
  res.json({ publicKey: getVapidKeys().publicKey });
});

const subscriptionSchema = z.object({
  endpoint: z.url().max(1000),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(4).max(100) }),
});

notificationsRouter.post("/push/subscribe", (req, res) => {
  const user = currentUser(req);
  const sub = parse(subscriptionSchema, req.body);
  if (!sub.endpoint.startsWith("https://")) throw new HttpError(400, "Endpoint non valido");
  run(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`,
    user.id,
    sub.endpoint,
    sub.keys.p256dh,
    sub.keys.auth,
  );
  res.status(201).json({ ok: true });
});

notificationsRouter.post("/push/unsubscribe", (req, res) => {
  const user = currentUser(req);
  const body = parse(z.object({ endpoint: z.string().max(1000) }), req.body);
  run("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?", body.endpoint, user.id);
  res.json({ ok: true });
});

const testLimiter = rateLimiter(5, 10 * 60 * 1000);

notificationsRouter.post("/push/test", (req, res) => {
  const user = currentUser(req);
  if (!testLimiter(String(user.id))) throw new HttpError(429, "Hai già fatto qualche prova, aspetta un attimo");
  notify(user.id, {
    kind: "system",
    icon: "👀",
    title: "Prova notifiche",
    body: "Ti ho visto che mangi merendine... occhio! (Le notifiche funzionano 😉)",
    url: "/notifiche",
  });
  res.json({ ok: true });
});
