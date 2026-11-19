import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { addDays, formatLongDate, formatShortDate, today, weighInDayOnOrBefore } from "../../../shared/dates";
import { badgeById, formatKg, MAX_WEIGHT_KG, MIN_WEIGHT_KG } from "../../../shared/game";
import type { Dashboard, WeighInResult } from "../../../shared/types";
import { DeltaChip } from "../components/DeltaChip";
import { TopBar } from "../components/Layout";
import { Sheet } from "../components/Sheet";
import { api, errorMessage } from "../lib/api";
import { useApi, useMe, useUi } from "../lib/session";

function parseKg(text: string): number | null {
  const n = Number(text.replace(",", ".").trim());
  return Number.isFinite(n) && text.trim() !== "" ? Math.round(n * 10) / 10 : null;
}

const fmtInput = (n: number) => n.toFixed(1).replace(".", ",");

export function WeighIn() {
  const me = useMe();
  const { toast, celebrate } = useUi();
  const dash = useApi<Dashboard>("/dashboard");
  const [value, setValue] = useState<string>("");
  const [week, setWeek] = useState<string>(() => weighInDayOnOrBefore(today()));
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<WeighInResult | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; date: string } | null>(null);

  const history = useMemo(() => dash.data?.stats.history ?? [], [dash.data]);
  const season = dash.data?.season;
  const initialized = useRef(false);

  // Start from this week's weight if already recorded, otherwise from the last one.
  useEffect(() => {
    if (!dash.data || initialized.current) return;
    initialized.current = true;
    const existing = history.find((h) => h.date === week);
    const last = history[history.length - 1];
    setValue(fmtInput(existing?.weightKg ?? last?.weightKg ?? 75));
  }, [dash.data, history, week]);

  const weeks = useMemo(() => {
    if (!season) return [];
    const out: string[] = [];
    let d = weighInDayOnOrBefore(today() > season.seasonEnd ? season.seasonEnd : today());
    while (d >= season.seasonStart && out.length < 60) {
      out.push(d);
      d = addDays(d, -7);
    }
    return out;
  }, [season]);

  if (dash.error && !dash.data) return <div className="error-box">{dash.error}</div>;
  if (!dash.data || !season) return <div className="spinner" />;

  const locked = season.adminOnlyWeighins && !me.isAdmin;
  const kg = parseKg(value);
  const valid = kg !== null && kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG;
  const existing = history.find((h) => h.date === week);
  const step = (d: number) => {
    const base = kg ?? 75;
    setValue(fmtInput(Math.min(MAX_WEIGHT_KG, Math.max(MIN_WEIGHT_KG, Math.round((base + d) * 10) / 10))));
  };

  const save = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const res = await api.post<WeighInResult>("/weighins", { weightKg: kg, date: week });
      setResult(res);
      if (res.delta !== null && res.delta < 0) celebrate();
      dash.reload();
      window.dispatchEvent(new Event("cpv:notifications"));
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      await api.del(`/weighins/${id}`);
      toast("Pesata eliminata");
      setConfirmDelete(null);
      dash.reload();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  };

  const rows = [...history].reverse();

  return (
    <>
      <TopBar title="Pesata ⚖️" subtitle="Si scende in produzione, si sale sulla bilancia" />

      {locked ? (
        <div className="info-box" style={{ marginBottom: 14 }}>
          🔐 In questa sfida le pesate le registra l'organizzatore direttamente in produzione. Qui sotto trovi lo storico.
        </div>
      ) : (
        <section className="card">
          <div className="field" style={{ marginBottom: 14 }}>
            <label htmlFor="week">Pesata di</label>
            <select
              id="week"
              className="select"
              value={week}
              onChange={(e) => {
                setWeek(e.target.value);
                const ex = history.find((h) => h.date === e.target.value);
                if (ex) setValue(fmtInput(ex.weightKg));
              }}
            >
              {weeks.map((w, i) => (
                <option key={w} value={w}>
                  {formatLongDate(w)}
                  {i === 0 ? (w === today() ? " (oggi)" : " (questa settimana)") : ""}
                  {history.some((h) => h.date === w) ? " ✓" : ""}
                </option>
              ))}
            </select>
          </div>

          <div className="scale-plate">
            <div className="scale-screen">
              <div className="scale-display">
                <label htmlFor="kg" className="sr-only">
                  Peso in kg
                </label>
                <input
                  id="kg"
                  inputMode="decimal"
                  value={value}
                  onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, "").slice(0, 6))}
                  onFocus={(e) => e.target.select()}
                  aria-invalid={!valid}
                />
                <span className="unit">kg</span>
              </div>
            </div>
            <div className="row" style={{ justifyContent: "center", marginTop: 14, gap: 12 }}>
              <button className="stepper" onClick={() => step(-1)} aria-label="Meno 1 kg">
                −1
              </button>
              <button className="stepper" onClick={() => step(-0.1)} aria-label="Meno 100 grammi">
                −
              </button>
              <button className="stepper" onClick={() => step(0.1)} aria-label="Più 100 grammi">
                +
              </button>
              <button className="stepper" onClick={() => step(1)} aria-label="Più 1 kg">
                +1
              </button>
            </div>
          </div>

          {!valid && value ? (
            <p className="error-box" style={{ marginTop: 12 }}>
              Inserisci un peso tra {MIN_WEIGHT_KG} e {MAX_WEIGHT_KG} kg
            </p>
          ) : null}
          {existing ? (
            <p className="hint" style={{ textAlign: "center" }}>
              Hai già registrato {formatKg(existing.weightKg)} per questa settimana: salvando la sostituisci.
            </p>
          ) : null}
          <button className="btn btn--block" style={{ marginTop: 14 }} disabled={!valid || saving} onClick={() => void save()}>
            {saving ? "Salvo..." : existing ? "Aggiorna pesata" : "Salva pesata"}
          </button>
          <p className="hint" style={{ textAlign: "center", marginBottom: 0 }}>
            🔒 Il peso lo vedi solo tu. Gli altri vedono solo quanto hai perso.
          </p>
        </section>
      )}

      <section className="card">
        <div className="card__head">
          <h2>📋 Le tue pesate</h2>
          <span className="muted">{history.length}</span>
        </div>
        {rows.length === 0 ? (
          <div className="empty">
            <span className="em">🐣</span>
            Nessuna pesata ancora.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <caption className="sr-only">Storico delle pesate</caption>
            <thead className="sr-only">
              <tr>
                <th>Data</th>
                <th>Peso</th>
                <th>Variazione</th>
                <th>Azioni</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((h, i) => {
                const prev = rows[i + 1];
                const delta = prev ? Math.round((h.weightKg - prev.weightKg) * 10) / 10 : null;
                return (
                  <tr key={h.id} className="history-row" style={{ display: "flex" }}>
                    <td className="history-row__date">{formatShortDate(h.date)}</td>
                    <td className="history-row__kg">{formatKg(h.weightKg)}</td>
                    <td style={{ width: 92, textAlign: "right" }}>{delta === null ? <span className="chip">partenza</span> : <DeltaChip delta={delta} />}</td>
                    <td>
                      {!locked ? (
                        <button className="link-btn" aria-label={`Elimina pesata del ${formatShortDate(h.date)}`} onClick={() => setConfirmDelete({ id: h.id, date: h.date })}>
                          🗑️
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {result ? <ResultSheet result={result} onClose={() => setResult(null)} /> : null}
      {confirmDelete ? (
        <Sheet title="Eliminare la pesata?" onClose={() => setConfirmDelete(null)}>
          <p style={{ marginTop: 0 }}>Elimini la pesata di {formatLongDate(confirmDelete.date)}. La classifica verrà ricalcolata.</p>
          <div className="grid-2">
            <button className="btn btn--ghost" onClick={() => setConfirmDelete(null)}>
              Annulla
            </button>
            <button className="btn btn--danger" onClick={() => void remove(confirmDelete.id)}>
              Elimina
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}

function ResultSheet({ result, onClose }: { result: WeighInResult; onClose: () => void }) {
  const d = result.delta;
  const title = d === null ? "🐣 Si parte!" : d < 0 ? "🎉 Grande!" : d > 0 ? "😬 Ahi ahi..." : "😐 Stabile";
  const moved = result.rank !== null && result.prevRank !== null ? result.prevRank - result.rank : 0;
  return (
    <Sheet title={title} onClose={onClose}>
      <div className="result-burst">
        {d === null ? (
          <p className="muted" style={{ margin: 0 }}>Prima pesata registrata: da qui in poi ogni etto conta.</p>
        ) : (
          <>
            <div className="big" style={{ color: d < 0 ? "var(--good-ink)" : d > 0 ? "var(--bad-ink)" : "var(--ink)" }}>
              {d < 0 ? "▼ " : d > 0 ? "▲ " : ""}
              {formatKg(Math.abs(d))}
            </div>
            <p className="muted">
              {d < 0 ? "in meno rispetto alla pesata precedente!" : d > 0 ? "in più rispetto alla volta scorsa. Giovedì prossimo si recupera!" : "uguale alla volta scorsa."}
            </p>
          </>
        )}
        {result.rank !== null ? (
          <p style={{ fontWeight: 800 }}>
            🏆 Sei al {result.rank}° posto
            {moved > 0 ? ` (▲ ${moved})` : moved < 0 ? ` (▼ ${-moved})` : ""}
          </p>
        ) : null}
      </div>
      {result.newBadges.length > 0 ? (
        <div className="stack" style={{ marginBottom: 14 }}>
          {result.newBadges.map((id) => {
            const b = badgeById(id);
            return b ? (
              <div key={id} className="banner">
                <span className="banner__ico">{b.emoji}</span>
                <p>
                  <b>Nuovo badge: {b.name}</b>
                  <br />
                  {b.description}
                </p>
              </div>
            ) : null;
          })}
        </div>
      ) : null}
      <div className="grid-2">
        <Link to="/classifica" className="btn btn--ghost" onClick={onClose}>
          Classifica
        </Link>
        <Link to="/" className="btn" onClick={onClose}>
          Home
        </Link>
      </div>
    </Sheet>
  );
}
