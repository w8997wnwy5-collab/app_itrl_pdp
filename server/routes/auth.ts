import { Router } from "express";
import { z } from "zod";
import { DEFAULT_AVATAR, randomAvatar } from "../../shared/avatar";
import { createSession, destroySession, hashPassword, rateLimiter, verifyPassword } from "../auth";
import { config } from "../config";
import { run } from "../db";
import { HttpError, parse } from "../http";
import { getGameSettings } from "../settings";
import { countUsers, getUser, getUserByEmail, toMe } from "../users";

export const authRouter = Router();

const loginLimiter = rateLimiter(10, 15 * 60 * 1000);
const registerLimiter = rateLimiter(10, 60 * 60 * 1000);

const email = z.email({ message: "Email non valida" }).max(120).transform((e) => e.trim().toLowerCase());
const password = z.string().min(6, { message: "La password deve avere almeno 6 caratteri" }).max(200);

/** Current session without a 401: { me: null } when logged out. */
authRouter.get("/session", (req, res) => {
  res.json({ me: req.user ? toMe(req.user) : null });
});

authRouter.get("/status", (_req, res) => {
  const hasUsers = countUsers() > 0;
  res.json({
    hasUsers,
    inviteRequired: hasUsers || Boolean(config.inviteCode),
    aiEnabled: config.aiEnabled,
  });
});

authRouter.post("/register", async (req, res) => {
  if (!registerLimiter(req.ip ?? "?")) throw new HttpError(429, "Troppi tentativi, riprova più tardi");
  const body = parse(
    z.object({
      name: z.string().trim().min(2, { message: "Il nome è troppo corto" }).max(40, { message: "Il nome è troppo lungo" }),
      email,
      password,
      inviteCode: z.string().trim().max(40).optional(),
    }),
    req.body,
  );

  const firstUser = countUsers() === 0;
  if (!firstUser || config.inviteCode) {
    const expected = getGameSettings().inviteCode;
    if ((body.inviteCode ?? "").toUpperCase() !== expected.toUpperCase()) {
      throw new HttpError(403, "Codice invito non valido: chiedilo all'organizzatore della sfida");
    }
  }
  if (getUserByEmail(body.email)) throw new HttpError(409, "Esiste già un account con questa email");

  const hash = await hashPassword(body.password);
  // Placeholder character until the photo step: random colors, neutral features.
  const avatar = { ...randomAvatar(), hair: DEFAULT_AVATAR.hair, facialHair: "none", glasses: "none", accessory: "none" } as const;
  const { lastInsertRowid } = run(
    "INSERT INTO users (email, name, password_hash, is_admin, avatar) VALUES (?, ?, ?, ?, ?)",
    body.email,
    body.name,
    hash,
    firstUser ? 1 : 0,
    JSON.stringify(avatar),
  );
  createSession(res, lastInsertRowid);
  res.status(201).json(toMe(getUser(lastInsertRowid)!));
});

authRouter.post("/login", async (req, res) => {
  const body = parse(z.object({ email, password: z.string().max(200) }), req.body);
  if (!loginLimiter(`${req.ip}:${body.email}`)) {
    throw new HttpError(429, "Troppi tentativi: riprova tra qualche minuto");
  }
  const user = getUserByEmail(body.email);
  const ok = user ? await verifyPassword(body.password, user.password_hash) : false;
  if (!user || !ok) throw new HttpError(401, "Email o password non corretti");
  createSession(res, user.id);
  res.json(toMe(user));
});

authRouter.post("/logout", (req, res) => {
  destroySession(req, res);
  res.json({ ok: true });
});
