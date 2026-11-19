import fs from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import express from "express";
import { loadUser, requireAdmin, requireAuth } from "./auth";
import { config } from "./config";
import { errorHandler, HttpError, sameOriginOnly } from "./http";
import { adminRouter } from "./routes/admin";
import { authRouter } from "./routes/auth";
import { gameRouter } from "./routes/game";
import { meRouter } from "./routes/me";
import { notificationsRouter } from "./routes/notifications";
import { getSetting, setSetting } from "./settings";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", 1);

  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "same-origin");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=()");
    if (config.isProd) {
      res.setHeader(
        "Content-Security-Policy",
        "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; " +
          "script-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; frame-ancestors 'none'; base-uri 'self'",
      );
    }
    next();
  });

  // Remember the public https address (used as contact for push services).
  let publicUrlKnown = Boolean(config.publicUrl) || Boolean(getSetting("public_url"));
  app.use((req, _res, next) => {
    if (!publicUrlKnown && req.protocol === "https") {
      const host = req.get("host");
      if (host && !/^(localhost|127\.|\[::1\])/.test(host)) {
        setSetting("public_url", `https://${host}`);
        publicUrlKnown = true;
      }
    }
    next();
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  const api = express.Router();
  api.use(express.json({ limit: "5mb" }));
  api.use(cookieParser());
  api.use(sameOriginOnly);
  api.use(loadUser);
  api.use((_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  api.use("/auth", authRouter);
  api.use(requireAuth);
  api.use(meRouter);
  api.use(gameRouter);
  api.use(notificationsRouter);
  api.use("/admin", requireAdmin, adminRouter);
  api.use(() => {
    throw new HttpError(404, "Risorsa non trovata");
  });
  app.use("/api", api);

  // Built frontend (production). In development Vite serves it on :5173.
  const staticDir = path.resolve(process.env.STATIC_DIR ?? "dist/web");
  if (fs.existsSync(path.join(staticDir, "index.html"))) {
    app.use(
      express.static(staticDir, {
        index: false,
        setHeaders(res, file) {
          if (file.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          } else {
            res.setHeader("Cache-Control", "no-cache");
          }
        },
      }),
    );
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  app.use(errorHandler);
  return app;
}
