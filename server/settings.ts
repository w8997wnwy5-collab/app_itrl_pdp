import crypto from "node:crypto";
import { daysBetween, isISODate, today } from "../shared/dates";
import type { RankingMode } from "../shared/game";
import type { AdminSettings, SeasonInfo } from "../shared/types";
import { config } from "./config";
import { get, run } from "./db";

export function getSetting(key: string): string | undefined {
  return get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key)?.value;
}

export function setSetting(key: string, value: string): void {
  run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    key,
    value,
  );
}

function generateInviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (const byte of crypto.randomBytes(6)) code += alphabet[byte % alphabet.length];
  return code;
}

export function getGameSettings(): AdminSettings {
  const year = Number(today().slice(0, 4));
  let inviteCode = config.inviteCode ?? getSetting("invite_code");
  if (!inviteCode) {
    inviteCode = generateInviteCode();
    setSetting("invite_code", inviteCode);
  }
  const start = getSetting("season_start");
  const end = getSetting("season_end");
  const mode = getSetting("ranking_mode");
  return {
    challengeName: getSetting("challenge_name") ?? `Sfida ${year}`,
    seasonStart: start && isISODate(start) ? start : `${year}-01-01`,
    seasonEnd: end && isISODate(end) ? end : `${year}-12-31`,
    rankingMode: mode === "pct" ? "pct" : "kg",
    inviteCode,
    adminOnlyWeighins: getSetting("admin_only_weighins") === "1",
  };
}

export function updateGameSettings(patch: Partial<AdminSettings>): AdminSettings {
  if (patch.challengeName !== undefined) setSetting("challenge_name", patch.challengeName);
  if (patch.seasonStart !== undefined) setSetting("season_start", patch.seasonStart);
  if (patch.seasonEnd !== undefined) setSetting("season_end", patch.seasonEnd);
  if (patch.rankingMode !== undefined) setSetting("ranking_mode", patch.rankingMode satisfies RankingMode);
  if (patch.inviteCode !== undefined && !config.inviteCode) setSetting("invite_code", patch.inviteCode);
  if (patch.adminOnlyWeighins !== undefined) setSetting("admin_only_weighins", patch.adminOnlyWeighins ? "1" : "0");
  return getGameSettings();
}

export function getSeasonInfo(now: string = today()): SeasonInfo {
  const s = getGameSettings();
  return {
    challengeName: s.challengeName,
    seasonStart: s.seasonStart,
    seasonEnd: s.seasonEnd,
    rankingMode: s.rankingMode,
    daysLeft: Math.max(0, daysBetween(now, s.seasonEnd)),
    ended: now > s.seasonEnd,
    adminOnlyWeighins: s.adminOnlyWeighins,
  };
}
