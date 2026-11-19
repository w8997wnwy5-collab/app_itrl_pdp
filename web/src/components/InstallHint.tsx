import { useInstall } from "../lib/install";

/** Explains how to put the app on the home screen (needed on iPhone for notifications). */
export function InstallHint({ beforeSignup = false }: { beforeSignup?: boolean }) {
  const { mode, install } = useInstall();
  if (mode === "ios") {
    return (
      <div className="banner" role="note">
        <span className="banner__ico" aria-hidden="true">
          📲
        </span>
        <p>
          <b>{beforeSignup ? "Su iPhone, prima di iscriverti:" : "Su iPhone:"}</b> tocca <b>Condividi</b> ⬆️ in Safari → <b>Aggiungi alla schermata Home</b>, poi apri l'app dall'icona
          {beforeSignup ? " e iscriviti da lì" : ""}. Solo così arrivano le notifiche.
        </p>
      </div>
    );
  }
  if (mode === "prompt") {
    return (
      <button className="btn btn--soft btn--block" style={{ marginBottom: 14 }} onClick={() => void install()}>
        📲 Installa l'app sul telefono
      </button>
    );
  }
  return null;
}
