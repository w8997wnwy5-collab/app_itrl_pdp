import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { addDays, daysBetween, formatFullDate, formatLongDate, today } from "../../../shared/dates";
import { formatKg, formatPct, levelForPct, LEVELS, MOOD_LABELS, nextLevel, snackById, type Mood } from "../../../shared/game";
import type { Dashboard, Me } from "../../../shared/types";
import { Avatar } from "../components/Avatar";
import { BadgeGrid } from "../components/BadgeGrid";
import { DeltaChip } from "../components/DeltaChip";
import { TopBar } from "../components/Layout";
import { LineChart } from "../components/LineChart";
import { Sheet } from "../components/Sheet";
import { SnackReportSheet } from "../components/SnackReportSheet";
import { api, errorMessage } from "../lib/api";
import { firstName, gapText, scoreText, timeAgo } from "../lib/format";
import { useApi, useSession, useUi } from "../lib/session";

const PHRASES: Record<Mood, string[]> = {
  ecstatic: ["Sono una scheggia! ⚡", "Questa settimana spacco! 💪", "Chi mi ferma più?", "Leggerezza level: piuma 🪶"],
  happy: ["Si va nella direzione giusta 😎", "Un etto alla volta!", "Oggi insalata, domani gloria.", "Le scale? Fatte a piedi!"],
  neutral: ["Giovedì si vede chi ha fatto i compiti 😏", "Pronti per la pesata?", "Ho fame... ma resisto.", "Acqua e determinazione 💧"],
  worried: ["Ehm... forse quella pizza...", "Da lunedì dieta, giuro!", "La bilancia mi guarda male 😬", "Era solo un aperitivo..."],
  sad: ["Settimana no... ma mi rifaccio!", "Torno più forte, promesso.", "Mi serve un abbraccio (non un cornetto)."],
  guilty: ["Non è come sembra! 🍫", "Era solo un assaggino...", "Chi ha fatto la spia?! 👀", "Avevo un calo di zuccheri..."],
};

type Detail = "rank" | "lost" | "weight" | "streak" | "snacks" | "goal" | null;

