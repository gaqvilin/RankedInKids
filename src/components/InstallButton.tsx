import { t } from '../lib/i18n';
import { useState } from 'react';
import { useInstall } from '../lib/install';
import { Sheet } from './Sheet';

/**
 * One button to put PadelAdmin on the home screen. Uses the browser's install
 * prompt where there is one; otherwise shows the two steps for that phone.
 * Renders nothing when already installed, or on a desktop browser without support.
 */
export function InstallButton({ className = 'btn btn--small' }: { className?: string }) {
  const { installed, canPrompt, platform, prompt } = useInstall();
  const [help, setHelp] = useState(false);
  if (installed) return null;
  if (!canPrompt && platform === 'desktop') return null;

  return (
    <>
      <button className={className} onClick={() => (canPrompt ? void prompt() : setHelp(true))}>
        {t('Lägg till på hemskärmen')}
      </button>
      {help && (
        <Sheet label={t('Lägg till på hemskärmen')} onClose={() => setHelp(false)}>
            <h2>{t('Lägg till på hemskärmen')}</h2>
            {platform === 'ios' ? (
              <ol className="install-steps">
                <li>
                  {t('Tryck på')} <strong>{t('Dela')}</strong>{' '}
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-label={t('Dela-ikonen')} style={{ verticalAlign: '-3px' }}>
                    <path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>{' '}
                  {t('i Safari (längst ner eller i adressfältet).')}
                </li>
                <li>
                  {t('Välj')} <strong>{t('Lägg till på hemskärmen')}</strong> {t('och tryck')} <strong>{t('Lägg till')}</strong>.
                </li>
              </ol>
            ) : (
              <ol className="install-steps">
                <li>
                  {t('Öppna webbläsarens meny')} <strong>⋮</strong> {t('uppe till höger.')}
                </li>
                <li>
                  {t('Välj')} <strong>{t('Installera app')}</strong> {t('eller')} <strong>{t('Lägg till på startskärmen')}</strong>.
                </li>
              </ol>
            )}
            <p className="muted small">{t('Då öppnas PadelAdmin som en egen app, utan adressfält.')}</p>
            <button className="btn btn--primary" onClick={() => setHelp(false)}>
              {t('Klart')}
            </button>
        </Sheet>
      )}
    </>
  );
}
