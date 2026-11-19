import { useState } from "react";
import { SNACKS } from "../../../shared/game";
import type { PublicUser } from "../../../shared/types";
import { api, errorMessage } from "../lib/api";
import { firstName } from "../lib/format";
import { useApi, useMe, useUi } from "../lib/session";
import { Avatar } from "./Avatar";
import { Sheet } from "./Sheet";

/** "Ti ho visto che mangi merendine... occhio!" — anonymous sighting report. */
export function SnackReportSheet({ onClose, target }: { onClose: () => void; target?: PublicUser }) {
  const me = useMe();
  const { toast } = useUi();
  const users = useApi<PublicUser[]>(target ? null : "/users");
  const [who, setWho] = useState<PublicUser | null>(target ?? null);
  const [snack, setSnack] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!who || !snack) return;
    setSending(true);
    try {
      const res = await api.post<{ remaining: number }>("/snacks", { targetId: who.id, snack });
      toast(`🕵️ Segnalazione anonima inviata a ${firstName(who.name)}! (ne hai ancora ${res.remaining} oggi)`);
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  };

  const colleagues = (users.data ?? []).filter((u) => u.id !== me.id);

  return (
    <Sheet title="👀 Segnala uno sgarro" onClose={onClose}>
      <p className="muted" style={{ marginTop: -6 }}>
        Hai beccato qualcuno con le mani nel sacco? Riceverà una notifica anonima: <i>"Ti ho visto che mangi merendine... occhio!"</i>
      </p>
      {!who ? (
        <>
          <h3 className="section-title" style={{ marginTop: 8 }}>
            Chi hai beccato?
          </h3>
          {users.loading && !users.data ? <div className="spinner" /> : null}
          {colleagues.length === 0 && users.data ? <p className="muted">Non ci sono ancora colleghi iscritti.</p> : null}
          <div className="picker-grid">
            {colleagues.map((u) => (
              <button key={u.id} className="pick" onClick={() => setWho(u)}>
                <Avatar config={u.avatar} size={56} animated={false} />
                {firstName(u.name)}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="row" style={{ marginBottom: 6 }}>
            <Avatar config={who.avatar} size={44} animated={false} style={{ borderRadius: "50%" }} />
            <b style={{ flex: 1 }}>{who.name}</b>
            {!target ? (
              <button className="link-btn" onClick={() => setWho(null)}>
                Cambia
              </button>
            ) : null}
          </div>
          <h3 className="section-title" style={{ marginTop: 8 }}>
            Cosa stava mangiando?
          </h3>
          <div className="picker-grid">
            {SNACKS.map((s) => (
              <button key={s.id} className="pick" aria-pressed={snack === s.id} onClick={() => setSnack(s.id)}>
                <span className="pick__emoji">{s.emoji}</span>
                {s.name}
              </button>
            ))}
          </div>
          <button className="btn btn--snack btn--block" style={{ marginTop: 16 }} disabled={!snack || sending} onClick={() => void send()}>
            {sending ? "Invio..." : "🕵️ Invia segnalazione anonima"}
          </button>
        </>
      )}
    </Sheet>
  );
}
