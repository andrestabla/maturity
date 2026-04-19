import { Eye, ExternalLink } from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';

interface LibraryAssetCardProps {
  asset: LibrarySearchResult;
  onAddToCourse: (asset: LibrarySearchResult) => void;
  onPreview: (asset: LibrarySearchResult) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string, selected: boolean) => void;
}

// ── Provider brand styles ────────────────────────────────────────────────────

const PROVIDER_META: Record<string, { label: string; bg: string; fg: string; border: string }> = {
  'semantic-scholar': { label: 'Semantic Scholar', bg: '#eff6ff', fg: '#1d4ed8', border: '#bfdbfe' },
  openalex:          { label: 'OpenAlex',          bg: '#f0fdfa', fg: '#0f766e', border: '#99f6e4' },
  arxiv:             { label: 'arXiv',             bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' },
  core:              { label: 'CORE',              bg: '#f0fdf4', fg: '#15803d', border: '#bbf7d0' },
  scielo:            { label: 'SciELO',            bg: '#f0f9ff', fg: '#0369a1', border: '#bae6fd' },
  redalyc:           { label: 'Redalyc',           bg: '#faf5ff', fg: '#7c3aed', border: '#ddd6fe' },
  'oer-commons':     { label: 'OER Commons',       bg: '#fffbeb', fg: '#d97706', border: '#fde68a' },
  phet:              { label: 'PhET',              bg: '#f0f9ff', fg: '#0891b2', border: '#bae6fd' },
  youtube:           { label: 'YouTube',           bg: '#fef2f2', fg: '#dc2626', border: '#fecaca' },
  institutional:     { label: 'Institucional',     bg: '#eef2ff', fg: '#4f46e5', border: '#c7d2fe' },
};

// Provider icon component
function ProviderBadge({ provider }: { provider: string }) {
  const m = PROVIDER_META[provider] ?? { label: provider.toUpperCase(), bg: '#f8fafc', fg: '#64748b', border: '#e2e8f0' };

  if (provider === 'youtube') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dc2626', borderRadius: 6, padding: '3px 8px' }}>
        <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
          <rect width="12" height="9" rx="2" fill="#dc2626" />
          <polygon points="4.5,2 9,4.5 4.5,7" fill="white" />
        </svg>
        <span style={{ color: 'white', fontSize: 9, fontWeight: 900, letterSpacing: '0.02em' }}>YouTube</span>
      </div>
    );
  }

  if (provider === 'arxiv') {
    return (
      <div style={{ display: 'inline-flex', alignItems: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, padding: '3px 8px' }}>
        <span style={{ color: '#b91c1c', fontSize: 11, fontWeight: 900, fontStyle: 'italic' }}>arXiv</span>
      </div>
    );
  }

  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center',
      background: m.bg, border: `1px solid ${m.border}`, borderRadius: 6, padding: '3px 8px',
    }}>
      <span style={{ color: m.fg, fontSize: 9, fontWeight: 800, letterSpacing: '0.03em' }}>{m.label}</span>
    </div>
  );
}

// Score ring with label
function ScoreRing({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const r = 22;
  const size = 56;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.min(score, 1));
  const color = pct >= 80 ? '#16a34a' : pct >= 60 ? '#ca8a04' : '#dc2626';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, flexShrink: 0 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)', position: 'absolute', inset: 0 }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth="3" />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth="3"
            strokeDasharray={circ} strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 900, color, lineHeight: 1 }}>{pct}%</span>
        </div>
      </div>
      <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
        <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Puntuación</div>
        <div style={{ fontSize: 8, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.04em' }}>de Madurez</div>
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
  const yearLabel = asset.publishedAt ? asset.publishedAt.slice(0, 4) : null;

  return (
    <article
      className="group relative bg-white cursor-pointer transition-all duration-200 hover:-translate-y-0.5 focus-visible:outline-none"
      style={{
        borderRadius: 16,
        border: isSelected ? '2px solid var(--library-teal)' : '1.5px solid #e2e8f0',
        boxShadow: isSelected
          ? '0 0 0 3px color-mix(in srgb, var(--library-teal) 20%, transparent), 0 1px 4px rgba(0,0,0,0.06)'
          : '0 1px 4px rgba(0,0,0,0.06)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
      tabIndex={0}
      role="button"
      aria-label={`Ver recurso: ${asset.title}`}
      onClick={() => onPreview(asset)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPreview(asset); } }}
    >
      {/* Hover/focus border overlay */}
      <div
        className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity"
        style={{ border: '2px solid var(--library-teal)', borderRadius: 16 }}
      />

      {/* ── Main content row: text + score ring ── */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {/* Text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3
            className="group-hover:text-teal-600 transition-colors"
            style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', lineHeight: 1.4, marginBottom: 4,
              display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
          >
            {asset.title}
          </h3>
          {asset.authors.length > 0 && (
            <p style={{ fontSize: 10, color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {asset.authors.slice(0, 2).join(', ')}
            </p>
          )}
          {yearLabel && (
            <p style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>{yearLabel}</p>
          )}
        </div>

        {/* Score ring */}
        <ScoreRing score={asset.score} />
      </div>

      {/* ── Footer: provider badge + actions ── */}
      <div
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 10, borderTop: '1px solid #f1f5f9' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Checkbox — visible when selected, visible on hover/focus-within */}
          {onToggleSelect && (
            <div
              className={`transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'}`}
              onClick={(e) => { e.stopPropagation(); onToggleSelect(asset.id, !isSelected); }}
            >
              <input
                type="checkbox"
                className="w-3.5 h-3.5 rounded cursor-pointer"
                style={{ accentColor: 'var(--library-teal)' }}
                checked={isSelected}
                onChange={(e) => { e.stopPropagation(); onToggleSelect(asset.id, e.target.checked); }}
                onClick={(e) => e.stopPropagation()}
                aria-label="Seleccionar recurso"
              />
            </div>
          )}
          <ProviderBadge provider={asset.provider} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Previsualizar — visible on hover/focus */}
          <button
            type="button"
            className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all focus-visible:outline-none focus-visible:ring-2"
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              background: 'var(--library-teal)', color: 'white', border: 'none',
              borderRadius: 8, padding: '5px 10px', fontSize: 10, fontWeight: 700,
              cursor: 'pointer',
            }}
            onClick={(e) => { e.stopPropagation(); onPreview(asset); }}
            aria-label={`Previsualizar: ${asset.title}`}
          >
            <Eye size={11} />
            Previsualizar
          </button>

          {/* External link */}
          {asset.canonicalUrl && (
            <a
              href={asset.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all"
              style={{ color: '#94a3b8', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }}
              title="Abrir fuente"
              onClick={(e) => e.stopPropagation()}
              aria-label="Abrir fuente original"
            >
              <ExternalLink size={11} />
            </a>
          )}

          {/* Add to course — always visible */}
          <button
            type="button"
            style={{
              background: '#0f172a', color: 'white', border: 'none',
              borderRadius: 8, padding: '5px 8px', fontSize: 10, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center',
            }}
            onClick={(e) => { e.stopPropagation(); onAddToCourse(asset); }}
            aria-label="Añadir al curso"
            title="Añadir al curso"
          >
            +
          </button>
        </div>
      </div>
    </article>
  );
}
