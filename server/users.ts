import { DEFAULT_AVATAR, sanitizeAvatar } from "../shared/avatar";
import type { TeaseLevel } from "../shared/game";
import type { Me, PublicUser } from "../shared/types";
import { all, get } from "./db";

export interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  is_admin: number;
  onboarded: number;
  avatar: string | null;
  title: string | null;
  goal_kg: number | null;
  tease_level: string;
  created_at: string;
}

function parseAvatar(raw: string | null) {
  if (!raw) return { ...DEFAULT_AVATAR };
  try {
    return sanitizeAvatar(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_AVATAR };
  }
}

export function toPublicUser(u: UserRow): PublicUser {
  return { id: u.id, name: u.name, title: u.title, avatar: parseAvatar(u.avatar) };
}

const TEASE: readonly TeaseLevel[] = ["off", "soft", "normal", "spicy"];

export function toMe(u: UserRow): Me {
  return {
    ...toPublicUser(u),
    email: u.email,
    isAdmin: u.is_admin === 1,
    onboarded: u.onboarded === 1,
    goalKg: u.goal_kg,
    teaseLevel: TEASE.includes(u.tease_level as TeaseLevel) ? (u.tease_level as TeaseLevel) : "normal",
  };
}

export function getUser(id: number): UserRow | undefined {
  return get<UserRow>("SELECT * FROM users WHERE id = ?", id);
}

export function getUserByEmail(email: string): UserRow | undefined {
  return get<UserRow>("SELECT * FROM users WHERE email = ?", email.trim());
}

export function listUsers(): UserRow[] {
  return all<UserRow>("SELECT * FROM users ORDER BY name COLLATE NOCASE");
}

export function countUsers(): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM users")?.n ?? 0;
}