export function Home() {
  const { data, error, reload } = useApi<Dashboard>("/dashboard");
  const [bubble, setBubble] = useState<string | null>(null);
  const [bounce, setBounce] = useState(false);
  const [detail, setDetail] = useState<Detail>(null);
  const [snackOpen, setSnackOpen] = useState(false);
  const bubbleTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(bubbleTimer.current), []);

  if (error && !data) return <div className="error-box">{error}</div>;
  if (!data) return <div className="spinner" />;

  const { me, stats, season, nextWeighIn, neighbors } = data;
  const mode = season.rankingMode;
  const level = levelForPct(stats.lostPct);
  const next = nextLevel(level.level);
  const isLeader = stats.rank === 1 && stats.weighinCount >= 2 && (mode === "kg" ? stats.lostKg : stats.lostPct) > 0;

  const poke = () => {
    const pool = stats.weighinCount === 0 ? ["Prima pesata giovedì: si parte! 🚀", ...PHRASES.neutral] : isLeader ? ["Sono in testa! 👑 Inchinatevi.", ...PHRASES[stats.mood]] : PHRASES[stats.mood];
    let phrase = pool[Math.floor(Math.random() * pool.length)]!;
    if (phrase === bubble && pool.length > 1) phrase = pool[(pool.indexOf(phrase) + 1) % pool.length]!;
    setBubble(phrase);
    setBounce(false);
    requestAnimationFrame(() => setBounce(true));
    window.clearTimeout(bubbleTimer.current);
    bubbleTimer.current = window.setTimeout(() => setBubble(null), 2800);
  };

  const levelProgress = next ? Math.max(0, Math.min(1, (stats.lostPct - level.minPct) / (next.minPct - level.minPct))) : 1;
  const goalProgress = me.goalKg ? Math.max(0, Math.min(1, stats.lostKg / me.goalKg)) : null;
  const seasonLength = Math.max(1, daysBetween(season.seasonStart, season.seasonEnd));
  const seasonElapsed = Math.max(0, Math.min(1, daysBetween(season.seasonStart, today()) / seasonLength));
  const thisWeek = stats.history.find((h) => h.date === nextWeighIn.currentWeek);

  return (
    <>
      <TopBar
        title={`Ciao, ${firstName(me.name)}!`}
        subtitle={`${season.challengeName} · ${season.ended ? "sfida conclusa" : `mancano ${season.daysLeft} giorni`}`}
        right={
          <button className="icon-btn" aria-label="Segnala uno sgarro" onClick={() => setSnackOpen(true)}>
            👀
          </button>
        }
      />

      {season.ended && data.winner ? (
        <div className="card winner">
          <Avatar config={data.winner.avatar} size={96} leader level={5} mood="ecstatic" style={{ borderRadius: "50%" }} />
          <h2 style={{ marginTop: 8 }}>🏆 Vince {data.winner.name}!</h2>
          <p className="muted" style={{ margin: "4px 0 0" }}>
            La sfida "{season.challengeName}" è finita. Complimenti a tutti!
          </p>
        </div>
      ) : null}

      {/* Hero: the character */}
      <section className="card hero">
        <div className="hero__stage">
          {bubble ? <div className="bubble">{bubble}</div> : null}
          <button className={`hero__avatar${bounce ? " bounce" : ""}`} onClick={poke} aria-label="Tocca il tuo personaggio">
            <Avatar config={me.avatar} mood={stats.mood} level={level.level} leader={isLeader} size={176} />
          </button>
        </div>
        <div className="hero__name">
          <h2>{me.title || me.name}</h2>
          <p>
            {me.title ? `${me.name} · ` : ""}
            {MOOD_LABELS[stats.mood]}
          </p>
        </div>
        <div className="level-bar">
          <div className="row row--between" style={{ marginBottom: 6 }}>
            <span className="chip chip--primary">
              {level.emoji} Lv {level.level} · {level.name}
            </span>
            {next ? (
              <span className="hint">
                Prossimo: {next.emoji} {next.name} a −{formatPct(next.minPct)}
              </span>
            ) : (
              <span className="hint">Livello massimo! 🌟</span>
            )}
          </div>
          <div className="level-bar__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(levelProgress * 100)} aria-label="Progresso verso il prossimo livello">
            <div className="level-bar__fill" style={{ width: `${Math.max(4, levelProgress * 100)}%` }} />
          </div>
          {next ? <div className="level-bar__labels"><span>Sblocca: {next.perk}</span></div> : null}
        </div>
      </section>

      {/* Status icons */}
      <div className="status-grid">
        <StatusTile ico="🏆" tone="gold" pulse={isLeader} value={stats.rank ? `${stats.rank}°` : "—"} label={stats.rank ? `su ${neighbors.total}` : "Classifica"} onClick={() => setDetail("rank")} />
        <StatusTile
          ico="📉"
          tone={(mode === "kg" ? stats.lostKg : stats.lostPct) > 0 ? "good" : stats.lostKg < 0 ? "bad" : "neutral"}
          value={stats.weighinCount ? scoreText(mode, stats) : "—"}
          label="Dall'inizio"
          onClick={() => setDetail("lost")}
        />
        <StatusTile ico="⚖️" tone="primary" value={stats.currentWeight !== null ? formatKg(stats.currentWeight) : "—"} label="🔒 Peso attuale" onClick={() => setDetail("weight")} />
        <StatusTile ico="🔥" tone={stats.streak >= 2 ? "gold" : "neutral"} pulse={stats.streak >= 3} value={`${stats.streak} sett.`} label="In calo di fila" onClick={() => setDetail("streak")} />
        <StatusTile ico={stats.lastSnack ? snackById(stats.lastSnack.snack)?.emoji ?? "🍫" : "🍫"} tone="snack" pulse={stats.mood === "guilty"} value={`${stats.snacksCaught}`} label="Sgarri avvistati" onClick={() => setDetail("snacks")} />
        <StatusTile ico="🎯" tone="good" value={goalProgress !== null ? `${Math.round(goalProgress * 100)}%` : "Fissalo"} label="Obiettivo" onClick={() => setDetail("goal")} />
      </div>

      {/* Next weigh-in */}
      <section className="card">
        <div className="countdown">
          <div className={`countdown__days${nextWeighIn.doneThisWeek ? " done" : nextWeighIn.isToday ? " today" : ""}`}>
            {nextWeighIn.doneThisWeek ? (
              <div>
                <b>✓</b>
                <small>fatta</small>
              </div>
            ) : nextWeighIn.isToday ? (
              <div>
                <b>⚖️</b>
                <small>OGGI</small>
              </div>
            ) : (
              <div>
                <b>{nextWeighIn.daysUntil}</b>
                <small>{nextWeighIn.daysUntil === 1 ? "giorno" : "giorni"}</small>
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {nextWeighIn.isToday && !nextWeighIn.doneThisWeek ? (
              <>
                <h2 style={{ fontSize: "1.15rem" }}>Oggi si pesa! 🥁</h2>
                <p className="muted" style={{ margin: "2px 0 8px" }}>Scendi in produzione e poi registra il peso.</p>
                {!season.adminOnlyWeighins ? (
                  <Link to="/pesata" className="btn btn--sm">
                    Registra la pesata
                  </Link>
                ) : null}
              </>
            ) : nextWeighIn.doneThisWeek ? (
              <>
                <h2 style={{ fontSize: "1.15rem" }}>Pesata della settimana fatta</h2>
                <p className="muted" style={{ margin: "2px 0 6px" }}>Prossima: {formatLongDate(nextWeighIn.isToday ? addDays(nextWeighIn.date, 7) : nextWeighIn.date)}</p>
                {thisWeek ? <DeltaChip delta={stats.weekDelta} suffix=" questa settimana" /> : null}
              </>
            ) : (
              <>
                <h2 style={{ fontSize: "1.15rem" }}>Prossima pesata</h2>
                <p className="muted" style={{ margin: "2px 0 0" }}>{formatLongDate(nextWeighIn.date)}</p>
                {stats.weighinCount > 0 && stats.weekDelta !== null ? (
                  <div style={{ marginTop: 6 }}>
                    <DeltaChip delta={stats.weekDelta} suffix=" l'ultima volta" />
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Rivals */}
      {stats.rank ? (
        <section className="card">
          <div className="card__head">
            <h2>⚔️ I tuoi rivali</h2>
            <Link to="/classifica" className="link-btn">
              Classifica →
            </Link>
          </div>
          {neighbors.ahead ? (
            <Link to={`/utente/${neighbors.ahead.id}`} className="rival">
              <Avatar config={neighbors.ahead.avatar} size={46} animated={false} />
              <div className="rival__text">
                <b>{neighbors.ahead.name}</b>
                <span>ti sta davanti di {gapText(mode, neighbors.ahead.gap)}</span>
              </div>
              <span className="chip chip--bad">da superare</span>
            </Link>
          ) : (
            <div className="rival">
              <span style={{ fontSize: "2rem" }}>👑</span>
              <div className="rival__text">
                <b>Sei in testa alla classifica!</b>
                <span>Difendi la posizione fino all'ultimo giovedì.</span>
              </div>
            </div>
          )}
          {neighbors.behind ? (
            <Link to={`/utente/${neighbors.behind.id}`} className="rival">
              <Avatar config={neighbors.behind.avatar} size={46} animated={false} />
              <div className="rival__text">
                <b>{neighbors.behind.name}</b>
                <span>ti insegue a {gapText(mode, neighbors.behind.gap)}</span>
              </div>
              <span className="chip chip--good">dietro di te</span>
            </Link>
          ) : null}
        </section>
      ) : null}

      <button className="btn btn--snack btn--block" style={{ marginBottom: 14 }} onClick={() => setSnackOpen(true)}>
        👀 Ho beccato qualcuno con una merendina!
      </button>

      {/* Weight chart */}
      <section className="card">
        <div className="card__head">
          <h2>📈 Il tuo peso</h2>
          <Link to="/pesata" className="link-btn">
            Tutte le pesate →
          </Link>
        </div>
        {stats.history.length >= 2 ? (
          <LineChart
            label="Andamento del tuo peso"
            points={stats.history.map((h) => ({ date: h.date, value: h.weightKg }))}
            formatValue={(v) => formatKg(v)}
            target={me.goalKg && stats.startWeight ? { value: Math.round((stats.startWeight - me.goalKg) * 10) / 10, label: "Obiettivo" } : null}
          />
        ) : (
          <div className="empty">
            <span className="em">📊</span>
            {stats.history.length === 0 ? "Il grafico appare dopo le prime due pesate." : "Ancora una pesata e il grafico prende vita!"}
          </div>
        )}
        <p className="hint" style={{ margin: "8px 0 0" }}>🔒 Solo tu vedi il tuo peso. I colleghi vedono solo i chili persi.</p>
      </section>

      {/* Weekly recap */}
      {data.recap ? (
        <section className="card recap">
          <div className="recap__masthead">📰 La Gazzetta della Bilancia</div>
          <span className="hint">Pesata di {formatLongDate(data.recap.weekDate)}{data.recap.source === "ai" ? " · scritta dall'AI" : ""}</span>
          <p className="recap__text">{data.recap.text}</p>
        </section>
      ) : null}

      {/* Badges */}
      <section className="card">
        <div className="card__head">
          <h2>🏅 Badge</h2>
          <span className="muted">
            {data.badges.length} sbloccati
          </span>
        </div>
        <BadgeGrid earned={data.badges} />
      </section>

      {/* Season */}
      <section className="card card--flat">
        <div className="row row--between">
          <b>🗓️ {season.challengeName}</b>
          <span className="hint">fino al {formatFullDate(season.seasonEnd)}</span>
        </div>
        <div className="level-bar__track" style={{ marginTop: 10, background: "var(--surface-3)" }}>
          <div className="level-bar__fill" style={{ width: `${seasonElapsed * 100}%`, background: "var(--gold)" }} />
        </div>
        <p className="hint" style={{ margin: "6px 0 0" }}>
          Classifica per {mode === "kg" ? "chili persi" : "percentuale di peso perso"}. {season.ended ? "Sfida conclusa." : `Mancano ${season.daysLeft} giorni: ogni giovedì conta!`}
        </p>
      </section>

      {detail ? <DetailSheet detail={detail} data={data} onClose={() => setDetail(null)} onChanged={reload} /> : null}
      {snackOpen ? <SnackReportSheet onClose={() => setSnackOpen(false)} /> : null}
    </>
  );
}

function StatusTile({ ico, tone, value, label, onClick, pulse }: { ico: string; tone: string; value: string; label: string; onClick: () => void; pulse?: boolean }) {
  return (
    <button className="status-tile" onClick={onClick}>
      <span className={`status-tile__ico tone-${tone}${pulse ? " pulse" : ""}`} aria-hidden="true">
        {ico}
      </span>
      <span className="status-tile__value">{value}</span>
      <span className="status-tile__label">{label}</span>
    </button>
  );
}

function DetailSheet({ detail, data, onClose, onChanged }: { detail: Exclude<Detail, null>; data: Dashboard; onClose: () => void; onChanged: () => void }) {
  const { stats, season, me, neighbors } = data;
  const { setMe } = useSession();
  const { toast } = useUi();
  const [goal, setGoal] = useState(me.goalKg ? String(me.goalKg).replace(".", ",") : "");
  const mode = season.rankingMode;
  const nextLv = useMemo(() => nextLevel(levelForPct(stats.lostPct).level), [stats.lostPct]);

  const saveGoal = async () => {
    try {
      const v = goal.trim() ? Number(goal.replace(",", ".")) : null;
      setMe(await api.patch<Me>("/me", { goalKg: v }));
      toast("🎯 Obiettivo salvato!");
      onChanged();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  switch (detail) {
    case "rank":
      return (
        <Sheet title="🏆 La tua posizione" onClose={onClose}>
          {stats.rank ? (
            <div className="stack">
              <p style={{ margin: 0 }}>
                Sei al <b>{stats.rank}° posto</b> su {neighbors.total} con <b>{scoreText(mode, stats)}</b> persi.
              </p>
              {stats.prevRank ? (
                <p className="muted" style={{ margin: 0 }}>
                  {stats.prevRank > stats.rank
                    ? `📈 Hai guadagnato ${stats.prevRank - stats.rank} ${stats.prevRank - stats.rank === 1 ? "posizione" : "posizioni"} con l'ultima pesata.`
                    : stats.prevRank < stats.rank
                      ? `📉 Hai perso ${stats.rank - stats.prevRank} ${stats.rank - stats.prevRank === 1 ? "posizione" : "posizioni"} con l'ultima pesata.`
                      : "Posizione invariata rispetto alla settimana scorsa."}
                </p>
              ) : null}
              {neighbors.ahead ? <p className="muted" style={{ margin: 0 }}>Per superare {neighbors.ahead.name} ti servono {gapText(mode, neighbors.ahead.gap)}.</p> : null}
              <Link to="/classifica" className="btn btn--block" onClick={onClose}>
                Vedi la classifica completa
              </Link>
            </div>
          ) : (
            <p>Entrerai in classifica con la prima pesata. Ci vediamo giovedì! ⚖️</p>
          )}
        </Sheet>
      );
    case "lost":
      return (
        <Sheet title="📉 Quanto hai perso" onClose={onClose}>
          <div className="grid-2">
            <div className="card card--flat" style={{ margin: 0, textAlign: "center" }}>
              <div className="status-tile__value" style={{ fontSize: "1.6rem" }}>{formatKg(stats.lostKg)}</div>
              <span className="hint">in chili</span>
            </div>
            <div className="card card--flat" style={{ margin: 0, textAlign: "center" }}>
              <div className="status-tile__value" style={{ fontSize: "1.6rem" }}>{formatPct(stats.lostPct)}</div>
              <span className="hint">del peso di partenza</span>
            </div>
          </div>
          <p className="muted">
            La classifica conta {mode === "kg" ? "i chili persi" : "la percentuale persa"}. Miglior settimana: <b>{stats.bestWeekLoss > 0 ? `−${formatKg(stats.bestWeekLoss)}` : "—"}</b>.
          </p>
          {nextLv ? (
            <p className="info-box">
              {nextLv.emoji} Al −{formatPct(nextLv.minPct)} diventi <b>{nextLv.name}</b> e sblocchi: {nextLv.perk.toLowerCase()}.
            </p>
          ) : null}
          <div className="stack" style={{ gap: 6 }}>
            {LEVELS.map((l) => (
              <div key={l.level} className="row" style={{ opacity: stats.lostPct >= l.minPct ? 1 : 0.5 }}>
                <span style={{ width: 28 }}>{l.emoji}</span>
                <span style={{ flex: 1 }}>
                  <b>Lv {l.level} · {l.name}</b> <span className="hint">da −{formatPct(l.minPct)}</span>
                </span>
                {stats.lostPct >= l.minPct ? "✅" : "🔒"}
              </div>
            ))}
          </div>
        </Sheet>
      );
    case "weight":
      return (
        <Sheet title="⚖️ Il tuo peso" onClose={onClose}>
          {stats.currentWeight !== null ? (
            <div className="stack">
              <div className="grid-2">
                <div className="card card--flat" style={{ margin: 0, textAlign: "center" }}>
                  <div className="status-tile__value">{formatKg(stats.startWeight ?? 0)}</div>
                  <span className="hint">alla partenza</span>
                </div>
                <div className="card card--flat" style={{ margin: 0, textAlign: "center" }}>
                  <div className="status-tile__value">{formatKg(stats.currentWeight)}</div>
                  <span className="hint">ultima pesata</span>
                </div>
              </div>
              <p className="muted" style={{ margin: 0 }}>🔒 Il peso è privato: in classifica e nei profili si vedono solo le variazioni.</p>
              <Link to="/pesata" className="btn btn--block" onClick={onClose}>
                Registra o modifica le pesate
              </Link>
            </div>
          ) : (
            <p>Nessuna pesata ancora. Giovedì si scende in produzione! ⚖️</p>
          )}
        </Sheet>
      );
    case "streak":
      return (
        <Sheet title="🔥 Serie positiva" onClose={onClose}>
          <p style={{ marginTop: 0 }}>
            {stats.streak > 0
              ? `Sei in calo da ${stats.streak} ${stats.streak === 1 ? "settimana" : "settimane"} di fila. Non mollare!`
              : "Nessuna serie in corso: la prossima pesata in calo fa ripartire il contatore."}
          </p>
          <p className="muted">Con 3 settimane di fila sblocchi il badge 🔥 Tris, con 5 il badge ☄️ Inarrestabile.</p>
        </Sheet>
      );
    case "snacks": {
      const last = stats.lastSnack ? snackById(stats.lastSnack.snack) : null;
      return (
        <Sheet title="🍫 Sgarri avvistati" onClose={onClose}>
          <p style={{ marginTop: 0 }}>
            {stats.snacksCaught === 0
              ? "Nessuno ti ha ancora beccato. Fedina pulita... per ora 😇"
              : `Ti hanno beccato ${stats.snacksCaught} ${stats.snacksCaught === 1 ? "volta" : "volte"}.`}
            {last && stats.lastSnack ? ` L'ultima: ${last.emoji} ${last.name.toLowerCase()}, ${timeAgo(stats.lastSnack.at)}.` : ""}
          </p>
          <p className="muted">
            Tu hai fatto {stats.snacksReported} {stats.snacksReported === 1 ? "segnalazione" : "segnalazioni"}. Le segnalazioni sono anonime: chi viene beccato riceve una notifica tipo
            "Ti ho visto che mangi merendine... occhio! 👀"
          </p>
        </Sheet>
      );
    }
    case "goal":
      return (
        <Sheet title="🎯 Il tuo obiettivo" onClose={onClose}>
          <div className="stack">
            {me.goalKg ? (
              <p style={{ margin: 0 }}>
                Hai perso <b>{formatKg(Math.max(0, stats.lostKg))}</b> su <b>{formatKg(me.goalKg)}</b>. {stats.lostKg >= me.goalKg ? "Obiettivo raggiunto! 🎉" : `Ne mancano ${formatKg(me.goalKg - Math.max(0, stats.lostKg))}.`}
              </p>
            ) : (
              <p style={{ margin: 0 }}>Quanti chili vuoi perdere entro la fine della sfida?</p>
            )}
            <div className="field">
              <label htmlFor="goal">Obiettivo (kg da perdere)</label>
              <input id="goal" className="input" inputMode="decimal" value={goal} placeholder="es. 5" onChange={(e) => setGoal(e.target.value)} />
            </div>
            <button className="btn btn--block" onClick={() => void saveGoal()}>
              Salva obiettivo
            </button>
          </div>
        </Sheet>
      );
  }
}
