// Avatar ("personaggio") configuration shared by server and client.
// Every field is an id from a fixed list, so a saved avatar can always be
// validated and rendered safely.

export interface Option<Id extends string = string> {
  id: Id;
  label: string;
}

export interface ColorOption<Id extends string = string> extends Option<Id> {
  hex: string;
}

export const SKIN_TONES = [
  { id: "porcelain", label: "Porcellana", hex: "#FCE6D8" },
  { id: "fair", label: "Chiara", hex: "#F6D3BA" },
  { id: "light", label: "Chiara calda", hex: "#EDBF9C" },
  { id: "beige", label: "Beige", hex: "#DFA982" },
  { id: "tan", label: "Ambrata", hex: "#C98D65" },
  { id: "olive", label: "Olivastra", hex: "#B27E55" },
  { id: "brown", label: "Bruna", hex: "#8E5B3C" },
  { id: "dark", label: "Scura", hex: "#6C432A" },
  { id: "deep", label: "Molto scura", hex: "#4B2F20" },
] as const satisfies readonly ColorOption[];

export const HAIR_COLORS = [
  { id: "black", label: "Nero", hex: "#221D1E" },
  { id: "dark_brown", label: "Castano scuro", hex: "#3E271A" },
  { id: "brown", label: "Castano", hex: "#6B4429" },
  { id: "light_brown", label: "Castano chiaro", hex: "#9B6C44" },
  { id: "blonde", label: "Biondo", hex: "#D8B06A" },
  { id: "platinum", label: "Platino", hex: "#EEDDB4" },
  { id: "red", label: "Rosso", hex: "#B6492B" },
  { id: "auburn", label: "Ramato", hex: "#7F3424" },
  { id: "gray", label: "Grigio", hex: "#9E9B9A" },
  { id: "white", label: "Bianco", hex: "#E8E5E1" },
  { id: "blue", label: "Blu", hex: "#3F6FD8" },
  { id: "pink", label: "Rosa", hex: "#E46CA8" },
] as const satisfies readonly ColorOption[];

export const EYE_COLORS = [
  { id: "dark", label: "Scuri", hex: "#2A1C13" },
  { id: "brown", label: "Marroni", hex: "#5D3A21" },
  { id: "hazel", label: "Nocciola", hex: "#8B6A2F" },
  { id: "green", label: "Verdi", hex: "#4D7A3A" },
  { id: "blue", label: "Azzurri", hex: "#3B78B6" },
  { id: "gray", label: "Grigi", hex: "#6E7B84" },
] as const satisfies readonly ColorOption[];

export const HAIR_STYLES = [
  { id: "short", label: "Corti" },
  { id: "side", label: "Riga di lato" },
  { id: "spiky", label: "Sparati" },
  { id: "buzz", label: "Rasati" },
  { id: "curly", label: "Ricci" },
  { id: "long", label: "Lunghi" },
  { id: "bob", label: "Caschetto" },
  { id: "bun", label: "Chignon" },
  { id: "ponytail", label: "Coda" },
  { id: "afro", label: "Afro" },
  { id: "mohawk", label: "Cresta" },
  { id: "receding", label: "Stempiato" },
  { id: "bald", label: "Pelato" },
] as const satisfies readonly Option[];

export const BROWS = [
  { id: "natural", label: "Naturali" },
  { id: "thick", label: "Folte" },
  { id: "thin", label: "Sottili" },
  { id: "arched", label: "Ad arco" },
] as const satisfies readonly Option[];

export const FACIAL_HAIR = [
  { id: "none", label: "Niente" },
  { id: "stubble", label: "Barba corta" },
  { id: "mustache", label: "Baffi" },
  { id: "goatee", label: "Pizzetto" },
  { id: "beard", label: "Barba" },
  { id: "full_beard", label: "Barbone" },
] as const satisfies readonly Option[];

export const GLASSES = [
  { id: "none", label: "Niente" },
  { id: "round", label: "Tondi" },
  { id: "square", label: "Squadrati" },
  { id: "sun", label: "Da sole" },
] as const satisfies readonly Option[];

export const ACCESSORIES = [
  { id: "none", label: "Niente" },
  { id: "earrings", label: "Orecchini" },
  { id: "cap", label: "Cappellino" },
  { id: "beanie", label: "Berretto" },
  { id: "headphones", label: "Cuffie" },
  { id: "hardhat", label: "Caschetto" },
] as const satisfies readonly Option[];

export const OUTFITS = [
  { id: "tshirt", label: "T-shirt" },
  { id: "hoodie", label: "Felpa" },
  { id: "shirt", label: "Camicia" },
  { id: "polo", label: "Polo" },
  { id: "sweater", label: "Maglione" },
  { id: "overalls", label: "Tuta da lavoro" },
] as const satisfies readonly Option[];

