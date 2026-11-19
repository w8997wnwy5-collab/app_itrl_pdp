// Italian notification texts. Placeholders in {braces} are filled by fill().
// Messages are written to be gender-neutral and to joke about habits
// (snacks, pizza, vending machines), never about bodies.

export interface MessageContext {
  name: string;
  /** "oggi", "domani", "tra 3 giorni" */
  when: string;
  leader?: string;
  rival?: string;
  gap?: string;
  rank?: number;
}

export interface Template {
  title: string;
  body: string;
  icon: string;
  /** Only usable when these placeholders are available. */
  needs?: (keyof MessageContext)[];
}

const t = (icon: string, title: string, body: string, needs?: (keyof MessageContext)[]): Template => ({
  icon,
  title,
  body,
  needs,
});

export const SNACK_TIME: Template[] = [
  t("👀", "Avvistamento", "Ti ho visto che mangi merendine... occhio!"),
  t("🍫", "Il cassetto parla", "Quella merendina nel cassetto? Lo sappiamo tutti, {name}."),
  t("🥐", "Pausa sospetta", "Cornetto alla crema a metà mattina? La bilancia di giovedì prende appunti."),
  t("☕", "Consiglio da bar", "Caffè amaro oggi: lo zucchero non fa punti in classifica."),
  t("🍪", "Le macchinette chiamano", "Le macchinette ti chiamano, {name}? Fai finta di non sentire."),
  t("⚖️", "Promemoria gentile", "Pesata {when}. La bilancia in produzione non dimentica nulla."),
  t("🍟", "Crunch sospetto", "Era un rumore di patatine quello? Davvero, {name}?"),
  t("🚶", "Sfida del giorno", "Oggi scale al posto dell'ascensore. Ti teniamo d'occhio."),
  t("🍬", "Effetto domino", "Una caramella tira l'altra... e la pesata è {when}."),
  t("💧", "Trucco del mestiere", "Prima dello spuntino bevi un bicchiere d'acqua: a volte la fame è solo noia."),
  t("🕵️", "Fonte anonima", "Una fonte anonima segnala movimenti sospetti vicino al distributore."),
  t("🍩", "Profumo di ciambelle", "Sento profumo di ciambelle... spero non arrivi dalla tua scrivania."),
  t("🥕", "Spuntino ufficiale", "Spuntino consigliato: una carota. Spuntino reale: lo sappiamo, {name}."),
  t("📸", "Sorridi!", "Una telecamera ti ha inquadrato vicino alla macchinetta. Scherziamo... forse."),
  t("😏", "Fiato sul collo", "{rival} ti sta davanti di {gap}. Posa quel biscotto.", ["rival", "gap"]),
  t("🏃", "Tutto si gioca sugli etti", "Ti separano {gap} da {rival}: ogni merendina conta!", ["rival", "gap"]),
  t("👑", "Intanto in vetta...", "{leader} è in testa alla classifica. Tu stai pensando alla merenda?", ["leader"]),
];

export const FRIDAY: Template[] = [
  t("🍕", "Venerdì sera", "Pizza stasera? Ricorda che il giovedì arriva sempre."),
  t("🍹", "Aperitivo in vista", "Aperitivo del venerdì? Scegli gli stuzzichini con saggezza, {name}."),
  t("🍺", "Weekend alle porte", "Birretta del weekend? Una, non tre. La pesata è {when}!"),
  t("🍖", "Allarme grigliata", "Weekend di grigliate e pranzi dalla nonna: occhio al bis!"),
];

export const MONDAY: Template[] = [
  t("💪", "Nuova settimana", "Nuova settimana, nuova occasione: la pesata è {when}!"),
  t("🌅", "Lunedì di riscatto", "Il weekend è passato, {name}. Da oggi si rimedia: pesata {when}."),
  t("🎯", "Obiettivo giovedì", "Missione della settimana: arrivare a giovedì più leggeri di oggi."),
];

export const WEDNESDAY_EVENING: Template[] = [
  t("⚖️", "Domani si pesa!", "Cena leggera stasera, eh {name}."),
  t("🥗", "L'ultima cena", "Ultima cena prima della pesata: insalata o rimpianti?"),
  t("😬", "Vigilia di pesata", "Domani la bilancia in produzione ti aspetta. Niente pizza stasera!"),
  t("🌙", "Consiglio della vigilia", "Stasera a letto presto e niente spuntini di mezzanotte: domani si pesa!"),
];

export const THURSDAY_MORNING: Template[] = [
  t("⚖️", "È giovedì!", "Oggi si scende in produzione a pesarsi. In bocca al lupo, {name}!"),
  t("🎯", "Giorno di pesata", "Svuota le tasche: oggi ogni etto conta 😉"),
  t("🥁", "Rullo di tamburi...", "...oggi si pesa! Ricordati di registrare il peso nell'app."),
  t("👟", "Giovedì = bilancia", "Scarpe leggere e tanto coraggio: oggi si pesa!"),
];

export const THURSDAY_REMINDER: Template[] = [
  t("⏰", "Manca la tua pesata", "Non hai ancora registrato la pesata di oggi... stai scappando dalla bilancia? 👀"),
  t("🫣", "Coincidenze?", "Quasi tutti hanno fatto la pesata. Tu no. Coincidenze? Io non credo."),
  t("⚖️", "Ultima chiamata", "Ultima chiamata per la pesata di oggi, {name}!"),
];

export const SNACK_REPORT_BODIES = [
  "Ti ho visto che {phrase}... occhio! 👀",
  "Una spia ti ha visto mentre {phrase}. Giovedì è vicino... 👀",
  "Qualcuno giura di averti visto mentre {phrase}. La bilancia è stata informata.",
  "Fonti anonime riferiscono che {phrase}. Occhio! 👀",
];

export function pickRandom<T>(list: readonly T[], rnd: () => number = Math.random): T {
  return list[Math.floor(rnd() * list.length)]!;
}

export function fill(text: string, values: Record<string, string | number | undefined>): string {
  return text.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = values[key];
    return v === undefined ? match : String(v);
  });
}

/** Picks a template whose placeholders are all available, then fills it. */
export function render(pool: readonly Template[], ctx: MessageContext, rnd: () => number = Math.random) {
  const usable = pool.filter((tpl) => (tpl.needs ?? []).every((k) => ctx[k] !== undefined));
  const tpl = pickRandom(usable.length ? usable : pool, rnd);
  const values = { ...ctx } as Record<string, string | number | undefined>;
  return { icon: tpl.icon, title: fill(tpl.title, values), body: fill(tpl.body, values) };
}

export function whenPhrase(daysUntil: number): string {
  if (daysUntil <= 0) return "oggi";
  if (daysUntil === 1) return "domani";
  return `tra ${daysUntil} giorni`;
}
