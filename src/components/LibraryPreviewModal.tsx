import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Sparkles,
  Users,
} from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';
import { SidePanel } from './SidePanel.js';

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

// Derive "Compatibilidad de madures" metrics from the asset score
function getCompatMetrics(score: number) {
  const s = Math.min(score, 0.99);
  return [
    { label: 'Relevancia temática',      pct: Math.round(Math.min(s * 1.05, 0.99) * 100) },
    { label: 'Nivel de complejidad',     pct: Math.round(Math.min(s * 0.98, 0.99) * 100) },
    { label: 'Compatibilidad de fuente', pct: Math.round(Math.min(s * 1.02, 0.99) * 100) },
    { label: 'Densidad conceptual',      pct: Math.round(Math.min(s * 0.95, 0.99) * 100) },
    { label: 'Actualidad del contenido', pct: Math.round(Math.min(s * 0.92, 0.99) * 100) },
  ];
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

  return (
    <SidePanel
      isOpen={!!asset}
      onClose={onClose}
      title={asset?.title || 'Detalles del recurso'}
      description="Previsualización y vinculación de contenido inteligente."
      sideLabel="RECURSO"
      sideDescription={providerCfg.label}
      width="lg"
      footer={
        asset ? (
          <div className="flex flex-col gap-2.5 w-full">
            <button
              onClick={() => { setShowCourseForm((v) => !v); setAddSuccess(false); }}
              disabled={courseOptions.length === 0}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all shadow-lg active:scale-[0.98] disabled:opacity-40"
              style={{
                background: showCourseForm
                  ? 'linear-gradient(135deg, #475569, #334155)'
                  : 'linear-gradient(135deg, #0d9488 0%, #0891b2 100%)',
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
        ) : null
      }
    >
      {asset && (
        <div className="space-y-4">
          {/* Provider + badges */}
          <div className="flex flex-wrap gap-1.5">
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
            {asset.openAccess && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Open Access
              </span>
            )}
          </div>

          {/* ── AI Summary block ── */}
          {asset.abstract && (
            <div
              className="rounded-2xl p-6"
              style={{
                background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 40%, #2563eb 100%)',
                color: 'white',
                boxShadow: '0 20px 40px rgba(79, 70, 229, 0.15)',
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-white/20 rounded-lg">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest text-white/90">
                    Resumen de IA
                  </span>
                </div>
                <span className="text-[9px] font-bold bg-white/20 px-2 py-0.5 rounded-full text-white/80">
                  Chispa/IA
                </span>
              </div>
              <p className="text-sm leading-relaxed text-white/95 mb-6">
                {asset.abstract.slice(0, 480)}{asset.abstract.length > 480 ? '…' : ''}
              </p>

              {/* Compatibilidad de madures */}
              <div className="border-t border-white/20 pt-4 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-widest text-white/60 mb-3">
                  Compatibilidad de madures
                </div>
                {getCompatMetrics(asset.score).map((m) => (
                  <div key={m.label} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/80 flex-1 truncate">· {m.label}</span>
                    <span className="text-xs font-bold text-white/90 flex-shrink-0">{m.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Metadata card ── */}
          <div className="bg-white rounded-2xl p-5 space-y-4 border border-slate-100 shadow-sm">
            <ScoreRing score={asset.score} />

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-50">
              <div>
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Fuente</div>
                <div className="text-xs font-bold" style={{ color: providerCfg.color }}>{providerCfg.label}</div>
              </div>
              {asset.publishedAt && (
                <div>
                  <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1">Fecha</div>
                  <div className="text-xs font-semibold text-ink">{asset.publishedAt.slice(0, 10)}</div>
                </div>
              )}
              {asset.authors.length > 0 && (
                <div className="col-span-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    <Users size={12} className="text-muted" />
                    <span className="text-[10px] font-bold text-muted uppercase tracking-wider">Autores</span>
                  </div>
                  <div className="text-xs text-ink leading-relaxed font-medium">
                    {asset.authors.slice(0, 5).join(', ')}{asset.authors.length > 5 ? ` +${asset.authors.length - 5}` : ''}
                  </div>
                </div>
              )}
            </div>

            {/* DOI */}
            {asset.doi && (
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <FileText size={14} className="text-muted flex-shrink-0" />
                <span className="text-[11px] text-slate-500 font-mono truncate flex-1">doi:{asset.doi}</span>
                <button
                  onClick={copyDOI}
                  className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-muted"
                  title="Copiar DOI"
                >
                  {copied ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                </button>
              </div>
            )}
          </div>

          {/* Embeds */}
          {asset.previewKind === 'video' && asset.embedUrl && (
            <div className="rounded-2xl overflow-hidden bg-black aspect-video shadow-xl border border-slate-200">
              <iframe
                src={asset.embedUrl}
                className="w-full h-full"
                title={asset.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Inline course form */}
          <AnimatePresence>
            {showCourseForm && (
              <motion.div
                key="course-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="pt-2"
              >
                {addSuccess ? (
                  <div className="flex flex-col items-center gap-3 py-6 bg-emerald-50 border border-emerald-200 rounded-2xl text-center">
                    <CheckCircle2 size={40} className="text-emerald-500" />
                    <div className="text-sm font-bold text-emerald-700">¡Recurso vinculado con éxito!</div>
                  </div>
                ) : (
                  <form onSubmit={handleAddSubmit} className="p-5 bg-slate-50 border border-slate-200 rounded-2xl space-y-3.5">
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Vinculación institucional
                    </div>
                    <div className="relative">
                      <select
                        className="w-full bg-white border border-slate-200 text-sm rounded-xl py-3 px-4 pr-10 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 appearance-none text-ink font-semibold"
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        required
                      >
                        {courseOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                    <input
                      type="text"
                      className="w-full bg-white border border-slate-200 text-sm rounded-xl py-3 px-4 outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 placeholder:text-slate-400 font-medium"
                      placeholder="Nombre de la unidad o sección (opcional)"
                      value={targetUnit}
                      onChange={(e) => setTargetUnit(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={isAdding || !selectedCourse}
                      className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-60 shadow-lg active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}
                    >
                      {isAdding ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                      <span>{isAdding ? 'Sincronizando…' : 'Finalizar Vinculación'}</span>
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </SidePanel>
  );
}
