import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalFrameProps {
  title: ReactNode;
  description?: ReactNode;
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
  width = 'lg',
  variant = 'modal',
  onClose,
  children,
  footer,
  closeLabel = 'Cerrar',
}: ModalFrameProps) {
  const titleId = useId();
  const modalRef = useRef<HTMLElement>(null);

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
        const firstElement = focusables[0] as HTMLElement;
        const lastElement = focusables[focusables.length - 1] as HTMLElement;

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
      document.body.style.overflow = 'unset';
      root.classList.remove('modal-active');
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
    <div 
      className={`fixed inset-0 z-[1000] flex bg-ink/75 backdrop-blur-2xl backdrop-saturate-[180%] animate-in fade-in transition-all ${
        variant === 'drawer' ? 'justify-end p-0' : 'items-end md:items-center justify-center p-0 md:p-6'
      }`} 
      onClick={onClose}
    >
      <section
        ref={modalRef as any}
        className={`relative shadow-2xl bg-white overflow-hidden animate-in duration-600 flex flex-col ${
          variant === 'drawer' 
            ? 'h-full w-full slide-in-from-right rounded-none border-l border-line-strong' 
            : 'h-full md:h-[95vh] w-full slide-in-from-bottom md:zoom-in rounded-none md:rounded-[40px] border-x md:border border-line-strong'
        } ${
          width === 'sm' ? 'max-w-md' : 
          width === 'md' ? 'max-w-2xl' : 
          width === 'xl' ? 'max-w-[96vw]' : 
          width === 'full' ? 'max-w-full' : 
          variant === 'drawer' ? 'max-w-[40vw]' : 'max-w-6xl'
        }`}
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
