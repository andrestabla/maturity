import { ExternalLink, Layers, Plus, Star, Users } from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';

interface LibraryAssetCardProps {
  asset: LibrarySearchResult;
  onAddToCourse: (asset: LibrarySearchResult) => void;
  isSelected?: boolean;
  onToggleSelect?: (id: string, selected: boolean) => void;
}

/**
 * Compact, High-Density Resource Card for a 6-Column Grid.
 * Optimized for scannability and quick selection.
 */
export function LibraryAssetCard({ 
  asset, 
  onAddToCourse,
  isSelected = false,
  onToggleSelect
}: LibraryAssetCardProps) {
  const isInstitutional = asset.provider === 'institutional';
  
  return (
    <article className={`resource-card-compact group flex flex-col h-full transition-all border-2 rounded-2xl p-3 overflow-hidden relative ${
      isSelected 
        ? 'border-ocean bg-ocean/5 shadow-md shadow-ocean/10' 
        : 'border-line/20 bg-white/40 hover:border-ocean/40 hover:bg-white/60 hover:shadow-xl'
    }`}>
      
      {/* Multi-select Checkbox (Simplified for density) */}
      <div className="absolute top-2 right-2 z-20">
        <input 
          type="checkbox"
          className="w-4 h-4 rounded border-line text-ocean focus:ring-ocean transition-all cursor-pointer accent-ocean"
          checked={isSelected}
          onChange={(e) => onToggleSelect?.(asset.id, e.target.checked)}
        />
      </div>

      <div className="flex flex-col gap-2 flex-grow">
        {/* Source & Score */}
        <div className="flex items-center justify-between gap-1 pr-6">
          <div className="flex items-center gap-1.5 opacity-80 overflow-hidden">
            <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded truncate ${
              isInstitutional ? 'bg-ocean/10 text-ocean' : 'bg-secondary/10 text-secondary'
            }`}>
              {isInstitutional ? 'Institucional' : asset.provider}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[10px] font-bold text-gold">
            <Star size={10} fill="currentColor" />
            <span>{asset.score.toFixed(1)}</span>
          </div>
        </div>

        {/* Title (High-priority) */}
        <strong className="block text-sm leading-tight text-ink font-bold line-clamp-2 group-hover:text-ocean transition-colors">
          {asset.title}
        </strong>

        {/* Preview Summary (Very compact) */}
        {asset.abstract && (
          <p className="text-[11px] text-muted line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
            {asset.abstract}
          </p>
        )}

        {/* Authors (Minor) */}
        {asset.authors && asset.authors.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-muted overflow-hidden">
            <Users size={10} className="shrink-0" />
            <span className="truncate">{asset.authors[0]} {asset.authors.length > 1 ? `+${asset.authors.length - 1}` : ''}</span>
          </div>
        )}
      </div>

      <div className="mt-3 pt-2 border-t border-line/10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[10px] text-secondary/60">
          <Layers size={12} />
          <span className="capitalize">{asset.resourceType}</span>
        </div>
        
        <div className="flex items-center gap-1">
          {asset.canonicalUrl && (
            <a
              href={asset.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 hover:bg-ocean/10 text-ocean rounded-lg transition-colors"
              title="Ver fuente original"
            >
              <ExternalLink size={14} />
            </a>
          )}
          <button
            type="button"
            className="p-1.5 bg-ink text-white hover:bg-ocean rounded-lg transition-all shadow-sm active:scale-90"
            onClick={() => onAddToCourse(asset)}
            title="Integrar recurso"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
    </article>
  );
}
