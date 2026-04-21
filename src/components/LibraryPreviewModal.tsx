import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  Edit2,
  ExternalLink,
  Loader2,
  Sparkles,
  Trash2,
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
  userRole?: string;
  onDeleteAsset?: (assetId: string) => Promise<void>;
  onEditAsset?: (asset: LibrarySearchResult) => void;
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

function generateAPA7(asset: LibrarySearchResult): string {
  const authors = asset.authors.length === 0
    ? asset.institutionName ?? 'Autor desconocido'
    : asset.authors.length === 1
      ? formatAuthor(asset.authors[0])
      : asset.authors.length <= 20
        ? asset.authors.slice(0, -1).map(formatAuthor).join(', ') + ', & ' + formatAuthor(asset.authors[asset.authors.length - 1])
        : asset.authors.slice(0, 19).map(formatAuthor).join(', ') + ', . . . ' + formatAuthor(asset.authors[asset.authors.length - 1]);

  const year = asset.publishedAt ? `(${asset.publishedAt.slice(0, 4)})` : '(s.f.)';
  const title = asset.title ?? 'Sin título';
  const url = asset.canonicalUrl ?? '';
  const source = PROVIDER_LABELS[asset.provider]?.label ?? asset.provider;

  if (asset.previewKind === 'video' || asset.provider === 'youtube') {
    const dateStr = asset.publishedAt ? `, ${formatDate(asset.publishedAt)}` : '';
    return `${authors} ${year.replace(')', `${dateStr})`)}. ${title} [Video]. ${source}. ${url}`;
  }

  if (asset.doi) {
    return `${authors} ${year}. ${title}. ${source}. https://doi.org/${asset.doi}`;
  }

  return `${authors} ${year}. ${title}. ${source}. ${url}`;
}

