// Optional Claude features: photo → avatar analysis and the weekly recap.
// Enabled when ANTHROPIC_API_KEY (or AI_ENABLED=1 with another credential) is set.
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import * as z from "zod/v4";
import {
  ACCESSORIES,
  BACKGROUNDS,
  BROWS,
  EYE_COLORS,
  FACIAL_HAIR,
  GLASSES,
  HAIR_COLORS,
  HAIR_STYLES,
  OUTFIT_COLORS,
  OUTFITS,
  SKIN_TONES,
  sanitizeAvatar,
} from "../shared/avatar";
import type { AvatarAnalysis } from "../shared/types";
import { config } from "./config";
import { HttpError } from "./http";

// Server-side fallback: if the model declines for policy reasons, the API
// retries on Anthropic's recommended fallback model within the same call.
const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({
    maxRetries: 2,
    timeout: 90_000,
    // Resolve fetch at call time (lets tests intercept requests).
    fetch: (input, init) => globalThis.fetch(input, init),
  });
  return client;
}

function ids<T extends readonly { id: string }[]>(list: T) {
  return list.map((o) => o.id) as [T[number]["id"], ...T[number]["id"][]];
}

const AvatarTraits = z.object({
  is_person: z.boolean(),
  skin: z.enum(ids(SKIN_TONES)),
  hair: z.enum(ids(HAIR_STYLES)),
  hairColor: z.enum(ids(HAIR_COLORS)),
  eyes: z.enum(ids(EYE_COLORS)),
  brows: z.enum(ids(BROWS)),
  facialHair: z.enum(ids(FACIAL_HAIR)),
  glasses: z.enum(ids(GLASSES)),
  accessory: z.enum(ids(ACCESSORIES)),
  outfit: z.enum(ids(OUTFITS)),
  outfitColor: z.enum(ids(OUTFIT_COLORS)),
  bg: z.enum(ids(BACKGROUNDS)),
  title: z.string(),
  description: z.string(),
});

const swatches = (list: readonly { id: string; hex: string; label: string }[]) =>
  list.map((o) => `${o.id} (${o.label}, ${o.hex})`).join(", ");

const AVATAR_SYSTEM = `You turn a selfie into settings for a friendly cartoon avatar used in "Chi Perde Vince", an Italian office game where colleagues weigh in every Thursday.

For each field pick the option that best matches what is visible in the photo:
- skin: the closest swatch: ${swatches(SKIN_TONES)}.
- hair: hairstyle seen from the front: ${HAIR_STYLES.map((h) => h.id).join(", ")}. "bald" = no hair on top, "receding" = clearly receding hairline, "buzz" = very short/shaved, "short" = classic short cut, "side" = short with a side part, "spiky" = short and spiky/messy, long styles only if hair reaches the shoulders.
- hairColor: ${swatches(HAIR_COLORS)}.
- eyes: iris color: ${swatches(EYE_COLORS)}. Use "dark" when unsure.
- brows: natural, thick, thin or arched.
- facialHair: none, stubble, mustache, goatee, beard (short full beard), full_beard (long, bushy).
- glasses: none, round, square, sun (sunglasses only).
- accessory: only if clearly worn: earrings, cap, beanie, headphones, hardhat; otherwise none.
- outfit: the visible top: ${OUTFITS.map((o) => o.id).join(", ")} ("overalls" = work overalls or a work uniform).
- outfitColor: dominant color of the top: ${swatches(OUTFIT_COLORS)}.
- bg: a background that goes well with the outfit: ${swatches(BACKGROUNDS)}.

Then write, in Italian:
- title: a playful, flattering nickname for the game character, 2-4 words, inspired by sport, food or office life. Build it on a noun that suits anyone and avoid gendered articles or adjectives (good: "Fulmine del Reparto", "Ninja della Bilancia", "Uragano del Giovedì", "Terrore delle Merendine").
- description: one short sentence (max 20 words) presenting the character like a video-game character card.

Never mention or infer body weight, body shape, age, ethnicity or health. If no human face is clearly visible, set is_person to false and choose friendly default options.`;

export async function analyzePhoto(base64: string, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<AvatarAnalysis> {
  if (!config.aiEnabled) throw new HttpError(501, "Analisi AI non configurata");
  let message;
  try {
    message = await getClient().beta.messages.parse({
      model: config.claudeModel,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: AVATAR_SYSTEM,
      output_config: { effort: "low", format: betaZodOutputFormat(AvatarTraits) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Crea il personaggio per questa persona." },
          ],
        },
      ],
    });
  } catch (err) {
    throw aiError(err);
  }
  if (message.stop_reason === "refusal") {
    throw new HttpError(422, "Non sono riuscito ad analizzare questa foto: prova con un'altra o crea l'avatar a mano.");
  }
  const traits = message.parsed_output;
  if (!traits) throw new HttpError(502, "Risposta dell'AI non valida, riprova.");
  if (!traits.is_person) {
    throw new HttpError(422, "Non vedo bene un volto in questa foto: riprova inquadrando il viso.");
  }
  return {
    avatar: sanitizeAvatar(traits),
    title: traits.title.trim().slice(0, 40) || null,
    description: traits.description.trim().slice(0, 160) || null,
    source: "ai",
  };
}

const RECAP_SYSTEM = `Sei il telecronista della "Gazzetta della Bilancia", il notiziario di "Chi Perde Vince": una sfida tra colleghi d'ufficio che ogni giovedì si pesano e vince chi perde più peso entro fine anno.

Ricevi in JSON i risultati della pesata della settimana. Scrivi il commento della settimana in italiano:
- 60-100 parole, tono da telecronaca sportiva, ironico e affettuoso;
- cita i protagonisti per nome: chi ha perso di più, chi guida la classifica, sorpassi e rimonte;
- se qualcuno è salito di peso, scherza con gentilezza e incoraggialo;
- usa solo le variazioni di peso fornite (kg persi, variazioni settimanali), mai pesi assoluti;
- non commentare mai l'aspetto fisico o il corpo delle persone: si scherza solo su abitudini come merendine, pizza e macchinette;
- usa forme neutre rispetto al genere quando non sono ovvie;
- massimo 3 emoji, niente titoli, niente elenchi puntati: un unico paragrafo.`;

export async function writeRecap(data: unknown): Promise<string | null> {
  if (!config.aiEnabled) return null;
  try {
    const message = await getClient().beta.messages.create({
      model: config.claudeModel,
      max_tokens: 16000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      system: RECAP_SYSTEM,
      output_config: { effort: "medium" },
      messages: [{ role: "user", content: JSON.stringify(data) }],
    });
    if (message.stop_reason === "refusal") return null;
    const text = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    return text || null;
  } catch (err) {
    console.warn("Recap AI non disponibile:", err instanceof Error ? err.message : err);
    return null;
  }
}

function aiError(err: unknown): HttpError {
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("Claude: credenziali non valide", err.message);
    return new HttpError(503, "Analisi AI non disponibile (chiave API non valida).");
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new HttpError(503, "Troppe richieste all'AI, riprova tra un minuto.");
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("Claude: richiesta non valida", err.message);
    return new HttpError(422, "La foto non è stata accettata: prova con un'altra immagine.");
  }
  if (err instanceof Anthropic.APIError) {
    console.error(`Claude: errore API ${err.status}`, err.message);
    return new HttpError(503, "Analisi AI momentaneamente non disponibile, riprova.");
  }
  console.error("Claude: errore", err);
  return new HttpError(503, "Analisi AI momentaneamente non disponibile, riprova.");
}
