import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bottom sheet (centred dialog on desktop). Rendered at the end of <body>, so it
 * never inherits styles from where it is opened (e.g. the centred footer).
 */
export function Sheet({ label, onClose, children }: { label: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} onClick={(e) => e.stopPropagation()}>
        <div className="sheet__grip" aria-hidden="true" />
        {children}
      </div>
    </div>,
    document.body,
  );
}
