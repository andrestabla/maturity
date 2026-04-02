import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

interface PopoverConfirmProps {
  trigger: React.ReactElement;
  title: string;
  onConfirm: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'warning' | 'info';
}

export function PopoverConfirm({
  trigger,
  title,
  onConfirm,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'danger',
}: PopoverConfirmProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const toggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX - 120, // Offset for typical right-aligned triggers
      });
    }
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <div ref={triggerRef} className="inline-block" onClick={toggle}>
        {trigger}
      </div>

      {isOpen && createPortal(
        <div 
          ref={popoverRef}
          style={{ top: coords.top, left: coords.left }}
          className="fixed z-[100] w-64 p-5 bg-white shadow-2xl rounded-2xl border border-line animate-in zoom-in duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-lg ${tone === 'danger' ? 'bg-coral/10 text-coral' : 'bg-gold/10 text-gold'}`}>
                <AlertTriangle size={18} />
              </div>
              <p className="text-sm font-bold text-ink leading-tight">{title}</p>
            </div>
            
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                className="px-3 py-2 text-xs font-bold text-muted hover:text-ink transition-colors"
                onClick={() => setIsOpen(false)}
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all active:scale-95 ${
                  tone === 'danger' ? 'bg-coral text-white' : 'bg-gold text-ink'
                }`}
                onClick={() => {
                  onConfirm();
                  setIsOpen(false);
                }}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
          <div className="absolute top-[-6px] left-[130px] w-3 h-3 bg-white border-t border-l border-line rotate-45" />
        </div>,
        document.body
      )}
    </>
  );
}
