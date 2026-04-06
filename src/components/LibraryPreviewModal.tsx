import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Layers,
  Loader2,
  Microscope,
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

function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const r = 18;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(score, 1));
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626';

  return (
    <div className="flex items-center gap-2">
      <div style={{ position: 'relative', width: 48, height: 48, flexShrink: 0 }}>
        <svg width="48" height="48" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
          <circle cx="24" cy="24" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
          <circle
            cx="24" cy="24" r={r} fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={circ}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 900, color }}>{pct}%</span>
        </div>
      </div>
      <div>
        <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Puntuación</div>
        <div className="text-xs font-bold" style={{ color }}>de Madurez</div>
      </div>
    </div>
  );
}

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
              position: 'fixed', inset: 0, zIndex: 400,
              background: 'rgba(15,23,42,0.25)',
              backdropFilter: 'blur(3px)',
              WebkitBackdropFilter: 'blur(3px)',
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
              position: 'fixed', top: 0, right: 0, bottom: 0,
              width: 'min(480px, 100vw)',
              zIndex: 401,
              background: '#f8fafc',
              borderRadius: '20px 0 0 20px',
              boxShadow: '-32px 0 80px rgba(0,0,0,0.18)',
              display: 'flex', flexDirection: 'column', overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ── */}
            <div style={{ padding: '18px 20px 14px', background: 'white', borderBottom: '1px solid #f1f5f9', flexShrink: 0 }}>
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">
                    Detalles del Recurso
                  </div>
                  <h2 className="text-sm font-bold text-ink leading-snug line-clamp-2 font-display">
                    {asset.title}
                  </h2>
                </div>
                <button
                  onClick={onClose}
                  className="flex-shrink-0 p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Provider + badges */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                {asset.providers.map((p) => {
                  const cfg = PROVIDER_LABELS[p] ?? { label: p, color: '#6b7280' };
                  return (
                    <span
                      key={p}
                      className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border"
                      style={{ color: cfg.color, borderColor: `${cfg.color}40`, backgroundColor: `${cfg.color}10` }}
                    >
                      {cfg.label}
                    </span>
                  );
                })}
                {asset.openAccess && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                    Open Access
                  </span>
                )}
              </div>
            </div>

            {/* ── Body (scrollable) ── */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }} className="space-y-3">

              {/* ── AI Summary block (gradient purple→blue) ── */}
              {asset.abstract && (
                <div
                  className="rounded-2xl p-5"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 40%, #2563eb 100%)',
                    color: 'white',
                  }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 bg-white/20 rounded-lg">
                      <Sparkles size={14} className="text-white" />
                    </div>
                    <span className="text-xs font-black uppercase tracking-widest text-white/90">
                      Resumen de IA
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-white/90">
                    {asset.abstract.slice(0, 320)}{asset.abstract.length > 320 ? '…' : ''}
                  </p>
                </div>
              )}

              {/* ── Metadata card ── */}
              <div className="bg-white rounded-2xl p-4 space-y-3" style={{ border: '1px solid #f1f5f9' }}>
                {/* Score ring */}
                <ScoreRing score={asset.score} />

                <div
                  className="grid grid-cols-2 gap-3 pt-3"
                  style={{ borderTop: '1px solid #f8fafc' }}
                >
                  <div>
                    <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Fuente</div>
                    <div className="text-xs font-bold" style={{ color: providerCfg.color }}>{providerCfg.label}</div>
                  </div>
                  {asset.publishedAt && (
                    <div>
                      <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-0.5">Fecha</div>
                      <div className="text-xs font-semibold text-ink">{asset.publishedAt.slice(0, 10)}</div>
                    </div>
                  )}
                  {asset.authors.length > 0 && (
                    <div className="col-span-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Users size={10} className="text-muted" />
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Autores</span>
                      </div>
                      <div className="text-xs text-ink leading-relaxed">
                        {asset.authors.slice(0, 3).join(', ')}{asset.authors.length > 3 ? ` +${asset.authors.length - 3}` : ''}
                      </div>
                    </div>
                  )}
                  {asset.citationCount > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-0.5">
                        <Microscope size={10} className="text-muted" />
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Citas</span>
                      </div>
                      <div className="text-xs font-bold text-ink">{asset.citationCount.toLocaleString()}</div>
                    </div>
                  )}
                </div>

                {/* DOI */}
                {asset.doi && (
                  <div
                    className="flex items-center gap-2 p-2.5 bg-slate-50 rounded-xl"
                    style={{ borderTop: '1px solid #f1f5f9' }}
                  >
                    <FileText size={12} className="text-muted flex-shrink-0" />
                    <span className="text-[10px] text-slate-500 font-mono truncate flex-1">doi:{asset.doi}</span>
                    <button
                      onClick={copyDOI}
                      className="p-1 hover:bg-slate-200 rounded-lg transition-colors text-muted"
                      title="Copiar DOI"
                    >
                      {copied ? <Check size={11} className="text-emerald-600" /> : <Copy size={11} />}
                    </button>
                  </div>
                )}
              </div>

              {/* Tags */}
              {asset.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {asset.tags.slice(0, 8).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 bg-white text-slate-500 rounded-md text-[10px] font-medium border border-line/30">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Embed (video/sim/pdf) */}
              {asset.previewKind === 'video' && asset.embedUrl && (
                <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-lg">
                  <iframe
                    src={asset.embedUrl}
                    className="w-full h-full"
                    title={asset.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              )}
              {asset.previewKind === 'simulation' && asset.embedUrl && (
                <div className="rounded-2xl overflow-hidden bg-slate-900 aspect-video shadow-lg">
                  <iframe src={asset.embedUrl} className="w-full h-full" title={asset.title} allow="fullscreen" />
                </div>
              )}

              {/* Institutional */}
              {asset.institutionName && (
                <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <Layers size={13} className="text-indigo-500 flex-shrink-0" />
                  <span className="text-xs font-semibold text-indigo-700">{asset.institutionName}</span>
                </div>
              )}

              {/* Inline course form */}
              <AnimatePresence>
                {showCourseForm && (
                  <motion.div
                    key="course-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    style={{ overflow: 'hidden' }}
                  >
                    {addSuccess ? (
                      <div className="flex flex-col items-center gap-2 py-5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                        <div className="text-sm font-bold text-emerald-700">¡Recurso vinculado al curso!</div>
                      </div>
                    ) : (
                      <form onSubmit={handleAddSubmit} className="p-4 bg-white border border-slate-200 rounded-2xl space-y-2.5">
                        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                          Seleccionar curso
                        </div>
                        <div className="relative">
                          <select
                            className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl py-2.5 px-3 pr-8 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 appearance-none text-ink"
                            value={selectedCourse}
                            onChange={(e) => setSelectedCourse(e.target.value)}
                            required
                          >
                            {courseOptions.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                          <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <input
                          type="text"
                          className="w-full bg-slate-50 border border-slate-200 text-sm rounded-xl py-2.5 px-3 outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 placeholder:text-slate-400"
                          placeholder="Unidad / Módulo (opcional)"
                          value={targetUnit}
                          onChange={(e) => setTargetUnit(e.target.value)}
                        />
                        <button
                          type="submit"
                          disabled={isAdding || !selectedCourse}
                          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition-all disabled:opacity-60 shadow"
                        >
                          {isAdding ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          <span>{isAdding ? 'Vinculando…' : 'Confirmar'}</span>
                        </button>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* ── Footer CTAs ── */}
            <div
              style={{ padding: '16px 16px 20px', background: 'white', borderTop: '1px solid #f1f5f9', flexShrink: 0 }}
              className="space-y-2.5"
            >
              <button
                onClick={() => { setShowCourseForm((v) => !v); setAddSuccess(false); }}
                disabled={courseOptions.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-[0.98] disabled:opacity-40"
                style={{
                  background: showCourseForm
                    ? 'linear-gradient(135deg, #475569, #334155)'
                    : 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                  color: 'white',
                }}
              >
                <span>{showCourseForm ? '✕ Cancelar' : '🔗 Vincular a mi Curso Actual'}</span>
              </button>

              {asset.canonicalUrl && (
                <a
                  href={asset.canonicalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all border-2 border-line hover:border-ink hover:bg-ink hover:text-white text-ink"
                >
                  <ExternalLink size={15} />
                  <span>Abrir Original</span>
                </a>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return createPortal(panel, document.body);
}
