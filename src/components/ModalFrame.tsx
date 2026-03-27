import { X } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';

interface ModalFrameProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl';
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
}

export function ModalFrame({
  eyebrow,
  title,
  description,
  width = 'lg',
  onClose,
  children,
  footer,
  closeLabel = 'Cerrar',
}: ModalFrameProps) {
  const titleId = useId();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className={`modal-panel surface modal-panel--${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="modal-panel__head">
          <div>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            <h3 id={titleId}>{title}</h3>
            {description ? <p>{description}</p> : null}
          </div>

          <button type="button" className="ghost-button ghost-button--icon" onClick={onClose} aria-label={closeLabel}>
            <X size={16} />
          </button>
        </header>

        <div className="modal-panel__body">{children}</div>

        {footer ? <footer className="modal-panel__foot">{footer}</footer> : null}
      </section>
    </div>
  );
}
