import { useState } from 'react';
import { BookOpen, Check, Copy, Download, ExternalLink, Play, Plus, Puzzle, Users, X } from 'lucide-react';
import type { LibrarySearchResult } from '../types.js';

const PROVIDER_COLORS: Record<string, string> = {
  'semantic-scholar': '#1d4ed8', openalex: '#0f766e', arxiv: '#b91c1c', core: '#15803d',
  scielo: '#0ea5e9', redalyc: '#7c3aed', 'oer-commons': '#d97706', phet: '#0891b2',
  youtube: '#dc2626', institutional: '#4f46e5',
};

const PROVIDER_LABELS: Record<string, string> = {
  'semantic-scholar': 'Semantic Scholar', openalex: 'OpenAlex', arxiv: 'arXiv', core: 'CORE',
  scielo: 'SciELO', redalyc: 'Redalyc', 'oer-commons': 'OER Commons', phet: 'PhET',
  youtube: 'YouTube', institutional: 'Institucional',
};

interface Props {
  asset: LibrarySearchResult | null;
  onClose: () => void;
  onAddToCourse: (asset: LibrarySearchResult) => void;
}

export function LibraryPreviewModal({ asset, onClose, onAddToCourse }: Props) {
  const [copied, setCopied] = useState(false);
  if (!asset) return null;

  const providerColor = PROVIDER_COLORS[asset.provider] ?? '#6b7280';
  const year = asset.publishedAt?.slice(0, 4);
  const multiSource = asset.providers.length > 1;

  function copyDOI() {
    if (!asset?.doi) return;
    void navigator.clipboard.writeText(`doi:${asset.doi}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function renderEmbed() {
    if (!asset) return null;

    if (asset.previewKind === 'video' && asset.embedUrl) {
      return (
        <div style={{ borderRadius: '16px', overflow: 'hidden', background: '#000', aspectRatio: '16/9', marginBottom: '20px' }}>
          <iframe src={asset.embedUrl} title={asset.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      );
    }

    if (asset.previewKind === 'simulation' && asset.embedUrl) {
      return (
        <div style={{ borderRadius: '16px', overflow: 'hidden', background: '#0f172a', aspectRatio: '16/9', marginBottom: '20px' }}>
          <iframe src={asset.embedUrl} title={asset.title} allow="fullscreen"
            style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      );
    }

    if (asset.previewKind === 'pdf' && asset.embedUrl) {
      return (
        <div style={{ borderRadius: '16px', overflow: 'hidden', height: '420px', marginBottom: '20px', background: '#f1f5f9' }}>
          <iframe
            src={`https://docs.google.com/viewer?url=${encodeURIComponent(asset.embedUrl)}&embedded=true`}
            title={asset.title} style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      );
    }

    // Text/abstract fallback
    return (
      <div style={{ background: '#f8fafc', border: '1px solid var(--line)', borderRadius: '16px', padding: '24px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--line)' }}>
          <div style={{ padding: '10px', borderRadius: '12px', background: `${providerColor}12`, display: 'flex' }}>
            <BookOpen size={20} style={{ color: providerColor }} />
          </div>
          <div>
            <span style={{ fontSize: '11px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: providerColor }}>
              {PROVIDER_LABELS[asset.provider] ?? asset.provider}
            </span>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{asset.resourceType}</p>
          </div>
        </div>
        {asset.abstract ? (
          <>
            <h4 style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--muted)', marginBottom: '10px' }}>
              Abstract
            </h4>
            <p style={{ fontSize: '14px', lineHeight: 1.75, color: '#475569' }}>{asset.abstract}</p>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--muted)' }}>
            <BookOpen size={36} style={{ margin: '0 auto 10px', display: 'block', opacity: 0.2 }} />
            <p style={{ fontSize: '13px' }}>Vista previa no disponible. Abre "Ver fuente" para leer el recurso.</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="library-preview-overlay"
      onClick={onClose}
      role="dialog"
      aria-modal
      aria-label="Vista previa del recurso"
    >
      <div className="library-preview-panel" onClick={e => e.stopPropagation()}>

        {/* Head */}
        <div className="library-preview-panel__head">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
            {asset.providers.map(p => {
              const color = PROVIDER_COLORS[p] ?? '#6b7280';
              return (
                <span key={p} style={{
                  fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em',
                  padding: '3px 10px', borderRadius: '100px',
                  border: `1px solid ${color}40`, color, background: `${color}0e`,
                }}>
                  {PROVIDER_LABELS[p] ?? p}
                </span>
              );
            })}
            {multiSource && (
              <span style={{
                fontSize: '10px', fontWeight: 800, padding: '3px 10px', borderRadius: '100px',
                border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b', background: 'rgba(245,158,11,0.08)',
              }}>
                ✦ Multifuente
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '8px', borderRadius: '10px', border: '1px solid var(--line)',
              background: 'var(--panel-strong)', cursor: 'pointer', color: 'var(--muted)',
              display: 'flex', flexShrink: 0, transition: 'all 150ms',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="library-preview-panel__body">
          {/* Title */}
          <h2 style={{
            fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 2.5vw, 24px)',
            fontWeight: 600, lineHeight: 1.3, color: 'var(--ink)', marginBottom: '12px',
          }}>
            {asset.title}
          </h2>

          {/* Meta row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '16px', fontSize: '13px', color: 'var(--muted)', alignItems: 'center' }}>
            {asset.authors.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Users size={13} style={{ opacity: 0.55, flexShrink: 0 }} />
                <span>
                  {asset.authors.slice(0, 3).join(', ')}
                  {asset.authors.length > 3 ? ` +${asset.authors.length - 3}` : ''}
                </span>
              </div>
            )}
            {year && (
              <span style={{ padding: '2px 8px', background: 'var(--panel-strong)', borderRadius: '8px', fontWeight: 700, fontSize: '12px', color: 'var(--ink)' }}>
                {year}
              </span>
            )}
            {asset.openAccess && (
              <span style={{ padding: '2px 8px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '8px', fontWeight: 800, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#10b981' }}>
                Open Access
              </span>
            )}
            {asset.citationCount > 0 && (
              <span style={{ fontWeight: 600 }}>{asset.citationCount.toLocaleString()} citas</span>
            )}
            {asset.license?.label && (
              <span style={{ padding: '2px 8px', background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', borderRadius: '8px', fontSize: '11px', fontWeight: 600, color: '#7c3aed' }}>
                {asset.license.label}
              </span>
            )}
          </div>

          {/* DOI */}
          {asset.doi && (
            <button
              onClick={copyDOI}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px',
                borderRadius: '10px', background: 'var(--panel-strong)', border: '1px solid var(--line)',
                cursor: 'pointer', marginBottom: '16px', transition: 'all 150ms', width: '100%', textAlign: 'left',
              }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                doi:{asset.doi}
              </span>
              {copied ? <Check size={14} style={{ color: '#10b981', flexShrink: 0 }} /> : <Copy size={14} style={{ flexShrink: 0, color: 'var(--muted)' }} />}
            </button>
          )}

          {/* Tags */}
          {asset.tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
              {asset.tags.slice(0, 8).map(tag => (
                <span key={tag} style={{ padding: '3px 8px', background: 'var(--panel-strong)', border: '1px solid var(--line)', borderRadius: '6px', fontSize: '11px', fontWeight: 500, color: 'var(--muted)' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {renderEmbed()}
        </div>

        {/* Foot */}
        <div className="library-preview-panel__foot">
          {asset.canonicalUrl && (
            <a
              href={asset.canonicalUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
                borderRadius: '12px', border: '2px solid var(--line)', fontWeight: 700,
                fontSize: '13px', color: 'var(--ink)', textDecoration: 'none', transition: 'all 200ms',
              }}
            >
              <ExternalLink size={15} /> Ver fuente
            </a>
          )}
          {asset.embedUrl && asset.previewKind === 'pdf' && (
            <a
              href={asset.embedUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px',
                borderRadius: '12px', border: '2px solid var(--line)', fontWeight: 700,
                fontSize: '13px', color: 'var(--ink)', textDecoration: 'none',
              }}
            >
              <Download size={15} /> PDF
            </a>
          )}
          <button
            onClick={() => onAddToCourse(asset)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 22px',
              borderRadius: '12px', border: 'none', background: 'var(--ink)', color: 'white',
              fontWeight: 700, fontSize: '13px', cursor: 'pointer', marginLeft: 'auto',
              transition: 'all 200ms',
            }}
          >
            {asset.previewKind === 'video' ? <Play size={15} /> : asset.previewKind === 'simulation' ? <Puzzle size={15} /> : <Plus size={15} />}
            Añadir al curso
          </button>
        </div>
      </div>
    </div>
  );
}
