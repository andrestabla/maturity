import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';
import { useSystemDialog } from './SystemDialogProvider.js';
import { ModalFrame } from './ModalFrame.js';
import {
  buildAiSummary,
  buildMaturityBreakdown,
  formatLibraryDate,
  getLibraryVisualSource,
} from '../utils/libraryPresentation.js';

interface CourseOption {
  value: string;
  label: string;
}

interface LibraryPreviewModalProps {
  asset: LibrarySearchResult | null;
  onClose: () => void;
  courseOptions: CourseOption[];
  onAddToCourse: (asset: LibrarySearchResult, courseSlug: string, targetUnit?: string) => Promise<void>;
}

export function LibraryPreviewModal({
  asset,
  onClose,
  courseOptions,
  onAddToCourse,
}: LibraryPreviewModalProps) {
  const { showConfirm, showAlert } = useSystemDialog();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(courseOptions[0]?.value ?? '');
  const [targetUnit, setTargetUnit] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const selectedCourseLabel = useMemo(() => (
    courseOptions.find((option) => option.value === selectedCourse)?.label ?? ''
  ), [courseOptions, selectedCourse]);

  useEffect(() => {
    setIsLinkModalOpen(false);
    setTargetUnit('');
    setAddSuccess(false);
    setIsAdding(false);
    setSelectedCourse(courseOptions[0]?.value ?? '');
  }, [asset?.id, courseOptions.length]);

  if (!asset) {
    return null;
  }

  const source = getLibraryVisualSource(asset);
  const aiSummary = buildAiSummary(asset);
  const maturityBreakdown = buildMaturityBreakdown(asset);
  const authorList = asset.authors.length > 0 ? asset.authors.join(', ') : 'Curaduria editorial';

  async function handleAddSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asset || !selectedCourse) return;

    const confirmed = await showConfirm({
      title: 'Confirmar vinculación',
      message: selectedCourseLabel
        ? `¿Deseas vincular "${asset.title}" al curso "${selectedCourseLabel}"?`
        : `¿Deseas vincular "${asset.title}" al curso seleccionado?`,
      confirmLabel: 'Vincular recurso',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    setIsAdding(true);
    setAddError(null);
    try {
      await onAddToCourse(asset, selectedCourse, targetUnit || undefined);
      setAddSuccess(true);
      await showAlert({
        title: 'Recurso vinculado',
        message: 'El recurso quedó asignado al curso seleccionado.',
        tone: 'success',
        confirmLabel: 'Entendido',
      });
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'No se pudo realizar la vinculación';
      setAddError(message);
      await showAlert({
        title: 'No fue posible vincular el recurso',
        message,
        tone: 'error',
        confirmLabel: 'Entendido',
      });
    } finally {
      setIsAdding(false);
    }
  }

  const content = (
    <AnimatePresence>
      <motion.div
        className="library-quickview-root"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <motion.button
          type="button"
          className="library-quickview-backdrop"
          aria-label="Cerrar previsualizacion"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        <motion.aside
          className="library-quickview-panel"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 28 }}
        >
          <div className="library-quickview-panel__header">
            <div>
              <span
                className="library-quickview-panel__source"
                style={{
                  background: source.soft,
                  color: source.accent,
                  borderColor: `${source.accent}33`,
                }}
              >
                {source.label}
              </span>
              <h2>Detalles: {asset.title}</h2>
            </div>

            <button
              type="button"
              className="library-quickview-panel__close"
              onClick={onClose}
              aria-label="Cerrar panel"
            >
              <X size={18} />
            </button>
          </div>

          <div className="library-quickview-panel__body">
            <section className="library-quickview-summary">
              <div className="library-quickview-summary__head">
                <div className="library-quickview-summary__icon">
                  <Sparkles size={14} />
                </div>
                <div>
                  <strong>Resumen de IA</strong>
                  <span>Chispa/IA</span>
                </div>
              </div>
              <p>{aiSummary}</p>
            </section>

            <section className="library-quickview-section">
              <dl className="library-quickview-facts">
                <div>
                  <dt>Fuente</dt>
                  <dd>{source.label}</dd>
                </div>
                <div>
                  <dt>Autores</dt>
                  <dd>{authorList}</dd>
                </div>
                <div>
                  <dt>Fecha de publicacion</dt>
                  <dd>{formatLibraryDate(asset.publishedAt)}</dd>
                </div>
                <div>
                  <dt>Tipo de recurso</dt>
                  <dd>{asset.resourceType || 'Material curado'}</dd>
                </div>
              </dl>
            </section>

            <section className="library-quickview-section">
              <div className="library-quickview-section__eyebrow">Cita (Formato APA 7)</div>
              <div className="library-quickview-apa" style={{ fontSize: '0.86rem', color: '#475569', lineHeight: '1.5', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                {(() => {
                  const authors = asset.authors.length > 0 ? asset.authors.join(', ') : 'Curaduría editorial';
                  const year = asset.publishedAt ? asset.publishedAt.slice(0, 4) : 's.f.';
                  return (
                    <span>
                      {authors} ({year}). <i>{asset.title}</i>. {source.label}.
                    </span>
                  );
                })()}
              </div>
            </section>

            <section className="library-quickview-section">
              <div className="library-quickview-section__eyebrow">Compatibilidad de madurez</div>
              <ul className="library-quickview-signals">
                {maturityBreakdown.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </section>

            {asset.tags.length > 0 ? (
              <section className="library-quickview-section">
                <div className="library-quickview-section__eyebrow">Etiquetas clave</div>
                <div className="library-quickview-tags">
                  {asset.tags.slice(0, 6).map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              </section>
            ) : null}

          </div>

          <div className="library-quickview-panel__footer">
            <button
              type="button"
              className="library-quickview-panel__primary"
              onClick={() => setIsLinkModalOpen(true)}
              disabled={courseOptions.length === 0}
            >
              Vincular a mi Curso Actual
            </button>

            {asset.canonicalUrl ? (
              <a
                className="library-quickview-panel__secondary"
                href={asset.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink size={16} />
                <span>Abrir Original</span>
              </a>
            ) : (
              <button type="button" className="library-quickview-panel__secondary" disabled>
                <ExternalLink size={16} />
                <span>Abrir Original</span>
              </button>
            )}
          </div>
        </motion.aside>

        {isLinkModalOpen ? (
          <ModalFrame
            title="Confirmar vinculación"
            description="Selecciona el curso al que quieres enviar este recurso."
            width="sm"
            onClose={() => setIsLinkModalOpen(false)}
            footer={(
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() => setIsLinkModalOpen(false)}
                >
                  <span>Cancelar</span>
                </button>
                <button
                  type="submit"
                  form="library-link-course-form"
                  className="cta-button"
                  disabled={isAdding || !selectedCourse}
                >
                  {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  <span>{isAdding ? 'Vinculando...' : 'Confirmar y Vincular'}</span>
                </button>
              </div>
            )}
          >
            {addSuccess ? (
              <div className="library-quickview-success" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px', color: '#166534' }}>
                <CheckCircle2 size={28} />
                <div>
                  <strong style={{ display: 'block', fontSize: '1rem' }}>¡Recurso vinculado con éxito!</strong>
                  <span style={{ opacity: 0.8, fontSize: '0.85rem' }}>Ya está disponible en la biblioteca del curso.</span>
                </div>
              </div>
            ) : (
              <form id="library-link-course-form" className="library-quickview-form" onSubmit={handleAddSubmit}>
                {addError ? (
                  <div style={{ background: '#fef2f2', color: '#991b1b', padding: '10px', borderRadius: '8px', fontSize: '0.85rem', marginBottom: '12px', border: '1px solid #fecaca' }}>
                    {addError}
                  </div>
                ) : null}

                <label style={{ display: 'block', marginBottom: '12px' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '6px' }}>Curso destino</span>
                  <div className="library-quickview-form__select" style={{ position: 'relative' }}>
                    <select
                      value={selectedCourse}
                      onChange={(event) => setSelectedCourse(event.target.value)}
                      required
                      style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', appearance: 'none' }}
                    >
                      {courseOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={14} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                  </div>
                </label>

                <label style={{ display: 'block' }}>
                  <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: '6px' }}>Módulo/Unidad (opcional)</span>
                  <input
                    type="text"
                    value={targetUnit}
                    onChange={(event) => setTargetUnit(event.target.value)}
                    placeholder="Ej. Unidad 2 o Microcurrículo"
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white' }}
                  />
                </label>
              </form>
            )}
          </ModalFrame>
        ) : null}
      </motion.div>
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}
