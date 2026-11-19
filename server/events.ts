// Game events: weigh-ins, sightings ("sgarri") and cheers, with their notifications.
import { badgeById, cheerById, formatKg, formatPct, snackById } from "../shared/game";
import type { WeighInResult } from "../shared/types";
import { all, get, run, transaction } from "./db";
import { HttpError } from "./http";
import { fill, pickRandom, SNACK_REPORT_BODIES } from "./messages";
import { notify } from "./notify";
import { loadStandings, syncBadges, type Standings } from "./stats";
import { getUser } from "./users";

export interface WeighInEntry {
  userId: number;
  date: string;
  /** null deletes the weigh-in of that week */
  weightKg: number | null;
}

function nameOf(userId: number): string {
  return getUser(userId)?.name ?? "Qualcuno";
}

function scoreLabel(standings: Standings, userId: number): string {
  const s = standings.byUser.get(userId);
  if (!s) return "";
  return standings.mode === "kg" ? formatKg(s.lostKg) : formatPct(s.lostPct);
}

/** Saves weigh-ins and notifies results, overtakes and new badges. */
export function recordWeighIns(entries: WeighInEntry[], recordedBy: number): Map<number, WeighInResult | null> {
  const before = loadStandings();

  transaction(() => {
    for (const e of entries) {
      if (e.weightKg === null) {
        run("DELETE FROM weighins WHERE user_id = ? AND week_date = ?", e.userId, e.date);
      } else {
        run(
          `INSERT INTO weighins (user_id, week_date, weight_kg, recorded_by) VALUES (?, ?, ?, ?)
           ON CONFLICT(user_id, week_date) DO UPDATE SET weight_kg = excluded.weight_kg,
             recorded_by = excluded.recorded_by, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
          e.userId,
          e.date,
          e.weightKg,
          recordedBy,
        );
      }
    }
  });

  const after = loadStandings();
  const touched = new Set(entries.map((e) => e.userId));
  const results = new Map<number, WeighInResult | null>();

  for (const e of entries) {
    if (e.weightKg === null) {
      results.set(e.userId, null);
      continue;
    }
    const s = after.byUser.get(e.userId);
    const row = get<{ id: number }>("SELECT id FROM weighins WHERE user_id = ? AND week_date = ?", e.userId, e.date);
    if (!s || !row) continue;
    const idx = s.history.findIndex((h) => h.date === e.date);
    const previous = idx > 0 ? s.history[idx - 1] : undefined;
    const delta = previous ? Math.round((e.weightKg - previous.weightKg) * 10) / 10 : null;
    results.set(e.userId, {
      weighIn: { id: row.id, date: e.date, weightKg: e.weightKg },
      delta,
      rank: s.rank,
      prevRank: before.byUser.get(e.userId)?.rank ?? null,
      newBadges: [],
    });

    // Admin-recorded weigh-ins: tell the person their result.
    if (recordedBy !== e.userId) {
      const rankText = s.rank ? ` Sei al ${s.rank}° posto in classifica.` : "";
      if (delta === null) {
        notify(e.userId, {
          kind: "result",
          icon: "🐣",
          title: "Prima pesata registrata",
          body: `Si parte! Da qui in poi ogni etto conta.${rankText}`,
          url: "/",
        });
      } else if (delta < 0) {
        notify(e.userId, {
          kind: "result",
          icon: "📉",
          title: "Grande pesata!",
          body: `${formatKg(delta, { sign: true })} questa settimana.${rankText}`,
          url: "/",
        });
      } else if (delta > 0) {
        notify(e.userId, {
          kind: "result",
          icon: "📈",
          title: "Ahi ahi...",
          body: `${formatKg(delta, { sign: true })} questa settimana. Giovedì prossimo si recupera!${rankText}`,
          url: "/",
        });
      } else {
        notify(e.userId, {
          kind: "result",
          icon: "➖",
          title: "Peso stabile",
          body: `Nessuna variazione questa settimana.${rankText}`,
          url: "/",
        });
      }
    }
  }

  notifyOvertakes(before, after, touched);

  const awarded = syncBadges(after);
  for (const [userId, badges] of awarded) {
    const r = results.get(userId);
    if (r) r.newBadges = badges;
    for (const id of badges) {
      const b = badgeById(id);
      if (b) notify(userId, { kind: "badge", icon: b.emoji, title: `Nuovo badge: ${b.name}`, body: b.description, url: "/profilo" });
    }
  }
  return results;
}

/** Tells people who lost positions who passed them. */
function notifyOvertakes(before: Standings, after: Standings, skip: Set<number>): void {
  for (const [userId, now] of after.byUser) {
    if (skip.has(userId)) continue;
    const was = before.byUser.get(userId);
    if (!was?.rank || !now.rank || now.rank <= was.rank) continue;
    const passers = [...after.byUser.values()].filter((o) => {
      if (o.userId === userId || !o.rank) return false;
      const oBefore = before.byUser.get(o.userId)?.rank ?? null;
      const wasBehind = oBefore === null || oBefore > was.rank!;
      return wasBehind && o.rank < now.rank!;
    });
    if (passers.length === 0) continue;
    const names = passers.slice(0, 2).map((p) => nameOf(p.userId));
    const who = passers.length > 2 ? `${names.join(", ")} e altri ${passers.length - 2}` : names.join(" e ");
    notify(userId, {
      kind: "overtake",
      icon: "😱",
      title: "Sorpasso!",
      body: `${who} ${passers.length > 1 ? "ti hanno" : "ti ha"} superato in classifica. Ora sei al ${now.rank}° posto (${scoreLabel(after, userId)}).`,
      url: "/classifica",
    });
  }
}

const SNACKS_PER_DAY = 5;

export function reportSnack(reporterId: number, targetId: number, snackId: string): { remaining: number } {
  const snack = snackById(snackId);
  if (!snack) throw new HttpError(400, "Sgarro sconosciuto");
  if (reporterId === targetId) throw new HttpError(400, "Autodenunciarsi è nobile, ma non vale 😇");
  if (!getUser(targetId)) throw new HttpError(404, "Collega non trovato");

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const today = all<{ target_id: number }>(
    "SELECT target_id FROM snack_reports WHERE reporter_id = ? AND created_at > ?",
    reporterId,
    since,
  );
  if (today.length >= SNACKS_PER_DAY) {
    throw new HttpError(429, "Hai già fatto 5 segnalazioni nelle ultime 24 ore: non esagerare, 007!");
  }
  if (today.some((r) => r.target_id === targetId)) {
    throw new HttpError(429, "Hai già segnalato questa persona nelle ultime 24 ore.");
  }

  run("INSERT INTO snack_reports (reporter_id, target_id, snack) VALUES (?, ?, ?)", reporterId, targetId, snack.id);
  notify(targetId, {
    kind: "snack",
    icon: snack.emoji,
    title: "Avvistamento!",
    body: fill(pickRandom(SNACK_REPORT_BODIES), { phrase: snack.phrase }),
    url: "/",
  });

  const awarded = syncBadges();
  for (const [userId, badges] of awarded) {
    for (const id of badges) {
      const b = badgeById(id);
      if (b) notify(userId, { kind: "badge", icon: b.emoji, title: `Nuovo badge: ${b.name}`, body: b.description, url: "/profilo" });
    }
  }
  return { remaining: SNACKS_PER_DAY - today.length - 1 };
}

const CHEERS_PER_DAY = 10;

export function sendCheer(senderId: number, targetId: number, cheerId: string): void {
  const cheer = cheerById(cheerId);
  if (!cheer) throw new HttpError(400, "Messaggio sconosciuto");
  if (senderId === targetId) throw new HttpError(400, "Non puoi mandarlo a te stesso");
  if (!getUser(targetId)) throw new HttpError(404, "Collega non trovato");

  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const recent = all<{ target_id: number }>(
    "SELECT target_id FROM cheers WHERE sender_id = ? AND created_at > ?",
    senderId,
    since,
  );
  if (recent.length >= CHEERS_PER_DAY) throw new HttpError(429, "Hai finito i messaggi per oggi, riprova domani!");
  if (recent.filter((r) => r.target_id === targetId).length >= 3) {
    throw new HttpError(429, "Hai già scritto 3 volte a questa persona oggi.");
  }

  run("INSERT INTO cheers (sender_id, target_id, kind) VALUES (?, ?, ?)", senderId, targetId, cheer.id);
  const from = nameOf(senderId);
  notify(targetId, {
    kind: "cheer",
    icon: cheer.emoji,
    title: `Messaggio da ${from}`,
    body: fill(cheer.message, { from }),
    url: `/utente/${senderId}`,
  });
}
