import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalFrameProps {
  title: ReactNode;
  description?: ReactNode;
  sideLabel?: ReactNode;
  sideDescription?: string;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  variant?: 'modal' | 'drawer';
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
}

export function ModalFrame({
  title,
  description,
  sideLabel,
  sideDescription,
  width = 'lg',
  variant = 'modal',
  onClose,
  children,
  footer,
  closeLabel = 'Cerrar',
}: ModalFrameProps) {
  const titleId = useId();
  const modalRef = useRef<HTMLElement>(null);
  const panelClassName =
    width === 'sm'
      ? 'modal-panel modal-panel--sm surface'
      : width === 'md'
        ? 'modal-panel modal-panel--md surface'
        : width === 'xl'
          ? 'modal-panel modal-panel--xl surface'
          : width === 'full'
            ? 'modal-panel modal-panel--full surface'
            : 'modal-panel modal-panel--lg surface';

  useEffect(() => {
    const root = document.documentElement;
    const currentDepth = Number(root.dataset.modalDepth ?? '0');
    const nextDepth = currentDepth + 1;
    root.dataset.modalDepth = String(nextDepth);
    root.classList.add('has-modal-open');

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
      
      if (event.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusables[0] as HTMLElement | undefined;
        const lastElement = focusables[focusables.length - 1] as HTMLElement | undefined;

        if (!firstElement || !lastElement) {
          return;
        }

        if (event.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            event.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            event.preventDefault();
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    root.classList.add('modal-active');

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      const depth = Number(root.dataset.modalDepth ?? '1') - 1;
      if (depth <= 0) {
        delete root.dataset.modalDepth;
        root.classList.remove('has-modal-open');
        root.classList.remove('modal-active');
        if (!document.querySelector('.side-sheet-root')) {
          document.body.style.overflow = 'unset';
        }
        return;
      }
      root.dataset.modalDepth = String(depth);
    };
  }, [onClose]);

  return createPortal(
    <div className="modal-backdrop animate-in fade-in" onClick={onClose}>
      <section
        ref={modalRef as any}
        className={panelClassName}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        {variant === 'drawer' ? (
          <div className="side-sheet__main">
            <header className="modal-panel__head">
              <div>
                {sideLabel ? <span className="eyebrow">{sideLabel}</span> : null}
                <h3 id={titleId}>{title}</h3>
                {description ? <p>{description}</p> : null}
                {sideDescription ? <p className="field-help">{sideDescription}</p> : null}
              </div>
              <button
                type="button"
                className="filter-chip"
                onClick={onClose}
                aria-label={closeLabel}
              >
                <X size={18} />
                <span>{closeLabel}</span>
              </button>
            </header>

            <div className="modal-panel__body custom-scrollbar">{children}</div>

            {footer ? <footer className="modal-panel__foot">{footer}</footer> : null}
          </div>
        ) : (
          <>
            <header className="modal-panel__head">
              <div>
                <h3 id={titleId}>{title}</h3>
                {description ? <p>{description}</p> : null}
              </div>
              <button
                type="button"
                className="filter-chip"
                onClick={onClose}
                aria-label={closeLabel}
              >
                <X size={18} />
                <span>{closeLabel}</span>
              </button>
            </header>

            <div className="modal-panel__body custom-scrollbar">{children}</div>

            {footer ? <footer className="modal-panel__foot">{footer}</footer> : null}
          </>
        )}
      </section>
    </div>,
    document.body,
  );
}
