import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** Validates a request body/query with a zod schema, throwing a 400 with an Italian message. */
export function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    throw new HttpError(400, issue?.message ? `${field ? `${field}: ` : ""}${issue.message}` : "Dati non validi");
  }
  return result.data;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err && typeof err === "object" && "type" in err && err.type === "entity.too.large") {
    res.status(413).json({ error: "File troppo grande" });
    return;
  }
  if (err && typeof err === "object" && "type" in err && err.type === "entity.parse.failed") {
    res.status(400).json({ error: "Richiesta non valida" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Errore interno, riprova tra poco" });
}

/** Rejects cross-site state-changing requests (defense in depth on top of SameSite cookies). */
export function sameOriginOnly(req: Request, _res: Response, next: NextFunction): void {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  if (origin) {
    const host = req.get("x-forwarded-host") ?? req.get("host");
    try {
      if (new URL(origin).host !== host) throw new HttpError(403, "Origine non consentita");
    } catch (e) {
      if (e instanceof HttpError) throw e;
      throw new HttpError(403, "Origine non consentita");
    }
  }
  next();
}
