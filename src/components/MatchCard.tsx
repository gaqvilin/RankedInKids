import { Go } from './shell';
import type { Side } from '../lib/rankedin';
import { Tip } from './ui';
import { useOutbox } from '../lib/outbox';
import { fmtDayTime, fmtTime } from '../lib/format';
import { t } from '../lib/i18n';

/** A playoff round as lib/rankedin names it ("Final", "Om plats 3–4", "Omgång 2"), in the current language. */
export function roundLabel(name: string): string {
  const places = /^Om plats (\d+)–(\d+)$/.exec(name);
  if (places) return t('Om plats {from}–{to}', { from: places[1], to: places[2] });
  const round = /^Omgång (\d+)$/.exec(name);
  return round ? t('Omgång {n}', { n: round[1] }) : t(name);
}

/** A side that is not decided yet is named by its place ("1:a grupp B"); real names are left as they are. */
function sideName(name: string): string {
  const seed = /^(\d+):([ae]) grupp (.+)$/.exec(name);
  if (!seed) return name;
  return seed[2] === 'a' ? t('{n}:a grupp {group}', { n: seed[1], group: seed[3] }) : t('{n}:e grupp {group}', { n: seed[1], group: seed[3] });
}

type Props = {
  sides: [Side, Side];
  sets: [number, number][];
  played: boolean;
  date: string | null;
  court: string | null;
  label?: string;
  /** Playoff round ("Final", "Om plats 3–4"): the card is marked as playoff. */
  playoff?: string;
  highlightIds?: number[];
  showDay?: boolean;
  /** The time is shown elsewhere (board column): hide it on the card. */
  hideTime?: boolean;
  /** From matchStatus() when the page knows all matches (players/court busy in an earlier match = waiting). Left out: the card decides from its own time. */
  status?: 'live' | 'waiting' | null;
  refereeCode?: string | null;
  canEnterResult?: boolean;
  awaitingConfirmation?: boolean;
  onEnterResult?: () => void;
  /** Organiser: move the match to another time/court. */
  onMove?: () => void;
  /** Rankedin challenge id: shows a result waiting to be sent from this phone. */
  challengeId?: number;
  /** Link to the whole team match (team leagues). */
  teamMatchPath?: string;
  /** Label for "back" on pages opened from this card. */
  from?: string;
};

export function MatchCard(p: Props) {
  const mine = (s: Side) => !!p.highlightIds?.some((id) => s.ids.includes(id));
  const when = p.hideTime ? '' : p.showDay ? fmtDayTime(p.date) : fmtTime(p.date);
  const isMine = p.sides.some(mine);
  // "Pågår nu": started within the last 90 minutes and no result yet.
  const start = p.date ? Date.parse(p.date) : NaN;
  const live = p.status !== undefined ? p.status === 'live' : !p.played && Number.isFinite(start) && Date.now() >= start && Date.now() < start + 90 * 60_000;
  const won = isMine && p.played ? p.sides.some((s) => mine(s) && s.isWinner) : null;
  const outbox = useOutbox();
  const waiting = p.challengeId ? outbox.find((q) => q.challengeId === p.challengeId) : undefined;
  return (
    <article className={`match ${isMine ? 'match--mine' : ''} ${live ? 'match--live' : ''} ${p.played ? 'match--played' : ''}`}>
      <div className="match__meta">
        {when && <span className="match__time">{when}</span>}
        {p.court && <span className="pill">{p.court}</span>}
        {p.playoff && <span className="pill pill--playoff">{t('Slutspel')} · {roundLabel(p.playoff)}</span>}
        {live && (
          <span className="pill pill--live">
            <span className="live-dot" aria-hidden="true" />
            {t('Pågår nu')}
          </span>
        )}
        {p.status === 'waiting' && (
          <span className="pill pill--loss">
            <Tip tip={t('Spelare eller bana är upptagna i en tidigare match som inte har resultat än.')}>{t('Väntar på förra matchen')}</Tip>
          </span>
        )}
        {won !== null && <span className={`pill ${won ? 'pill--win' : 'pill--loss'}`}>{won ? t('Vinst') : t('Förlust')}</span>}
        {p.label && <span className="match__label">{p.label}</span>}
        {waiting && (
          <span className="pill pill--warn">
            {waiting.state === 'conflict'
              ? t('Krock med Rankedin')
              : waiting.sets
                ? t('Väntar på nät: {score}', { score: waiting.sets.map(([a, b]) => `${a}–${b}`).join(' ') })
                : t('Väntar på nät: ta bort resultat')}
          </span>
        )}
      </div>
      <div className="match__body">
        {p.sides.map((s, i) => (
          <div key={i} className={`match__side ${s.isWinner ? 'is-winner' : ''} ${mine(s) ? 'is-mine' : ''}`}>
            <span className="match__names">{s.names.length ? s.names.map(sideName).join(' / ') : t('Ej uttagna')}</span>
            <span className="match__sets">
              {p.sets.map((set, j) => (
                <span key={j} className={set[i] > set[1 - i] ? 'set set--won' : 'set'}>
                  {set[i]}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>
      {(p.refereeCode || p.canEnterResult || p.awaitingConfirmation || p.teamMatchPath || p.onMove) && (
        <div className="match__actions">
          {p.teamMatchPath && (
            <Go className="btn btn--ghost btn--small" to={p.teamMatchPath} from={p.from ?? t('Tillbaka')}>
              {t('Hela lagmatchen')}
            </Go>
          )}
          {p.awaitingConfirmation && <span className="pill pill--warn">
              <Tip tip={t('Resultatet är rapporterat men inte bekräftat av motståndaren än.')}>{t('Väntar på bekräftelse')}</Tip>
            </span>}
          {p.refereeCode && !p.played && (
            <Go className="btn btn--small" to={`/doma/${encodeURIComponent(p.refereeCode)}`} from={p.from ?? t('Tillbaka')}>
              {t('Döm live')}
            </Go>
          )}
          {p.onMove && !p.played && (
            <button className="btn btn--ghost btn--small" onClick={p.onMove}>
              {t('Flytta')}
            </button>
          )}
          {p.canEnterResult && p.onEnterResult && (
            <button className="btn btn--small" onClick={p.onEnterResult}>
              {p.played ? t('Ändra resultat') : t('Rapportera resultat')}
            </button>
          )}
        </div>
      )}
    </article>
  );
}
