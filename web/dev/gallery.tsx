// Dev-only page (http://localhost:5173/dev/avatars.html) to review every avatar option.
import { createRoot } from "react-dom/client";
import { DEFAULT_AVATAR, HAIR_STYLES, randomAvatar, type AvatarConfig } from "../../shared/avatar";
import type { Mood } from "../../shared/game";
import { Avatar } from "../src/components/Avatar";

const moods: Mood[] = ["ecstatic", "happy", "neutral", "worried", "sad", "guilty"];
let seed = 7;
const rnd = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

function Row({ label, items }: { label: string; items: { key: string; config: AvatarConfig; mood?: Mood; level?: number; leader?: boolean }[] }) {
  return (
    <section style={{ padding: 12 }}>
      <h3 style={{ margin: "4px 0" }}>{label}</h3>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        {items.map((it) => (
          <figure key={it.key} style={{ margin: 0, textAlign: "center", fontSize: 11 }}>
            <Avatar config={it.config} mood={it.mood} level={it.level} leader={it.leader} size={120} animated={false} />
            <figcaption>{it.key}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

function Gallery() {
  return (
    <div>
      <Row label="Capelli" items={HAIR_STYLES.map((h) => ({ key: h.id, config: { ...DEFAULT_AVATAR, hair: h.id, hairColor: "dark_brown" } }))} />
      <Row label="Umori" items={moods.map((m) => ({ key: m, config: { ...DEFAULT_AVATAR, glasses: "round" }, mood: m }))} />
      <Row label="Livelli" items={[0, 1, 2, 3, 4, 5].map((l) => ({ key: `lv ${l}`, config: { ...DEFAULT_AVATAR, hair: "side" }, level: l, leader: l === 5 }))} />
      <Row label="Casuali" items={Array.from({ length: 18 }, (_, i) => ({ key: `r${i}`, config: randomAvatar(rnd), mood: moods[i % moods.length] }))} />
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<Gallery />);
