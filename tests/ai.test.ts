// Checks the Claude integration offline: the HTTP call is intercepted, so no API key or network is needed.
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

process.env.AI_ENABLED = "1";
process.env.ANTHROPIC_API_KEY = "sk-ant-test";

type Ai = typeof import("../server/ai");
let ai: Ai;

beforeAll(async () => {
  ai = await import("../server/ai");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function reply(content: unknown[], stop_reason = "end_turn") {
  return new Response(
    JSON.stringify({
      id: "msg_test",
      type: "message",
      role: "assistant",
      model: "claude-opus-5-5",
      content,
      stop_reason,
      stop_sequence: null,
      usage: { input_tokens: 1200, output_tokens: 90 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

const traits = {
  is_person: true,
  skin: "olive",
  hair: "curly",
  hairColor: "black",
  eyes: "brown",
  brows: "thick",
  facialHair: "beard",
  glasses: "round",
  accessory: "none",
  outfit: "hoodie",
  outfitColor: "red",
  bg: "peach",
  title: "Uragano del Giovedì",
  description: "Pronto a sfidare la bilancia a colpi di insalata.",
};

describe("Claude integration", () => {
  it("sends a structured-output vision request and maps the answer to an avatar", async () => {
    let captured: { url: string; headers: Headers; body: Record<string, any> } | null = null;
    vi.stubGlobal("fetch", async (url: string | URL, init: RequestInit) => {
      captured = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) };
      return reply([{ type: "text", text: JSON.stringify(traits) }]);
    });

    const res = await ai.analyzePhoto("aGVsbG8=", "image/jpeg");
    expect(res.avatar).toMatchObject({ skin: "olive", hair: "curly", facialHair: "beard", glasses: "round", outfitColor: "red" });
    expect(res.title).toBe("Uragano del Giovedì");

    expect(captured!.url).toContain("/v1/messages");
    expect(captured!.headers.get("anthropic-beta")).toContain("server-side-fallback-2026-07-01");
    const body = captured!.body;
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.fallbacks).toBe("default");
    expect(body.output_config.effort).toBe("low");
    expect(body.output_config.format.type).toBe("json_schema");
    expect(body.output_config.format.schema.properties.hair.enum).toContain("receding");
    expect(body.messages[0].content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg" } });
  });

  it("rejects photos without a face", async () => {
    vi.stubGlobal("fetch", async () => reply([{ type: "text", text: JSON.stringify({ ...traits, is_person: false }) }]));
    await expect(ai.analyzePhoto("aGVsbG8=", "image/png")).rejects.toMatchObject({ status: 422 });
  });

  it("handles a refusal without crashing", async () => {
    vi.stubGlobal("fetch", async () => reply([], "refusal"));
    await expect(ai.analyzePhoto("aGVsbG8=", "image/png")).rejects.toMatchObject({ status: 422 });
  });

  it("turns API errors into friendly messages", async () => {
    vi.stubGlobal(
      "fetch",
      async () =>
        new Response(JSON.stringify({ type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }), {
          status: 401,
          headers: { "content-type": "application/json" },
        }),
    );
    await expect(ai.analyzePhoto("aGVsbG8=", "image/png")).rejects.toMatchObject({ status: 503 });
  });

  it("writes the weekly recap and falls back to null on errors", async () => {
    vi.stubGlobal("fetch", async () => reply([{ type: "text", text: "Che settimana, signore e signori!" }]));
    expect(await ai.writeRecap({ settimana: "giovedì 19 novembre" })).toBe("Che settimana, signore e signori!");
    vi.stubGlobal("fetch", async () => new Response("boom", { status: 500 }));
    expect(await ai.writeRecap({})).toBeNull();
  });
});
