import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { createApp } from "../server/app";

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

export async function startServer(): Promise<TestServer> {
  const app = createApp();
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/** Minimal API client that keeps the session cookie. */
export class Client {
  cookie = "";
  constructor(private base: string) {}

  async req<T = unknown>(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${this.base}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) this.cookie = setCookie.split(";")[0]!;
    const text = await res.text();
    return { status: res.status, body: (text ? JSON.parse(text) : null) as T, text };
  }

  get<T = unknown>(path: string) {
    return this.req<T>("GET", path);
  }
  post<T = unknown>(path: string, body: unknown = {}, headers?: Record<string, string>) {
    return this.req<T>("POST", path, body, headers);
  }
}
