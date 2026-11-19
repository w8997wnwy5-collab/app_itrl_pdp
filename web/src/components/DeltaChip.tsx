import { formatKg } from "../../../shared/game";

/** Weekly change: green when weight went down, red when it went up. */
export function DeltaChip({ delta, suffix }: { delta: number | null; suffix?: string }) {
  if (delta === null) return <span className="chip">—</span>;
  if (delta < 0)
    return (
      <span className="chip chip--good" title="Peso in calo">
        ▼ {formatKg(-delta)}
        {suffix}
      </span>
    );
  if (delta > 0)
    return (
      <span className="chip chip--bad" title="Peso in aumento">
        ▲ {formatKg(delta)}
        {suffix}
      </span>
    );
  return <span className="chip">＝ stabile</span>;
}

export function RankMove({ rank, prevRank }: { rank: number | null; prevRank: number | null }) {
  if (rank === null) return null;
  if (prevRank === null) return <span className="lb-move faint">nuovo</span>;
  const diff = prevRank - rank;
  if (diff > 0) return <span className="lb-move up">▲{diff}</span>;
  if (diff < 0) return <span className="lb-move down">▼{-diff}</span>;
  return <span className="lb-move faint">＝</span>;
}
