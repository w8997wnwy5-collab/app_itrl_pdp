import { useState } from "react";
import { DEFAULT_AVATAR, sanitizeAvatar, type AvatarConfig } from "../../../shared/avatar";
import type { AvatarAnalysis } from "../../../shared/types";
import { api, errorMessage } from "../lib/api";
import { useUi } from "../lib/session";
import { AvatarEditor } from "./AvatarEditor";
import { PhotoCapture, type CapturedPhoto } from "./PhotoCapture";

interface Props {
  initialAvatar: AvatarConfig;
  initialTitle: string | null;
  aiEnabled: boolean;
  saveLabel: string;
  startWithPhoto?: boolean;
  onSave: (avatar: AvatarConfig, title: string | null) => Promise<void> | void;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Photo → analysis → editor. Used in onboarding and in the profile. */
export function CharacterCreator({ initialAvatar, initialTitle, aiEnabled, saveLabel, startWithPhoto = true, onSave }: Props) {
  const { toast } = useUi();
  const [step, setStep] = useState<"photo" | "analyzing" | "edit">(startWithPhoto ? "photo" : "edit");
  const [photo, setPhoto] = useState<string | null>(null);
  const [avatar, setAvatar] = useState<AvatarConfig>(initialAvatar);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [description, setDescription] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const analyze = async (captured: CapturedPhoto) => {
    setPhoto(captured.dataUrl);
    setStep("analyzing");
    // Without AI we only know the colors: start from neutral features, the user picks the rest.
    const fallback = sanitizeAvatar({ ...DEFAULT_AVATAR, bg: avatar.bg, ...captured.guess });
    if (aiEnabled) {
      try {
        const res = await api.post<AvatarAnalysis>("/avatar/analyze", { image: captured.dataUrl });
        setAvatar(res.avatar);
        if (res.title) setTitle(res.title);
        setDescription(res.description);
        setStep("edit");
        return;
      } catch (err) {
        toast(`${errorMessage(err)} Ho fatto una stima dai colori della foto.`, "error");
      }
    } else {
      await wait(1400);
    }
    setAvatar(fallback);
    setStep("edit");
  };

  const save = async () => {
    setSaving(true);
    try {
      await onSave(avatar, title.trim() || null);
    } finally {
      setSaving(false);
    }
  };

  if (step === "photo") {
    return (
      <div className="stack">
        <div className="info-box">
          {aiEnabled
            ? "📸 Scatta un selfie: l'intelligenza artificiale lo trasforma nel tuo personaggio. La foto non viene salvata."
            : "📸 Scatta un selfie: ne ricaviamo i colori del tuo personaggio, poi lo rifinisci tu. La foto resta sul telefono."}
        </div>
        <PhotoCapture onPhoto={(p) => void analyze(p)} />
        <button className="link-btn" onClick={() => setStep("edit")}>
          Salta: lo creo a mano ✏️
        </button>
      </div>
    );
  }

  if (step === "analyzing") {
    return (
      <div className="stack">
        <div className="camera">
          {photo ? <img src={photo} alt="La tua foto" /> : null}
          <div className="scan">
            <div>
              <div style={{ fontSize: "2.2rem" }}>🪄</div>
              Sto disegnando il tuo personaggio...
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stack">
      {photo ? (
        <div className="row" style={{ justifyContent: "center", gap: 14 }}>
          <img src={photo} alt="La tua foto" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: "50%" }} />
          <span style={{ fontSize: "1.4rem" }}>➜</span>
          <span className="chip chip--primary">Ecco il tuo personaggio!</span>
        </div>
      ) : null}
      {description ? <p className="muted" style={{ textAlign: "center", margin: 0 }}>{description}</p> : null}
      <AvatarEditor value={avatar} onChange={setAvatar} />
      <div className="field">
        <label htmlFor="title">Soprannome da gara (facoltativo)</label>
        <input
          id="title"
          className="input"
          value={title}
          maxLength={40}
          placeholder="es. Il Fulmine del Reparto"
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <button className="btn btn--block" onClick={() => void save()} disabled={saving}>
        {saving ? "Salvo..." : saveLabel}
      </button>
      {startWithPhoto ? (
        <button className="link-btn" onClick={() => setStep("photo")}>
          📸 Rifai la foto
        </button>
      ) : null}
    </div>
  );
}
