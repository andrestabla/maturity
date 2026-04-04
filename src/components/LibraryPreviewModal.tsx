import { useState } from 'react';
import {
  BookOpen,
  ExternalLink,
  FileText,
  Globe,
  Layers,
  Play,
  Puzzle,
  Users,
  X,
  Download,
  Copy,
  Check,
  Microscope,
} from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';

interface LibraryPreviewModalProps {
  asset: LibrarySearchResult | null;
  onClose: () => void;
  onAddToCourse: (asset: LibrarySearchResult) => void;
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

export function LibraryPreviewModal({ asset, onClose, onAddToCourse }: LibraryPreviewModalProps) {
  const [copied, setCopied] = useState(false);

  if (!asset) return null;

  const providerCfg = PROVIDER_LABELS[asset.provider] ?? { label: asset.provider, color: '#6b7280' };

  function copyDOI() {
    if (!asset?.doi) return;
    void navigator.clipboard.writeText(asset.doi).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function renderPreviewContent() {
    if (!asset) return null;

    switch (asset.previewKind) {
      case 'video':
        if (asset.embedUrl) {
          return (
            <div className="library-preview__embed rounded-2xl overflow-hidden bg-black aspect-video shadow-2xl">
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
        break;

      case 'simulation':
        if (asset.embedUrl) {
          return (
            <div className="library-preview__embed rounded-2xl overflow-hidden bg-slate-900 aspect-video shadow-2xl">
              <iframe
                src={asset.embedUrl}
                className="w-full h-full"
                title={asset.title}
                allow="fullscreen"
              />
            </div>
          );
        }
        break;

      case 'pdf':
        if (asset.embedUrl) {
          return (
            <div className="library-preview__embed rounded-2xl overflow-hidden bg-gray-100 shadow-inner" style={{ height: 480 }}>
              <iframe
                src={`https://docs.google.com/viewer?url=${encodeURIComponent(asset.embedUrl)}&embedded=true`}
                className="w-full h-full"
                title={`Preview: ${asset.title}`}
              />
            </div>
          );
        }
        break;

      default:
        break;
    }

    // Fallback: rich text preview
    return (
      <div className="library-preview__text-fallback bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8 border border-slate-200">
        <div className="flex items-center gap-3 mb-6 pb-6 border-b border-slate-200">
          <div className="p-3 rounded-xl" style={{ backgroundColor: `${providerCfg.color}15` }}>
            <BookOpen size={24} style={{ color: providerCfg.color }} />
          </div>
          <div>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: providerCfg.color }}>
              {providerCfg.label}
            </span>
            <p className="text-sm text-slate-500 mt-0.5">{asset.resourceType}</p>
          </div>
        </div>

        {asset.abstract ? (
          <div>
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Abstract / Resumen</h4>
            <p className="text-sm leading-relaxed text-slate-700">{asset.abstract}</p>
          </div>
        ) : (
          <div className="text-center py-8 text-slate-400">
            <Globe size={40} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Vista previa no disponible. Abre el enlace externo para leer el recurso.</p>
          </div>
        )}
      </div>
    );
  }

  const yearLabel = asset.publishedAt ? asset.publishedAt.slice(0, 4) : null;
  const multiSource = asset.providers.length > 1;

  return (
    <div className="library-preview-overlay" onClick={onClose} role="dialog" aria-modal aria-label="Vista previa del recurso">
      <div
        className="library-preview-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="library-preview-panel__head">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Provider badges */}
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
            {multiSource && (
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-gold/10 text-gold border border-gold/30">
                ✦ Multifuente
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors ml-auto flex-shrink-0"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="library-preview-panel__body">
          {/* Title & metadata */}
          <div className="mb-6">
            <h2 className="text-2xl font-bold leading-tight text-ink mb-3 font-display">
              {asset.title}
            </h2>

            {/* Meta row */}
            <div className="flex flex-wrap items-center gap-4 text-sm text-secondary">
              {asset.authors.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <Users size={14} className="text-muted" />
                  <span>{asset.authors.slice(0, 3).join(', ')}{asset.authors.length > 3 ? ` +${asset.authors.length - 3}` : ''}</span>
                </div>
              )}
              {yearLabel && (
                <span className="px-2 py-0.5 bg-slate-100 rounded-lg font-semibold text-xs text-slate-600">{yearLabel}</span>
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

            {/* DOI row */}
            {asset.doi && (
              <div className="flex items-center gap-2 mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                <FileText size={14} className="text-muted flex-shrink-0" />
                <span className="text-xs text-slate-500 font-mono truncate flex-1">doi:{asset.doi}</span>
                <button
                  onClick={copyDOI}
                  className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors text-muted hover:text-ink flex-shrink-0"
                  title="Copiar DOI"
                >
                  {copied ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                </button>
              </div>
            )}

            {/* Tags */}
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

          {/* Preview content */}
          {renderPreviewContent()}

          {/* Institutional info */}
          {asset.institutionName && (
            <div className="flex items-center gap-2 p-3 bg-indigo-50 border border-indigo-100 rounded-xl mt-4">
              <Layers size={14} className="text-indigo-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-indigo-700">{asset.institutionName}</span>
              {asset.visibility === 'Institucional' && (
                <span className="ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 bg-indigo-100 text-indigo-600 rounded-full">
                  Privado
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="library-preview-panel__foot">
          {asset.canonicalUrl && (
            <a
              href={asset.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-line font-bold text-sm text-ink hover:border-ink hover:bg-ink hover:text-white transition-all"
            >
              <ExternalLink size={16} />
              <span>Ver fuente</span>
            </a>
          )}

          {asset.embedUrl && (asset.previewKind === 'pdf' || asset.previewKind === 'external-link') && (
            <a
              href={asset.embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-5 py-3 rounded-xl border-2 border-line font-bold text-sm text-ink hover:border-ink hover:bg-ink hover:text-white transition-all"
            >
              <Download size={16} />
              <span>PDF</span>
            </a>
          )}

          <button
            onClick={() => onAddToCourse(asset)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-ink text-white font-bold text-sm ml-auto hover:bg-ocean transition-all shadow-lg active:scale-95"
          >
            {asset.previewKind === 'video' ? <Play size={16} /> : asset.previewKind === 'simulation' ? <Puzzle size={16} /> : <BookOpen size={16} />}
            <span>Añadir al curso</span>
          </button>
        </div>
      </div>
    </div>
  );
}
