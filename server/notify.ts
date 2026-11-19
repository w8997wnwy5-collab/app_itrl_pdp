import { generateVAPIDKeys, sendNotification, WebPushError } from "web-push";
import type { NotificationKind } from "../shared/types";
import { config } from "./config";
import { all, run } from "./db";
import { getSetting, setSetting } from "./settings";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
}

let cachedKeys: VapidKeys | null = null;

/** VAPID keys from the environment, or generated once and stored in the database. */
export function getVapidKeys(): VapidKeys {
  if (cachedKeys) return cachedKeys;
  if (config.vapidPublicKey && config.vapidPrivateKey) {
    cachedKeys = { publicKey: config.vapidPublicKey, privateKey: config.vapidPrivateKey };
    return cachedKeys;
  }
  const pub = getSetting("vapid_public_key");
  const priv = getSetting("vapid_private_key");
  if (pub && priv) {
    cachedKeys = { publicKey: pub, privateKey: priv };
    return cachedKeys;
  }
  const keys = generateVAPIDKeys();
  setSetting("vapid_public_key", keys.publicKey);
  setSetting("vapid_private_key", keys.privateKey);
  cachedKeys = { publicKey: keys.publicKey, privateKey: keys.privateKey };
  return cachedKeys;
}

/** mailto:/https: contact sent to push services (Apple rejects invalid ones). */
export function vapidSubject(): string {
  if (config.vapidSubject) return config.vapidSubject;
  const url = config.publicUrl || getSetting("public_url");
  if (url?.startsWith("https://")) return url;
  return "mailto:sfida@chiperdevince.app";
}

export interface NotificationInput {
  kind: NotificationKind;
  title: string;
  body: string;
  icon?: string;
  url?: string;
}

interface SubscriptionRow {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function pushToUser(userId: number, payload: NotificationInput & { id: number }): Promise<void> {
  const subs = all<SubscriptionRow>(
    "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?",
    userId,
  );
  if (subs.length === 0) return;
  const keys = getVapidKeys();
  const body = JSON.stringify({
    id: payload.id,
    title: `${payload.icon ?? "🔔"} ${payload.title}`,
    body: payload.body,
    url: payload.url ?? "/notifiche",
    tag: `${payload.kind}-${payload.id}`,
  });
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, body, {
          TTL: 6 * 60 * 60,
          urgency: "normal",
          vapidDetails: { subject: vapidSubject(), publicKey: keys.publicKey, privateKey: keys.privateKey },
        });
      } catch (err) {
        if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
          run("DELETE FROM push_subscriptions WHERE id = ?", sub.id);
        } else {
          console.warn("Push fallita:", err instanceof Error ? err.message : err);
        }
      }
    }),
  );
}

/** Stores an in-app notification and sends it as a web push to every device of the user. */
export function notify(userId: number, input: NotificationInput): number {
  const { lastInsertRowid: id } = run(
    "INSERT INTO notifications (user_id, kind, title, body, icon, url) VALUES (?, ?, ?, ?, ?, ?)",
    userId,
    input.kind,
    input.title,
    input.body,
    input.icon ?? "🔔",
    input.url ?? null,
  );
  void pushToUser(userId, { ...input, id }).catch((err) => console.warn("Push fallita:", err));
  return id;
}

export function notifyMany(userIds: number[], input: NotificationInput): void {
  for (const id of userIds) notify(id, input);
}

export function unreadCount(userId: number): number {
  return (
    all<{ n: number }>("SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND read_at IS NULL", userId)[0]
      ?.n ?? 0
  );
}
