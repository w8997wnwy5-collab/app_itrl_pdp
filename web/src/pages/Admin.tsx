import { useEffect, useMemo, useState } from "react";
import { addDays, formatLongDate, today, weighInDayOnOrBefore } from "../../../shared/dates";
import { formatKg } from "../../../shared/game";
import type { AdminSettings, AdminUser, AdminWeighInRow, Recap } from "../../../shared/types";
import { Avatar } from "../components/Avatar";
import { TopBar } from "../components/Layout";
import { Sheet } from "../components/Sheet";
import { api, errorMessage } from "../lib/api";
import { useApi, useMe, useUi } from "../lib/session";

type Tab = "pesate" | "iscritti" | "sfida" | "comunica";

export function Admin() {
  const me = useMe();
  const [tab, setTab] = useState<Tab>("pesate");
  const settings = useApi<AdminSettings>("/admin/settings");

  if (!me.isAdmin) return <div className="error-box">Questa sezione è riservata all'organizzatore.</div>;

  return (
    <>
      <TopBar title="Organizzatore 🛠️" subtitle="Gestisci la sfida e le pesate" back="/profilo" />
      <div className="editor__tabs" role="tablist" style={{ marginBottom: 6 }}>
        {(
          [
            ["pesate", "⚖️ Pesate"],
            ["iscritti", "👥 Iscritti"],
            ["sfida", "🗓️ Sfida"],
            ["comunica", "📣 Comunica"],
          ] as const
        ).map(([id, label]) => (
          <button key={id} className="editor__tab" role="tab" aria-selected={tab === id} aria-pressed={tab === id} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      {!settings.data ? (
        <div className="spinner" />
      ) : tab === "pesate" ? (
        <WeighInsTab settings={settings.data} />
      ) : tab === "iscritti" ? (
        <UsersTab settings={settings.data} />
      ) : tab === "sfida" ? (
        <SettingsTab settings={settings.data} onSaved={(s) => settings.setData(s)} />
      ) : (
        <CommunicateTab />
      )}
    </>
  );
}

function WeighInsTab({ settings }: { settings: AdminSettings }) {
  const { toast } = useUi();
  const weeks = useMemo(() => {
    const out: string[] = [];
    let d = weighInDayOnOrBefore(today() > settings.seasonEnd ? settings.seasonEnd : today());
    while (d >= settings.seasonStart && out.length < 60) {
      out.push(d);
      d = addDays(d, -7);
    }
    return out;
  }, [settings]);
  const [week, setWeek] = useState(weeks[0] ?? weighInDayOnOrBefore(today()));
  const data = useApi<{ date: string; rows: AdminWeighInRow[] }>(`/admin/weighins?date=${week}`);
  const [values, setValues] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!data.data) return;
    const v: Record<number, string> = {};
    for (const r of data.data.rows) v[r.userId] = r.weightKg !== null ? r.weightKg.toFixed(1).replace(".", ",") : "";
    setValues(v);
  }, [data.data]);

  const changed = (data.data?.rows ?? []).filter((r) => {
    const raw = (values[r.userId] ?? "").trim();
    const original = r.weightKg !== null ? r.weightKg.toFixed(1).replace(".", ",") : "";
    return raw !== original;
  });

  const save = async () => {
    setSaving(true);
    try {
      const entries = changed.map((r) => {
        const raw = (values[r.userId] ?? "").trim();
        return { userId: r.userId, weightKg: raw ? Number(raw.replace(",", ".")) : null };
      });
      const res = await api.post<{ saved: number }>("/admin/weighins", { date: week, entries });
      toast(`✅ ${res.saved} pesate salvate: classifica aggiornata e notifiche inviate`);
      data.reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card">
      <div className="field" style={{ marginBottom: 10 }}>
        <label htmlFor="aw">Pesata di</label>
        <select id="aw" className="select" value={week} onChange={(e) => setWeek(e.target.value)}>
          {weeks.map((w) => (
            <option key={w} value={w}>
              {formatLongDate(w)}
            </option>
          ))}
        </select>
        <span className="hint">Inserisci i pesi letti sulla bilancia (anche settimane passate). Lascia vuoto chi era assente.</span>
      </div>
      {!data.data ? (
        <div className="spinner" />
      ) : (
        <>
          {data.data.rows.map((r) => {
            const raw = values[r.userId] ?? "";
            const n = Number(raw.replace(",", "."));
            const delta = raw && r.previousKg !== null && Number.isFinite(n) ? Math.round((n - r.previousKg) * 10) / 10 : null;
            return (
              <div key={r.userId} className="admin-row">
                <Avatar config={r.avatar} size={38} animated={false} />
                <div className="admin-row__name">
                  {r.name}
                  <small>
                    {r.previousKg !== null ? `prima: ${formatKg(r.previousKg)}` : "prima pesata"}
                    {delta !== null ? ` · ${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toLocaleString("it-IT")} kg` : ""}
                  </small>
                </div>
                <input
                  className="input"
                  inputMode="decimal"
                  aria-label={`Peso di ${r.name}`}
                  placeholder="kg"
                  value={raw}
                  onChange={(e) => setValues((v) => ({ ...v, [r.userId]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 6) }))}
                />
              </div>
            );
          })}
          <button className="btn btn--block" style={{ marginTop: 12 }} disabled={changed.length === 0 || saving} onClick={() => void save()}>
            {saving ? "Salvo..." : changed.length ? `Salva ${changed.length} ${changed.length === 1 ? "pesata" : "pesate"}` : "Nessuna modifica"}
          </button>
        </>
      )}
    </section>
  );
}

