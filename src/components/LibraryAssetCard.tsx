import { ExternalLink, Layers, Plus, Star, Users } from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';

interface LibraryAssetCardProps {
  asset: LibrarySearchResult;
  onAddToCourse: (asset: LibrarySearchResult) => void;
}

export function LibraryAssetCard({ asset, onAddToCourse }: LibraryAssetCardProps) {
  const isInstitutional = asset.provider === 'institutional';
  
  return (
    <article className="resource-card group flex flex-col h-full transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="resource-card__top mb-3">
        <div className="flex items-center gap-2">
          <span className={`badge ${isInstitutional ? 'badge--ocean' : 'badge--sage'}`}>
            {isInstitutional ? 'Institucional' : asset.provider}
          </span>
          {asset.openAccess && (
            <span className="badge badge--outline">Open Access</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gold/10 text-gold rounded-full text-xs font-bold">
          <Star size={12} fill="currentColor" />
          <span>{asset.score.toFixed(1)}</span>
        </div>
      </div>

      <strong className="block text-lg mb-1 leading-tight group-hover:text-ocean transition-colors">
        {asset.title}
      </strong>
      
      {asset.authors && asset.authors.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-secondary mb-3">
          <Users size={12} />
          <span className="line-clamp-1">{asset.authors.join(', ')}</span>
        </div>
      )}
      
      <p className="text-sm text-secondary line-clamp-3 mb-4 flex-grow">
        {asset.abstract || 'Sin resumen disponible.'}
      </p>

      <div className="resource-card__meta mb-3 flex items-center justify-between text-xs font-medium border-t border-line/50 pt-3">
        <div className="flex items-center gap-1.5 opacity-70">
          <Layers size={14} />
          <span>{asset.resourceType}</span>
        </div>
        {asset.publishedAt && (
          <span className="opacity-70">{asset.publishedAt}</span>
        )}
      </div>

      <div className="tag-row mb-4">
        {asset.tags.slice(0, 3).map((tag) => (
          <span key={tag} className="tag text-[10px] py-1 px-2">
            {tag}
          </span>
        ))}
      </div>

      <div className="action-row mt-auto grid grid-cols-2 gap-2">
        {asset.canonicalUrl && (
          <a
            href={asset.canonicalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ghost-button justify-center py-2"
          >
            <ExternalLink size={16} />
            <span>Ver fuente</span>
          </a>
        )}
        <button
          type="button"
          className="cta-button cta-button--small justify-center py-2"
          onClick={() => onAddToCourse(asset)}
        >
          <Plus size={16} />
          <span>Integrar</span>
        </button>
      </div>
    </article>
  );
}
