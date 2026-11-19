import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { TEASE_LEVELS, type TeaseLevel } from "../../../shared/game";
import type { Dashboard, Me } from "../../../shared/types";
import { Avatar } from "../components/Avatar";
import { CharacterCreator } from "../components/CharacterCreator";
import { InstallHint } from "../components/InstallHint";
import { TopBar } from "../components/Layout";
import { Sheet } from "../components/Sheet";
import { api, errorMessage } from "../lib/api";
import { disablePush, enablePush, pushState, type PushState } from "../lib/push";
import { useApi, useMe, useSession, useUi } from "../lib/session";

type Theme = "system" | "light" | "dark";

export function applyTheme(theme: Theme) {
  if (theme === "system") document.documentElement.removeAttribute("data-theme");
  else document.documentElement.setAttribute("data-theme", theme);
}

export function storedTheme(): Theme {
  try {
    const t = localStorage.getItem("cpv-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}

export function Settings() {
  const me = useMe();
  const { setMe, logout } = useSession();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [push, setPush] = useState<PushState | null>(null);
  const [pushBusy, setPushBusy] = useState(false);
  const [name, setName] = useState(me.name);
  const [theme, setTheme] = useState<Theme>(storedTheme);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    void pushState().then(setPush);
  }, []);

  const save = async (patch: Partial<Pick<Me, "name" | "teaseLevel">>, message = "Salvato ✓") => {
    try {
      setMe(await api.patch<Me>("/me", patch));
      toast(message);
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const togglePush = async () => {
    setPushBusy(true);
    try {
      if (push === "on") {
        await disablePush();
        setPush("off");
        toast("Notifiche disattivate su questo dispositivo");
      } else {
        const state = await enablePush();
        setPush(state);
        if (state === "on") toast("🔔 Notifiche attive!");
        if (state === "denied") toast("Le notifiche sono bloccate: sbloccale dalle impostazioni del browser/telefono.", "error");
      }
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setPushBusy(false);
    }
  };

  const testPush = async () => {
    try {
      await api.post("/push/test");
      toast("Notifica di prova inviata 👀");
      window.dispatchEvent(new Event("cpv:notifications"));
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const changeTheme = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    try {
      localStorage.setItem("cpv-theme", t);
    } catch {
      /* private mode: theme just isn't remembered */
    }
  };

  return (
    <>
      <TopBar title="Profilo" subtitle={me.email} />

      <section className="card">
        <div className="row">
          <Avatar config={me.avatar} size={72} mood="happy" style={{ borderRadius: "50%" }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 style={{ fontSize: "1.2rem" }}>{me.title || me.name}</h2>
            <span className="muted">{me.title ? me.name : "Nessun soprannome"}</span>
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: 14 }}>
          <Link to="/avatar" className="btn btn--soft btn--sm">
            🎨 Personaggio
          </Link>
          <Link to={`/utente/${me.id}`} className="btn btn--ghost btn--sm">
            👁️ Profilo pubblico
          </Link>
        </div>
      </section>

      <h2 className="section-title">Notifiche</h2>
      <InstallHint />
      <section className="card">
        <div className="setting">
          <div className="setting__text">
            <b>Notifiche su questo dispositivo</b>
            <span>
              {push === "unsupported"
                ? "Questo browser non supporta le notifiche push."
                : push === "needs-install"
                  ? "Su iPhone: Condividi ⬆️ → Aggiungi alla schermata Home, poi apri l'app dall'icona."
                  : push === "denied"
                    ? "Bloccate: sbloccale dalle impostazioni del browser."
                    : "Promemoria, sorpassi e sfottò."}
            </span>
          </div>
          {push === "on" || push === "off" ? (
            <label className="switch">
              <input type="checkbox" checked={push === "on"} disabled={pushBusy} onChange={() => void togglePush()} aria-label="Notifiche push" />
              <span />
            </label>
          ) : null}
        </div>
        <div className="setting">
          <div className="setting__text">
            <b>Prova</b>
            <span>Ricevi una notifica di prova</span>
          </div>
          <button className="btn btn--ghost btn--sm" onClick={() => void testPush()}>
            Invia 👀
          </button>
        </div>
        <div className="field" style={{ paddingTop: 12, borderTop: "1px solid var(--line)" }}>
          <label htmlFor="tease">Livello di sfottò</label>
          <select
            id="tease"
            className="select"
            value={me.teaseLevel}
            onChange={(e) => void save({ teaseLevel: e.target.value as TeaseLevel }, "Livello di sfottò aggiornato")}
          >
            {TEASE_LEVELS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="hint">{TEASE_LEVELS.find((t) => t.id === me.teaseLevel)?.description}</span>
        </div>
      </section>

      <h2 className="section-title">Account</h2>
      <section className="card stack">
        <form
          className="field"
          onSubmit={(e) => {
            e.preventDefault();
            void save({ name: name.trim() }, "Nome aggiornato");
          }}
        >
          <label htmlFor="name">Nome visibile in classifica</label>
          <div className="row">
            <input id="name" className="input" value={name} minLength={2} maxLength={40} onChange={(e) => setName(e.target.value)} />
            <button className="btn btn--sm" disabled={name.trim() === me.name || name.trim().length < 2}>
              Salva
            </button>
          </div>
        </form>
        <div className="field">
          <span className="label">Tema</span>
          <div className="segmented" style={{ width: "100%" }}>
            {(
              [
                ["system", "Automatico"],
                ["light", "Chiaro"],
                ["dark", "Scuro"],
              ] as const
            ).map(([id, label]) => (
              <button key={id} aria-pressed={theme === id} onClick={() => changeTheme(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <button className="btn btn--ghost btn--block" onClick={() => setPwOpen(true)}>
          🔑 Cambia password
        </button>
        {me.isAdmin ? (
          <Link to="/admin" className="btn btn--soft btn--block">
            🛠️ Pannello organizzatore
          </Link>
        ) : null}
        <button
          className="btn btn--ghost btn--block"
          onClick={() => {
            void logout().then(() => navigate("/", { replace: true }));
          }}
        >
          Esci
        </button>
      </section>

      <h2 className="section-title">Come funziona</h2>
      <section className="card card--flat">
        <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 6 }}>
          <li>Ogni <b>giovedì</b> si scende in produzione a pesarsi e si registra il peso nell'app.</li>
          <li>Vince chi a fine sfida ha perso di più. In classifica si vedono solo i chili persi: <b>il peso resta privato</b>.</li>
          <li>Il tuo personaggio cambia umore con i risultati e sblocca accessori salendo di livello.</li>
          <li>Hai beccato qualcuno con una merendina? Segnalalo con 👀: riceverà una notifica anonima.</li>
          <li>Ogni giovedì sera esce la Gazzetta della Bilancia con il commento della settimana.</li>
        </ul>
      </section>

      {pwOpen ? <PasswordSheet onClose={() => setPwOpen(false)} /> : null}
    </>
  );
}

function PasswordSheet({ onClose }: { onClose: () => void }) {
  const { toast } = useUi();
  const { setMe } = useSession();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet title="🔑 Cambia password" onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          api
            .post("/me/password", { current, next })
            .then(() => {
              toast("Password cambiata: accedi di nuovo con la nuova password");
              setMe(null);
            })
            .catch((err) => setError(errorMessage(err)));
        }}
      >
        <div className="field">
          <label htmlFor="cur">Password attuale</label>
          <input id="cur" className="input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
        </div>
        <div className="field">
          <label htmlFor="new">Nuova password</label>
          <input id="new" className="input" type="password" autoComplete="new-password" minLength={6} value={next} onChange={(e) => setNext(e.target.value)} required />
        </div>
        {error ? <div className="error-box">{error}</div> : null}
        <button className="btn btn--block">Cambia password</button>
      </form>
    </Sheet>
  );
}

export function AvatarPage() {
  const me = useMe();
  const { setMe } = useSession();
  const { toast } = useUi();
  const navigate = useNavigate();
  const dash = useApi<Dashboard>("/dashboard");
  const [withPhoto, setWithPhoto] = useState<boolean | null>(null);
  if (!dash.data) return <div className="spinner" />;
  return (
    <>
      <TopBar title="Il tuo personaggio" back="/profilo" />
      <section className="card">
        {withPhoto === null ? (
          <div className="stack">
            <div className="editor__preview">
              <Avatar config={me.avatar} size={150} mood="happy" />
            </div>
            <button className="btn btn--block" onClick={() => setWithPhoto(true)}>
              📸 Rifallo da una foto
            </button>
            <button className="btn btn--ghost btn--block" onClick={() => setWithPhoto(false)}>
              ✏️ Modifica a mano
            </button>
          </div>
        ) : (
          <CharacterCreator
            initialAvatar={me.avatar}
            initialTitle={me.title}
            aiEnabled={dash.data.aiEnabled}
            startWithPhoto={withPhoto}
            saveLabel="Salva personaggio"
            onSave={async (avatar, title) => {
              try {
                setMe(await api.patch<Me>("/me", { avatar, title }));
                toast("Personaggio aggiornato! 🎨");
                navigate("/profilo");
              } catch (err) {
                toast(errorMessage(err), "error");
              }
            }}
          />
        )}
      </section>
    </>
  );
}