function UsersTab({ settings }: { settings: AdminSettings }) {
  const me = useMe();
  const { toast } = useUi();
  const users = useApi<AdminUser[]>("/admin/users");
  const [temp, setTemp] = useState<{ name: string; password: string } | null>(null);
  const [confirm, setConfirm] = useState<AdminUser | null>(null);
  const inviteLink = `${location.origin}/?invito=${encodeURIComponent(settings.inviteCode)}`;

  const share = async () => {
    const text = `Unisciti alla sfida "${settings.challengeName}" su Chi Perde Vince! ⚖️ Codice invito: ${settings.inviteCode}`;
    try {
      if (navigator.share) await navigator.share({ title: "Chi Perde Vince", text, url: inviteLink });
      else {
        await navigator.clipboard.writeText(`${text}\n${inviteLink}`);
        toast("Link copiato negli appunti 📋");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      toast(ok);
      users.reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  return (
    <>
      <section className="card">
        <div className="card__head">
          <h2>✉️ Invita i colleghi</h2>
        </div>
        <p style={{ margin: "0 0 10px" }}>
          Codice invito: <b style={{ fontFamily: "var(--font-display)", fontSize: "1.3rem", letterSpacing: "0.08em" }}>{settings.inviteCode}</b>
        </p>
        <button className="btn btn--block" onClick={() => void share()}>
          📤 Condividi il link d'invito
        </button>
      </section>
      <section className="card">
        <div className="card__head">
          <h2>👥 Iscritti</h2>
          <span className="muted">{users.data?.length ?? ""}</span>
        </div>
        {!users.data ? (
          <div className="spinner" />
        ) : (
          users.data.map((u) => (
            <div key={u.id} className="admin-row" style={{ flexWrap: "wrap" }}>
              <div className="admin-row__name">
                {u.name} {u.isAdmin ? <span className="chip chip--primary">admin</span> : null}
                <small>
                  {u.email} · {u.weighinCount} pesate · {u.pushDevices > 0 ? `🔔 ${u.pushDevices}` : "🔕"}
                  {!u.onboarded ? " · registrazione incompleta" : ""}
                </small>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {u.id !== me.id ? (
                  <button
                    className="btn btn--ghost btn--sm"
                    onClick={() => void act(() => api.patch(`/admin/users/${u.id}`, { isAdmin: !u.isAdmin }), u.isAdmin ? "Permessi admin rimossi" : "Ora è admin")}
                  >
                    {u.isAdmin ? "Togli admin" : "Rendi admin"}
                  </button>
                ) : null}
                <button
                  className="btn btn--ghost btn--sm"
                  aria-label={`Reimposta password di ${u.name}`}
                  onClick={() =>
                    void api
                      .post<{ temporaryPassword: string }>(`/admin/users/${u.id}/reset-password`)
                      .then((r) => setTemp({ name: u.name, password: r.temporaryPassword }))
                      .catch((err) => toast(errorMessage(err), "error"))
                  }
                >
                  🔑
                </button>
                {u.id !== me.id ? (
                  <button className="btn btn--ghost btn--sm" aria-label={`Elimina ${u.name}`} onClick={() => setConfirm(u)}>
                    🗑️
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </section>
      {temp ? (
        <Sheet title="🔑 Password temporanea" onClose={() => setTemp(null)}>
          <p style={{ marginTop: 0 }}>
            Comunica a <b>{temp.name}</b> questa password temporanea, poi potrà cambiarla dal Profilo:
          </p>
          <p style={{ fontFamily: "var(--font-display)", fontSize: "1.6rem", textAlign: "center", letterSpacing: "0.05em", userSelect: "all" }}>{temp.password}</p>
        </Sheet>
      ) : null}
      {confirm ? (
        <Sheet title={`Eliminare ${confirm.name}?`} onClose={() => setConfirm(null)}>
          <p style={{ marginTop: 0 }}>Vengono cancellati anche tutte le sue pesate, badge e notifiche. Non si può annullare.</p>
          <div className="grid-2">
            <button className="btn btn--ghost" onClick={() => setConfirm(null)}>
              Annulla
            </button>
            <button
              className="btn btn--danger"
              onClick={() => {
                const target = confirm;
                setConfirm(null);
                void act(() => api.del(`/admin/users/${target.id}`), `${target.name} eliminato dalla sfida`);
              }}
            >
              Elimina
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

function SettingsTab({ settings, onSaved }: { settings: AdminSettings; onSaved: (s: AdminSettings) => void }) {
  const { toast } = useUi();
  const [form, setForm] = useState(settings);
  const set = <K extends keyof AdminSettings>(k: K, v: AdminSettings[K]) => setForm((f) => ({ ...f, [k]: v }));
  return (
    <form
      className="card stack"
      onSubmit={(e) => {
        e.preventDefault();
        api
          .put<AdminSettings>("/admin/settings", form)
          .then((s) => {
            onSaved(s);
            setForm(s);
            toast("Impostazioni salvate ✓");
          })
          .catch((err) => toast(errorMessage(err), "error"));
      }}
    >
      <div className="field">
        <label htmlFor="cn">Nome della sfida</label>
        <input id="cn" className="input" value={form.challengeName} maxLength={60} onChange={(e) => set("challengeName", e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="ss">Inizio</label>
          <input id="ss" className="input" type="date" value={form.seasonStart} onChange={(e) => set("seasonStart", e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="se">Fine</label>
          <input id="se" className="input" type="date" value={form.seasonEnd} onChange={(e) => set("seasonEnd", e.target.value)} />
        </div>
      </div>
      <div className="field">
        <span className="label">Vince chi perde di più in...</span>
        <div className="segmented" style={{ width: "100%" }}>
          <button type="button" aria-pressed={form.rankingMode === "kg"} onClick={() => set("rankingMode", "kg")}>
            Chili
          </button>
          <button type="button" aria-pressed={form.rankingMode === "pct"} onClick={() => set("rankingMode", "pct")}>
            Percentuale
          </button>
        </div>
        <span className="hint">La percentuale è più equa tra persone con pesi di partenza diversi.</span>
      </div>
      <div className="field">
        <label htmlFor="ic">Codice invito</label>
        <input id="ic" className="input" value={form.inviteCode} maxLength={24} onChange={(e) => set("inviteCode", e.target.value.toUpperCase())} />
      </div>
      <div className="setting" style={{ padding: 0 }}>
        <div className="setting__text">
          <b>Solo l'organizzatore registra le pesate</b>
          <span>Utile se le pesate vengono lette e inserite da una persona sola in produzione.</span>
        </div>
        <label className="switch">
          <input type="checkbox" checked={form.adminOnlyWeighins} onChange={(e) => set("adminOnlyWeighins", e.target.checked)} aria-label="Solo l'organizzatore registra le pesate" />
          <span />
        </label>
      </div>
      <button className="btn btn--block">Salva impostazioni</button>
    </form>
  );
}

function CommunicateTab() {
  const { toast } = useUi();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [recap, setRecap] = useState<Recap | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <form
        className="card stack"
        onSubmit={(e) => {
          e.preventDefault();
          api
            .post("/admin/announce", { title, body })
            .then(() => {
              toast("📣 Annuncio inviato a tutti");
              setTitle("");
              setBody("");
            })
            .catch((err) => toast(errorMessage(err), "error"));
        }}
      >
        <div className="card__head" style={{ marginBottom: 0 }}>
          <h2>📣 Annuncio a tutti</h2>
        </div>
        <div className="field">
          <label htmlFor="at">Titolo</label>
          <input id="at" className="input" value={title} maxLength={60} required minLength={2} placeholder="es. Pesata spostata a venerdì" onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="ab">Messaggio</label>
          <textarea id="ab" className="textarea" value={body} maxLength={300} required minLength={2} onChange={(e) => setBody(e.target.value)} />
        </div>
        <button className="btn btn--block">Invia a tutti</button>
      </form>
      <section className="card stack">
        <div className="card__head" style={{ marginBottom: 0 }}>
          <h2>📰 Gazzetta della Bilancia</h2>
        </div>
        <p className="muted" style={{ margin: 0 }}>
          Esce in automatico il giovedì alle 18:00. Puoi pubblicarla subito (o rigenerarla) dopo aver inserito le pesate.
        </p>
        <button
          className="btn btn--soft btn--block"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            api
              .post<Recap>("/admin/recap", {})
              .then((r) => {
                setRecap(r);
                toast("📰 Gazzetta pubblicata!");
              })
              .catch((err) => toast(errorMessage(err), "error"))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Scrivo..." : "Pubblica la Gazzetta di questa settimana"}
        </button>
        {recap ? <p className="recap__text">{recap.text}</p> : null}
      </section>
    </>
  );
}
