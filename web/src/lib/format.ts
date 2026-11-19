import { formatKg, formatPct, type RankingMode } from "../../../shared/game";

/** Weight change since the start, signed: "−6,4 kg" (lost) or "+2,7 kg" (gained). */
export function scoreText(mode: RankingMode, s: { lostKg: number; lostPct: number }): string {
  return mode === "kg" ? formatKg(-s.lostKg, { sign: true }) : formatPct(-s.lostPct, { sign: true });
}

export function gapText(mode: RankingMode, gap: number): string {
  return mode === "kg" ? formatKg(gap) : formatPct(gap);
}

/** "adesso", "5 min fa", "ieri", "3 giorni fa"... */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = (now.getTime() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "adesso";
  if (diff < 3600) return `${Math.floor(diff / 60)} min fa`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h fa`;
  const days = Math.floor(diff / 86400);
  if (days === 1) return "ieri";
  if (days < 7) return `${days} giorni fa`;
  return new Date(iso).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function ordinal(n: number): string {
  return `${n}°`;
}
