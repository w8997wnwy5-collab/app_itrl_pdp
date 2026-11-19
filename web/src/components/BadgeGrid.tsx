import { useState } from "react";
import { BADGES, type BadgeDef } from "../../../shared/game";
import type { BadgeAward } from "../../../shared/types";
import { Sheet } from "./Sheet";

export function BadgeGrid({ earned, showLocked = true }: { earned: BadgeAward[]; showLocked?: boolean }) {
  const [open, setOpen] = useState<BadgeDef | null>(null);
  const got = new Map(earned.map((b) => [b.id, b.awardedAt]));
  const list = showLocked ? BADGES : BADGES.filter((b) => got.has(b.id));
  if (list.length === 0) return <p className="muted">Ancora nessun badge: la prima pesata ne sblocca uno!</p>;
  return (
    <>
      <div className="badge-grid">
        {list.map((b) => (
          <button key={b.id} className={`badge${got.has(b.id) ? "" : " badge--locked"}`} onClick={() => setOpen(b)}>
            <span className="badge__medal" aria-hidden="true">
              {b.emoji}
            </span>
            <span className="badge__name">{b.name}</span>
          </button>
        ))}
      </div>
      {open ? (
        <Sheet title={`${open.emoji} ${open.name}`} onClose={() => setOpen(null)}>
          <p style={{ marginTop: 0 }}>{open.description}.</p>
          {got.has(open.id) ? (
            <p className="chip chip--gold">
              Sbloccato il {new Date(got.get(open.id)!).toLocaleDateString("it-IT", { day: "numeric", month: "long" })}
            </p>
          ) : (
            <p className="chip">🔒 Ancora da sbloccare</p>
          )}
        </Sheet>
      ) : null}
    </>
  );
}
