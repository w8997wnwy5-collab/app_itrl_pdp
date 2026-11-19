// Game rules shared by server and client: levels, moods, badges, snacks.

export type RankingMode = "kg" | "pct";

export type Mood = "ecstatic" | "happy" | "neutral" | "worried" | "sad" | "guilty";

export interface Level {
  level: number;
  minPct: number;
  name: string;
  emoji: string;
  perk: string;
}

/** Levels unlock avatar gear as the percentage of weight lost grows. */
export const LEVELS: readonly Level[] = [
  { level: 0, minPct: 0, name: "Divano", emoji: "🛋️", perk: "Il viaggio comincia qui" },
  { level: 1, minPct: 1, name: "Riscaldamento", emoji: "🔥", perk: "Fascia da atleta" },
  { level: 2, minPct: 2.5, name: "In movimento", emoji: "👟", perk: "Asciugamano da palestra" },
  { level: 3, minPct: 5, name: "Atleta", emoji: "🥉", perk: "Medaglia di bronzo" },
  { level: 4, minPct: 8, name: "Fuoriclasse", emoji: "🥇", perk: "Medaglia d'oro" },
  { level: 5, minPct: 12, name: "Leggenda", emoji: "🌟", perk: "Aura leggendaria" },
];

export function levelForPct(pct: number): Level {
  let current = LEVELS[0]!;
  for (const l of LEVELS) if (pct >= l.minPct) current = l;
  return current;
}

export function nextLevel(level: number): Level | null {
  return LEVELS[level + 1] ?? null;
}

/** Hours during which a snack sighting keeps the avatar "guilty". */
export const GUILTY_HOURS = 24;

export function moodFor(weekDelta: number | null, caughtRecently: boolean): Mood {
  if (caughtRecently) return "guilty";
  if (weekDelta === null) return "neutral";
  if (weekDelta <= -1) return "ecstatic";
  if (weekDelta < 0) return "happy";
  if (weekDelta === 0) return "neutral";
  if (weekDelta < 1) return "worried";
  return "sad";
}

export const MOOD_LABELS: Record<Mood, string> = {
  ecstatic: "Alle stelle",
  happy: "Di buon umore",
  neutral: "Zen",
  worried: "Un filo d'ansia",
  sad: "Giornata no",
  guilty: "Mani nel sacco",
};

export interface BadgeDef {
  id: string;
  emoji: string;
  name: string;
  description: string;
}

export const BADGES: readonly BadgeDef[] = [
  { id: "first_weighin", emoji: "🐣", name: "Primo passo", description: "Hai registrato la prima pesata" },
  { id: "streak_3", emoji: "🔥", name: "Tris", description: "3 settimane di fila in calo" },
  { id: "streak_5", emoji: "☄️", name: "Inarrestabile", description: "5 settimane di fila in calo" },
  { id: "big_week", emoji: "💥", name: "Settimana d'oro", description: "Almeno 1 kg perso in una settimana" },
  { id: "kg_3", emoji: "🥉", name: "Club −3", description: "3 kg persi dall'inizio della sfida" },
  { id: "kg_5", emoji: "🥈", name: "Club −5", description: "5 kg persi dall'inizio della sfida" },
  { id: "kg_10", emoji: "🥇", name: "Club −10", description: "10 kg persi dall'inizio della sfida" },
  { id: "pct_5", emoji: "📉", name: "Meno 5%", description: "Perso il 5% del peso di partenza" },
  { id: "podium", emoji: "🏅", name: "Sul podio", description: "Hai raggiunto il podio della classifica" },
  { id: "leader", emoji: "👑", name: "Capoclassifica", description: "Hai conquistato la vetta della classifica" },
  { id: "comeback", emoji: "🚀", name: "Rimonta", description: "Almeno 3 posizioni guadagnate in una settimana" },
  { id: "consistent", emoji: "📅", name: "Stakanovista", description: "8 pesate registrate" },
  { id: "iron", emoji: "🛡️", name: "Inossidabile", description: "Mai un etto in più (minimo 5 pesate)" },
  { id: "caught", emoji: "🍫", name: "Mani nel sacco", description: "Qualcuno ti ha visto con uno sgarro" },
  { id: "caught_5", emoji: "🚨", name: "Sgarro seriale", description: "Cinque avvistamenti di sgarri" },
  { id: "spy", emoji: "🕵️", name: "Occhio di falco", description: "Hai segnalato 5 sgarri dei colleghi" },
];

