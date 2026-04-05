import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Loader2,
  Microscope,
  Play,
  Plus,
  Puzzle,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';

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

const PROVIDER_LABELS: Record<string, { label: string; color: string }> = {
  'semantic-scholar': { label: 'Semantic Scholar', color: '#1d4ed8' },
  openalex: { label: 'OpenAlex', color: '#0f766e' },
  arxiv: { label: 'arXiv', color: '#b91c1c' },
  core: { label: 'CORE', color: '#15803d' },
  scielo: { label: 'SciELO', color: '#0ea5e9' },
  redalyc: { label: 'Redalyc', color: '#7c3aed' },
  'oer-commons': { label: 'OER Commons', color: '#d97706' },
  phet: { label: 'PhET', color: '#0891b2' },
  youtube: { label: 'YouTube', color: '#dc2626' },
  institutional: { label: 'Institucional', color: '#4f46e5' },
};

export function LibraryPreviewModal({
  asset,
  onClose,
  courseOptions,
  onAddToCourse,
}: LibraryPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(courseOptions[0]?.value ?? '');
  const [targetUnit, setTargetUnit] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);

  const providerCfg = asset
    ? (PROVIDER_LABELS[asset.provider] ?? { label: asset.provider, color: '#6b7280' })
    : { label: '', color: '#6b7280' };

  function copyDOI() {
    if (!asset?.doi) return;
    void navigator.clipboard.writeText(asset.doi).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!asset || !selectedCourse) return;
    setIsAdding(true);
    try {
      await onAddToCourse(asset, selectedCourse, targetUnit || undefined);
      setAddSuccess(true);
      setTimeout(() => {
        setShowCourseForm(false);
        setAddSuccess(false);
        onClose();
      }, 1400);
    } finally {
      setIsAdding(false);
    }
  }

  function renderEmbedPreview() {
    if (!asset) return null;

    if (asset.previewKind === 'video' && asset.embedUrl) {
      return (
        <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-xl">
          <iframe
            src={asset.embedUrl}
            className="w-full h-full"
            title={asset.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }

    if (asset.previewKind === 'simulation' && asset.embedUrl) {
      return (
        <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-video shadow-xl">
          <iframe
            src={asset.embedUrl}
            className="w-full h-full"
            title={asset.title}
            allow="fullscreen"
          />
        </div>
      );
    }

    if (asset.previewKind === 'pdf' && asset.embedUrl) {
      return (
        <div className="rounded-2xl overflow-hidden bg-gray-100 shadow-inner" style={{ height: 360 }}>
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(asset.embedUrl)}&embedded=true`}
            className="w-full h-full"
            title={`Preview: ${asset.title}`}
          />
        </div>
      );
    }

    return null;
  }

  const panel = (
    <AnimatePresence>
      {asset && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 400,
              background: 'rgba(15,23,42,0.22)',
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
          />

          {/* Panel */}
          <motion.div
            key="panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            style={{
              position: 'fixed',
              top: 0,
              right: 0,
              bottom: 0,
              width: 'min(540px, 100vw)',
              zIndex: 401,
              background: 'white',
              borderRadius: '20px 0 0 20px',
              boxShadow: '-24px 0 80px rgba(0,0,0,0.13)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ──────────────────────────────────────────────── */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <div className="flex items-start gap-3">
                <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                  {asset.providers.map((p) => {
                    const cfg = PROVIDER_LABELS[p] ?? { label: p, color: '#6b7280' };
                    return (
                      <span
                        key={p}
                        className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border"
                        style={{ color: cfg.color, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}10` }}
                      >
                        {cfg.label}
                      </span>
                    );
                  })}
                  {asset.providers.length > 1 && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-200">
                      ✦ Multifuente
                    </span>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* ── Body (scrollable) ────────────────────────────────────── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }} className="space-y-6">

              {/* Title & meta */}
              <div>
                <h2 className="text-2xl font-bold leading-tight text-ink mb-3 font-display">
                  {asset.title}
                </h2>

                <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
                  {asset.authors.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Users size={13} className="text-muted" />
                      <span className="text-xs">
                        {asset.authors.slice(0, 3).join(', ')}
                        {asset.authors.length > 3 ? ` +${asset.authors.length - 3}` : ''}
                      </span>
                    </div>
                  )}
                  {asset.publishedAt && (
                    <span className="px-2 py-0.5 bg-slate-100 rounded-lg font-semibold text-xs text-slate-600">
                      {asset.publishedAt.slice(0, 4)}
                    </span>
                  )}
                  {asset.openAccess && (
                    <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[10px] uppercase tracking-widest">
                      Open Access
                    </span>
                  )}
                  {asset.citationCount > 0 && (
                    <div className="flex items-center gap-1 text-xs text-muted">
                      <Microscope size={12} />
                      <span>{asset.citationCount.toLocaleString()} citas</span>
                    </div>
                  )}
                  {asset.license?.label && (
                    <span className="px-2 py-0.5 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg font-semibold text-xs">
                      {asset.license.label}
                    </span>
                  )}
                </div>

                {asset.doi && (
                  <div className="flex items-center gap-2 mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <FileText size={13} className="text-muted flex-shrink-0" />
                    <span className="text-xs text-slate-500 font-mono truncate flex-1">doi:{asset.doi}</span>
                    <button
                      onClick={copyDOI}
                      className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-muted hover:text-ink flex-shrink-0"
                      title="Copiar DOI"
                    >
                      {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                    </button>
                  </div>
                )}

                {asset.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {asset.tags.slice(0, 8).map((tag) => (
                      <span key={tag} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[11px] font-medium">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── AI Summary ──────────────────────────────────────────── */}
              {asset.abstract && (
                <div
                  className="rounded-2xl p-5 border"
                  style={{
                    background: `linear-gradient(135deg, ${providerCfg.color}06 0%, transparent 60%)`,
                    borderColor: `${providerCfg.color}20`,
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="p-1.5 rounded-lg"
                      style={{ backgroundColor: `${providerCfg.color}15` }}
                    >
                      <Sparkles size={14} style={{ color: providerCfg.color }} />
                    </div>
                    <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: providerCfg.color }}>
                      Resumen del recurso
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-slate-700">
                    {asset.abstract}
                  </p>
                </div>
              )}

              {/* ── Embed preview ────────────────────────────────────────── */}
              {renderEmbedPreview()}

              {/* Fallback if no abstract and no embed */}
              {!asset.abstract && !asset.embedUrl && (
                <div className="py-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-slate-100">
                  <Globe size={36} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Vista previa no disponible. Abre el enlace externo para leer el recurso.</p>
                </div>
              )}

              {/* ── Institutional info ───────────────────────────────────── */}
              {asset.institutionName && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <Layers size={14} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-indigo-700">{asset.institutionName}</span>
                  {asset.visibility === 'Institucional' && (
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                      Privado
                    </span>
                  )}
                </div>
              )}

              {/* ── Inline Add to Course form ────────────────────────────── */}
              <AnimatePresence>
                {showCourseForm && (
                  <motion.div
                    key="course-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    style={{ overflow: 'hidden' }}
                  >
                    {addSuccess ? (
                      <div className="flex flex-col items-center gap-3 py-6 bg-emerald-50 border border-emerald-200 rounded-2xl">
                        <CheckCircle2 size={36} className="text-emerald-500" />
                        <div className="text-sm font-bold text-emerald-700">¡Recurso integrado al curso!</div>
                      </div>
                    ) : (
                      <form
                        onSubmit={handleAddSubmit}
                        className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3"
                      >
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Vincular al curso
                        </div>

                        <div className="relative">
                          <select
                            className="w-full bg-white border border-slate-200 text-sm rounded-xl py-2.5 px-3 pr-8 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 appearance-none text-ink"
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                            required
                          >
                            {courseOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>

                        <input
                          type="text"
                          className="w-full bg-white border border-slate-200 text-sm rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300 placeholder:text-slate-400"
                          placeholder="Unidad / Módulo (opcional)"
                          value={targetUnit}
                          onChange={(e) => setTargetUnit(e.target.value)}
                        />

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowCourseForm(false)}
                            className="flex-1 py-2.5 px-4 rounded-xl text-sm font-bold border border-slate-200 text-slate-500 hover:bg-slate-100 transition-all"
                          >
                            Cancelar
                          </button>
                          <button
                            type="submit"
                            disabled={isAdding || !selectedCourse}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-bold bg-ink text-white hover:bg-ocean transition-all disabled:opacity-60 shadow-lg"
                          >
                            {isAdding ? (
                              <Loader2 size={15} className="animate-spin" />
                            ) : (
                              <Check size={15} />
                            )}
                            <span>{isAdding ? 'Integrando…' : 'Integrar'}</span>
                          </button>
                        </div>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer ──────────────────────────────────────────────── */}
            <div
              style={{ padding: '16px 24px', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}
              className="flex items-center gap-2 flex-wrap"
            >
              {asset.canonicalUrl && (
                <a
                  href={asset.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line font-bold text-sm text-ink hover:border-ink hover:bg-ink hover:text-white transition-all"
                >
                  <ExternalLink size={15} />
                  <span>Ver fuente</span>
                </a>
              )}

              {asset.embedUrl && (asset.previewKind === 'pdf' || asset.previewKind === 'external-link') && (
                <a
                  href={asset.embedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-line font-bold text-sm text-ink hover:border-ink hover:bg-ink hover:text-white transition-all"
                >
                  <Download size={15} />
                  <span>PDF</span>
                </a>
              )}

              <button
                onClick={() => {
                  setShowCourseForm((v) => !v);
                  setAddSuccess(false);
                }}
                disabled={courseOptions.length === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm ml-auto transition-all shadow-lg active:scale-95 disabled:opacity-40"
                style={{ backgroundColor: showCourseForm ? '#64748b' : 'var(--ink, #0f172a)', color: 'white' }}
              >
                {asset.previewKind === 'video' ? (
                  <Play size={15} />
                ) : asset.previewKind === 'simulation' ? (
                  <Puzzle size={15} />
                ) : (
                  <Plus size={15} />
                )}
                <span>{showCourseForm ? 'Cancelar' : 'Añadir al curso'}</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(panel, document.body);
}
