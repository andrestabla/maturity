import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface SidePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: string;
  sideLabel?: string;
  sideDescription?: string;
  width?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SidePanel({
  isOpen,
  onClose,
  title,
  description,
  sideLabel,
  sideDescription,
  width = 'lg',
  children,
  footer,
}: SidePanelProps) {
  const titleId = useId();

  // Scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Escape key handler
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="side-sheet-root">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="side-sheet-backdrop"
            aria-hidden="true"
          />

          <motion.section
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className={`side-sheet side-sheet--${width}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <aside className="side-sheet__rail">
              <div className="side-sheet__mark" aria-hidden="true">
                M
              </div>

              <div className="side-sheet__rail-copy" style={{ writingMode: 'vertical-rl' }}>
                {sideLabel ? <span className="side-sheet__rail-label">{sideLabel}</span> : null}
                {sideDescription ? (
                  <span className="side-sheet__rail-description">{sideDescription}</span>
                ) : null}
              </div>

              <div className="side-sheet__version" aria-hidden="true">
                v1.1
              </div>
            </aside>

            <div className="side-sheet__main">
              <header className="side-sheet__header">
                <div className="side-sheet__heading">
                  <h3 id={titleId} className="side-sheet__title">
                    {title}
                  </h3>
                  {description ? <p className="side-sheet__description">{description}</p> : null}
                </div>
                <button 
                  onClick={onClose}
                  className="side-sheet__close"
                  aria-label="Cerrar panel"
                >
                  <X size={22} />
                </button>
              </header>

              <main className="side-sheet__body custom-scrollbar">
                <div className="side-sheet__content">
                  {children}
                </div>
              </main>

              {footer && (
                <footer className="side-sheet__footer">
                  {footer}
                </footer>
              )}
            </div>
          </motion.section>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
