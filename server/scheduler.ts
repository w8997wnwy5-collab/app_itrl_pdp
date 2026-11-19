// Time-based notifications (Europe/Rome): reminders, snack-time teasing,
// weekly recap and season milestones.
import { addDays, daysBetween, weekdayOf, weighInDayOnOrAfter, weighInDayOnOrBefore, zonedParts } from "../shared/dates";
import { formatKg, formatPct, type TeaseLevel } from "../shared/game";
import { all, run } from "./db";
import {
  FRIDAY,
  MONDAY,
  render,
  SNACK_TIME,
  THURSDAY_MORNING,
  THURSDAY_REMINDER,
  WEDNESDAY_EVENING,
  whenPhrase,
  type MessageContext,
  type Template,
} from "./messages";
import { notify, notifyMany } from "./notify";
import { getRecap, publishRecap } from "./recap";
import { getSeasonInfo } from "./settings";
import { loadStandings, type Standings } from "./stats";
import { listUsers, type UserRow } from "./users";

interface Job {
  id: string;
  /** 0 = Sunday ... 6 = Saturday */
  days: number[];
  hour: number;
  minute: number;
  run: (date: string, rnd: () => number) => Promise<void> | void;
}

const WINDOW_MINUTES = 30;

/** Chance of a teasing message per snack-time slot, by tease level. */
const TEASE_CHANCE: Record<TeaseLevel, number> = { off: 0, soft: 0.1, normal: 0.25, spicy: 0.5 };

function teaseLevel(u: UserRow): TeaseLevel {
  return (["off", "soft", "normal", "spicy"] as const).find((l) => l === u.tease_level) ?? "normal";
}

function contextFor(u: UserRow, standings: Standings, date: string, names: Map<number, string>): MessageContext {
  const ctx: MessageContext = {
    name: u.name.split(" ")[0] ?? u.name,
    when: whenPhrase(daysBetween(date, weighInDayOnOrAfter(date))),
  };
  const leaderId = standings.order.find((id) => standings.byUser.get(id)?.rank === 1);
  if (leaderId !== undefined && leaderId !== u.id) ctx.leader = names.get(leaderId);
  const me = standings.byUser.get(u.id);
  if (me?.rank && me.rank > 1) {
    const idx = standings.order.indexOf(u.id);
    const aheadId = standings.order[idx - 1];
    const ahead = aheadId !== undefined ? standings.byUser.get(aheadId) : undefined;
    if (ahead && ahead.score !== null && me.score !== null && ahead.score > me.score) {
      ctx.rival = names.get(ahead.userId);
      ctx.gap = standings.mode === "kg" ? formatKg(ahead.score - me.score) : formatPct(ahead.score - me.score);
    }
  }
  return ctx;
}

function sendPool(
  users: UserRow[],
  pool: readonly Template[],
  date: string,
  rnd: () => number,
  kind: "tease" | "reminder",
  chance: (u: UserRow) => number,
): void {
  const standings = loadStandings();
  const names = new Map(listUsers().map((u) => [u.id, u.name.split(" ")[0] ?? u.name]));
  for (const u of users) {
    if (rnd() >= chance(u)) continue;
    const msg = render(pool, contextFor(u, standings, date, names), rnd);
    notify(u.id, { kind, ...msg, url: kind === "reminder" ? "/pesata" : "/" });
  }
}

const teasable = (u: UserRow) => teaseLevel(u) !== "off";

