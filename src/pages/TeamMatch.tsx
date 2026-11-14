import { fmtDayTime } from '../lib/format';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Go } from '../components/shell';
import { MatchCard } from '../components/MatchCard';
import { LineupSheet } from '../components/LineupSheet';
import { ResultSheet } from '../components/ResultSheet';
import { AppHeader, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { getTeamMatch, getTeamMatchInfo, rinUrl, type TournamentMatch } from '../lib/rankedin';
import { t } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

export default function TeamMatch() {
  const { id = '' } = useParams();
  const teamMatchId = Number(id);
  const [params] = useSearchParams();
  const playerId = Number(params.get('spelare')) || null;
  const { version } = useSession();
  const tm = useAsync((fresh) => getTeamMatch(teamMatchId, fresh), [teamMatchId, version]);
  const info = useAsync(() => getTeamMatchInfo(teamMatchId).catch(() => null), [teamMatchId]);
  const [reporting, setReporting] = useState<TournamentMatch | null>(null);
  const [lineupSide, setLineupSide] = useState<'first' | 'second' | null>(null);

  // Refresh every minute while matches are still being played.
  const ongoing = !!tm.data && tm.data.matches.some((m) => !m.played);
  useEffect(() => {
    if (!ongoing) return;
    const timer = setInterval(() => tm.reload(), 60_000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ongoing]);

  if (tm.error) {
    return (
      <>
        <AppHeader back="/serier" backLabel={t('Serier')} title={t('Lagmatch')} />
        <Page>
          <ErrorBox error={tm.error} onRetry={() => tm.reload()} />
        </Page>
      </>
    );
  }
  if (!tm.data) {
    return (
      <>
        <AppHeader back="/serier" backLabel={t('Serier')} title={t('Lagmatch')} />
        <Page>
          <Loading />
        </Page>
      </>
    );
  }

  const d = tm.data;
  const played = d.matches.filter((m) => m.played).length;
  return (
    <>
      <AppHeader back="/serier" backLabel={t('Serier')} title={t('Lagmatch')} />
      <Page>
        {info.data && (
          <p className="muted small center">
            {info.data.date ? `${fmtDayTime(info.data.date)} · ` : ''}
            {info.data.leagueId ? (
              <Go to={`/liga/${info.data.leagueId}`} from={t('Lagmatchen')}>
                {info.data.leagueName}
              </Go>
            ) : (
              info.data.leagueName
            )}
            {info.data.division ? ` · ${info.data.division}` : ''}
            {info.data.date && (
              <>
                {' · '}
                <Go to={`/lag/${d.teams[0].id}/omgang/${info.data.date.slice(0, 10)}`} from={t('Lagmatchen')}>
                  {t('Hela speldagen')}
                </Go>
              </>
            )}
          </p>
        )}
        <div className="team-score">
          <Go className="team-score__team" to={`/lag/${d.teams[0].id}`} from={t('Lagmatch')}>
            {d.teams[0].name}
          </Go>
          <div className="team-score__num" aria-label={t('Ställning {a} mot {b}', { a: d.score[0], b: d.score[1] })}>
            {d.score[0]}–{d.score[1]}
          </div>
          <Go className="team-score__team" to={`/lag/${d.teams[1].id}`} from={t('Lagmatch')}>
            {d.teams[1].name}
          </Go>
          <p className="team-score__sub">
            {d.matches.length ? t('{n} av {total} matcher spelade', { n: played, total: d.matches.length }) : t('Matcherna är inte skapade i Rankedin än')}
          </p>
        </div>

        {d.matches.length === 0 && (
          <Notice tone="info">
            <strong>{t('Matcherna är inte öppnade än.')}</strong>{' '}
            {t('Rankedin har inte skapat de enskilda matcherna för den här lagmatchen, så laguppställning och resultat går inte att lägga in ännu, varken här eller på rankedin.com. De öppnas när arrangören startar omgången, oftast närmare matchdagen.')}
          </Notice>
        )}

        {d.matches.length > 0 && d.canLineup.some(Boolean) && (
          <Notice tone="info">
            <div className="row gap" style={{ justifyContent: 'space-between' }}>
              <span>
                {t('Du kan sätta uppställning för')}{' '}
                <strong>
                  {d.teams
                    .filter((_, i) => d.canLineup[i])
                    .map((x) => x.name)
                    .join(t(' och '))}
                </strong>
                .
              </span>
              {d.canLineup.map(
                (can, i) =>
                  can && (
                    <button key={i} className="btn btn--primary btn--small" onClick={() => setLineupSide(i === 0 ? 'first' : 'second')}>
                      {d.slots.some((s) => (i === 0 ? s.first : s.second).some((id) => id > 0)) ? t('Ändra uppställning') : t('Sätt uppställning')}
                      {d.canLineup[0] && d.canLineup[1] ? ` (${d.teams[i].name})` : ''}
                    </button>
                  ),
              )}
            </div>
          </Notice>
        )}

        {d.matches.length > 0 && d.canLineup.some(Boolean) && !d.matches.some((m) => m.canEnterResult) && (
          <p className="muted small">
            {played === d.matches.length
              ? t('Resultaten är inlagda. I Rankedin kan bara seriens administratör ändra ett inlagt resultat.')
              : t('Resultat kan rapporteras när båda lagens uppställning är satt.')}
          </p>
        )}

        <Section title={t('Matcher')} action={<RefreshButton onClick={() => tm.reload()} loading={tm.loading} />}>
          {d.matches.map((m, i) => (
            <MatchCard
              key={m.id}
              label={t('Match {n}', { n: i + 1 })}
              sides={m.sides}
              sets={m.sets}
              played={m.played}
              date={null}
              court={null}
              highlightIds={playerId ? [playerId] : []}
              canEnterResult={m.canEnterResult}
              awaitingConfirmation={m.awaitingConfirmation}
              onEnterResult={() => setReporting(m)}
            />
          ))}
        </Section>

        <p className="center">
          <ExternalLink href={rinUrl(`/sv/team/matchresults/${d.id}`)}>{t('Öppna i Rankedin')}</ExternalLink>
        </p>
      </Page>

      {lineupSide && (
        <LineupSheet
          leagueName={info.data?.leagueName ?? null}
          division={info.data?.division ?? null}
          firstMatchStart={info.data?.date ?? null}
          teamMatch={d}
          side={lineupSide}
          onClose={() => setLineupSide(null)}
          onSaved={() => {
            setLineupSide(null);
            tm.reload();
          }}
        />
      )}

      {reporting && (
        <ResultSheet
          challengeId={reporting.id}
          sides={reporting.sides}
          initial={reporting.sets}
          onClose={() => setReporting(null)}
          onDone={() => {
            setReporting(null);
            tm.reload();
          }}
        />
      )}
    </>
  );
}
