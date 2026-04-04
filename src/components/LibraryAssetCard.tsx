import { BookOpen, ExternalLink, Eye, Layers, Microscope, Play, Plus, Puzzle, Star, Users } from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';

interface LibraryAssetCardProps {
  asset: LibrarySearchResult;
  onAddToCourse: (asset: LibrarySearchResult) => void;
  onPreview: (asset: LibrarySearchResult) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string, selected: boolean) => void;
}

const PROVIDER_COLORS: Record<string, string> = {
  'semantic-scholar': '#1d4ed8',
  openalex: '#0f766e',
  arxiv: '#b91c1c',
  core: '#15803d',
  scielo: '#0ea5e9',
  redalyc: '#7c3aed',
  'oer-commons': '#d97706',
  phet: '#0891b2',
  youtube: '#dc2626',
  institutional: '#4f46e5',
};

const PROVIDER_SHORT: Record<string, string> = {
  'semantic-scholar': 'SS',
  openalex: 'OA',
  arxiv: 'arXiv',
  core: 'CORE',
  scielo: 'SciELO',
  redalyc: 'RDALYC',
  'oer-commons': 'OER',
  phet: 'PhET',
  youtube: 'YT',
  institutional: 'INST',
};

const PREVIEW_ICONS: Record<string, React.ElementType> = {
  video: Play,
  simulation: Puzzle,
  pdf: BookOpen,
  article: BookOpen,
  paper: BookOpen,
  'external-link': ExternalLink,
};

export function LibraryAssetCard({
  asset,
  onAddToCourse,
  onPreview,
  isSelected = false,
  onToggleSelect,
}: LibraryAssetCardProps) {
  const primaryColor = PROVIDER_COLORS[asset.provider] ?? '#6b7280';
  const isInstitutional = asset.visibility === 'Institucional';
  const isVideo = asset.previewKind === 'video';
  const isSim = asset.previewKind === 'simulation';
  const PreviewIcon = PREVIEW_ICONS[asset.previewKind] ?? ExternalLink;
  const multiSource = asset.providers.length > 1;
  const yearLabel = asset.publishedAt ? asset.publishedAt.slice(0, 4) : null;

  return (
    <article
      className={`library-card group flex flex-col h-full transition-all rounded-2xl overflow-hidden relative cursor-pointer ${
        isSelected
          ? 'ring-2 ring-ocean shadow-lg shadow-ocean/10 bg-ocean/3'
          : 'hover:shadow-2xl hover:-translate-y-0.5'
      }`}
      onClick={() => onPreview(asset)}
    >
      {/* Thumbnail or color header */}
      <div
        className="library-card__thumb relative overflow-hidden flex-shrink-0"
        style={{ height: 100, backgroundColor: `${primaryColor}15` }}
      >
        {asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt={asset.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center opacity-20">
            <PreviewIcon size={36} style={{ color: primaryColor }} />
          </div>
        )}

        {/* Type overlay for video/sim */}
        {(isVideo || isSim) && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
            <div className="bg-white/90 p-2.5 rounded-full shadow-lg">
              <PreviewIcon size={22} style={{ color: primaryColor }} />
            </div>
          </div>
        )}

        {/* Multi-source badge */}
        {multiSource && (
          <div className="absolute top-2 left-2 bg-gold text-ink text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md shadow">
            ×{asset.providers.length}
          </div>
        )}

        {/* Open access badge */}
        {asset.openAccess && (
          <div className="absolute top-2 right-2 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md shadow">
            OA
          </div>
        )}

        {/* Institutional lock */}
        {isInstitutional && (
          <div className="absolute top-2 right-2 bg-indigo-600 text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md shadow">
            🔒 INST
          </div>
        )}

        {/* Checkbox */}
        <div
          className="absolute bottom-2 left-2 z-10"
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(asset.id, !isSelected); }}
        >
          <input
            type="checkbox"
            className="w-4 h-4 rounded border-white/60 text-ocean focus:ring-ocean accent-ocean cursor-pointer shadow"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onToggleSelect?.(asset.id, e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Seleccionar recurso"
          />
        </div>
      </div>

      {/* Content */}
      <div className="library-card__body flex flex-col flex-grow p-3 bg-white border border-t-0 border-line/20 rounded-b-2xl">
        {/* Provider row */}
        <div className="flex items-center justify-between gap-1 mb-2">
          <span
            className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded truncate max-w-[70%]"
            style={{ color: primaryColor, backgroundColor: `${primaryColor}15` }}
          >
            {PROVIDER_SHORT[asset.provider] ?? asset.provider}
          </span>
          <div className="flex items-center gap-0.5 text-[10px] font-bold text-gold flex-shrink-0">
            <Star size={9} fill="currentColor" />
            <span>{asset.score.toFixed(1)}</span>
          </div>
        </div>

        {/* Title */}
        <strong className="library-card__title block text-[13px] leading-snug text-ink font-bold line-clamp-2 mb-1.5 flex-grow group-hover:text-ocean transition-colors">
          {asset.title}
        </strong>

        {/* Authors */}
        {asset.authors.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted overflow-hidden mb-1">
            <Users size={9} className="shrink-0 flex-shrink-0" />
            <span className="truncate">{asset.authors[0]}{asset.authors.length > 1 ? ` +${asset.authors.length - 1}` : ''}</span>
          </div>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1">
          {yearLabel && (
            <span className="text-[10px] text-muted font-medium">{yearLabel}</span>
          )}
          {asset.citationCount > 0 && (
            <div className="flex items-center gap-0.5 text-[10px] text-muted">
              <Microscope size={9} />
              <span>{asset.citationCount > 999 ? `${(asset.citationCount / 1000).toFixed(1)}k` : asset.citationCount}</span>
            </div>
          )}
          {asset.language && asset.language !== 'en' && (
            <span className="text-[9px] font-bold uppercase px-1 py-0.5 bg-slate-100 text-slate-500 rounded">{asset.language}</span>
          )}
          <div className="ml-auto flex items-center gap-0.5">
            <Layers size={9} className="text-muted" />
            <span className="text-[9px] text-muted capitalize truncate max-w-[60px]">{asset.resourceType}</span>
          </div>
        </div>

        {/* Actions */}
        <div
          className="library-card__actions flex items-center gap-1 mt-2 pt-2 border-t border-line/10"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onPreview(asset); }}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-slate-100 text-muted hover:text-ink transition-colors text-[10px] font-bold"
            title="Vista previa"
          >
            <Eye size={12} />
            <span>Preview</span>
          </button>

          {asset.canonicalUrl && (
            <a
              href={asset.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-slate-100 text-muted hover:text-ink rounded-lg transition-colors"
              title="Ver fuente"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={12} />
            </a>
          )}

          <button
            type="button"
            className="ml-auto p-1.5 bg-ink text-white hover:bg-ocean rounded-lg transition-all shadow-sm active:scale-90"
            onClick={(e) => { e.stopPropagation(); onAddToCourse(asset); }}
            title="Añadir al curso"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>
    </article>
  );
}