export const OUTFIT_COLORS = [
  { id: "red", label: "Rosso", hex: "#E5484D" },
  { id: "orange", label: "Arancio", hex: "#F27B2F" },
  { id: "yellow", label: "Giallo", hex: "#F5C527" },
  { id: "green", label: "Verde", hex: "#38A169" },
  { id: "teal", label: "Petrolio", hex: "#1E9AA0" },
  { id: "blue", label: "Blu", hex: "#3B82F6" },
  { id: "navy", label: "Blu notte", hex: "#27356B" },
  { id: "purple", label: "Viola", hex: "#7C4DDB" },
  { id: "pink", label: "Rosa", hex: "#EC6AA6" },
  { id: "black", label: "Nero", hex: "#2A2833" },
  { id: "gray", label: "Grigio", hex: "#8B8A96" },
  { id: "white", label: "Bianco", hex: "#F3F1EC" },
] as const satisfies readonly ColorOption[];

export const BACKGROUNDS = [
  { id: "lilac", label: "Lilla", hex: "#DCD3FF" },
  { id: "mint", label: "Menta", hex: "#C9F2DD" },
  { id: "peach", label: "Pesca", hex: "#FFD9C2" },
  { id: "sky", label: "Cielo", hex: "#CDE7FF" },
  { id: "lemon", label: "Limone", hex: "#FFF1A8" },
  { id: "rose", label: "Rosa", hex: "#FFD3E2" },
  { id: "sage", label: "Salvia", hex: "#DDE8C8" },
  { id: "sand", label: "Sabbia", hex: "#EFE3CF" },
] as const satisfies readonly ColorOption[];

type Ids<T extends readonly { id: string }[]> = T[number]["id"];

export type SkinId = Ids<typeof SKIN_TONES>;
export type HairColorId = Ids<typeof HAIR_COLORS>;
export type EyeColorId = Ids<typeof EYE_COLORS>;
export type HairStyleId = Ids<typeof HAIR_STYLES>;
export type BrowId = Ids<typeof BROWS>;
export type FacialHairId = Ids<typeof FACIAL_HAIR>;
export type GlassesId = Ids<typeof GLASSES>;
export type AccessoryId = Ids<typeof ACCESSORIES>;
export type OutfitId = Ids<typeof OUTFITS>;
export type OutfitColorId = Ids<typeof OUTFIT_COLORS>;
export type BackgroundId = Ids<typeof BACKGROUNDS>;

export interface AvatarConfig {
  skin: SkinId;
  hair: HairStyleId;
  hairColor: HairColorId;
  eyes: EyeColorId;
  brows: BrowId;
  facialHair: FacialHairId;
  glasses: GlassesId;
  accessory: AccessoryId;
  outfit: OutfitId;
  outfitColor: OutfitColorId;
  bg: BackgroundId;
}

export const AVATAR_FIELDS = {
  skin: SKIN_TONES,
  hair: HAIR_STYLES,
  hairColor: HAIR_COLORS,
  eyes: EYE_COLORS,
  brows: BROWS,
  facialHair: FACIAL_HAIR,
  glasses: GLASSES,
  accessory: ACCESSORIES,
  outfit: OUTFITS,
  outfitColor: OUTFIT_COLORS,
  bg: BACKGROUNDS,
} as const satisfies { [K in keyof AvatarConfig]: readonly Option[] };

export const DEFAULT_AVATAR: AvatarConfig = {
  skin: "light",
  hair: "short",
  hairColor: "brown",
  eyes: "brown",
  brows: "natural",
  facialHair: "none",
  glasses: "none",
  accessory: "none",
  outfit: "tshirt",
  outfitColor: "blue",
  bg: "lilac",
};

function pick<T>(list: readonly T[], rnd: () => number): T {
  return list[Math.floor(rnd() * list.length)]!;
}

export function randomAvatar(rnd: () => number = Math.random): AvatarConfig {
  const hairColorPool = HAIR_COLORS.filter((c) => !["blue", "pink"].includes(c.id));
  return {
    skin: pick(SKIN_TONES, rnd).id,
    hair: pick(HAIR_STYLES, rnd).id,
    hairColor: pick(hairColorPool, rnd).id,
    eyes: pick(EYE_COLORS, rnd).id,
    brows: pick(BROWS, rnd).id,
    facialHair: rnd() < 0.55 ? "none" : pick(FACIAL_HAIR, rnd).id,
    glasses: rnd() < 0.6 ? "none" : pick(GLASSES, rnd).id,
    accessory: rnd() < 0.6 ? "none" : pick(ACCESSORIES, rnd).id,
    outfit: pick(OUTFITS, rnd).id,
    outfitColor: pick(OUTFIT_COLORS, rnd).id,
    bg: pick(BACKGROUNDS, rnd).id,
  };
}

/** Returns a valid avatar, replacing unknown or missing fields with defaults. */
export function sanitizeAvatar(input: unknown): AvatarConfig {
  const src = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const out = { ...DEFAULT_AVATAR } as Record<keyof AvatarConfig, string>;
  for (const key of Object.keys(AVATAR_FIELDS) as (keyof AvatarConfig)[]) {
    const value = src[key];
    const options = AVATAR_FIELDS[key] as readonly Option[];
    if (typeof value === "string" && options.some((o) => o.id === value)) out[key] = value;
  }
  return out as AvatarConfig;
}

export function colorHex<T extends readonly ColorOption[]>(list: T, id: string): string {
  return (list.find((c) => c.id === id) ?? list[0]!).hex;
}