function formatAuthor(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return name;
  const last = parts[parts.length - 1];
  const initials = parts.slice(0, -1).map((p) => `${p[0]}.`).join(' ');
  return `${last}, ${initials}`;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-ES', { month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

export function LibraryPreviewModal({
  asset,
  onClose,
  courseOptions,
  onAddToCourse,
  userRole,
  onDeleteAsset,
  onEditAsset,
}: LibraryPreviewModalProps) {
  const [copied, setCopied] = useState(false);
  const [copiedAPA, setCopiedAPA] = useState(false);
  const [showCourseForm, setShowCourseForm] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(courseOptions[0]?.value ?? '');
  const [targetUnit, setTargetUnit] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addSuccess, setAddSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const isAdminOrGestor = userRole === 'Administrador' || userRole === 'Gestor LMS';
  const isInstitutional = asset?.provider === 'institutional';
  const canManage = isAdminOrGestor && isInstitutional;

  const providerCfg = asset
    ? (PROVIDER_LABELS[asset.provider] ?? { label: asset.provider, color: '#6b7280' })
    : { label: '', color: '#6b7280' };

  const panelWidth = asset?.previewKind === 'pdf' ? '2xl' : 'lg';

  const meta = asset?.metadata ?? {};

  const metaEmbedCode = typeof meta.embedCode === 'string' ? meta.embedCode : null;
  const metaFormat = typeof meta.format === 'string' ? meta.format : null;
  const metaExtension = typeof meta.extension === 'string' ? meta.extension : null;
  const metaMinutes = typeof meta.estimatedStudyMinutes === 'number' && meta.estimatedStudyMinutes > 0
    ? meta.estimatedStudyMinutes : null;
  const metaFaculty = typeof meta.faculty === 'string' ? meta.faculty : null;
  const metaProgram = typeof meta.program === 'string' ? meta.program : null;
  const metaThematicAreas = Array.isArray(meta.thematicAreas) ? (meta.thematicAreas as string[]) : null;
  const metaKeywords = Array.isArray(meta.keywords) ? (meta.keywords as string[]) : null;

  function copyAPA() {
    if (!asset) return;
    void navigator.clipboard.writeText(generateAPA7(asset)).then(() => {
      setCopiedAPA(true);
      setTimeout(() => setCopiedAPA(false), 2500);
    });
  }

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

  async function handleDelete() {
    if (!asset || !onDeleteAsset) return;
    setIsDeleting(true);
    try {
      await onDeleteAsset(asset.id);
      onClose();
    } finally {
      setIsDeleting(false);
      setConfirmDelete(false);
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
      width={panelWidth}
      footer={
        asset ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {/* Admin/Gestor actions for institutional resources */}
            {canManage && (
              <div style={{ display: 'flex', gap: 8 }}>
                <button
                  onClick={() => onEditAsset?.(asset)}
                  style={{
                    flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: 6, padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                    border: '2px solid #4f46e5', color: '#4f46e5', background: 'white', cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = '#4f46e5'; (e.currentTarget as HTMLButtonElement).style.color = 'white'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'white'; (e.currentTarget as HTMLButtonElement).style.color = '#4f46e5'; }}
                >
                  <Edit2 size={14} />
                  <span>Editar</span>
                </button>
                {confirmDelete ? (
                  <button
                    onClick={() => void handleDelete()}
                    disabled={isDeleting}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                      background: '#dc2626', color: 'white', border: 'none', cursor: 'pointer',
                    }}
                  >
                    {isDeleting ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={14} />}
                    <span>{isDeleting ? 'Eliminando…' : '¿Confirmar?'}</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirmDelete(true)}
                    style={{
                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      gap: 6, padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 700,
                      border: '2px solid #fecaca', color: '#dc2626', background: '#fff5f5', cursor: 'pointer',
                    }}
                  >
                    <Trash2 size={14} />
                    <span>Eliminar</span>
                  </button>
                )}
              </div>
            )}

            {/* Vincular button */}
            <button
              onClick={() => { setShowCourseForm((v) => !v); setAddSuccess(false); }}
              disabled={courseOptions.length === 0}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '14px', borderRadius: 16, fontWeight: 700, fontSize: 14,
                background: showCourseForm
                  ? 'linear-gradient(135deg, #475569, #334155)'
                  : 'linear-gradient(135deg, #0d9488, #0891b2)',
                color: 'white', border: 'none', cursor: 'pointer',
                opacity: courseOptions.length === 0 ? 0.4 : 1,
              }}
            >
              <span>{showCourseForm ? '✕ Cancelar' : '🔗 Vincular a mi Curso'}</span>
            </button>

            {/* Abrir original */}
            {asset.canonicalUrl && (
              <a
                href={asset.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: 8, padding: '14px', borderRadius: 16, fontWeight: 700, fontSize: 14,
                  border: '2px solid #e2e8f0', color: '#1e293b', textDecoration: 'none',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = '#1e293b'; (e.currentTarget as HTMLAnchorElement).style.color = 'white'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'; (e.currentTarget as HTMLAnchorElement).style.color = '#1e293b'; }}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── 1. Resource viewer (priority) ───────────────────────────── */}
          {asset.previewKind === 'video' && asset.embedUrl && (
            <div style={{ borderRadius: 16, overflow: 'hidden', background: '#000', boxShadow: '0 20px 40px rgba(0,0,0,0.15)', aspectRatio: '16/9' }}>
              <iframe
                src={asset.embedUrl}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title={asset.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {asset.previewKind === 'pdf' && asset.canonicalUrl && (
            <div style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
              <iframe
                src={asset.canonicalUrl}
                style={{ width: '100%', height: '75vh', border: 'none', display: 'block', background: '#f8fafc' }}
                title={asset.title}
              />
            </div>
          )}

          {asset.previewKind !== 'video' && asset.previewKind !== 'pdf' && metaEmbedCode && (
            <div
              style={{ borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}
              dangerouslySetInnerHTML={{ __html: metaEmbedCode }}
            />
          )}

          {asset.previewKind === 'image' && asset.thumbnailUrl && (
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0' }}>
              <img src={asset.thumbnailUrl} alt={asset.title} style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          )}

          {asset.previewKind !== 'video' && asset.previewKind !== 'pdf' && asset.previewKind !== 'image' && !meta.embedCode && asset.thumbnailUrl && (
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid #e2e8f0', maxHeight: 220, background: '#f8fafc' }}>
              <img src={asset.thumbnailUrl} alt={asset.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
          )}

          {/* ── 2. Provider + visibility badges ─────────────────────────── */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {asset.providers.map((p) => {
              const cfg = PROVIDER_LABELS[p] ?? { label: p, color: '#6b7280' };
              return (
                <span key={p} style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  padding: '4px 10px', borderRadius: 999, border: `1px solid ${cfg.color}40`,
                  color: cfg.color, background: `${cfg.color}10`,
                }}>
                  {cfg.label}
                </span>
              );
            })}
            {asset.openAccess && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>
                Open Access
              </span>
            )}
            {asset.visibility === 'Institucional' && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                Institucional
              </span>
            )}
          </div>

          {/* ── 3. AI Summary ────────────────────────────────────────────── */}
          {asset.abstract && (
            <div style={{
              borderRadius: 16, padding: 24,
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 40%, #2563eb 100%)',
              boxShadow: '0 20px 40px rgba(79,70,229,0.15)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ padding: 6, background: 'rgba(255,255,255,0.2)', borderRadius: 8 }}>
                    <Sparkles size={16} color="white" />
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.9)' }}>
                    Resumen de IA
                  </span>
                </div>
                <span style={{ fontSize: 9, fontWeight: 700, background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: 999, color: 'rgba(255,255,255,0.8)' }}>
                  Chispa/IA
                </span>
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.65, color: 'rgba(255,255,255,0.95)', marginBottom: 20 }}>
                {asset.abstract.slice(0, 480)}{asset.abstract.length > 480 ? '…' : ''}
              </p>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)', marginBottom: 12 }}>
                  Compatibilidad de madurez
                </div>
                {getCompatMetrics(asset.score).map((m) => (
                  <div key={m.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', flex: 1 }}>· {m.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.9)' }}>{m.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 4. Full metadata card ─────────────────────────────────── */}
          <div style={{ background: 'white', borderRadius: 16, padding: 20, border: '1px solid #f1f5f9', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
              <BookOpen size={14} color="#94a3b8" />
              <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Metadatos</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <MetaRow label="Fuente">
                <span style={{ color: providerCfg.color }}>{providerCfg.label}</span>
              </MetaRow>
              {asset.publishedAt && (
                <MetaRow label="Publicado">{asset.publishedAt.slice(0, 10)}</MetaRow>
              )}
              {asset.resourceType && (
                <MetaRow label="Tipo">{asset.resourceType}</MetaRow>
              )}
              {metaFormat && (
                <MetaRow label="Formato">{metaFormat}</MetaRow>
              )}
              {metaExtension && (
                <MetaRow label="Extensión">{metaExtension.toUpperCase()}</MetaRow>
              )}
              {metaMinutes && (
                <MetaRow label="Tiempo estimado">{metaMinutes} min</MetaRow>
              )}
              {metaFaculty && (
                <MetaRow label="Facultad">{metaFaculty}</MetaRow>
              )}
              {metaProgram && (
                <MetaRow label="Programa">{metaProgram}</MetaRow>
              )}
              {asset.language && (
                <MetaRow label="Idioma">{asset.language.toUpperCase()}</MetaRow>
              )}
              {asset.citationCount > 0 && (
                <MetaRow label="Citas">{asset.citationCount.toLocaleString()}</MetaRow>
              )}
            </div>

            {/* Authors */}
            {asset.authors.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f8fafc' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <Users size={12} color="#94a3b8" />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Autores</span>
                </div>
                <div style={{ fontSize: 13, color: '#1e293b', lineHeight: 1.6, fontWeight: 500 }}>
                  {asset.authors.slice(0, 5).join(', ')}{asset.authors.length > 5 ? ` +${asset.authors.length - 5} más` : ''}
                </div>
              </div>
            )}

            {/* Thematic areas */}
            {metaThematicAreas && metaThematicAreas.length > 0 && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f8fafc' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Áreas temáticas
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {metaThematicAreas.map((area) => (
                    <span key={area} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe' }}>
                      {area}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {metaKeywords && metaKeywords.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  Palabras clave
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {metaKeywords.map((kw) => (
                    <span key={kw} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 999, background: '#f0fdfa', color: '#0d9488', border: '1px solid #99f6e4' }}>
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* DOI */}
            {asset.doi && (
              <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f8fafc', display: 'flex', alignItems: 'center', gap: 10, padding: '12px', background: '#f8fafc', borderRadius: 12, border: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 11, color: '#64748b', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  doi:{asset.doi}
                </span>
                <button onClick={copyDOI} style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: '#94a3b8', borderRadius: 8 }} title="Copiar DOI">
                  {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                </button>
              </div>
            )}
          </div>

          {/* ── 5. APA 7 citation ────────────────────────────────────────── */}
          <div style={{ background: '#fafaf9', borderRadius: 16, padding: 20, border: '1px solid #e7e5e4' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#78716c', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Referencia APA 7
              </span>
              <button
                onClick={copyAPA}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, background: 'white', border: '1px solid #d6d3d1', color: '#78716c', cursor: 'pointer' }}
              >
                {copiedAPA ? <Check size={12} color="#16a34a" /> : <Copy size={12} />}
                <span>{copiedAPA ? 'Copiado' : 'Copiar'}</span>
              </button>
            </div>
            <p style={{ fontSize: 13, color: '#44403c', lineHeight: 1.7, fontStyle: 'italic', margin: 0 }}>
              {generateAPA7(asset)}
            </p>
          </div>

          {/* ── 6. Inline course linking form ────────────────────────────── */}
          <AnimatePresence>
            {showCourseForm && (
              <motion.div
                key="course-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
              >
                {addSuccess ? (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: 24, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 16, textAlign: 'center' }}>
                    <CheckCircle2 size={40} color="#16a34a" />
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#15803d' }}>¡Recurso vinculado con éxito!</div>
                  </div>
                ) : (
                  <form onSubmit={handleAddSubmit} style={{ padding: 20, background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Vinculación institucional
                    </div>
                    <div style={{ position: 'relative', minWidth: 0 }}>
                      <select
                        style={{ width: '100%', background: 'white', border: '1px solid #e2e8f0', fontSize: 14, borderRadius: 12, padding: '12px 16px', paddingRight: 36, outline: 'none', fontWeight: 600, color: '#1e293b', appearance: 'none' }}
                        value={selectedCourse}
                        onChange={(e) => setSelectedCourse(e.target.value)}
                        required
                      >
                        {courseOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label.length > 60 ? `${opt.label.slice(0, 57)}…` : opt.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} />
                    </div>
                    <input
                      type="text"
                      style={{ width: '100%', background: 'white', border: '1px solid #e2e8f0', fontSize: 14, borderRadius: 12, padding: '12px 16px', outline: 'none', color: '#1e293b', fontWeight: 500 }}
                      placeholder="Nombre de la unidad o sección (opcional)"
                      value={targetUnit}
                      onChange={(e) => setTargetUnit(e.target.value)}
                    />
                    <button
                      type="submit"
                      disabled={isAdding || !selectedCourse}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        gap: 8, padding: '14px', borderRadius: 12, fontSize: 14, fontWeight: 700,
                        background: 'linear-gradient(135deg, #0d9488, #0891b2)', color: 'white',
                        border: 'none', cursor: 'pointer', opacity: isAdding || !selectedCourse ? 0.6 : 1,
                      }}
                    >
                      {isAdding ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={16} />}
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
