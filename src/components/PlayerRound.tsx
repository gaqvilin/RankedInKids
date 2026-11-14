import { useState } from 'react';
import { getAvailability, setAvailability, STATUS_LABEL, type AvailabilityStatus } from '../lib/availability';
import { fmtDay } from '../lib/format';
import { t } from '../lib/i18n';
import type { LeagueTeamSummary } from '../lib/overview';
import { getTeamMatch } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';
import { Go } from './shell';

const ORDER: AvailabilityStatus[] = ['yes', 'maybe', 'no'];

/**
 * For one of the player's teams: the next round day, whether the player is
 * in the lineup (and in which match), and – if logged in as the player –
 * a quick "can you play?" answer.
 */
export function PlayerRound({ team, playerId, rankedinId, from }: { team: LeagueTeamSummary; playerId: number; rankedinId: string; from: string }) {
  const { user, version } = useSession();
  const date = team.next?.date?.slice(0, 10) ?? null;
  const dayFixtures = date ? team.upcoming.filter((f) => f.date?.slice(0, 10) === date) : [];
  const isMe = user.accounts.some((a) => a.rankedinId === rankedinId);

  const selection = useAsync(async () => {
    const out: string[] = [];
    for (const f of dayFixtures) {
      const tm = await getTeamMatch(f.teamMatchId).catch(() => null);
      if (!tm) continue;
      const side = tm.teams[0].id === team.teamId ? 0 : 1;
      const opp = tm.teams[1 - side].name;
      tm.slots.forEach((s, i) => {
        const ids = side === 0 ? s.first : s.second;
        if (ids.includes(playerId)) {
          const partnerId = ids.find((x) => x > 0 && x !== playerId);
          const m = tm.matches[i];
          const partner = m?.sides[side].names[m.sides[side].ids.indexOf(partnerId ?? -1)] ?? null;
          out.push(partner ? t('match {n} mot {opponent} med {partner}', { n: i + 1, opponent: opp, partner }) : t('match {n} mot {opponent}', { n: i + 1, opponent: opp }));
        }
      });
    }
    return out;
  }, [team.teamId, date, playerId, version]);

  const av = useAsync(() => (isMe && date ? getAvailability(team.teamId, date).catch(() => null) : Promise.resolve(null)), [team.teamId, date, isMe, version]);
  const [busy, setBusy] = useState(false);
  const mine = av.data?.entries.find((e) => e.playerId === playerId);

  if (!date) return null;
  return (
    <div className="player-round">
      <p className="small">
        <Go to={`/lag/${team.teamId}/omgang/${date}`} from={from}>
          <strong>{t('Nästa speldag {day}', { day: fmtDay(team.next!.date) })}</strong>
        </Go>{' '}
        <span className="muted">{t('mot {opponent}', { opponent: dayFixtures.map((f) => (f.home.id === team.teamId ? f.away.name : f.home.name)).join(t(' och ')) })}</span>
      </p>
      {selection.data && selection.data.length > 0 && <p className="small">{t('Uttagen: {matches}.', { matches: selection.data.join(', ') })}</p>}
      {selection.data && selection.data.length === 0 && <p className="small muted">{t('Inte uttagen än.')}</p>}
      {isMe && (
        <div className="row gap small">
          <span>{t('Kan du spela?')}</span>
          <span className="seg" role="group">
            {ORDER.map((s) => (
              <button
                key={s}
                className={`seg__btn ${mine?.status === s ? 'is-on' : ''}`}
                aria-pressed={mine?.status === s}
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await setAvailability(team.teamId, date, playerId, s);
                    av.reload();
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                {t(STATUS_LABEL[s])}
              </button>
            ))}
          </span>
        </div>
      )}
    </div>
  );
}
