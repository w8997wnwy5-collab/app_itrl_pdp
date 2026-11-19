// "La Gazzetta della Bilancia": the weekly recap after the Thursday weigh-in.
import { addDays, formatLongDate } from "../shared/dates";
import { formatKg, formatPct, snackById } from "../shared/game";
import type { Recap } from "../shared/types";
import { writeRecap } from "./ai";
import { all, get, run } from "./db";
import { notifyMany } from "./notify";
import { getSeasonInfo } from "./settings";
import { loadStandings } from "./stats";
import { listUsers } from "./users";

export interface RecapData {
  settimana: string;
  sfida: string;
  classificaPer: "kg persi" | "% di peso perso";
  presenti: number;
  iscritti: number;
  assenti: string[];
  kgPersiDallUfficioQuestaSettimana: number;
  kgPersiDallUfficioDaInizioSfida: number;
  risultati: {
    nome: string;
    variazioneSettimana: string | null;
    totalePerso: string;
    posizione: number | null;
    posizionePrecedente: number | null;
  }[];
  sgarriAvvistatiQuestaSettimana: number;
  sgarroPiuAvvistato: string | null;
  giorniAllaFineSfida: number;
}

export function buildRecapData(weekDate: string): RecapData | null {
  const standings = loadStandings({ cutoff: weekDate });
  const season = getSeasonInfo();
  const users = listUsers();
  const names = new Map(users.map((u) => [u.id, u.name]));

  const present = [...standings.byUser.values()].filter((s) => s.lastDate === weekDate);
  if (present.length === 0) return null;

  const weekLoss = present.reduce((sum, s) => sum + (s.weekDelta !== null && s.weekDelta < 0 ? -s.weekDelta : 0), 0);
  const seasonLoss = [...standings.byUser.values()].reduce((sum, s) => sum + Math.max(0, s.lostKg), 0);
  const absent = [...standings.byUser.values()]
    .filter((s) => s.weighinCount > 0 && s.lastDate !== weekDate)
    .map((s) => names.get(s.userId) ?? "?");

  const snacks = all<{ snack: string }>(
    "SELECT snack FROM snack_reports WHERE created_at >= ? AND created_at < ?",
    `${addDays(weekDate, -7)}T12:00:00Z`,
    `${weekDate}T23:59:59Z`,
  );
  const snackCounts = new Map<string, number>();
  for (const s of snacks) snackCounts.set(s.snack, (snackCounts.get(s.snack) ?? 0) + 1);
  const topSnack = [...snackCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    settimana: formatLongDate(weekDate),
    sfida: season.challengeName,
    classificaPer: standings.mode === "kg" ? "kg persi" : "% di peso perso",
    presenti: present.length,
    iscritti: users.length,
    assenti: absent,
    kgPersiDallUfficioQuestaSettimana: Math.round(weekLoss * 10) / 10,
    kgPersiDallUfficioDaInizioSfida: Math.round(seasonLoss * 10) / 10,
    risultati: standings.order
      .map((id) => standings.byUser.get(id)!)
      .filter((s) => s.rank !== null)
      .map((s) => ({
        nome: names.get(s.userId) ?? "?",
        variazioneSettimana:
          s.lastDate === weekDate && s.weekDelta !== null ? formatKg(s.weekDelta, { sign: true }) : null,
        totalePerso: standings.mode === "kg" ? formatKg(s.lostKg) : formatPct(s.lostPct),
        posizione: s.rank,
        posizionePrecedente: s.prevRank,
      })),
    sgarriAvvistatiQuestaSettimana: snacks.length,
    sgarroPiuAvvistato: topSnack ? (snackById(topSnack[0])?.name ?? null) : null,
    giorniAllaFineSfida: season.daysLeft,
  };
}

