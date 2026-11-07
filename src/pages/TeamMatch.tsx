import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { LineupSheet } from '../components/LineupSheet';
import { ResultSheet } from '../components/ResultSheet';
import { AppHeader, ErrorBox, ExternalLink, Loading, Notice, Page, RefreshButton, Section } from '../components/ui';
import { getTeamMatch, rinUrl, type TournamentMatch } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { useSession } from '../session';

export default function TeamMatch() {
  const { id = '' } = useParams();
  const teamMatchId = Number(id);
  const [params] = useSearchParams();
  const playerId = Number(params.get('spelare')) || null;
  const { version } = useSession();
  const tm = useAsync((fresh) => getTeamMatch(teamMatchId, fresh), [teamMatchId, version]);
  const [reporting, setReporting] = useState<TournamentMatch | null>(null);
  const [lineupSide, setLineupSide] = useState<'first' | 'second' | null>(null);

  // Refresh every minute while matches are still being played.
  const ongoing = !!tm.data && tm.data.matches.some((m) => !m.played);
  useEffect(() => {
    if (!ongoing) return;
    const t = setInterval(() => tm.reload(), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ongoing]);

  if (tm.error) {
    return (
      <>
        <AppHeader back="history" title="Lagmatch" />
        <Page>
          <ErrorBox error={tm.error} onRetry={() => tm.reload()} />
        </Page>
      </>
    );
  }
  if (!tm.data) {
    return (
      <>
        <AppHeader back="history" title="Lagmatch" />
        <Page>
          <Loading />
        </Page>
      </>
    );
  }

  const t = tm.data;
  const played = t.matches.filter((m) => m.played).length;
  return (
    <>
      <AppHeader back="history" title="Lagmatch" />
      <Page>
        <div className="team-score">
          <Link className="team-score__team" to={`/lag/${t.teams[0].id}`}>
            {t.teams[0].name}
          </Link>
          <div className="team-score__num" aria-label={`Ställning ${t.score[0]} mot ${t.score[1]}`}>
            {t.score[0]}–{t.score[1]}
          </div>
          <Link className="team-score__team" to={`/lag/${t.teams[1].id}`}>
            {t.teams[1].name}
          </Link>
          <p className="team-score__sub">
            {played} av {t.matches.length} matcher spelade
          </p>
        </div>

        {t.canLineup.some(Boolean) && (
          <Notice tone="info">
            <div className="row gap" style={{ justifyContent: 'space-between' }}>
              <span>
                Du är lagkapten för <strong>{t.teams[t.canLineup[0] ? 0 : 1].name}</strong>.
              </span>
              {t.canLineup.map(
                (can, i) =>
                  can && (
                    <button key={i} className="btn btn--primary btn--small" onClick={() => setLineupSide(i === 0 ? 'first' : 'second')}>
                      {t.slots.some((s) => (i === 0 ? s.first : s.second).some((id) => id > 0)) ? 'Ändra uppställning' : 'Sätt uppställning'}
                      {t.canLineup[0] && t.canLineup[1] ? ` (${t.teams[i].name})` : ''}
                    </button>
                  ),
              )}
            </div>
          </Notice>
        )}

        <Section title="Matcher" action={<RefreshButton onClick={() => tm.reload()} loading={tm.loading} />}>
          {t.matches.map((m, i) => (
            <MatchCard
              key={m.id}
              label={`Match ${i + 1}`}
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
          <ExternalLink href={rinUrl(`/sv/team/matchresults/${t.id}`)}>Öppna i Rankedin</ExternalLink>
        </p>
      </Page>

      {lineupSide && (
        <LineupSheet
          teamMatch={t}
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
