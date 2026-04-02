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

const WIDTH_MAP = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-full',
};

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
        <div className="fixed inset-0 z-[1000] flex justify-end overflow-hidden">
          {/* Isolation Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl"
            aria-hidden="true"
          />

          {/* Side Panel Surface */}
          <motion.section
            initial={{ x: '100%', opacity: 0.8 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.8 }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
            className={`relative h-full w-full bg-white shadow-2xl flex border-l border-slate-200 ${WIDTH_MAP[width]}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            {/* Professional Vertical Rail (Context Anchor) */}
            <aside className="w-[84px] bg-slate-50/80 border-r border-slate-200 flex flex-col items-center justify-between py-10 select-none flex-shrink-0">
               <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-2xl bg-slate-900/5 border border-slate-200 flex items-center justify-center text-slate-900 font-extrabold text-xl">
                     M
                  </div>
               </div>

               <div 
                  className="flex-grow flex items-center justify-center -rotate-180"
                  style={{ writingMode: 'vertical-rl' }}
               >
                  <div className="flex flex-col gap-6">
                     <span className="text-xl font-black text-slate-900 uppercase tracking-[4px] whitespace-nowrap opacity-80">
                       {sideLabel}
                     </span>
                     {sideDescription && (
                       <span className="text-[10px] text-slate-500 font-bold tracking-[3px] uppercase whitespace-nowrap opacity-60">
                         {sideDescription}
                       </span>
                     )}
                  </div>
               </div>

               <div className="p-4 rounded-full bg-slate-900/5 text-[9px] font-black text-slate-400 uppercase tracking-widest">
                 v1.1
               </div>
            </aside>

            {/* Main Panel Layout */}
            <div className="flex-grow flex flex-col h-full overflow-hidden bg-white">
              {/* Sticky Header */}
              <header className="px-10 py-8 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/90 backdrop-blur-md z-20">
                <div className="pr-12">
                  <h3 id={titleId} className="text-2xl font-black text-slate-900 tracking-tight leading-tight">
                    {title}
                  </h3>
                  {description && (
                    <p className="text-base text-slate-500 mt-2 font-medium leading-relaxed max-w-xl">
                      {description}
                    </p>
                  )}
                </div>
                <button 
                  onClick={onClose}
                  className="absolute top-8 right-8 p-3 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-900 transition-all active:scale-95"
                  aria-label="Cerrar panel"
                >
                  <X size={22} />
                </button>
              </header>

              {/* Scrollable Content Surface */}
              <main className="flex-grow overflow-y-auto custom-scrollbar">
                <div className="px-10 py-10 max-w-4xl mx-auto w-full">
                  {children}
                </div>
              </main>

              {/* Sticky Fluid Footer */}
              {footer && (
                <footer className="px-10 py-6 border-t border-slate-100 bg-slate-50/50 backdrop-blur-sm flex items-center justify-end gap-5">
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
