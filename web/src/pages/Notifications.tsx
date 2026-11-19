import { useEffect, useState } from "react";
import { Link } from "react-router";
import type { NotificationItem } from "../../../shared/types";
import { TopBar } from "../components/Layout";
import { api } from "../lib/api";
import { timeAgo } from "../lib/format";
import { pushState, type PushState } from "../lib/push";
import { useApi } from "../lib/session";

const KIND_TONE: Record<string, string> = {
  tease: "tone-snack",
  snack: "tone-snack",
  cheer: "tone-primary",
  reminder: "tone-gold",
  result: "tone-good",
  overtake: "tone-bad",
  badge: "tone-gold",
  recap: "tone-primary",
  announcement: "tone-primary",
  system: "tone-neutral",
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400000);
  if (diff === 0) return "Oggi";
  if (diff === 1) return "Ieri";
  return d.toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long" });
}

export function Notifications() {
  const { data, error } = useApi<{ items: NotificationItem[]; unreadCount: number }>("/notifications");
  const [push, setPush] = useState<PushState | null>(null);

  useEffect(() => {
    void pushState().then(setPush);
  }, []);

  useEffect(() => {
    if (data && data.unreadCount > 0) {
      const t = setTimeout(() => {
        void api.post("/notifications/read").then(() => window.dispatchEvent(new Event("cpv:notifications")));
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [data]);

  if (error && !data) return <div className="error-box">{error}</div>;
  if (!data) return <div className="spinner" />;

  const groups: { label: string; items: NotificationItem[] }[] = [];
  for (const n of data.items) {
    const label = dayLabel(n.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.label === label) g.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <>
      <TopBar title="Notifiche 🔔" subtitle={data.unreadCount > 0 ? `${data.unreadCount} da leggere` : "Tutto letto"} />

      {push === "off" || push === "needs-install" ? (
        <Link to="/profilo" className="banner" style={{ textDecoration: "none" }}>
          <span className="banner__ico">📲</span>
          <p>
            <b>Attiva le notifiche sul telefono</b>
            <br />
            {push === "needs-install" ? "Su iPhone aggiungi prima l'app alla schermata Home." : "Così nessuna merendina passa inosservata 👀"}
          </p>
        </Link>
      ) : null}

      {data.items.length === 0 ? (
        <div className="card empty">
          <span className="em">📭</span>
          Ancora niente. Il primo sfottò non tarderà ad arrivare... 👀
        </div>
      ) : (
        groups.map((g) => (
          <section key={g.label}>
            <h2 className="section-title">{g.label}</h2>
            {g.items.map((n) => {
              const inner = (
                <>
                  <span className={`notif__ico ${KIND_TONE[n.kind] ?? "tone-neutral"}`} aria-hidden="true">
                    {n.icon}
                  </span>
                  <span className="notif__body">
                    <b>{n.title}</b>
                    <p>{n.body}</p>
                  </span>
                  <span className="notif__time">{timeAgo(n.createdAt)}</span>
                </>
              );
              return n.url ? (
                <Link key={n.id} to={n.url} className={`notif${n.readAt ? "" : " unread"}`}>
                  {inner}
                </Link>
              ) : (
                <div key={n.id} className={`notif${n.readAt ? "" : " unread"}`}>
                  {inner}
                </div>
              );
            })}
          </section>
        ))
      )}
    </>
  );
}
