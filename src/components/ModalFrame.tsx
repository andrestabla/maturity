import { X } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalFrameProps {
  title: ReactNode;
  description?: ReactNode;
  width?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  closeLabel?: string;
}

export function ModalFrame({
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
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-0 md:p-6 bg-ink/60 backdrop-blur-md animate-in fade-in transition-all" onClick={onClose}>
      <section
        className={`relative w-full h-full md:h-[95vh] shadow-2xl rounded-none md:rounded-[32px] bg-white border-x md:border border-line-strong overflow-hidden animate-in slide-in-from-bottom md:zoom-in duration-500 flex flex-col ${width === 'sm' ? 'max-w-md' : width === 'md' ? 'max-w-2xl' : width === 'xl' ? 'max-w-[96vw]' : width === 'full' ? 'max-w-full' : 'max-w-5xl'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <button 
          type="button" 
          className="absolute top-6 right-8 p-3 rounded-2xl bg-black/5 hover:bg-black/10 text-muted hover:text-ink transition-all active:scale-95 z-20" 
          onClick={onClose} 
          aria-label={closeLabel}
        >
          <X size={22} />
        </button>

        <header className="px-10 py-8 border-b border-line flex items-center justify-between bg-white sticky top-0 z-10 pr-24">
          <div>
            <h3 id={titleId} className="text-2xl font-extrabold text-ink tracking-tight leading-tight">
              {title}
            </h3>
            {description && <p className="text-base text-muted mt-2 font-medium opacity-80">{description}</p>}
          </div>
        </header>

        <div className="modal-panel__body flex-grow overflow-y-auto p-10 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto w-full">
            {children}
          </div>
        </div>

        {footer && (
          <footer className="px-10 py-8 border-t border-line bg-white flex items-center justify-end gap-6">
            {footer}
          </footer>
        )}
      </section>
    </div>,
    document.body,
  );
}
