import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MatchCard } from '../components/MatchCard';
import { ResultSheet } from '../components/ResultSheet';
import { AppHeader, ErrorBox, ExternalLink, Loading, Page, RefreshButton, Section } from '../components/ui';
import { getTeamMatch, rinUrl, type TournamentMatch } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';

export default function TeamMatch() {
  const { id = '' } = useParams();
  const teamMatchId = Number(id);
  const [params] = useSearchParams();
  const playerId = Number(params.get('spelare')) || null;
  const tm = useAsync((fresh) => getTeamMatch(teamMatchId, fresh), [teamMatchId]);
  const [reporting, setReporting] = useState<TournamentMatch | null>(null);

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
          <div className="team-score__team">{t.teams[0].name}</div>
          <div className="team-score__num" aria-label={`Ställning ${t.score[0]} mot ${t.score[1]}`}>
            {t.score[0]}–{t.score[1]}
          </div>
          <div className="team-score__team">{t.teams[1].name}</div>
          <p className="team-score__sub">
            {played} av {t.matches.length} matcher spelade
          </p>
        </div>

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
