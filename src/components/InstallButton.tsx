import { useState } from 'react';
import { useInstall } from '../lib/install';

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
        Lägg till på hemskärmen
      </button>
      {help && (
        <div className="sheet-backdrop" onClick={() => setHelp(false)}>
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Lägg till på hemskärmen" onClick={(e) => e.stopPropagation()}>
            <div className="sheet__grip" aria-hidden="true" />
            <h2>Lägg till på hemskärmen</h2>
            {platform === 'ios' ? (
              <ol className="install-steps">
                <li>
                  Tryck på <strong>Dela</strong>{' '}
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-label="Dela-ikonen" style={{ verticalAlign: '-3px' }}>
                    <path d="M12 3v12M7 8l5-5 5 5M5 12v8h14v-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>{' '}
                  i Safari (längst ner eller i adressfältet).
                </li>
                <li>
                  Välj <strong>Lägg till på hemskärmen</strong> och tryck <strong>Lägg till</strong>.
                </li>
              </ol>
            ) : (
              <ol className="install-steps">
                <li>
                  Öppna webbläsarens meny <strong>⋮</strong> uppe till höger.
                </li>
                <li>
                  Välj <strong>Installera app</strong> eller <strong>Lägg till på startskärmen</strong>.
                </li>
              </ol>
            )}
            <p className="muted small">Då öppnas PadelAdmin som en egen app, utan adressfält.</p>
            <button className="btn btn--primary" onClick={() => setHelp(false)}>
              Klart
            </button>
          </div>
        </div>
      )}
    </>
  );
}
