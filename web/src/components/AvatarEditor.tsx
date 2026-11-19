import { useState } from "react";
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
  randomAvatar,
  SKIN_TONES,
  type AvatarConfig,
  type ColorOption,
  type Option,
} from "../../../shared/avatar";
import { Avatar } from "./Avatar";

type Tab = "viso" | "capelli" | "barba" | "occhiali" | "accessori" | "vestiti" | "sfondo";

const TABS: { id: Tab; label: string }[] = [
  { id: "viso", label: "🙂 Viso" },
  { id: "capelli", label: "💇 Capelli" },
  { id: "barba", label: "🧔 Barba" },
  { id: "occhiali", label: "👓 Occhiali" },
  { id: "accessori", label: "🧢 Accessori" },
  { id: "vestiti", label: "👕 Vestiti" },
  { id: "sfondo", label: "🎨 Sfondo" },
];

interface Props {
  value: AvatarConfig;
  onChange: (next: AvatarConfig) => void;
}

export function AvatarEditor({ value, onChange }: Props) {
  const [tab, setTab] = useState<Tab>("viso");
  const set = <K extends keyof AvatarConfig>(key: K, v: AvatarConfig[K]) => onChange({ ...value, [key]: v });

  const styleOptions = <K extends keyof AvatarConfig>(key: K, options: readonly Option[], zoom = false) => (
    <div className="picker-grid">
      {options.map((o) => (
        <button key={o.id} className="pick" aria-pressed={value[key] === o.id} onClick={() => set(key, o.id as AvatarConfig[K])}>
          <Avatar config={{ ...value, [key]: o.id }} size={zoom ? 64 : 58} animated={false} />
          {o.label}
        </button>
      ))}
    </div>
  );

  const colorOptions = <K extends keyof AvatarConfig>(key: K, options: readonly ColorOption[]) => (
    <div className="swatches" role="radiogroup">
      {options.map((o) => (
        <button
          key={o.id}
          className="swatch"
          style={{ background: o.hex }}
          aria-pressed={value[key] === o.id}
          aria-label={o.label}
          title={o.label}
          onClick={() => set(key, o.id as AvatarConfig[K])}
        />
      ))}
    </div>
  );

  return (
    <div className="editor">
      <div className="editor__preview">
        <Avatar config={value} size={168} mood="happy" />
      </div>
      <div className="row" style={{ justifyContent: "center", marginBottom: 12 }}>
        <button className="btn btn--soft btn--sm" onClick={() => onChange(randomAvatar())}>
          🎲 Casuale
        </button>
      </div>
      <div className="editor__tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} className="editor__tab" role="tab" aria-pressed={tab === t.id} aria-selected={tab === t.id} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "viso" ? (
        <>
          <div className="editor__group">
            <h3>Carnagione</h3>
            {colorOptions("skin", SKIN_TONES)}
          </div>
          <div className="editor__group">
            <h3>Occhi</h3>
            {colorOptions("eyes", EYE_COLORS)}
          </div>
          <div className="editor__group">
            <h3>Sopracciglia</h3>
            {styleOptions("brows", BROWS, true)}
          </div>
        </>
      ) : null}
      {tab === "capelli" ? (
        <>
          <div className="editor__group">
            <h3>Colore</h3>
            {colorOptions("hairColor", HAIR_COLORS)}
          </div>
          <div className="editor__group">
            <h3>Taglio</h3>
            {styleOptions("hair", HAIR_STYLES)}
          </div>
        </>
      ) : null}
      {tab === "barba" ? <div className="editor__group">{styleOptions("facialHair", FACIAL_HAIR, true)}</div> : null}
      {tab === "occhiali" ? <div className="editor__group">{styleOptions("glasses", GLASSES, true)}</div> : null}
      {tab === "accessori" ? <div className="editor__group">{styleOptions("accessory", ACCESSORIES)}</div> : null}
      {tab === "vestiti" ? (
        <>
          <div className="editor__group">
            <h3>Colore</h3>
            {colorOptions("outfitColor", OUTFIT_COLORS)}
          </div>
          <div className="editor__group">
            <h3>Capo</h3>
            {styleOptions("outfit", OUTFITS)}
          </div>
        </>
      ) : null}
      {tab === "sfondo" ? <div className="editor__group">{colorOptions("bg", BACKGROUNDS)}</div> : null}
    </div>
  );
}
