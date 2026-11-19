import { useEffect, useMemo, useState, type FormEvent } from "react";
import { randomAvatar } from "../../../shared/avatar";
import type { Me } from "../../../shared/types";
import { Avatar } from "../components/Avatar";
import { InstallHint } from "../components/InstallHint";
import { api, errorMessage } from "../lib/api";
import { useSession } from "../lib/session";
import type { Mood } from "../../../shared/game";

interface Status {
  hasUsers: boolean;
  inviteRequired: boolean;
  aiEnabled: boolean;
}

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

const CROWD_MOODS: Mood[] = ["happy", "ecstatic", "neutral", "guilty", "happy"];

export function AuthPage() {
  const { setMe } = useSession();
  const [status, setStatus] = useState<Status | null>(null);
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [invite, setInvite] = useState(() => new URLSearchParams(location.search).get("invito") ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const crowd = useMemo(() => {
    const rnd = seeded(42);
    return CROWD_MOODS.map((mood, i) => ({ config: randomAvatar(rnd), mood, i }));
  }, []);

  useEffect(() => {
    api
      .get<Status>("/auth/status")
      .then((s) => {
        setStatus(s);
        if (!s.hasUsers || new URLSearchParams(location.search).has("invito")) setMode("register");
      })
      .catch(() => setStatus({ hasUsers: true, inviteRequired: true, aiEnabled: false }));
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const me =
        mode === "login"
          ? await api.post<Me>("/auth/login", { email, password })
          : await api.post<Me>("/auth/register", { name, email, password, inviteCode: invite || undefined });
      setMe(me);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const firstSetup = status && !status.hasUsers;

  return (
    <div className="auth">
      <div className="auth__logo">
        <div className="auth__crowd" aria-hidden="true">
          {crowd.map((c) => (
            <Avatar key={c.i} config={c.config} mood={c.mood} size={c.i === 2 ? 84 : 64} leader={c.i === 2} level={c.i === 2 ? 5 : 0} />
          ))}
        </div>
        <h1>Chi Perde Vince</h1>
        <p>La sfida del giovedì ⚖️ chi perde più chili vince!</p>
      </div>

      <InstallHint beforeSignup />

      <div className="card">
        {firstSetup ? (
          <div className="info-box" style={{ marginBottom: 14 }}>
            👑 Sei il primo! Crea il tuo account: sarai l'organizzatore della sfida e potrai invitare i colleghi.
          </div>
        ) : (
          <div className="segmented" style={{ width: "100%", marginBottom: 16 }}>
            <button type="button" aria-pressed={mode === "login"} onClick={() => setMode("login")}>
              Accedi
            </button>
            <button type="button" aria-pressed={mode === "register"} onClick={() => setMode("register")}>
              Registrati
            </button>
          </div>
        )}

        <form className="stack" onSubmit={(e) => void submit(e)}>
          {mode === "register" ? (
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Marco Rossi" required minLength={2} maxLength={40} />
            </div>
          ) : null}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input id="email" className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              className="input"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 6 : undefined}
            />
            {mode === "register" ? <span className="hint">Almeno 6 caratteri</span> : null}
          </div>
          {mode === "register" && status?.inviteRequired ? (
            <div className="field">
              <label htmlFor="invite">Codice invito</label>
              <input
                id="invite"
                className="input"
                value={invite}
                onChange={(e) => setInvite(e.target.value.toUpperCase())}
                placeholder="Te lo dà l'organizzatore"
                autoCapitalize="characters"
                required
              />
            </div>
          ) : null}
          {error ? <div className="error-box">{error}</div> : null}
          <button className="btn btn--block" disabled={busy}>
            {busy ? "Un attimo..." : mode === "login" ? "Entra in gara" : firstSetup ? "Crea la sfida" : "Iscriviti alla sfida"}
          </button>
          {mode === "login" ? <p className="hint" style={{ textAlign: "center", margin: 0 }}>Password dimenticata? Chiedi all'organizzatore di reimpostarla.</p> : null}
        </form>
      </div>
    </div>
  );
}
