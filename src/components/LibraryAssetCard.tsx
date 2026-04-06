import { ExternalLink, Eye } from 'lucide-react';
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

const PROVIDER_LABELS: Record<string, string> = {
  'semantic-scholar': 'Semantic Scholar',
  openalex: 'OpenAlex',
  arxiv: 'arXiv',
  core: 'CORE',
  scielo: 'SciELO',
  redalyc: 'Redalyc',
  'oer-commons': 'OER',
  phet: 'PhET',
  youtube: 'YouTube',
  institutional: 'Institucional',
};

// Provider monogram logos
const PROVIDER_LOGOS: Record<string, string> = {
  'semantic-scholar': 'SS',
  openalex: 'OA',
  arxiv: 'arXiv',
  core: 'CORE',
  scielo: 'SC',
  redalyc: 'RD',
  'oer-commons': 'OER',
  phet: 'PhET',
  youtube: '▶',
  institutional: 'INST',
};

function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const r = 13;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(score, 1));
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626';

  return (
    <div style={{ position: 'relative', width: 38, height: 38, flexShrink: 0 }}>
      <svg width="38" height="38" style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
        <circle cx="19" cy="19" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
        <circle
          cx="19" cy="19" r={r} fill="none"
          stroke={color} strokeWidth="2.5"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 9, fontWeight: 900, color, lineHeight: 1 }}>{pct}%</span>
      </div>
    </div>
  );
}

export function LibraryAssetCard({
  asset,
  onAddToCourse,
  onPreview,
  isSelected = false,
  onToggleSelect,
}: LibraryAssetCardProps) {
  const primaryColor = PROVIDER_COLORS[asset.provider] ?? '#6b7280';
  const yearLabel = asset.publishedAt ? asset.publishedAt.slice(0, 4) : null;

  return (
    <article
      className={`library-card group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer transition-all bg-white ${
        isSelected
          ? 'ring-2 ring-ocean shadow-xl shadow-ocean/10'
          : 'shadow-sm hover:shadow-2xl hover:-translate-y-1'
      }`}
      style={{ border: '1px solid #f1f5f9' }}
      onClick={() => onPreview(asset)}
    >
      {/* ── Thumbnail / color header ─────────────────────────── */}
      <div
        className="relative overflow-hidden flex-shrink-0"
        style={{ height: 96, backgroundColor: `${primaryColor}12` }}
      >
        {asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt={asset.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${primaryColor}20 0%, ${primaryColor}08 100%)` }}
          >
            <span
              className="font-black text-lg tracking-wider"
              style={{ color: `${primaryColor}60` }}
            >
              {PROVIDER_LOGOS[asset.provider] ?? asset.provider.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}

        {/* Hover overlay with "Previsualizar" */}
        <div className="absolute inset-0 flex items-center justify-center bg-ink/70 opacity-0 group-hover:opacity-100 transition-all duration-200">
          <div className="flex items-center gap-1.5 bg-white text-ink text-xs font-bold px-3 py-1.5 rounded-full shadow-lg">
            <Eye size={12} />
            <span>Previsualizar</span>
          </div>
        </div>

        {/* Badges */}
        {asset.openAccess && (
          <div className="absolute top-2 left-2 bg-emerald-500 text-white text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md shadow-sm">
            OA
          </div>
        )}
        {asset.providers.length > 1 && (
          <div className="absolute top-2 right-2 bg-amber-400 text-ink text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md shadow-sm">
            ×{asset.providers.length}
          </div>
        )}

        {/* Checkbox */}
        <div
          className="absolute bottom-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => { e.stopPropagation(); onToggleSelect?.(asset.id, !isSelected); }}
        >
          <input
            type="checkbox"
            className="w-3.5 h-3.5 rounded border-white/60 accent-ocean cursor-pointer shadow"
            checked={isSelected}
            onChange={(e) => { e.stopPropagation(); onToggleSelect?.(asset.id, e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            aria-label="Seleccionar recurso"
          />
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────── */}
      <div className="flex flex-col flex-grow p-3 gap-1.5">
        {/* Provider badge */}
        <span
          className="self-start text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
          style={{ color: primaryColor, backgroundColor: `${primaryColor}12` }}
        >
          {PROVIDER_LABELS[asset.provider] ?? asset.provider}
        </span>

        {/* Title */}
        <strong className="block text-[12px] leading-snug text-ink font-bold line-clamp-2 flex-grow group-hover:text-ocean transition-colors">
          {asset.title}
        </strong>

        {/* Authors */}
        {asset.authors.length > 0 && (
          <p className="text-[10px] text-muted truncate">
            {asset.authors[0]}{asset.authors.length > 1 ? `, ${asset.authors[1]}` : ''}
          </p>
        )}

        {/* ── Footer: score ring + year + actions ─────────────── */}
        <div
          className="flex items-center gap-2 mt-1 pt-2"
          style={{ borderTop: '1px solid #f1f5f9' }}
          onClick={(e) => e.stopPropagation()}
        >
          <ScoreRing score={asset.score} />
          <div className="flex-1 min-w-0">
            <div className="text-[8px] font-bold text-muted uppercase tracking-wider leading-none mb-0.5">
              Puntuación
            </div>
            {yearLabel && (
              <div className="text-[9px] text-muted">{yearLabel}</div>
            )}
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {asset.canonicalUrl && (
              <a
                href={asset.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 hover:bg-slate-100 text-muted hover:text-ink rounded-lg transition-colors"
                title="Abrir fuente"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={11} />
              </a>
            )}
            <button
              type="button"
              className="p-1.5 bg-ink text-white hover:bg-ocean rounded-lg transition-all shadow-sm active:scale-90"
              onClick={(e) => { e.stopPropagation(); onAddToCourse(asset); }}
              title="Añadir al curso"
            >
              <span className="text-[9px] font-bold px-0.5">+</span>
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
