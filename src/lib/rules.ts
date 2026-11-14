// Rules per series, from SPF's documents:
// - SPL: "SPL – Särskilda tävlingsbestämmelser seriespel" (2024/25)
// - Klubbligan: "Tävlingsbestämmelser Klubbligan" (2026)
import { t } from './i18n';
import { checkSplLineup, divisionLevel, isSplLeague, lineupRules as splLineupRules, type PairInput } from './spl';

export type SeriesKind = 'spl' | 'klubbligan-young' | 'klubbligan' | 'other';

export function seriesKind(leagueName: string | null | undefined): SeriesKind {
  const n = leagueName || '';
  if (isSplLeague(n)) return 'spl';
  if (/klubbligan/i.test(n)) return /\b10\s*[-–]\s*1[234]\b/.test(n) ? 'klubbligan-young' : 'klubbligan';
  return 'other';
}

/** SPF: the 10–13 class keeps no table and gives no team points. */
export const showsStandings = (kind: SeriesKind) => kind !== 'klubbligan-young';

export type SeriesRules = {
  summary: string;
  /** Match numbers grouped in waves; a wave starts when the previous one is done. */
  waves: number[][];
  invitationDeadline: string;
  notes: string[];
};

export function seriesRules(kind: SeriesKind, division?: string | null): SeriesRules | null {
  if (kind === 'spl') {
    const level = divisionLevel(division);
    const r = splLineupRules(level);
    return {
      summary: r?.summary ?? t('Uppställningen läggs in i Rankedin av lagledaren.'),
      waves: level != null && level >= 2 ? [[1, 2], [3]] : [[1, 2, 3]],
      invitationDeadline: t('senast måndag samma vecka'),
      notes: [t('Uppställningen ska vara inlagd 15 min före första matchen.'), t('Vinnande lag rapporterar resultaten löpande i Rankedin.')],
    };
  }
  if (kind === 'klubbligan-young') {
    return {
      summary: t('Minst 4 spelare. Samma par bör inte spela flera matcher. Spelare som kommit längst spelar match 1.'),
      waves: [[1, 2], [3, 4], [5, 6]],
      invitationDeadline: t('senast 10 dagar före speldagen'),
      notes: [t('Coachning är inte tillåten – lagledaren får bara stötta vid behov.'), t('Spelarna dömer själva.'), t('Arrangören rapporterar resultaten efter lagmatcherna.')],
    };
  }
  if (kind === 'klubbligan') {
    return {
      summary: t('Minst 4 spelare. Samma par får inte spela flera matcher. Spelare som kommit längst spelar match 1.'),
      waves: [[1, 2], [3]],
      invitationDeadline: t('senast 10 dagar före speldagen'),
      notes: [t('Coachning är inte tillåten – lagledaren får bara stötta vid behov.'), t('Spelarna dömer själva.'), t('1 poäng per vunnen match. Inga SPF-rankingpoäng.')],
    };
  }
  return null;
}

/** Soft lineup warnings for any series. */
export function checkLineup(kind: SeriesKind, division: string | null | undefined, pairs: PairInput[], points: Map<number, number | null>): string[] {
  if (kind === 'spl') return checkSplLineup(pairs, points, divisionLevel(division));
  if (kind !== 'klubbligan' && kind !== 'klubbligan-young') return [];
  const warnings: string[] = [];
  const chosen = pairs.flatMap((p) => p.playerIds.filter((id) => id > 0));
  const complete = pairs.length > 0 && pairs.every((p) => p.playerIds.filter((id) => id > 0).length === 2);
  if (complete && new Set(chosen).size < 4) warnings.push(t('Lagmatchen ska ha minst {min} olika spelare (nu {n}).', { min: 4, n: new Set(chosen).size }));
  const seen = new Map<string, number>();
  pairs.forEach((p, i) => {
    const ids = p.playerIds.filter((id) => id > 0);
    if (ids.length < 2) return;
    const key = [...ids].sort((a, b) => a - b).join('-');
    if (seen.has(key)) {
      warnings.push(
        kind === 'klubbligan'
          ? t('Samma par spelar match {a} och {b} – det är inte tillåtet i den här klassen.', { a: seen.get(key)! + 1, b: i + 1 })
          : t('Samma par spelar match {a} och {b} – SPF rekommenderar olika par.', { a: seen.get(key)! + 1, b: i + 1 }),
      );
    } else seen.set(key, i);
  });
  return warnings;
}
