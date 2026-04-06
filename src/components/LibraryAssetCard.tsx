import type { CSSProperties } from 'react';
import { Eye } from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';
import { getLibraryVisualSource } from '../utils/libraryPresentation.js';

interface LibraryAssetCardProps {
  asset: LibrarySearchResult;
  onPreview: (asset: LibrarySearchResult) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string, selected: boolean) => void;
}

function ScoreRing({
  score,
  start,
  end,
}: {
  score: number;
  start: string;
  end: string;
}) {
  const percentage = Math.round(score * 100);
  const radius = 34;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(score, 1));
  const gradientId = `library-score-${percentage}-${start.replace('#', '')}-${end.replace('#', '')}`;

  return (
    <div className="library-card-adaptive__score-ring">
      <svg viewBox="0 0 92 92" aria-hidden="true">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={start} />
            <stop offset="100%" stopColor={end} />
          </linearGradient>
        </defs>
        <circle cx="46" cy="46" r={radius} className="library-card-adaptive__score-track" />
        <circle
          cx="46"
          cy="46"
          r={radius}
          className="library-card-adaptive__score-progress"
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="library-card-adaptive__score-copy">
        <strong>{percentage}%</strong>
        <span>Puntuacion de Madurez</span>
      </div>
    </div>
  );
}

export function LibraryAssetCard({
  asset,
  onPreview,
  isSelected = false,
  onToggleSelect,
}: LibraryAssetCardProps) {
  const source = getLibraryVisualSource(asset);
  const publishedYear = asset.publishedAt ? asset.publishedAt.slice(0, 4) : '2024';
  const leadAuthors = asset.authors.slice(0, 2).join(', ') || 'Autores verificados';
  const cardStyle = {
    '--library-accent': source.accent,
    '--library-accent-soft': source.soft,
  } as CSSProperties;

  return (
    <article
      className={`library-card-adaptive ${isSelected ? 'is-selected' : ''}`}
      style={cardStyle}
      onClick={() => onPreview(asset)}
    >
      <button
        type="button"
        className="library-card-adaptive__select"
        onClick={(event) => {
          event.stopPropagation();
          onToggleSelect?.(asset.id, !isSelected);
        }}
        aria-pressed={isSelected}
        aria-label={isSelected ? 'Quitar recurso de la seleccion' : 'Seleccionar recurso'}
      >
        <span />
      </button>

      <div className="library-card-adaptive__header">
        <div className="library-card-adaptive__source">
          <div
            className="library-card-adaptive__mark"
            style={{
              background: source.accent,
              color: source.markTextColor ?? '#f8fafc',
            }}
          >
            {source.mark}
          </div>
          <div className="library-card-adaptive__source-copy">
            <span>{source.label}</span>
            <small>{asset.resourceType || 'Recurso curado'}</small>
          </div>
        </div>

        <ScoreRing
          score={asset.score}
          start={source.ringStart}
          end={source.ringEnd}
        />
      </div>

      <div className="library-card-adaptive__body">
        <h3>{asset.title}</h3>
        <p className="library-card-adaptive__meta">Source: {source.label}</p>
        <p className="library-card-adaptive__meta">Autor: {leadAuthors}</p>

        <div className="library-card-adaptive__footer">
          <span>{publishedYear}</span>
          <span>{asset.openAccess ? 'Open access' : 'Fuente verificada'}</span>
          {asset.citationCount > 0 ? <span>{asset.citationCount} citas</span> : null}
        </div>
      </div>

      <div className="library-card-adaptive__hover">
        <button
          type="button"
          className="library-card-adaptive__preview"
          onClick={(event) => {
            event.stopPropagation();
            onPreview(asset);
          }}
        >
          <Eye size={15} />
          <span>Previsualizar</span>
        </button>
      </div>
    </article>
  );
}