/** Plain-text recap used when Claude is not configured. */
export function templateRecap(d: RecapData): string {
  const parts: string[] = [];
  parts.push(`Pesata di ${d.settimana}: ${d.presenti} su ${d.iscritti} all'appello.`);

  const withDelta = d.risultati.filter((r) => r.variazioneSettimana !== null);
  const parseDelta = (s: string) => Number(s.replace("−", "-").replace(",", ".").replace(/[^\d.-]/g, ""));
  const best = [...withDelta].sort((a, b) => parseDelta(a.variazioneSettimana!) - parseDelta(b.variazioneSettimana!))[0];
  if (best && parseDelta(best.variazioneSettimana!) < 0) {
    parts.push(`Miglior pesata della settimana: ${best.nome} con ${best.variazioneSettimana}! 🔥`);
  }
  const leader = d.risultati.find((r) => r.posizione === 1);
  if (leader) {
    const kept = leader.posizionePrecedente === 1;
    parts.push(`${kept ? "In testa resta" : "Nuovo capoclassifica:"} ${leader.nome} (${leader.totalePerso}). 👑`);
  }
  const climber = [...d.risultati]
    .filter((r) => r.posizione && r.posizionePrecedente && r.posizionePrecedente - r.posizione >= 2)
    .sort((a, b) => b.posizionePrecedente! - b.posizione! - (a.posizionePrecedente! - a.posizione!))[0];
  if (climber && climber.nome !== leader?.nome) {
    parts.push(`Rimonta di ${climber.nome}, ora al ${climber.posizione}° posto.`);
  }
  const worst = [...withDelta].sort((a, b) => parseDelta(b.variazioneSettimana!) - parseDelta(a.variazioneSettimana!))[0];
  if (worst && parseDelta(worst.variazioneSettimana!) > 0) {
    parts.push(`Settimana storta per ${worst.nome} (${worst.variazioneSettimana}): giovedì prossimo si rimedia!`);
  }
  if (d.kgPersiDallUfficioQuestaSettimana > 0) {
    parts.push(
      `In totale l'ufficio ha perso ${formatKg(d.kgPersiDallUfficioQuestaSettimana)} in una settimana (${formatKg(d.kgPersiDallUfficioDaInizioSfida)} da inizio sfida).`,
    );
  }
  if (d.sgarriAvvistatiQuestaSettimana > 0) {
    parts.push(
      `Sgarri avvistati: ${d.sgarriAvvistatiQuestaSettimana}${d.sgarroPiuAvvistato ? ` (il più gettonato: ${d.sgarroPiuAvvistato.toLowerCase()})` : ""}. 👀`,
    );
  }
  if (d.assenti.length > 0) {
    const shown = d.assenti.slice(0, 3).join(", ");
    parts.push(`Assenze ingiustificate: ${shown}${d.assenti.length > 3 ? " e altri" : ""}.`);
  }
  parts.push(d.giorniAllaFineSfida > 0 ? `Mancano ${d.giorniAllaFineSfida} giorni alla fine della sfida!` : "La sfida è agli sgoccioli!");
  return parts.join(" ");
}

export function getRecap(weekDate: string): Recap | null {
  const row = get<{ week_date: string; text: string; source: "ai" | "template"; created_at: string }>(
    "SELECT * FROM recaps WHERE week_date = ?",
    weekDate,
  );
  return row ? { weekDate: row.week_date, text: row.text, source: row.source, createdAt: row.created_at } : null;
}

export function latestRecap(): Recap | null {
  const row = get<{ week_date: string }>("SELECT week_date FROM recaps ORDER BY week_date DESC LIMIT 1");
  return row ? getRecap(row.week_date) : null;
}

/** Builds (with Claude when available), stores and announces the recap of a week. */
export async function publishRecap(weekDate: string, opts: { notify?: boolean } = {}): Promise<Recap | null> {
  const data = buildRecapData(weekDate);
  if (!data) return null;
  const aiText = await writeRecap(data);
  const text = aiText ?? templateRecap(data);
  const source = aiText ? "ai" : "template";
  run(
    `INSERT INTO recaps (week_date, text, source) VALUES (?, ?, ?)
     ON CONFLICT(week_date) DO UPDATE SET text = excluded.text, source = excluded.source,
       created_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')`,
    weekDate,
    text,
    source,
  );
  if (opts.notify !== false) {
    const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? text;
    notifyMany(
      listUsers().map((u) => u.id),
      {
        kind: "recap",
        icon: "📰",
        title: "La Gazzetta della Bilancia",
        body: firstSentence.length > 140 ? `${firstSentence.slice(0, 137)}...` : firstSentence,
        url: "/",
      },
    );
  }
  return getRecap(weekDate);
}
