import { useMemo, useState } from 'react';
import { appearances, isSinglesMatchType, validateLineup } from '../../api/_lib/lineup';
import { saveLineup } from '../lib/api';
import type { LineupPlayer, TeamMatch } from '../lib/rankedin';
import { AccountSwitcher } from './AccountSwitcher';

type Props = {
  teamMatch: TeamMatch;
  side: 'first' | 'second';
  onClose: () => void;
  onSaved: () => void;
};

const fmtPoints = (p: number | null) => (p == null ? '' : p >= 100 ? Math.round(p).toString() : p.toFixed(1).replace('.', ','));

export function LineupSheet({ teamMatch, side, onClose, onSaved }: Props) {
  const idx = side === 'first' ? 0 : 1;
  const roster = teamMatch.rosters[idx];
  const per = isSinglesMatchType(teamMatch.matchType) ? 1 : 2;
  const initial = teamMatch.slots.map((s) => ({ challengeId: s.challengeId, playerIds: (side === 'first' ? s.first : s.second).slice(0, per) }));
  const [lineup, setLineup] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const sortedRoster = useMemo(() => [...roster].sort((a, b) => (b.points ?? -1) - (a.points ?? -1) || a.name.localeCompare(b.name, 'sv')), [roster]);
  const counts = appearances(lineup);
  const changed = lineup.filter((l, i) => l.playerIds.join() !== initial[i].playerIds.join());
  // Pairing rules for every match; roster membership only for what the captain changes.
  const validation =
    validateLineup(lineup, { matchType: teamMatch.matchType, names: roster }) ??
    validateLineup(changed, { matchType: teamMatch.matchType, roster });
  // Players already set in Rankedin but missing from the roster (e.g. left the team).
  const nameFor = (matchIdx: number, id: number) => {
    const side = teamMatch.matches[matchIdx]?.sides[idx];
    const pos = side?.ids.indexOf(id) ?? -1;
    return pos >= 0 ? side!.names[pos] : `Spelare ${id}`;
  };
  const pairPoints = (ids: number[]) => ids.reduce((sum, id) => sum + (byId.get(id)?.points ?? 0), 0);
  const unlicensed = [...new Set(lineup.flatMap((l) => l.playerIds))].map((id) => byId.get(id)).filter((p): p is LineupPlayer => !!p && !p.hasLicense);

  const set = (matchIdx: number, slot: number, playerId: number) =>
    setLineup((prev) => prev.map((l, i) => (i === matchIdx ? { ...l, playerIds: l.playerIds.map((id, j) => (j === slot ? playerId : id)) } : l)));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await saveLineup(teamMatch.id, side, changed);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Laguppställning" onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" aria-hidden="true" />
        <h2>Laguppställning</h2>
        <p className="muted small">{teamMatch.teams[idx].name}</p>
        <AccountSwitcher label="Sparas som" />

        {roster.length === 0 ? (
          <p className="notice notice--warn">Rankedin visar inga spelare för laget. Kontrollera att du är inloggad som lagkapten.</p>
        ) : (
          <>
            {lineup.map((l, i) => (
              <fieldset key={l.challengeId} className="lineup-match">
                <legend>
                  Match {i + 1}
                  {per === 2 && pairPoints(l.playerIds) > 0 && <span className="muted small"> · {fmtPoints(pairPoints(l.playerIds))} rankingpoäng</span>}
                </legend>
                {Array.from({ length: per }, (_, slot) => (
                  <select
                    key={slot}
                    className="input"
                    aria-label={`Match ${i + 1}, spelare ${slot + 1}`}
                    value={l.playerIds[slot] || 0}
                    onChange={(e) => set(i, slot, Number(e.target.value))}
                  >
                    <option value={0}>– Välj spelare –</option>
                    {l.playerIds[slot] > 0 && !byId.has(l.playerIds[slot]) && (
                      <option value={l.playerIds[slot]}>{nameFor(i, l.playerIds[slot])} (nuvarande)</option>
                    )}
                    {sortedRoster.map((p) => (
                      <option key={p.id} value={p.id} disabled={l.playerIds.includes(p.id) && l.playerIds[slot] !== p.id}>
                        {p.name}
                        {p.points != null ? ` (${fmtPoints(p.points)})` : ''}
                        {!p.hasLicense ? ' – licens saknas' : ''}
                        {(counts.get(p.id) || 0) > 0 && l.playerIds[slot] !== p.id ? ` · spelar ${counts.get(p.id)}` : ''}
                      </option>
                    ))}
                  </select>
                ))}
              </fieldset>
            ))}

            {[...counts].some(([, n]) => n > 1) && (
              <p className="notice notice--info">
                Spelar flera matcher:{' '}
                {[...counts]
                  .filter(([, n]) => n > 1)
                  .map(([id, n]) => `${byId.get(id)?.name ?? 'okänd'} (${n})`)
                  .join(', ')}
                . Kontrollera att seriens regler tillåter det.
              </p>
            )}
            {unlicensed.length > 0 && <p className="notice notice--warn">Licens saknas för {unlicensed.map((p) => p.name).join(', ')}.</p>}
            {validation && <p className="field-error">{validation}</p>}
            {error && <p className="field-error">{error}</p>}
            <p className="muted small">Kontrollera seriens regler för hur paren ska rangordnas. Siffran inom parentes är spelarens rankingpoäng.</p>
            <button className="btn btn--primary btn--block" disabled={busy || !!validation || changed.length === 0} onClick={save}>
              {busy ? 'Sparar…' : changed.length === 0 ? 'Inga ändringar' : 'Spara i Rankedin'}
            </button>
          </>
        )}
        <button className="btn btn--ghost btn--block" onClick={onClose}>
          Avbryt
        </button>
      </div>
    </div>
  );
}
