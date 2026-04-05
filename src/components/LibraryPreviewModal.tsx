import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  PackageCheck,
  Play,
  Plus,
  Puzzle,
  Users,
  X,
} from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';

const PROVIDER_COLORS: Record<string, string> = {
  'semantic-scholar': '#1d4ed8', openalex: '#0f766e', arxiv: '#b91c1c', core: '#15803d',
  scielo: '#0ea5e9', redalyc: '#7c3aed', 'oer-commons': '#d97706', phet: '#0891b2',
  youtube: '#dc2626', institutional: '#4f46e5',
};

const PROVIDER_LABELS: Record<string, string> = {
  'semantic-scholar': 'Semantic Scholar', openalex: 'OpenAlex', arxiv: 'arXiv', core: 'CORE',
  scielo: 'SciELO', redalyc: 'Redalyc', 'oer-commons': 'OER Commons', phet: 'PhET',
  youtube: 'YouTube', institutional: 'Institucional',
};

interface Props {
  asset: LibrarySearchResult | null;
  courseOptions: { value: string; label: string }[];
  onClose: () => void;
  onAddToCourse: (asset: LibrarySearchResult, courseSlug: string, targetUnit?: string) => Promise<void>;
}

export function LibraryPreviewModal({ asset, courseOptions, onClose, onAddToCourse }: Props) {
  const [copied, setCopied] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [courseSlug, setCourseSlug] = useState('');
  const [targetUnit, setTargetUnit] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  // Reset form state when a new asset opens
  useEffect(() => {
    if (asset) {
      setShowCourseForm(false);
      setCourseSlug(courseOptions[0]?.value ?? '');
      setTargetUnit('');
      setIsAdding(false);
      setAddSuccess(false);
    }
  }, [asset?.id]); // eslint-disable-line

  // Escape key
  useEffect(() => {
    if (!asset) return;
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [asset, onClose]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!asset) return;
    setIsAdding(true);
    try {
      await onAddToCourse(asset, courseSlug || courseOptions[0]?.value || '', targetUnit || undefined);
      setAddSuccess(true);
      setTimeout(() => {
        setShowCourseForm(false);
        setAddSuccess(false);
        onClose();
      }, 1200);
    } finally {
      setIsAdding(false);
    }
  }

  function copyDOI() {
    if (!asset?.doi) return;
    void navigator.clipboard.writeText(`doi:${asset.doi}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function renderEmbed(a: LibrarySearchResult) {
    if (a.previewKind === 'video' && a.embedUrl) {
      return (
        <div style={{ borderRadius: '14px', overflow: 'hidden', background: '#000', aspectRatio: '16/9', marginBottom: '20px' }}>
          <iframe src={a.embedUrl} title={a.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      );
    }
    if (a.previewKind === 'simulation' && a.embedUrl) {
      return (
        <div style={{ borderRadius: '14px', overflow: 'hidden', background: '#0f172a', aspectRatio: '16/9', marginBottom: '20px' }}>
          <iframe src={a.embedUrl} title={a.title} allow="fullscreen"
            style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      );
    }
    if (a.previewKind === 'pdf' && a.embedUrl) {
      return (
        <div style={{ borderRadius: '14px', overflow: 'hidden', height: '340px', marginBottom: '20px', background: '#f1f5f9' }}>
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(a.embedUrl)}&embedded=true`}
            title={a.title} style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      );
    }
    // Abstract fallback
    if (a.abstract) {
      return (
        <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--line)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
          <h4 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '10px' }}>
            Abstract
          </h4>
          <p style={{ fontSize: '13px', lineHeight: 1.75, color: '#475569' }}>{a.abstract}</p>
        </div>
      );
    }
    return (
      <div style={{ background: 'var(--panel-bg)', border: '1px solid var(--line)', borderRadius: '14px', padding: '32px', marginBottom: '20px', textAlign: 'center' }}>
        <BookOpen size={32} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.15, color: 'var(--muted)' }} />
        <p style={{ fontSize: '13px', color: 'var(--muted)' }}>Vista previa no disponible.</p>
      </div>
    );
  }

  return createPortal(
    <AnimatePresence>
      {asset && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1050, pointerEvents: 'none' }}>
          {/* Backdrop — subtle, grid remains visible */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'absolute', inset: 0,
              background: 'rgba(15, 23, 42, 0.22)',
              backdropFilter: 'blur(2px)',
              pointerEvents: 'auto',
            }}
          />

          {/* Side panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', right: 0, top: 0, bottom: 0,
              width: 'min(520px, 100vw)',
              background: 'white',
              display: 'flex', flexDirection: 'column',
              pointerEvents: 'auto',
              borderRadius: '20px 0 0 20px',
              boxShadow: '-24px 0 80px rgba(0,0,0,0.13), -2px 0 0 rgba(0,0,0,0.04)',
              overflow: 'hidden',
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Vista previa del recurso"
          >
            {/* ── Head ── */}
            <div style={{
              padding: '18px 20px 16px',
              borderBottom: '1px solid var(--line)',
              display: 'flex', alignItems: 'center', gap: '10px',
              flexShrink: 0,
            }}>
              {/* Provider badges */}
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', flex: 1, overflow: 'hidden' }}>
                {asset.providers.map(p => {
                  const color = PROVIDER_COLORS[p] ?? '#6b7280';
                  return (
                    <span key={p} style={{
                      fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                      padding: '3px 9px', borderRadius: '100px',
                      border: `1px solid ${color}35`, color, background: `${color}0c`,
                    }}>
                      {PROVIDER_LABELS[p] ?? p}
                    </span>
                  );
                })}
                {asset.providers.length > 1 && (
                  <span style={{
                    fontSize: '10px', fontWeight: 800, padding: '3px 9px', borderRadius: '100px',
                    border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', background: 'rgba(245,158,11,0.07)',
                  }}>
                    ✦ Multifuente
                  </span>
                )}
              </div>
              <button
                onClick={onClose}
                aria-label="Cerrar"
                style={{
                  padding: '7px', borderRadius: '10px', border: '1px solid var(--line)',
                  background: 'var(--panel-strong)', cursor: 'pointer', color: 'var(--muted)',
                  display: 'flex', flexShrink: 0, transition: 'all 150ms',
                }}
              >
                <X size={17} />
              </button>
            </div>

            {/* ── Scrollable body ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '0' }}>
              {/* Score badge */}
              {asset.score > 0 && (
                <div style={{ marginBottom: '14px' }}>
                  <span style={{
                    fontSize: '11px', fontWeight: 800,
                    padding: '4px 10px', borderRadius: '100px',
                    background: asset.score >= 0.8 ? 'rgba(16,185,129,0.08)' : asset.score >= 0.5 ? 'rgba(245,158,11,0.08)' : 'var(--panel-strong)',
                    border: `1px solid ${asset.score >= 0.8 ? 'rgba(16,185,129,0.25)' : asset.score >= 0.5 ? 'rgba(245,158,11,0.25)' : 'var(--line)'}`,
                    color: asset.score >= 0.8 ? '#10b981' : asset.score >= 0.5 ? '#f59e0b' : 'var(--muted)',
                  }}>
                    {Math.round(asset.score * 100)}% relevancia
                  </span>
                </div>
              )}

              {/* Title */}
              <h2 style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(16px, 2.5vw, 20px)',
                fontWeight: 600, lineHeight: 1.3,
                color: 'var(--ink)', marginBottom: '12px',
              }}>
                {asset.title}
              </h2>

              {/* Meta */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', fontSize: '12px', color: 'var(--muted)', alignItems: 'center' }}>
                {asset.authors.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Users size={12} style={{ opacity: 0.5 }} />
                    <span>{asset.authors.slice(0, 3).join(', ')}{asset.authors.length > 3 ? ` +${asset.authors.length - 3}` : ''}</span>
                  </div>
                )}
                {asset.publishedAt && (
                  <span style={{ padding: '2px 7px', background: 'var(--panel-strong)', borderRadius: '7px', fontWeight: 700, fontSize: '11px', color: 'var(--ink)' }}>
                    {asset.publishedAt.slice(0, 4)}
                  </span>
                )}
                {asset.openAccess && (
                  <span style={{ padding: '2px 7px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '7px', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981' }}>
                    Open Access
                  </span>
                )}
                {asset.citationCount > 0 && (
                  <span style={{ fontWeight: 600 }}>{asset.citationCount.toLocaleString()} citas</span>
                )}
                {asset.license?.label && (
                  <span style={{ padding: '2px 7px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: '7px', fontSize: '10px', fontWeight: 600, color: '#7c3aed' }}>
                    {asset.license.label}
                  </span>
                )}
              </div>

              {/* DOI */}
              {asset.doi && (
                <button
                  onClick={copyDOI}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px',
                    borderRadius: '10px', background: 'var(--panel-strong)', border: '1px solid var(--line)',
                    cursor: 'pointer', marginBottom: '16px', transition: 'all 150ms', width: '100%', textAlign: 'left',
                  }}
                >
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    doi:{asset.doi}
                  </span>
                  {copied ? <Check size={13} style={{ color: '#10b981', flexShrink: 0 }} /> : <Copy size={13} style={{ flexShrink: 0, color: 'var(--muted)' }} />}
                </button>
              )}

              {/* Tags */}
              {asset.tags.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '16px' }}>
                  {asset.tags.slice(0, 8).map(tag => (
                    <span key={tag} style={{ padding: '3px 7px', background: 'var(--panel-strong)', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '10px', fontWeight: 500, color: 'var(--muted)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Embed / Abstract */}
              {renderEmbed(asset)}
            </div>

            {/* ── Footer ── */}
            <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)' }}>

              {/* Inline Add to Course form */}
              <AnimatePresence>
                {showCourseForm && (
                  <motion.form
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    onSubmit={handleAdd}
                    style={{ overflow: 'hidden', background: 'var(--panel-bg)', borderBottom: '1px solid var(--line)' }}
                  >
                    <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--muted)' }}>
                          Selecciona curso de destino
                        </span>
                        <button type="button" onClick={() => setShowCourseForm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: '2px' }}>
                          <X size={14} />
                        </button>
                      </div>
                      <div style={{ position: 'relative' }}>
                        <select
                          value={courseSlug}
                          onChange={e => setCourseSlug(e.target.value)}
                          required
                          style={{
                            width: '100%', padding: '9px 32px 9px 12px', borderRadius: '10px',
                            border: '1px solid var(--line)', background: 'white', fontSize: '13px',
                            fontWeight: 500, color: 'var(--ink)', outline: 'none', appearance: 'none',
                            cursor: 'pointer',
                          }}
                        >
                          {courseOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                        <ChevronDown size={14} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', pointerEvents: 'none' }} />
                      </div>
                      <input
                        placeholder="Unidad / Módulo (opcional)"
                        value={targetUnit}
                        onChange={e => setTargetUnit(e.target.value)}
                        style={{
                          padding: '9px 12px', borderRadius: '10px', border: '1px solid var(--line)',
                          background: 'white', fontSize: '13px', color: 'var(--ink)', outline: 'none', width: '100%',
                        }}
                      />
                      <button
                        type="submit"
                        disabled={isAdding || addSuccess}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                          padding: '10px', borderRadius: '10px', border: 'none',
                          background: addSuccess ? '#10b981' : 'var(--ink)',
                          color: 'white', fontWeight: 700, fontSize: '13px', cursor: isAdding ? 'not-allowed' : 'pointer',
                          opacity: isAdding ? 0.75 : 1, transition: 'background 300ms',
                        }}
                      >
                        {addSuccess
                          ? <><Check size={15} /> Integrado</>
                          : isAdding
                            ? <><Loader2 size={15} style={{ animation: 'lib-spin 1s linear infinite' }} /> Integrando…</>
                            : <><PackageCheck size={15} /> Confirmar integración</>
                        }
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Action row */}
              <div style={{ padding: '14px 20px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                {asset.canonicalUrl && (
                  <a
                    href={asset.canonicalUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
                      borderRadius: '10px', border: '1.5px solid var(--line)', fontWeight: 700,
                      fontSize: '12px', color: 'var(--ink)', textDecoration: 'none', transition: 'all 150ms', flexShrink: 0,
                    }}
                  >
                    <ExternalLink size={13} /> Fuente
                  </a>
                )}
                {asset.embedUrl && asset.previewKind === 'pdf' && (
                  <a
                    href={asset.embedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 14px',
                      borderRadius: '10px', border: '1.5px solid var(--line)', fontWeight: 700,
                      fontSize: '12px', color: 'var(--ink)', textDecoration: 'none', flexShrink: 0,
                    }}
                  >
                    <Download size={13} /> PDF
                  </a>
                )}
                <button
                  onClick={() => {
                    if (!showCourseForm) {
                      setCourseSlug(courseOptions[0]?.value ?? '');
                      setTargetUnit('');
                    }
                    setShowCourseForm(v => !v);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '9px 18px', borderRadius: '10px', border: 'none',
                    background: showCourseForm ? 'var(--panel-strong)' : 'var(--ink)',
                    color: showCourseForm ? 'var(--ink)' : 'white',
                    fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginLeft: 'auto',
                    transition: 'all 200ms', flexShrink: 0,
                  }}
                >
                  {asset.previewKind === 'video' ? <Play size={14} /> : asset.previewKind === 'simulation' ? <Puzzle size={14} /> : <Plus size={14} />}
                  Añadir al curso
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