export const JOBS: Job[] = [
  {
    id: "monday-motivation",
    days: [1],
    hour: 9,
    minute: 0,
    run: (date, rnd) => sendPool(listUsers().filter(teasable), MONDAY, date, rnd, "tease", () => 1),
  },
  {
    id: "snack-morning",
    days: [1, 2, 3, 4, 5],
    hour: 10,
    minute: 30,
    run: (date, rnd) =>
      sendPool(listUsers(), SNACK_TIME, date, rnd, "tease", (u) => TEASE_CHANCE[teaseLevel(u)]),
  },
  {
    id: "snack-afternoon",
    days: [1, 2, 3, 5],
    hour: 16,
    minute: 0,
    run: (date, rnd) => {
      const friday = weekdayOf(date) === 5;
      sendPool(listUsers(), friday ? FRIDAY : SNACK_TIME, date, rnd, "tease", (u) =>
        Math.min(1, TEASE_CHANCE[teaseLevel(u)] * (friday ? 2.5 : 1)),
      );
    },
  },
  {
    id: "wednesday-evening",
    days: [3],
    hour: 18,
    minute: 30,
    run: (date, rnd) => sendPool(listUsers().filter(teasable), WEDNESDAY_EVENING, date, rnd, "reminder", () => 1),
  },
  {
    id: "thursday-morning",
    days: [4],
    hour: 8,
    minute: 30,
    run: (date, rnd) => sendPool(listUsers(), THURSDAY_MORNING, date, rnd, "reminder", () => 1),
  },
  {
    id: "thursday-reminder",
    days: [4],
    hour: 15,
    minute: 0,
    run: (date, rnd) => {
      if (getSeasonInfo(date).adminOnlyWeighins) return;
      const done = new Set(
        all<{ user_id: number }>("SELECT user_id FROM weighins WHERE week_date = ?", date).map((r) => r.user_id),
      );
      if (done.size === 0) return; // nobody weighed in: probably no weigh-in this week
      const missing = listUsers().filter((u) => !done.has(u.id));
      sendPool(missing, THURSDAY_REMINDER, date, rnd, "reminder", () => 1);
    },
  },
  {
    id: "thursday-recap",
    days: [4],
    hour: 18,
    minute: 0,
    run: async (date) => {
      if (getRecap(date)) return;
      await publishRecap(date);
    },
  },
  {
    id: "season-countdown",
    days: [0, 1, 2, 3, 4, 5, 6],
    hour: 9,
    minute: 15,
    run: (date) => {
      const season = getSeasonInfo(date);
      if (season.ended || ![30, 14, 7, 3, 1].includes(season.daysLeft)) return;
      const standings = loadStandings();
      const leaderId = standings.order.find((id) => standings.byUser.get(id)?.rank === 1);
      const leader = leaderId ? listUsers().find((u) => u.id === leaderId)?.name : undefined;
      const days = season.daysLeft === 1 ? "Manca 1 giorno" : `Mancano ${season.daysLeft} giorni`;
      notifyMany(
        listUsers().map((u) => u.id),
        {
          kind: "reminder",
          icon: "⏳",
          title: `${days} alla fine!`,
          body: leader
            ? `${days} alla fine di "${season.challengeName}". ${leader} è in testa: chi riuscirà a conquistare il trono?`
            : `${days} alla fine di "${season.challengeName}". Ogni pesata conta!`,
          url: "/classifica",
        },
      );
    },
  },
  {
    id: "season-end",
    days: [0, 1, 2, 3, 4, 5, 6],
    hour: 10,
    minute: 0,
    run: (date) => {
      const season = getSeasonInfo(date);
      if (date !== addDays(season.seasonEnd, 1)) return;
      const standings = loadStandings();
      const winnerId = standings.order.find((id) => standings.byUser.get(id)?.rank === 1);
      const winner = winnerId ? standings.byUser.get(winnerId) : undefined;
      const name = winnerId ? listUsers().find((u) => u.id === winnerId)?.name : undefined;
      if (!winner || !name) return;
      const score = standings.mode === "kg" ? formatKg(winner.lostKg) : formatPct(winner.lostPct);
      notifyMany(
        listUsers().map((u) => u.id),
        {
          kind: "announcement",
          icon: "🏆",
          title: `${season.challengeName}: abbiamo un vincitore!`,
          body: `Vince ${name} con ${score}. Complimenti a tutti per la sfida! 🎉`,
          url: "/classifica",
        },
      );
    },
  },
];

function claim(jobId: string, key: string): boolean {
  return run("INSERT OR IGNORE INTO job_runs (job, run_key) VALUES (?, ?)", jobId, key).changes > 0;
}

/** Runs every job whose time has come (within the window) and that has not run today. */
export async function tick(now: Date = new Date(), rnd: () => number = Math.random): Promise<string[]> {
  const p = zonedParts(now);
  const minutes = p.hour * 60 + p.minute;
  const ran: string[] = [];
  for (const job of JOBS) {
    if (!job.days.includes(p.weekday)) continue;
    const start = job.hour * 60 + job.minute;
    if (minutes < start || minutes >= start + WINDOW_MINUTES) continue;
    if (!claim(job.id, p.date)) continue;
    try {
      await job.run(p.date, rnd);
      ran.push(job.id);
    } catch (err) {
      console.error(`Job ${job.id} fallito:`, err);
    }
  }
  return ran;
}

export function startScheduler(): () => void {
  let running = false;
  const loop = async () => {
    if (running) return;
    running = true;
    try {
      await tick();
    } finally {
      running = false;
    }
  };
  void loop();
  const handle = setInterval(loop, 30_000);
  return () => clearInterval(handle);
}

/** Current week's weigh-in day, used by routes. */
export function currentWeighInDay(date: string): string {
  return weighInDayOnOrBefore(date);
}
