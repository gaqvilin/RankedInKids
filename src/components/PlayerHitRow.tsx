import { t } from '../lib/i18n';
import { getProfile, type PlayerHit } from '../lib/rankedin';
import { useAsync } from '../lib/useAsync';
import { Go } from './shell';

/** A search hit, with club and age loaded in the background to tell namesakes apart. */
export function PlayerHitRow({ h, from, badge }: { h: PlayerHit; from: string; badge?: string }) {
  const profile = useAsync(() => getProfile(h.rankedinId), [h.rankedinId], `profile.${h.rankedinId}`);
  const p = profile.data;
  const details = [p?.club, p?.age ? t('{n} år', { n: p.age }) : null].filter(Boolean).join(' · ');
  return (
    <Go to={`/spelare/${h.rankedinId}`} from={from} className="item">
      <span className="item__main">
        <strong>{h.name}</strong>
        {badge && <span className="pill">{badge}</span>}
        <span className="muted small block">{details || (profile.loading ? '…' : h.rankedinId)}</span>
      </span>
    </Go>
  );
}