export function badgeById(id: string): BadgeDef | undefined {
  return BADGES.find((b) => b.id === id);
}

export interface SnackDef {
  id: string;
  emoji: string;
  name: string;
  /** Completes "Ti ho visto che ..." (verb included). */
  phrase: string;
}

export const SNACKS: readonly SnackDef[] = [
  { id: "merendina", emoji: "🍫", name: "Merendina", phrase: "mangi merendine" },
  { id: "cornetto", emoji: "🥐", name: "Cornetto", phrase: "mangi un cornetto alla crema" },
  { id: "pizza", emoji: "🍕", name: "Pizza", phrase: "mangi pizza" },
  { id: "patatine", emoji: "🍟", name: "Patatine", phrase: "sgranocchi patatine" },
  { id: "dolce", emoji: "🍰", name: "Dolce", phrase: "mangi una fetta di torta" },
  { id: "gelato", emoji: "🍦", name: "Gelato", phrase: "lecchi un gelato" },
  { id: "biscotti", emoji: "🍪", name: "Biscotti", phrase: "inzuppi biscotti" },
  { id: "caramelle", emoji: "🍬", name: "Caramelle", phrase: "scarti caramelle" },
  { id: "panino", emoji: "🥪", name: "Panino", phrase: "addenti un panino con la porchetta" },
  { id: "bibita", emoji: "🥤", name: "Bibita", phrase: "bevi una bibita zuccherata" },
  { id: "birra", emoji: "🍺", name: "Birra", phrase: "bevi una birretta" },
  { id: "aperitivo", emoji: "🍹", name: "Aperitivo", phrase: "fai l'aperitivo con gli stuzzichini" },
];

export function snackById(id: string): SnackDef | undefined {
  return SNACKS.find((s) => s.id === id);
}

export interface CheerDef {
  id: string;
  emoji: string;
  label: string;
  /** Message received by the target; {from} = sender name. */
  message: string;
}

export const CHEERS: readonly CheerDef[] = [
  { id: "forza", emoji: "💪", label: "Forza!", message: "{from} fa il tifo per te: forza, ce la fai!" },
  { id: "applauso", emoji: "👏", label: "Applausi", message: "{from} ti applaude: che pesata!" },
  { id: "occhio", emoji: "👀", label: "Ti tengo d'occhio", message: "{from} ti tiene d'occhio... niente sgarri!" },
  { id: "arrivo", emoji: "😈", label: "Sto arrivando", message: "{from} ti avvisa: sto arrivando, preparati a perdere la posizione!" },
  { id: "scale", emoji: "🏃", label: "Fai le scale", message: "{from} ti consiglia: oggi scale, niente ascensore!" },
  { id: "pizza", emoji: "🍕", label: "Pizza stasera?", message: "{from} ti tenta: pizza stasera? 😏" },
];

export function cheerById(id: string): CheerDef | undefined {
  return CHEERS.find((c) => c.id === id);
}

export type TeaseLevel = "off" | "soft" | "normal" | "spicy";

export const TEASE_LEVELS: readonly { id: TeaseLevel; label: string; description: string }[] = [
  { id: "off", label: "Niente sfottò", description: "Solo promemoria e risultati" },
  { id: "soft", label: "Gentile", description: "Qualche frecciatina ogni tanto" },
  { id: "normal", label: "Normale", description: "Un paio di frecciatine a settimana" },
  { id: "spicy", label: "Piccante", description: "Ti teniamo sotto controllo 👀" },
];

export const MIN_WEIGHT_KG = 30;
export const MAX_WEIGHT_KG = 300;

export function roundKg(n: number): number {
  return Math.round(n * 10) / 10;
}

export function formatKg(n: number, opts: { sign?: boolean } = {}): string {
  const v = roundKg(n);
  const s = Math.abs(v).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (!opts.sign) return `${v < 0 ? "−" : ""}${s} kg`;
  if (v === 0) return "0,0 kg";
  return `${v > 0 ? "+" : "−"}${s} kg`;
}

export function formatPct(n: number, opts: { sign?: boolean } = {}): string {
  const v = Math.round(n * 10) / 10;
  const s = Math.abs(v).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  if (!opts.sign) return `${v < 0 ? "−" : ""}${s}%`;
  if (v === 0) return "0,0%";
  return `${v > 0 ? "+" : "−"}${s}%`;
}
