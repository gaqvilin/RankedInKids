// A group opened from its share link: the same view as the owner sees, read-only, no login needed.
import { useParams } from 'react-router-dom';
import { GroupView } from '../components/GroupView';
import { AppHeader, ErrorBox, Loading, Page } from '../components/ui';
import { getSharedGroup } from '../lib/groups';
import { t } from '../lib/i18n';
import { useAsync } from '../lib/useAsync';

export default function Group() {
  const { shareId = '' } = useParams();
  const group = useAsync(() => getSharedGroup(shareId), [shareId], `groupshare.${shareId}`);
  return (
    <>
      <AppHeader back="/" backLabel={t('Översikt')} title={group.data?.name ?? t('Grupp')} />
      <Page wide>
        {group.error && !group.data && <ErrorBox error={group.error} onRetry={() => group.reload()} />}
        {!group.data && group.loading && <Loading />}
        {group.data && (
          <>
            <div className="page-title">
              <div>
                <h1>{group.data.name}</h1>
                <p className="muted">{group.data.players.length === 1 ? t('1 spelare') : t('{n} spelare', { n: group.data.players.length })}</p>
              </div>
            </div>
            <GroupView players={group.data.players} cacheKey={`s.${shareId}`} from={group.data.name} />
          </>
        )}
      </Page>
    </>
  );
}
