import { BookOpen, ExternalLink, Eye, Plus, Star } from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';

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
  'oer-commons': 'OER Commons',
  phet: 'PhET',
  youtube: 'YouTube',
  institutional: 'Institucional',
};

interface Props {
  asset: LibrarySearchResult;
  isSelected: boolean;
  onToggleSelect: (id: string, selected: boolean) => void;
  onPreview: (asset: LibrarySearchResult) => void;
  onAddToCourse: (asset: LibrarySearchResult) => void;
}

export function LibraryAssetCard({ asset, isSelected, onToggleSelect, onPreview, onAddToCourse }: Props) {
  const providerColor = PROVIDER_COLORS[asset.provider] ?? '#6b7280';
  const providerLabel = PROVIDER_LABELS[asset.provider] ?? asset.provider;
  const multiSource = asset.providers.length > 1;
  const year = asset.publishedAt?.slice(0, 4);
  const isVideo = asset.previewKind === 'video';
  const isSim = asset.previewKind === 'simulation';

  return (
    <article
      className={`library-card${isSelected ? ' is-selected' : ''}`}
      onClick={() => onPreview(asset)}
      style={{ cursor: 'pointer' }}
    >
      {/* Thumbnail */}
      <div className="library-card__header" style={{ background: `${providerColor}14` }}>
        {asset.thumbnailUrl ? (
          <img
            src={asset.thumbnailUrl}
            alt=""
            loading="lazy"
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div className="fallback-bg" style={{ color: providerColor, fontSize: '36px' }}>
            {isVideo ? '▶' : isSim ? '⚡' : <BookOpen size={36} style={{ opacity: 0.18 }} />}
          </div>
        )}

        {/* Type badge */}
        {(isVideo || isSim) && (
          <div className="library-card__type-badge" style={{ background: `${providerColor}cc` }}>
            {isVideo ? '▶ Video' : '⚡ Sim.'}
          </div>
        )}

        {/* Multi-source badge */}
        {multiSource && (
          <div style={{
            position: 'absolute', top: '8px', left: '8px',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
            color: '#f59e0b', padding: '3px 7px', borderRadius: '7px',
            fontSize: '10px', fontWeight: 800,
          }}>
            ×{asset.providers.length}
          </div>
        )}

        {/* Select checkbox */}
        <button
          className="library-card__select"
          onClick={e => { e.stopPropagation(); onToggleSelect(asset.id, !isSelected); }}
          aria-label={isSelected ? 'Deseleccionar' : 'Seleccionar'}
        >
          {isSelected && <span style={{ color: 'white', fontSize: '11px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
        </button>
      </div>

      {/* Body */}
      <div className="library-card__body">
        {/* Provider + language */}
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="library-card__provider-badge" style={{ background: providerColor }}>
            {providerLabel}
          </span>
          {asset.language && asset.language !== 'und' && asset.language !== 'zxx' && (
            <span style={{
              padding: '2px 6px', borderRadius: '100px', fontSize: '10px', fontWeight: 700,
              background: 'var(--panel-strong)', border: '1px solid var(--line)', color: 'var(--muted)',
            }}>
              {asset.language.toUpperCase()}
            </span>
          )}
        </div>

        <h3 className="library-card__title">{asset.title}</h3>

        {(asset.authors.length > 0 || year) && (
          <p className="library-card__authors">
            {asset.authors.slice(0, 2).join(', ')}
            {asset.authors.length > 2 ? ' et al.' : ''}
            {year ? ` · ${year}` : ''}
          </p>
        )}

        <div className="library-card__badges">
          {asset.openAccess && <span className="library-card__oa-badge">OA</span>}
          {asset.citationCount > 0 && (
            <span className="library-card__citation-badge">
              <Star size={10} style={{ opacity: 0.55 }} />
              {asset.citationCount >= 1000 ? `${(asset.citationCount / 1000).toFixed(1)}k` : asset.citationCount}
            </span>
          )}
          {asset.institutionName && (
            <span style={{
              fontSize: '10px', fontWeight: 700, color: '#4f46e5',
              background: 'rgba(79,70,229,0.08)', padding: '2px 6px', borderRadius: '100px', marginLeft: 'auto',
            }}>Inst.</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="library-card__actions" onClick={e => e.stopPropagation()}>
        <button onClick={() => onPreview(asset)} title="Vista previa">
          <Eye size={13} /> Ver
        </button>
        {asset.canonicalUrl && (
          <a
            href={asset.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, padding: '8px', borderRadius: '10px', fontSize: '11px', fontWeight: 700,
              border: '1px solid var(--line)', background: 'var(--panel-strong)', color: 'var(--muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', transition: 'all 150ms',
            }}
            onClick={e => e.stopPropagation()}
          >
            <ExternalLink size={13} />
          </a>
        )}
        <button className="action-primary" onClick={() => onAddToCourse(asset)} title="Añadir al curso">
          <Plus size={13} />
        </button>
      </div>
    </article>
  );
}
