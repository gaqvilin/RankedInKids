import { useMemo, useState } from 'react';
import { appearances, isSinglesMatchType, validateLineup } from '../../api/_lib/lineup';
import { saveLineup } from '../lib/api';
import type { LineupPlayer, TeamMatch } from '../lib/rankedin';
import { AccountSwitcher } from './AccountSwitcher';
import { lineupDeadline } from '../lib/spl';
import { checkLineup, seriesKind, seriesRules } from '../lib/rules';
import { fmtTime } from '../lib/format';
import { locale, t } from '../lib/i18n';

type Props = {
  teamMatch: TeamMatch;
  /** League and division, for the series' lineup rules (SPL, Klubbligan). */
  leagueName?: string | null;
  division?: string | null;
  /** When the first match starts, for the lineup deadline. */
  firstMatchStart?: string | null;
  side: 'first' | 'second';
  onClose: () => void;
  onSaved: () => void;
};

const fmtPoints = (p: number | null) => (p == null ? '' : p >= 100 ? Math.round(p).toString() : p.toFixed(1).replace('.', locale() === 'sv-SE' ? ',' : '.'));

export function LineupSheet({ teamMatch, side, onClose, onSaved, leagueName = null, division = null, firstMatchStart = null }: Props) {
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
  const deadline = lineupDeadline(firstMatchStart);
  const kind = seriesKind(leagueName);
  const rules = seriesRules(kind, division);
  const splWarnings = checkLineup(kind, division, lineup, new Map(roster.map((p) => [p.id, p.points])));
  const changed = lineup.filter((l, i) => l.playerIds.join() !== initial[i].playerIds.join());
  // Pairing rules for every match; roster membership only for what the captain changes.
  const validation =
    validateLineup(lineup, { matchType: teamMatch.matchType, names: roster }) ??
    validateLineup(changed, { matchType: teamMatch.matchType, roster });
  // Players already set in Rankedin but missing from the roster (e.g. left the team).
  const nameFor = (matchIdx: number, id: number) => {
    const side = teamMatch.matches[matchIdx]?.sides[idx];
    const pos = side?.ids.indexOf(id) ?? -1;
    return pos >= 0 ? side!.names[pos] : t('Spelare {id}', { id });
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
      <div className="sheet" role="dialog" aria-modal="true" aria-label={t('Laguppställning')} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" aria-hidden="true" />
        <h2>{t('Laguppställning')}</h2>
        <p className="muted small">{teamMatch.teams[idx].name}</p>
        <AccountSwitcher label={t('Sparas som')} />
        {rules && (
          <p className="notice notice--info small">
            <strong>{kind === 'spl' ? `SPL ${division ?? ''}`.trim() : 'Klubbligan'}:</strong> {rules.summary}
            {kind === 'spl' && deadline && (
              <>
                {' '}
                {t('Uppställningen ska vara inlagd senast')} <strong>{fmtTime(deadline.toISOString())}</strong> ({t('15 min före första matchen')}).
              </>
            )}
          </p>
        )}

        {teamMatch.slots.length === 0 ? (
          <p className="notice notice--info">{t('Rankedin har inte skapat matcherna för den här lagmatchen än, så det finns inget att sätta uppställning på.')}</p>
        ) : roster.length === 0 ? (
          <p className="notice notice--warn">{t('Rankedin visar inga spelare för laget. Kontrollera att du är inloggad som lagkapten.')}</p>
        ) : (
          <>
            {lineup.map((l, i) => (
              <fieldset key={l.challengeId} className="lineup-match">
                <legend>
                  {t('Match {n}', { n: i + 1 })}
                  {per === 2 && pairPoints(l.playerIds) > 0 && <span className="muted small"> · {t('{points} rankingpoäng', { points: fmtPoints(pairPoints(l.playerIds)) })}</span>}
                </legend>
                {Array.from({ length: per }, (_, slot) => (
                  <select
                    key={slot}
                    className="input"
                    aria-label={t('Match {n}, spelare {slot}', { n: i + 1, slot: slot + 1 })}
                    value={l.playerIds[slot] || 0}
                    onChange={(e) => set(i, slot, Number(e.target.value))}
                  >
                    <option value={0}>{t('– Välj spelare –')}</option>
                    {l.playerIds[slot] > 0 && !byId.has(l.playerIds[slot]) && (
                      <option value={l.playerIds[slot]}>{t('{name} (nuvarande)', { name: nameFor(i, l.playerIds[slot]) })}</option>
                    )}
                    {sortedRoster.map((p) => (
                      <option key={p.id} value={p.id} disabled={l.playerIds.includes(p.id) && l.playerIds[slot] !== p.id}>
                        {p.name}
                        {p.points != null ? ` (${fmtPoints(p.points)})` : ''}
                        {!p.hasLicense ? ` – ${t('licens saknas')}` : ''}
                        {(counts.get(p.id) || 0) > 0 && l.playerIds[slot] !== p.id ? ` · ${t('spelar {n}', { n: counts.get(p.id) ?? 0 })}` : ''}
                      </option>
                    ))}
                  </select>
                ))}
              </fieldset>
            ))}

            {[...counts].some(([, n]) => n > 1) && (
              <p className="notice notice--info">
                {t('Spelar flera matcher:')}{' '}
                {[...counts]
                  .filter(([, n]) => n > 1)
                  .map(([id, n]) => `${byId.get(id)?.name ?? t('okänd')} (${n})`)
                  .join(', ')}
                . {t('Kontrollera att seriens regler tillåter det.')}
              </p>
            )}
            {unlicensed.length > 0 && <p className="notice notice--warn">{t('Licens saknas för {names}.', { names: unlicensed.map((p) => p.name).join(', ') })}</p>}
            {splWarnings.length > 0 && (
              <div className="notice notice--warn small">
                {splWarnings.map((w) => (
                  <p key={w}>{w}</p>
                ))}
              </div>
            )}
            {validation && <p className="field-error">{t(validation)}</p>}
            {error && <p className="field-error">{error}</p>}
            <p className="muted small">{t('Kontrollera seriens regler för hur paren ska rangordnas. Siffran inom parentes är spelarens rankingpoäng.')}</p>
            <button className="btn btn--primary btn--block" disabled={busy || !!validation || changed.length === 0} onClick={save}>
              {busy ? t('Sparar…') : changed.length === 0 ? t('Inga ändringar') : t('Spara i Rankedin')}
            </button>
          </>
        )}
        <button className="btn btn--ghost btn--block" onClick={onClose}>
          {t('Avbryt')}
        </button>
      </div>
    </div>
  );
}
