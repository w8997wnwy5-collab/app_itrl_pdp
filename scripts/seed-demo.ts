// Fills an EMPTY database with a demo office: colleagues, 12 weeks of weigh-ins,
// snack sightings, badges, notifications and a weekly recap.
//
//   DATA_DIR=./data-demo npm run seed:demo
//
// Demo login: demo@chiperdevince.it / demo1234 (organizer)
import { randomAvatar, type AvatarConfig } from "../shared/avatar";
import { addDays, today, weighInDayOnOrBefore } from "../shared/dates";
import { hashPassword } from "../server/auth";
import { get, getDb, run, transaction } from "../server/db";
import { publishRecap } from "../server/recap";
import { updateGameSettings } from "../server/settings";
import { syncBadges } from "../server/stats";

let seed = 20261119;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};
const gauss = () => {
  const u = Math.max(rnd(), 1e-9);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

interface Person {
  name: string;
  email: string;
  title: string;
  start: number;
  trend: number; // average kg per week
  avatar: Partial<AvatarConfig>;
  tease: string;
}

const PEOPLE: Person[] = [
  { name: "Demo Organizzatore", email: "demo@chiperdevince.it", title: "Ninja della Bilancia", start: 88.4, trend: -0.45, avatar: { hair: "side", hairColor: "dark_brown", skin: "light", outfit: "polo", outfitColor: "navy", bg: "lilac", glasses: "square", facialHair: "stubble" }, tease: "normal" },
  { name: "Giulia Bianchi", email: "giulia@demo.it", title: "Fulmine del Reparto", start: 71.2, trend: -0.5, avatar: { hair: "long", hairColor: "auburn", skin: "fair", outfit: "sweater", outfitColor: "teal", bg: "mint", accessory: "earrings" }, tease: "spicy" },
  { name: "Marco Rossi", email: "marco@demo.it", title: "Terrore delle Merendine", start: 97.8, trend: -0.6, avatar: { hair: "short", hairColor: "black", skin: "olive", facialHair: "beard", outfit: "overalls", outfitColor: "blue", accessory: "hardhat", bg: "lemon" }, tease: "spicy" },
  { name: "Sara Conti", email: "sara@demo.it", title: "Regina del Sedano", start: 64.5, trend: -0.3, avatar: { hair: "bun", hairColor: "blonde", skin: "porcelain", outfit: "shirt", outfitColor: "pink", bg: "rose", glasses: "round" }, tease: "normal" },
  { name: "Luca Ferrari", email: "luca@demo.it", title: "Uragano del Giovedì", start: 92.1, trend: -0.15, avatar: { hair: "spiky", hairColor: "brown", skin: "beige", outfit: "hoodie", outfitColor: "red", bg: "peach", accessory: "headphones" }, tease: "normal" },
  { name: "Chiara Romano", email: "chiara@demo.it", title: "Freccia delle Scale", start: 68.0, trend: -0.35, avatar: { hair: "bob", hairColor: "black", skin: "tan", outfit: "tshirt", outfitColor: "purple", bg: "sky" }, tease: "soft" },
  { name: "Paolo Greco", email: "paolo@demo.it", title: "Cuore di Panettone", start: 101.3, trend: 0.05, avatar: { hair: "receding", hairColor: "gray", skin: "light", facialHair: "mustache", outfit: "shirt", outfitColor: "white", bg: "sand", glasses: "square" }, tease: "spicy" },
  { name: "Elena Marino", email: "elena@demo.it", title: "Turbo della Contabilità", start: 74.6, trend: -0.4, avatar: { hair: "curly", hairColor: "dark_brown", skin: "brown", outfit: "sweater", outfitColor: "yellow", bg: "lemon", accessory: "earrings" }, tease: "normal" },
  { name: "Davide Costa", email: "davide@demo.it", title: "Leggenda del Magazzino", start: 85.0, trend: -0.25, avatar: { hair: "buzz", hairColor: "black", skin: "dark", facialHair: "goatee", outfit: "overalls", outfitColor: "orange", bg: "peach", accessory: "cap" }, tease: "normal" },
  { name: "Francesca Gallo", email: "francesca@demo.it", title: "Ninja del Pranzo", start: 66.9, trend: -0.2, avatar: { hair: "ponytail", hairColor: "light_brown", skin: "fair", outfit: "hoodie", outfitColor: "green", bg: "sage" }, tease: "off" },
  { name: "Andrea Fontana", email: "andrea@demo.it", title: "Barone della Macchinetta", start: 89.7, trend: 0.1, avatar: { hair: "afro", hairColor: "black", skin: "deep", outfit: "tshirt", outfitColor: "black", bg: "lilac", glasses: "sun" }, tease: "spicy" },
];

async function main() {
  getDb();
  const existing = get<{ n: number }>("SELECT COUNT(*) AS n FROM users")?.n ?? 0;
  if (existing > 0 && !process.argv.includes("--force")) {
    console.error("Il database contiene già degli utenti: lo script demo funziona solo su un database vuoto.");
    console.error("Usa un'altra cartella dati, es. DATA_DIR=./data-demo npm run seed:demo");
    process.exit(1);
  }

  const lastWeek = weighInDayOnOrBefore(today());
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(lastWeek, -7 * (11 - i)));
  const year = lastWeek.slice(0, 4);
  updateGameSettings({ challengeName: `Sfida ${year}`, seasonStart: `${year}-01-01`, seasonEnd: `${year}-12-31`, inviteCode: "GIOVEDI" });

  const password = await hashPassword("demo1234");
  const ids: number[] = [];
  transaction(() => {
    PEOPLE.forEach((p, i) => {
      const avatar = { ...randomAvatar(rnd), facialHair: "none", glasses: "none", accessory: "none", ...p.avatar };
      const { lastInsertRowid } = run(
        "INSERT INTO users (email, name, password_hash, is_admin, onboarded, avatar, title, goal_kg, tease_level, created_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?)",
        p.email,
        p.name,
        password,
        i === 0 ? 1 : 0,
        JSON.stringify(avatar),
        p.title,
        i === 0 ? 6 : null,
        p.tease,
        `${weeks[0]}T08:00:00.000Z`,
      );
      ids.push(lastInsertRowid);

      let w = p.start;
      weeks.forEach((week, k) => {
        // A couple of people skip some Thursdays; Francesca joined late.
        if (i === 9 && k < 4) return;
        if ((i === 4 && k === 7) || (i === 6 && (k === 5 || k === 10))) return;
        if (k > 0) w = Math.round((w + p.trend + gauss() * 0.45) * 10) / 10;
        // Last week: make the story interesting.
        if (k === weeks.length - 1 && i === 3) w = Math.round((w - 1.3) * 10) / 10;
        if (k === weeks.length - 1 && i === 4) w = Math.round((w + 0.8) * 10) / 10;
        run("INSERT INTO weighins (user_id, week_date, weight_kg, recorded_by, created_at) VALUES (?, ?, ?, ?, ?)", ids[i]!, week, w, ids[i]!, `${week}T09:30:00.000Z`);
      });
    });

    const snacks = ["merendina", "cornetto", "pizza", "patatine", "biscotti", "gelato", "aperitivo", "panino", "birra", "dolce"];
    const now = Date.now();
    for (let k = 0; k < 26; k++) {
      const reporter = ids[Math.floor(rnd() * ids.length)]!;
      let target = ids[Math.floor(rnd() * ids.length)]!;
      if (target === reporter) target = ids[(ids.indexOf(reporter) + 1) % ids.length]!;
      const at = new Date(now - (2 + rnd() * 70) * 24 * 3600 * 1000).toISOString();
      run("INSERT INTO snack_reports (reporter_id, target_id, snack, created_at) VALUES (?, ?, ?, ?)", reporter, target, snacks[k % snacks.length]!, at);
    }
    // Fresh sightings: Paolo and Andrea were just caught (guilty avatars).
    run("INSERT INTO snack_reports (reporter_id, target_id, snack, created_at) VALUES (?, ?, 'cornetto', ?)", ids[1]!, ids[6]!, new Date(now - 2 * 3600 * 1000).toISOString());
    run("INSERT INTO snack_reports (reporter_id, target_id, snack, created_at) VALUES (?, ?, 'merendina', ?)", ids[2]!, ids[10]!, new Date(now - 5 * 3600 * 1000).toISOString());
  });

  syncBadges();
  await publishRecap(lastWeek, { notify: false });

  const demo = ids[0]!;
  const notes: [string, string, string, string, string, number][] = [
    ["tease", "👀", "Avvistamento", "Ti ho visto che mangi merendine... occhio!", "/", 26],
    ["cheer", "💪", "Messaggio da Giulia", "Giulia Bianchi fa il tifo per te: forza, ce la fai!", `/utente/${ids[1]}`, 20],
    ["reminder", "⚖️", "È giovedì!", "Oggi si scende in produzione a pesarsi. In bocca al lupo, Demo!", "/pesata", 8],
    ["overtake", "😱", "Sorpasso!", "Sara Conti ti ha superato in classifica. Ora sei al 4° posto.", "/classifica", 3],
    ["recap", "📰", "La Gazzetta della Bilancia", "È uscito il commento della pesata di questa settimana!", "/", 1],
    ["snack", "🥐", "Avvistamento!", "Una spia ti ha visto mentre mangi un cornetto alla crema. Giovedì è vicino... 👀", "/", 0.3],
  ];
  for (const [kind, icon, title, body, url, hoursAgo] of notes) {
    run(
      "INSERT INTO notifications (user_id, kind, title, body, icon, url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      demo,
      kind,
      title,
      body,
      icon,
      url,
      new Date(Date.now() - hoursAgo * 3600 * 1000).toISOString(),
    );
  }

  console.log(`✅ Demo pronta: ${PEOPLE.length} colleghi, ${weeks.length} settimane (${weeks[0]} → ${lastWeek}).`);
  console.log("   Accedi con demo@chiperdevince.it / demo1234 (organizzatore). Codice invito: GIOVEDI");
}

void main();
