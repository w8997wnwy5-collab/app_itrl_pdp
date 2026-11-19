// API payloads shared by server and client.
import type { AvatarConfig } from "./avatar";
import type { Mood, RankingMode, TeaseLevel } from "./game";

export interface PublicUser {
  id: number;
  name: string;
  title: string | null;
  avatar: AvatarConfig;
}

export interface Me extends PublicUser {
  email: string;
  isAdmin: boolean;
  onboarded: boolean;
  goalKg: number | null;
  teaseLevel: TeaseLevel;
}

export interface SeasonInfo {
  challengeName: string;
  seasonStart: string;
  seasonEnd: string;
  rankingMode: RankingMode;
  daysLeft: number;
  ended: boolean;
  adminOnlyWeighins: boolean;
}

/** Stats that every colleague can see: only relative changes, never absolute weights. */
export interface StatsCore {
  weighinCount: number;
  lostKg: number;
  lostPct: number;
  /** kg change at the latest weigh-in vs the previous one (negative = lost). */
  weekDelta: number | null;
  lastDate: string | null;
  streak: number;
  bestWeekLoss: number;
  snacksCaught: number;
  snacksReported: number;
  lastSnack: { snack: string; at: string } | null;
  level: number;
  mood: Mood;
  rank: number | null;
  prevRank: number | null;
}

export interface WeighIn {
  id: number;
  date: string;
  weightKg: number;
}

export interface OwnStats extends StatsCore {
  startWeight: number | null;
  currentWeight: number | null;
  history: WeighIn[];
}

export interface LeaderboardEntry extends PublicUser, StatsCore {
  badges: string[];
  inLatestWeek: boolean;
}

export interface Leaderboard {
  mode: RankingMode;
  latestWeek: string | null;
  entries: LeaderboardEntry[];
  season: SeasonInfo;
}

export interface Neighbor extends PublicUser {
  /** Distance in ranking units (kg or %), always positive. */
  gap: number;
}

export interface BadgeAward {
  id: string;
  awardedAt: string;
}

export interface Recap {
  weekDate: string;
  text: string;
  source: "ai" | "template";
  createdAt: string;
}

export interface NextWeighIn {
  /** The upcoming (or today's) weigh-in day. */
  date: string;
  daysUntil: number;
  isToday: boolean;
  /** Weigh-in day of the current week (most recent Thursday). */
  currentWeek: string;
  doneThisWeek: boolean;
}

export interface Dashboard {
  me: Me;
  stats: OwnStats;
  neighbors: { ahead: Neighbor | null; behind: Neighbor | null; total: number };
  badges: BadgeAward[];
  season: SeasonInfo;
  nextWeighIn: NextWeighIn;
  unreadCount: number;
  recap: Recap | null;
  winner: PublicUser | null;
  aiEnabled: boolean;
}

export interface PublicProfile {
  user: PublicUser;
  stats: StatsCore;
  badges: BadgeAward[];
  lossHistory: { date: string; lostKg: number; lostPct: number }[];
  season: SeasonInfo;
  isMe: boolean;
}

export type NotificationKind =
  | "tease"
  | "snack"
  | "cheer"
  | "reminder"
  | "result"
  | "overtake"
  | "badge"
  | "recap"
  | "announcement"
  | "system";

export interface NotificationItem {
  id: number;
  kind: NotificationKind;
  title: string;
  body: string;
  icon: string;
  url: string | null;
  readAt: string | null;
  createdAt: string;
}

export interface WeighInResult {
  weighIn: WeighIn;
  delta: number | null;
  rank: number | null;
  prevRank: number | null;
  newBadges: string[];
}

export interface AvatarAnalysis {
  avatar: AvatarConfig;
  title: string | null;
  description: string | null;
  source: "ai";
}

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  isAdmin: boolean;
  onboarded: boolean;
  createdAt: string;
  weighinCount: number;
  pushDevices: number;
}

export interface AdminSettings {
  challengeName: string;
  seasonStart: string;
  seasonEnd: string;
  rankingMode: RankingMode;
  inviteCode: string;
  adminOnlyWeighins: boolean;
}

export interface AdminWeighInRow {
  userId: number;
  name: string;
  avatar: AvatarConfig;
  weightKg: number | null;
  previousKg: number | null;
}

export interface ApiError {
  error: string;
}
