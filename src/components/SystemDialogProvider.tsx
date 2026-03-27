import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, BadgeCheck, CircleAlert } from 'lucide-react';
import { ModalFrame } from './ModalFrame.js';

type SystemDialogTone = 'default' | 'success' | 'warning' | 'error';

interface AlertDialogOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  tone?: SystemDialogTone;
}

interface ConfirmDialogOptions extends AlertDialogOptions {
  cancelLabel?: string;
}

type DialogRequest =
  | {
      kind: 'alert';
      options: AlertDialogOptions;
      resolve: () => void;
    }
  | {
      kind: 'confirm';
      options: ConfirmDialogOptions;
      resolve: (value: boolean) => void;
    };

interface SystemDialogContextValue {
  showAlert: (options: AlertDialogOptions) => Promise<void>;
  showConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
}

const SystemDialogContext = createContext<SystemDialogContextValue | null>(null);

const toneMeta: Record<
  SystemDialogTone,
  { icon: typeof CircleAlert; title: string }
> = {
  default: {
    icon: CircleAlert,
    title: 'Sistema',
  },
  success: {
    icon: BadgeCheck,
    title: 'Operación completada',
  },
  warning: {
    icon: CircleAlert,
    title: 'Revisión requerida',
  },
  error: {
    icon: AlertTriangle,
    title: 'Se requiere atención',
  },
};

export function SystemDialogProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<DialogRequest[]>([]);
  const activeDialog = queue[0] ?? null;

  const closeActiveDialog = useCallback(() => {
    if (!activeDialog) {
      return;
    }

    if (activeDialog.kind === 'confirm') {
      activeDialog.resolve(false);
    } else {
      activeDialog.resolve();
    }

    setQueue((current) => current.slice(1));
  }, [activeDialog]);

  const showAlert = useCallback((options: AlertDialogOptions) => {
    return new Promise<void>((resolve) => {
      setQueue((current) => [
        ...current,
        {
          kind: 'alert',
          options,
          resolve,
        },
      ]);
    });
  }, []);

  const showConfirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      setQueue((current) => [
        ...current,
        {
          kind: 'confirm',
          options,
          resolve,
        },
      ]);
    });
  }, []);

  const contextValue = useMemo<SystemDialogContextValue>(
    () => ({
      showAlert,
      showConfirm,
    }),
    [showAlert, showConfirm],
  );

  const tone = activeDialog?.options.tone ?? 'default';
  const meta = toneMeta[tone];
  const Icon = meta.icon;

  return (
    <SystemDialogContext.Provider value={contextValue}>
      {children}

      {activeDialog ? (
        <ModalFrame
          eyebrow={meta.title}
          title={activeDialog.options.title}
          description={activeDialog.options.message}
          width="sm"
          onClose={closeActiveDialog}
        >
          <div className={`system-dialog system-dialog--${tone}`}>
            <div className="system-dialog__icon">
              <Icon size={18} />
            </div>
          </div>

          <div className="system-dialog__actions">
            {activeDialog.kind === 'confirm' ? (
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  activeDialog.resolve(false);
                  setQueue((current) => current.slice(1));
                }}
              >
                <span>{activeDialog.options.cancelLabel ?? 'Cancelar'}</span>
              </button>
            ) : null}

            <button
              type="button"
              className={tone === 'error' ? 'danger-button' : 'cta-button'}
              onClick={() => {
                if (activeDialog.kind === 'confirm') {
                  activeDialog.resolve(true);
                } else {
                  activeDialog.resolve();
                }

                setQueue((current) => current.slice(1));
              }}
            >
              <span>{activeDialog.options.confirmLabel ?? 'Entendido'}</span>
            </button>
          </div>
        </ModalFrame>
      ) : null}
    </SystemDialogContext.Provider>
  );
}

export function useSystemDialog() {
  const context = useContext(SystemDialogContext);

  if (!context) {
    throw new Error('useSystemDialog must be used within a SystemDialogProvider');
  }

  return context;
}
