import { useState } from "react";
import { useNavigate } from "react-router";
import { formatLongDate } from "../../../shared/dates";
import { TEASE_LEVELS, type TeaseLevel } from "../../../shared/game";
import type { Dashboard, Me } from "../../../shared/types";
import { CharacterCreator } from "../components/CharacterCreator";
import { api, errorMessage } from "../lib/api";
import { enablePush, needsInstallForPush, type PushState } from "../lib/push";
import { useApi, useMe, useSession, useUi } from "../lib/session";

export function Onboarding() {
  const me = useMe();
  const { setMe } = useSession();
  const { toast } = useUi();
  const navigate = useNavigate();
  const dash = useApi<Dashboard>("/dashboard");
  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState("");
  const [goal, setGoal] = useState("");
  const [tease, setTease] = useState<TeaseLevel>(me.teaseLevel);
  const [push, setPush] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

  if (!dash.data) return <div className="spinner" />;
  const { season, nextWeighIn, aiEnabled } = dash.data;

  const saveChallenge = async () => {
    setBusy(true);
    try {
      const kg = Number(weight.replace(",", "."));
      if (weight && !season.adminOnlyWeighins) {
        await api.post("/weighins", { weightKg: kg, date: nextWeighIn.isToday ? nextWeighIn.date : nextWeighIn.currentWeek });
      }
      const g = Number(goal.replace(",", "."));
      setMe(await api.patch<Me>("/me", { goalKg: goal ? g : null }));
      setStep(2);
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await api.patch<Me>("/me", { teaseLevel: tease });
      setMe(await api.post<Me>("/me/onboarded"));
      navigate("/", { replace: true });
    } catch (err) {
      toast(errorMessage(err), "error");
      setBusy(false);
    }
  };

  const turnOnPush = async () => {
    try {
      const state = await enablePush();
      setPush(state);
      if (state === "on") toast("🔔 Notifiche attive! Ora nessuna merendina passerà inosservata 👀");
      if (state === "denied") toast("Hai bloccato le notifiche: puoi riattivarle dalle impostazioni del browser.", "error");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <div className="app">
      <main className="app-main" style={{ paddingBottom: 32 }}>
        <div className="steps" aria-label={`Passo ${step + 1} di 3`}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={i <= step ? "on" : undefined} />
          ))}
        </div>

        {step === 0 ? (
          <>
            <h1 style={{ fontSize: "1.7rem" }}>Ciao {me.name.split(" ")[0]}! Creiamo il tuo personaggio</h1>
            <p className="muted">Sarà il tuo alter ego in classifica: cambia espressione in base ai risultati e si guadagna medaglie.</p>
            <div className="card">
              <CharacterCreator
                initialAvatar={me.avatar}
                initialTitle={me.title}
                aiEnabled={aiEnabled}
                saveLabel="Mi piace, avanti! →"
                onSave={async (avatar, title) => {
                  try {
                    setMe(await api.patch<Me>("/me", { avatar, title }));
                    setStep(1);
                  } catch (err) {
                    toast(errorMessage(err), "error");
                  }
                }}
              />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1 style={{ fontSize: "1.7rem" }}>La tua sfida ⚖️</h1>
            <p className="muted">
              Ogni giovedì si scende in produzione a pesarsi. Vince chi a fine sfida ha perso di più ({season.rankingMode === "kg" ? "in chili" : "in percentuale"}).
            </p>
            <div className="card stack">
              {season.adminOnlyWeighins ? (
                <div className="info-box">Le pesate le registra l'organizzatore direttamente dalla bilancia in produzione.</div>
              ) : (
                <div className="field">
                  <label htmlFor="w">Peso di partenza (kg)</label>
                  <input
                    id="w"
                    className="input"
                    inputMode="decimal"
                    placeholder="es. 82,5"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                  />
                  <span className="hint">
                    Vale per la pesata di {formatLongDate(nextWeighIn.isToday ? nextWeighIn.date : nextWeighIn.currentWeek)}. Se non hai ancora fatto la pesata lascia vuoto e
                    inseriscila giovedì. 🔒 Il tuo peso lo vedi solo tu: in classifica compaiono solo i chili persi.
                  </span>
                </div>
              )}
              <div className="field">
                <label htmlFor="g">Obiettivo: quanti kg vuoi perdere? (facoltativo)</label>
                <input id="g" className="input" inputMode="decimal" placeholder="es. 5" value={goal} onChange={(e) => setGoal(e.target.value)} />
              </div>
              <button className="btn btn--block" disabled={busy} onClick={() => void saveChallenge()}>
                Avanti →
              </button>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 style={{ fontSize: "1.7rem" }}>Notifiche e sfottò 👀</h1>
            <p className="muted">Promemoria del giovedì, sorpassi in classifica e qualche frecciatina all'ora della merenda.</p>
            <div className="card stack">
              <div className="field">
                <span className="label">Quante frecciatine vuoi ricevere?</span>
                <div className="stack" style={{ gap: 8 }}>
                  {TEASE_LEVELS.map((t) => (
                    <button key={t.id} className="pick" style={{ flexDirection: "row", justifyContent: "space-between", padding: "12px 14px", textAlign: "left" }} aria-pressed={tease === t.id} onClick={() => setTease(t.id)}>
                      <span>
                        <b style={{ display: "block", color: "var(--ink)" }}>{t.label}</b>
                        {t.description}
                      </span>
                      {tease === t.id ? "✓" : ""}
                    </button>
                  ))}
                </div>
              </div>
              {needsInstallForPush() ? (
                <div className="info-box">
                  📱 Su iPhone le notifiche arrivano solo se aggiungi l'app alla Home: tocca <b>Condividi</b> ⬆️ e poi <b>Aggiungi alla schermata Home</b>. Poi
                  riaprila dall'icona e attiva le notifiche dal Profilo.
                </div>
              ) : push === "on" ? (
                <div className="info-box">✅ Notifiche attive su questo dispositivo.</div>
              ) : (
                <button className="btn btn--soft btn--block" onClick={() => void turnOnPush()}>
                  🔔 Attiva le notifiche
                </button>
              )}
              <button className="btn btn--block" disabled={busy} onClick={() => void finish()}>
                Inizia la sfida! 🚀
              </button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}
