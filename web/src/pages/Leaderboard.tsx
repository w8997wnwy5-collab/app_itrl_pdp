import { useState } from "react";
import { Link } from "react-router";
import { formatLongDate } from "../../../shared/dates";
import type { RankingMode } from "../../../shared/game";
import type { Leaderboard as Board, LeaderboardEntry } from "../../../shared/types";
import { Avatar } from "../components/Avatar";
import { DeltaChip, RankMove } from "../components/DeltaChip";
import { TopBar } from "../components/Layout";
import { firstName, scoreText } from "../lib/format";
import { useApi, useMe } from "../lib/session";

export function Leaderboard() {
  const me = useMe();
  const [mode, setMode] = useState<RankingMode | null>(null);
  const { data, error } = useApi<Board>(`/leaderboard${mode ? `?mode=${mode}` : ""}`);

  if (error && !data) return <div className="error-box">{error}</div>;
  if (!data) return <div className="spinner" />;

  const shownMode = data.mode;
  const ranked = data.entries.filter((e) => e.rank !== null);
  const waiting = data.entries.filter((e) => e.rank === null);
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);
  const official = data.season.rankingMode;

  return (
    <>
      <TopBar
        title="Classifica 🏆"
        subtitle={data.latestWeek ? `Aggiornata alla pesata di ${formatLongDate(data.latestWeek)}` : "In attesa della prima pesata"}
      />

      <div className="row row--between" style={{ marginBottom: 10 }}>
        <div className="segmented" role="group" aria-label="Ordina per">
          <button aria-pressed={shownMode === "kg"} onClick={() => setMode("kg")}>
            Chili persi
          </button>
          <button aria-pressed={shownMode === "pct"} onClick={() => setMode("pct")}>
            % persa
          </button>
        </div>
        {shownMode !== official ? <span className="chip">non ufficiale</span> : <span className="chip chip--gold">ufficiale</span>}
      </div>

      {ranked.length === 0 ? (
        <div className="card empty">
          <span className="em">⚖️</span>
          La classifica si accende con le prime pesate di giovedì!
        </div>
      ) : (
        <>
          <section className="card" style={{ paddingBottom: 6 }}>
            <div className="podium">
              {[podium[1], podium[0], podium[2]].map((e, i) =>
                e ? <PodiumSpot key={e.id} entry={e} place={i === 1 ? 1 : i === 0 ? 2 : 3} mode={shownMode} /> : <div key={`empty-${i}`} />,
              )}
            </div>
          </section>

          {rest.length > 0 ? (
            <section className="card" style={{ padding: 8 }}>
              <ul className="lb-list">
                {rest.map((e) => (
                  <li key={e.id}>
                    <Row entry={e} mode={shownMode} isMe={e.id === me.id} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}

      {waiting.length > 0 ? (
        <>
          <h2 className="section-title">⏳ In attesa della prima pesata</h2>
          <section className="card" style={{ padding: 8 }}>
            <ul className="lb-list">
              {waiting.map((e) => (
                <li key={e.id}>
                  <Link to={`/utente/${e.id}`} className={`lb-row${e.id === me.id ? " me" : ""}`}>
                    <span className="lb-rank">–</span>
                    <Avatar config={e.avatar} size={44} mood={e.mood} animated={false} />
                    <span className="lb-who">
                      <b>{e.name}</b>
                      <span>{e.title ?? "Nuovo in gara"}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      ) : null}

      <p className="hint" style={{ textAlign: "center" }}>
        🔒 In classifica si vedono solo i chili persi, mai il peso. Vince chi a fine sfida ha perso di più ({official === "kg" ? "in chili" : "in percentuale"}).
      </p>
    </>
  );
}

function PodiumSpot({ entry, place, mode }: { entry: LeaderboardEntry; place: 1 | 2 | 3; mode: RankingMode }) {
  return (
    <Link to={`/utente/${entry.id}`} className="podium__spot">
      <Avatar config={entry.avatar} mood={entry.mood} level={entry.level} leader={place === 1} size={place === 1 ? 92 : 72} />
      <span className="podium__name">{firstName(entry.name)}</span>
      <span className="podium__value">{scoreText(mode, entry)}</span>
      <div className={`podium__block p${place}`} aria-label={`${place}° posto`}>
        {place}
      </div>
    </Link>
  );
}

function Row({ entry, mode, isMe }: { entry: LeaderboardEntry; mode: RankingMode; isMe: boolean }) {
  return (
    <Link to={`/utente/${entry.id}`} className={`lb-row${isMe ? " me" : ""}`}>
      <span className="lb-rank">
        {entry.rank}
        <RankMove rank={entry.rank} prevRank={entry.prevRank} />
      </span>
      <Avatar config={entry.avatar} size={44} mood={entry.mood} animated={false} />
      <span className="lb-who">
        <b>
          {entry.name}
          {isMe ? " (tu)" : ""}
        </b>
        <span>{entry.title ?? `${entry.weighinCount} ${entry.weighinCount === 1 ? "pesata" : "pesate"}`}</span>
      </span>
      <span className="lb-score">
        <b>{scoreText(mode, entry)}</b>
        {entry.inLatestWeek ? <DeltaChip delta={entry.weekDelta} /> : <span className="chip">assente</span>}
      </span>
    </Link>
  );
}
