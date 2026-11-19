import { addDays } from "../shared/dates";
import { GUILTY_HOURS, levelForPct, moodFor, roundKg, type RankingMode } from "../shared/game";
import type { StatsCore } from "../shared/types";
import { all, run } from "./db";
import { getGameSettings } from "./settings";

export interface WeighinRecord {
  id: number;
  userId: number;
  date: string;
  weightKg: number;
}

export interface SnackRecord {
  reporterId: number;
  targetId: number;
  snack: string;
  createdAt: string;
}

export interface UserStanding extends StatsCore {
  userId: number;
  startWeight: number | null;
  currentWeight: number | null;
  history: WeighinRecord[];
  maxStreak: number;
  everGained: boolean;
  /** Ranking score in the current mode (kg or %), null without weigh-ins. */
  score: number | null;
}

export interface StandingsInput {
  userIds: number[];
  weighins: WeighinRecord[];
  snacks: SnackRecord[];
  mode: RankingMode;
  now: Date;
  /** Only weigh-ins on or before this date are considered. */
  cutoff?: string;
}

export interface Standings {
  byUser: Map<number, UserStanding>;
  /** User ids ordered by rank (participants first, then users without weigh-ins). */
  order: number[];
  latestWeek: string | null;
  mode: RankingMode;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function scoreOf(s: { lostKg: number; lostPct: number }, mode: RankingMode): number {
  return mode === "kg" ? s.lostKg : s.lostPct;
}

/** Pure computation of every user's stats and the ranking. */
export function computeStandings(input: StandingsInput): Standings {
  const { mode, now, cutoff } = input;
  const weighins = cutoff ? input.weighins.filter((w) => w.date <= cutoff) : input.weighins;
  const latestWeek = weighins.reduce<string | null>((max, w) => (max === null || w.date > max ? w.date : max), null);

  const byUserWeighins = new Map<number, WeighinRecord[]>();
  for (const w of weighins) {
    const list = byUserWeighins.get(w.userId) ?? [];
    list.push(w);
    byUserWeighins.set(w.userId, list);
  }

  const byUser = new Map<number, UserStanding>();
  for (const userId of input.userIds) {
    const history = (byUserWeighins.get(userId) ?? []).sort((a, b) => a.date.localeCompare(b.date));
    const first = history[0];
    const last = history[history.length - 1];
    const prev = history.length >= 2 ? history[history.length - 2] : undefined;

    const startWeight = first?.weightKg ?? null;
    const currentWeight = last?.weightKg ?? null;
    const lostKg = first && last ? roundKg(first.weightKg - last.weightKg) : 0;
    const lostPct = first && last ? round2(((first.weightKg - last.weightKg) / first.weightKg) * 100) : 0;
    const weekDelta = last && prev ? roundKg(last.weightKg - prev.weightKg) : null;

    let streak = 0;
    for (let i = history.length - 1; i > 0; i--) {
      if (history[i]!.weightKg < history[i - 1]!.weightKg) streak++;
      else break;
    }
    let maxStreak = 0;
    let run = 0;
    let bestWeekLoss = 0;
    let everGained = false;
    for (let i = 1; i < history.length; i++) {
      const diff = history[i - 1]!.weightKg - history[i]!.weightKg;
      if (diff > 0) {
        run++;
        maxStreak = Math.max(maxStreak, run);
        bestWeekLoss = Math.max(bestWeekLoss, roundKg(diff));
      } else {
        run = 0;
        if (diff < 0) everGained = true;
      }
    }

    const received = input.snacks.filter((s) => s.targetId === userId);
    const lastSnackRecord = received.reduce<SnackRecord | null>(
      (latest, s) => (latest === null || s.createdAt > latest.createdAt ? s : latest),
      null,
    );
    const caughtRecently =
      lastSnackRecord !== null &&
      now.getTime() - new Date(lastSnackRecord.createdAt).getTime() < GUILTY_HOURS * 3600 * 1000;

    // Mood follows the latest weigh-in only if the user took part in it.
    const moodDelta = last && last.date === latestWeek ? weekDelta : null;

    const standing: UserStanding = {
      userId,
      weighinCount: history.length,
      startWeight,
      currentWeight,
      history,
      lostKg,
      lostPct,
      weekDelta,
      lastDate: last?.date ?? null,
      streak,
      maxStreak,
      bestWeekLoss,
      everGained,
      snacksCaught: received.length,
      snacksReported: input.snacks.filter((s) => s.reporterId === userId).length,
      lastSnack: lastSnackRecord ? { snack: lastSnackRecord.snack, at: lastSnackRecord.createdAt } : null,
      level: levelForPct(lostPct).level,
      mood: moodFor(moodDelta, caughtRecently),
      rank: null,
      prevRank: null,
      score: history.length > 0 ? scoreOf({ lostKg, lostPct }, mode) : null,
    };
    byUser.set(userId, standing);
  }

  const participants = [...byUser.values()].filter((s) => s.score !== null);
  const other: RankingMode = mode === "kg" ? "pct" : "kg";
  participants.sort(
    (a, b) =>
      b.score! - a.score! ||
      scoreOf(b, other) - scoreOf(a, other) ||
      b.weighinCount - a.weighinCount ||
      a.userId - b.userId,
  );
  participants.forEach((s, i) => {
    const prev = participants[i - 1];
    s.rank = prev && prev.score === s.score ? prev.rank : i + 1;
  });

  const waiting = [...byUser.values()].filter((s) => s.score === null).sort((a, b) => a.userId - b.userId);
  return {
    byUser,
    order: [...participants, ...waiting].map((s) => s.userId),
    latestWeek,
    mode,
  };
}

/** Adds prevRank (rank before the latest weigh-in week) to the standings. */
export function withPreviousRanks(input: StandingsInput): Standings {
  const current = computeStandings(input);
  if (!current.latestWeek) return current;
  const previous = computeStandings({ ...input, cutoff: addDays(current.latestWeek, -1) });
  for (const [userId, s] of current.byUser) {
    s.prevRank = previous.byUser.get(userId)?.rank ?? null;
  }
  return current;
}

export function loadStandingsInput(opts: { cutoff?: string; mode?: RankingMode; now?: Date } = {}): StandingsInput {
  const settings = getGameSettings();
  const userIds = all<{ id: number }>("SELECT id FROM users ORDER BY id").map((u) => u.id);
  const weighins = all<{ id: number; user_id: number; week_date: string; weight_kg: number }>(
    "SELECT id, user_id, week_date, weight_kg FROM weighins WHERE week_date BETWEEN ? AND ?",
    settings.seasonStart,
    settings.seasonEnd,
  ).map((w) => ({ id: w.id, userId: w.user_id, date: w.week_date, weightKg: w.weight_kg }));
  const snacks = all<{ reporter_id: number; target_id: number; snack: string; created_at: string }>(
    "SELECT reporter_id, target_id, snack, created_at FROM snack_reports WHERE created_at >= ? AND created_at < ?",
    `${addDays(settings.seasonStart, -1)}T22:00:00Z`,
    `${addDays(settings.seasonEnd, 1)}T23:59:59Z`,
  ).map((s) => ({ reporterId: s.reporter_id, targetId: s.target_id, snack: s.snack, createdAt: s.created_at }));
  return {
    userIds,
    weighins,
    snacks,
    mode: opts.mode ?? settings.rankingMode,
    now: opts.now ?? new Date(),
    cutoff: opts.cutoff,
  };
}

export function loadStandings(opts: { cutoff?: string; mode?: RankingMode; now?: Date } = {}): Standings {
  return withPreviousRanks(loadStandingsInput(opts));
}

export function toStatsCore(s: UserStanding): StatsCore {
  return {
    weighinCount: s.weighinCount,
    lostKg: s.lostKg,
    lostPct: s.lostPct,
    weekDelta: s.weekDelta,
    lastDate: s.lastDate,
    streak: s.streak,
    bestWeekLoss: s.bestWeekLoss,
    snacksCaught: s.snacksCaught,
    snacksReported: s.snacksReported,
    lastSnack: s.lastSnack,
    level: s.level,
    mood: s.mood,
    rank: s.rank,
    prevRank: s.prevRank,
  };
}

/** Badges a user has earned according to the current standings. */
export function earnedBadges(s: UserStanding): string[] {
  const out: string[] = [];
  const positive = (s.score ?? 0) > 0;
  if (s.weighinCount >= 1) out.push("first_weighin");
  if (s.maxStreak >= 3) out.push("streak_3");
  if (s.maxStreak >= 5) out.push("streak_5");
  if (s.bestWeekLoss >= 1) out.push("big_week");
  if (s.lostKg >= 3) out.push("kg_3");
  if (s.lostKg >= 5) out.push("kg_5");
  if (s.lostKg >= 10) out.push("kg_10");
  if (s.lostPct >= 5) out.push("pct_5");
  if (positive && s.rank !== null && s.rank <= 3 && s.weighinCount >= 2) out.push("podium");
  if (positive && s.rank === 1 && s.weighinCount >= 2) out.push("leader");
  if (s.rank !== null && s.prevRank !== null && s.prevRank - s.rank >= 3) out.push("comeback");
  if (s.weighinCount >= 8) out.push("consistent");
  if (s.weighinCount >= 5 && !s.everGained && s.lostKg > 0) out.push("iron");
  if (s.snacksCaught >= 1) out.push("caught");
  if (s.snacksCaught >= 5) out.push("caught_5");
  if (s.snacksReported >= 5) out.push("spy");
  return out;
}

/** Stores newly earned badges; returns them grouped by user. */
export function syncBadges(standings: Standings = loadStandings()): Map<number, string[]> {
  const existing = new Set(
    all<{ user_id: number; badge: string }>("SELECT user_id, badge FROM user_badges").map(
      (b) => `${b.user_id}:${b.badge}`,
    ),
  );
  const awarded = new Map<number, string[]>();
  for (const s of standings.byUser.values()) {
    for (const badge of earnedBadges(s)) {
      if (existing.has(`${s.userId}:${badge}`)) continue;
      run("INSERT OR IGNORE INTO user_badges (user_id, badge) VALUES (?, ?)", s.userId, badge);
      awarded.set(s.userId, [...(awarded.get(s.userId) ?? []), badge]);
    }
  }
  return awarded;
}

export function badgesOf(userId: number): { id: string; awardedAt: string }[] {
  return all<{ badge: string; awarded_at: string }>(
    "SELECT badge, awarded_at FROM user_badges WHERE user_id = ? ORDER BY awarded_at",
    userId,
  ).map((b) => ({ id: b.badge, awardedAt: b.awarded_at }));
}
