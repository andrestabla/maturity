import { X } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalFrameProps {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
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
    const root = document.documentElement;
    const currentDepth = Number(root.dataset.modalDepth ?? '0');
    const nextDepth = currentDepth + 1;
    root.dataset.modalDepth = String(nextDepth);
    root.classList.add('has-modal-open');

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);

      const depth = Number(root.dataset.modalDepth ?? '1') - 1;

      if (depth <= 0) {
        delete root.dataset.modalDepth;
        root.classList.remove('has-modal-open');
        return;
      }

      root.dataset.modalDepth = String(depth);
    };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/40 backdrop-blur-sm animate-in fade-in transition-all" onClick={onClose}>
      <section
        className={`relative w-full shadow-2xl rounded-3xl bg-white border border-line-strong overflow-hidden animate-in scale-in duration-500 flex flex-col max-h-[90vh] ${width === 'sm' ? 'max-w-md' : width === 'md' ? 'max-w-lg' : width === 'xl' ? 'max-w-6xl' : width === 'full' ? 'max-w-[95vw]' : 'max-w-3xl'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="px-8 py-6 border-b border-line flex items-center justify-between bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div>
            {eyebrow && (
              <span className="block font-mono text-[10px] font-bold uppercase tracking-widest text-ocean mb-1 opacity-80">
                {eyebrow}
              </span>
            )}
            <h3 id={titleId} className="text-xl font-bold text-ink leading-tight">
              {title}
            </h3>
            {description && <p className="text-sm text-muted mt-1">{description}</p>}
          </div>

          <button 
            type="button" 
            className="p-2.5 rounded-xl hover:bg-black/5 text-muted hover:text-ink transition-all active:scale-90" 
            onClick={onClose} 
            aria-label={closeLabel}
          >
            <X size={20} />
          </button>
        </header>

        <div className="modal-panel__body flex-grow overflow-y-auto p-8 custom-scrollbar">
          {children}
        </div>

        {footer && (
          <footer className="px-8 py-6 border-t border-line bg-white/40 backdrop-blur-md flex items-center justify-end gap-4">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
