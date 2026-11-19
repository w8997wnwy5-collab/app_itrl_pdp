import path from "node:path";

// Optional .env file in the working directory (real environment variables win).
try {
  process.loadEnvFile();
} catch {
  /* no .env file */
}

function flag(name: string): boolean | undefined {
  const v = process.env[name];
  if (v === undefined || v === "") return undefined;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

const isProd = process.env.NODE_ENV === "production";
const publicUrl = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");

export const config = {
  isProd,
  port: Number(process.env.PORT ?? 3001),
  /** Folder that holds the SQLite database. Use ":memory:" for tests. */
  dataDir: process.env.DATA_DIR ?? path.resolve("data"),
  publicUrl,
  /** Optional fixed invite code. If unset, one is generated and shown in the admin panel. */
  inviteCode: process.env.INVITE_CODE?.trim() || undefined,
  /** Secure cookies need HTTPS: on by default in production. */
  cookieSecure: flag("COOKIE_SECURE") ?? isProd,
  /** Behind a reverse proxy (Fly, Render, Railway, nginx...) */
  trustProxy: flag("TRUST_PROXY") ?? isProd,
  /** Claude is used for the photo → avatar analysis and the weekly recap. */
  aiEnabled:
    flag("AI_ENABLED") ?? Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN),
  claudeModel: process.env.CLAUDE_MODEL?.trim() || "claude-opus-5-5",
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY?.trim() || undefined,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY?.trim() || undefined,
  /** Contact for push services; if unset the app's own https address is used. */
  vapidSubject: process.env.VAPID_SUBJECT?.trim() || undefined,
  schedulerEnabled: flag("SCHEDULER") ?? true,
};
