import { useState } from "react";
import { Link, useParams } from "react-router";
import { CHEERS, formatKg, formatPct, LEVELS, MOOD_LABELS, snackById } from "../../../shared/game";
import type { PublicProfile } from "../../../shared/types";
import { Avatar } from "../components/Avatar";
import { BadgeGrid } from "../components/BadgeGrid";
import { DeltaChip } from "../components/DeltaChip";
import { TopBar } from "../components/Layout";
import { LineChart } from "../components/LineChart";
import { SnackReportSheet } from "../components/SnackReportSheet";
import { api, errorMessage } from "../lib/api";
import { firstName, timeAgo } from "../lib/format";
import { useApi, useUi } from "../lib/session";

export function UserProfile() {
  const { id } = useParams();
  const { toast } = useUi();
  const { data, error } = useApi<PublicProfile>(`/users/${id}`);
  const [snackOpen, setSnackOpen] = useState(false);
  const [sending, setSending] = useState<string | null>(null);

  if (error && !data) return <div className="error-box">{error}</div>;
  if (!data) return <div className="spinner" />;

  const { user, stats, season } = data;
  const mode = season.rankingMode;
  const level = LEVELS[stats.level] ?? LEVELS[0]!;
  const isLeader = stats.rank === 1 && stats.weighinCount >= 2 && (mode === "kg" ? stats.lostKg : stats.lostPct) > 0;
  const lastSnack = stats.lastSnack ? snackById(stats.lastSnack.snack) : null;

  const cheer = async (kind: string) => {
    setSending(kind);
    try {
      await api.post("/cheers", { targetId: user.id, kind });
      toast(`Messaggio inviato a ${firstName(user.name)}! 📨`);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(null);
    }
  };

  return (
    <>
      <TopBar title={firstName(user.name)} subtitle={data.isMe ? "Il tuo profilo pubblico" : "Profilo in gara"} back="/classifica" />

      <section className="card hero">
        <div className="hero__stage">
          <Avatar config={user.avatar} mood={stats.mood} level={stats.level} leader={isLeader} size={160} style={{ borderRadius: "50%" }} />
        </div>
        <div className="hero__name">
          <h2>{user.title || user.name}</h2>
          <p>
            {user.title ? `${user.name} · ` : ""}
            {MOOD_LABELS[stats.mood]}
          </p>
          <div className="row" style={{ justifyContent: "center", marginTop: 8, flexWrap: "wrap", gap: 6 }}>
            <span className="chip chip--primary">
              {level.emoji} Lv {level.level} · {level.name}
            </span>
            {stats.rank ? <span className="chip chip--gold">🏆 {stats.rank}° posto</span> : <span className="chip">in attesa della prima pesata</span>}
          </div>
        </div>
      </section>

      <div className="grid-3" style={{ marginBottom: 14 }}>
        <div className="status-tile" style={{ cursor: "default" }}>
          <span className="status-tile__ico tone-good">📉</span>
          <span className="status-tile__value">{formatKg(-stats.lostKg, { sign: true })}</span>
          <span className="status-tile__label">{formatPct(-stats.lostPct, { sign: true })} dall'inizio</span>
        </div>
        <div className="status-tile" style={{ cursor: "default" }}>
          <span className="status-tile__ico tone-gold">🔥</span>
          <span className="status-tile__value">{stats.streak} sett.</span>
          <span className="status-tile__label">in calo di fila</span>
        </div>
        <div className="status-tile" style={{ cursor: "default" }}>
          <span className="status-tile__ico tone-snack">{lastSnack?.emoji ?? "🍫"}</span>
          <span className="status-tile__value">{stats.snacksCaught}</span>
          <span className="status-tile__label">sgarri avvistati</span>
        </div>
      </div>

      <section className="card">
        <div className="card__head">
          <h2>📉 Variazione dall'inizio</h2>
          {stats.weekDelta !== null ? <DeltaChip delta={stats.weekDelta} /> : null}
        </div>
        {data.lossHistory.length >= 2 ? (
          <LineChart
            label={`Variazione di peso di ${user.name} dall'inizio`}
            points={data.lossHistory.map((h) => ({ date: h.date, value: -h.lostKg }))}
            formatValue={(v) => formatKg(v, { sign: true })}
          />
        ) : (
          <div className="empty">
            <span className="em">📊</span>
            Servono almeno due pesate per il grafico.
          </div>
        )}
        <p className="hint" style={{ margin: "8px 0 0" }}>
          {stats.weighinCount} {stats.weighinCount === 1 ? "pesata" : "pesate"}
          {stats.bestWeekLoss > 0 ? ` · miglior settimana −${formatKg(stats.bestWeekLoss)}` : ""}
          {lastSnack && stats.lastSnack ? ` · ultimo sgarro: ${lastSnack.emoji} ${timeAgo(stats.lastSnack.at)}` : ""}
        </p>
      </section>

      {!data.isMe ? (
        <section className="card">
          <div className="card__head">
            <h2>💬 Manda un messaggio</h2>
          </div>
          <div className="picker-grid">
            {CHEERS.map((c) => (
              <button key={c.id} className="pick" disabled={sending !== null} onClick={() => void cheer(c.id)}>
                <span className="pick__emoji">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
          <button className="btn btn--snack btn--block" style={{ marginTop: 14 }} onClick={() => setSnackOpen(true)}>
            👀 Ho beccato {firstName(user.name)} con uno sgarro
          </button>
        </section>
      ) : (
        <Link to="/profilo" className="btn btn--soft btn--block" style={{ marginBottom: 14 }}>
          ✏️ Modifica il tuo profilo
        </Link>
      )}

      <section className="card">
        <div className="card__head">
          <h2>🏅 Badge</h2>
          <span className="muted">{data.badges.length}</span>
        </div>
        <BadgeGrid earned={data.badges} showLocked={false} />
      </section>

      {snackOpen ? <SnackReportSheet target={user} onClose={() => setSnackOpen(false)} /> : null}
    </>
  );
}
