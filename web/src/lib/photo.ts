// Photo helpers: resize for upload, and a no-AI color guess for the avatar.
import {
  HAIR_COLORS,
  OUTFIT_COLORS,
  SKIN_TONES,
  type AvatarConfig,
  type ColorOption,
} from "../../../shared/avatar";

export async function fileToImage(file: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

function sourceSize(src: CanvasImageSource): { w: number; h: number } {
  if (src instanceof HTMLVideoElement) return { w: src.videoWidth, h: src.videoHeight };
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight };
  if (src instanceof HTMLCanvasElement) return { w: src.width, h: src.height };
  return { w: 512, h: 512 };
}

/** JPEG data URL scaled so the longest side is at most maxSide. */
export function toJpegDataUrl(src: CanvasImageSource, maxSide = 1024, mirror = false): string {
  const { w, h } = sourceSize(src);
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  if (mirror) {
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// Distance in a simple perceptual space (weighted RGB, "redmean").
function distance(a: RGB, b: RGB): number {
  const rm = (a[0] + b[0]) / 2;
  const dr = a[0] - b[0];
  const dg = a[1] - b[1];
  const db = a[2] - b[2];
  return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
}

function nearest<T extends ColorOption>(list: readonly T[], rgb: RGB): T {
  let best = list[0]!;
  let bestD = Infinity;
  for (const c of list) {
    const d = distance(rgb, hexToRgb(c.hex));
    if (d < bestD) {
      best = c;
      bestD = d;
    }
  }
  return best;
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)] ?? 0;
}

function sample(ctx: CanvasRenderingContext2D, size: number, x0: number, y0: number, x1: number, y1: number): RGB {
  const data = ctx.getImageData(Math.round(x0 * size), Math.round(y0 * size), Math.round((x1 - x0) * size), Math.round((y1 - y0) * size)).data;
  const r: number[] = [];
  const g: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < data.length; i += 4) {
    r.push(data[i]!);
    g.push(data[i + 1]!);
    b.push(data[i + 2]!);
  }
  return [median(r), median(g), median(b)];
}

/**
 * Rough guess of skin, hair and clothes colors from a centered selfie.
 * Used when the AI analysis is not configured; the user refines it in the editor.
 */
export function guessFromPhoto(src: CanvasImageSource): Partial<AvatarConfig> {
  const { w, h } = sourceSize(src);
  const size = 128;
  const side = Math.min(w, h);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, (w - side) / 2, (h - side) / 2, side, side, 0, 0, size, size);

  const skin = sample(ctx, size, 0.4, 0.46, 0.6, 0.62);
  const hair = sample(ctx, size, 0.34, 0.08, 0.66, 0.2);
  const clothes = sample(ctx, size, 0.3, 0.9, 0.7, 0.99);

  const naturalHair = HAIR_COLORS.filter((c) => c.id !== "blue" && c.id !== "pink");
  const result: Partial<AvatarConfig> = {
    skin: nearest(SKIN_TONES, skin).id,
    outfitColor: nearest(OUTFIT_COLORS, clothes).id,
  };
  // If the "hair" area looks like skin, the person is probably bald or the photo is tight.
  if (distance(hair, skin) > 60) result.hairColor = nearest(naturalHair, hair).id;
  return result;
}
