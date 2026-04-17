/**
 * H5PManager — Full instructor UI for the H5P module.
 *
 * Features:
 *  - List all H5P activities for a course
 *  - Create: embed URL/HTML or upload .h5p package
 *  - Preview with H5PPlayer
 *  - Delete
 *  - Content type picker showing available H5P types
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileUp,
  Loader2,
  Package2,
  Play,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import { H5PPlayer } from './H5PPlayer.js';
import type { H5PContent } from '../../lib/h5p.js';
import { H5P_CONTENT_TYPES } from '../../lib/h5p.js';

interface H5PManagerProps {
  courseSlug?: string;
  /** If false (viewer/student), only show player — no create/delete */
  canEdit?: boolean;
}

type Tab = 'list' | 'create-embed' | 'create-upload' | 'preview';

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function H5PManager({ courseSlug, canEdit = true }: H5PManagerProps) {
  const [items, setItems] = useState<H5PContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('list');
  const [previewItem, setPreviewItem] = useState<H5PContent | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = courseSlug ? `?courseSlug=${encodeURIComponent(courseSlug)}` : '';
      const resp = await fetch(`/api/h5p/content${params}`);
      if (!resp.ok) throw new Error('No se pudo cargar las actividades H5P');
      const data = await resp.json() as { items: H5PContent[] };
      setItems(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar');
    } finally {
      setLoading(false);
    }
  }, [courseSlug]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  async function handleDelete(id: string) {
    setDeleteId(id);
    try {
      await fetch(`/api/h5p/content?id=${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((i) => i.id !== id));
    } catch { /* ignore */ } finally {
      setDeleteId(null);
    }
  }

  if (tab === 'preview' && previewItem) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => { setTab('list'); setPreviewItem(null); }}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            ← Volver
          </button>
          <h3 className="text-sm font-bold text-slate-700">{previewItem.title}</h3>
        </div>
        <H5PPlayer content={previewItem} />
      </div>
    );
  }

  if (tab === 'create-embed') {
    return (
      <CreateEmbedForm
        courseSlug={courseSlug}
        onCancel={() => setTab('list')}
        onCreated={() => { void fetchItems(); setTab('list'); }}
      />
    );
  }

  if (tab === 'create-upload') {
    return (
      <UploadForm
        courseSlug={courseSlug}
        onCancel={() => setTab('list')}
        onCreated={() => { void fetchItems(); setTab('list'); }}
      />
    );
  }

  // ── List view ───────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black"
              style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}
            >
              H5P
            </div>
            <h2 className="text-base font-bold text-slate-800">Actividades Interactivas H5P</h2>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {items.length} actividad{items.length !== 1 ? 'es' : ''} · xAPI tracking habilitado
          </p>
        </div>

        {canEdit && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setTab('create-embed')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 border-slate-200 text-slate-600 hover:border-teal-400 hover:text-teal-600 transition-all"
            >
              <ExternalLink size={13} />
              Insertar URL
            </button>
            <button
              onClick={() => setTab('create-upload')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white shadow-sm transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}
            >
              <FileUp size={13} />
              Subir .h5p
            </button>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-teal-500" />
        </div>
      )}

      {/* Empty state */}
      {!loading && items.length === 0 && (
        <ContentTypePicker
          onSelectEmbed={() => setTab('create-embed')}
          onSelectUpload={() => setTab('create-upload')}
          canEdit={canEdit}
        />
      )}

      {/* Content grid */}
      {!loading && items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => (
            <H5PCard
              key={item.id}
              item={item}
              isDeleting={deleteId === item.id}
              onPreview={() => { setPreviewItem(item); setTab('preview'); }}
              onDelete={canEdit ? () => void handleDelete(item.id) : undefined}
            />
          ))}

          {canEdit && (
            <button
              onClick={() => setTab('create-upload')}
              className="flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-teal-400 hover:text-teal-500 transition-all group min-h-[160px]"
            >
              <Plus size={24} className="group-hover:scale-110 transition-transform" />
              <span className="text-sm font-bold">Añadir actividad</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// H5P content card
// ─────────────────────────────────────────────────────────────────────────────

function H5PCard({
  item,
  isDeleting,
  onPreview,
  onDelete,
}: {
  item: H5PContent;
  isDeleting: boolean;
  onPreview: () => void;
  onDelete?: () => void;
}) {
  const typeInfo = H5P_CONTENT_TYPES.find((t) => t.machineName === item.libraryName);

  return (
    <div className="relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group overflow-hidden">
      {/* Color bar */}
      <div
        className="h-1.5 w-full"
        style={{ background: 'linear-gradient(90deg, #0d9488, #0891b2)' }}
      />

      <div className="p-4 space-y-3">
        {/* Icon + title */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f0fdfa, #e0f2fe)' }}
          >
            {typeInfo?.icon ?? (item.kind === 'embed' ? '🔗' : '📦')}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-slate-800 leading-snug line-clamp-2">
              {item.title}
            </h3>
            <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
              {typeInfo?.title ?? item.libraryName ?? (item.kind === 'embed' ? 'Embed externo' : 'Paquete H5P')}
            </p>
          </div>
        </div>

        {/* Description */}
        {item.description && (
          <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{item.description}</p>
        )}

        {/* Metadata row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
            item.kind === 'embed'
              ? 'text-blue-600 bg-blue-50 border-blue-200'
              : 'text-teal-600 bg-teal-50 border-teal-200'
          }`}>
            {item.kind === 'embed' ? 'Embed' : 'Paquete'}
          </span>
          {item.xapiTracking && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full text-violet-600 bg-violet-50 border border-violet-200 uppercase tracking-wider">
              xAPI
            </span>
          )}
          {item.libraryVersion && (
            <span className="text-[9px] text-slate-400 font-mono">v{item.libraryVersion}</span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <button
            onClick={onPreview}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold text-white transition-all active:scale-95 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}
          >
            <Play size={12} />
            Iniciar
          </button>

          {onDelete && (
            <button
              onClick={onDelete}
              disabled={isDeleting}
              className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors border border-transparent hover:border-red-200"
            >
              {isDeleting
                ? <Loader2 size={14} className="animate-spin" />
                : <Trash2 size={14} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Content type picker (empty state)
// ─────────────────────────────────────────────────────────────────────────────

function ContentTypePicker({
  onSelectEmbed,
  onSelectUpload,
  canEdit,
}: {
  onSelectEmbed: () => void;
  onSelectUpload: () => void;
  canEdit: boolean;
}) {
  return (
    <div className="rounded-[24px] border-2 border-dashed border-slate-200 p-8">
      <div className="text-center mb-8">
        <div
          className="inline-flex w-14 h-14 rounded-2xl items-center justify-center text-2xl mb-4 shadow-sm"
          style={{ background: 'linear-gradient(135deg, #f0fdfa, #e0f2fe)' }}
        >
          🎮
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Actividades H5P</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          H5P permite crear contenido interactivo enriquecido: cuestionarios, videos
          interactivos, presentaciones de curso y más de 50 tipos de actividades.
        </p>
      </div>

      {canEdit && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8 max-w-lg mx-auto">
            <button
              onClick={onSelectUpload}
              className="flex items-center gap-3 p-4 rounded-2xl border-2 border-teal-200 hover:border-teal-400 bg-teal-50/50 hover:bg-teal-50 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Package2 size={18} className="text-teal-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-teal-700">Subir paquete</p>
                <p className="text-[11px] text-teal-500">Archivo .h5p de Lumi o H5P.org</p>
              </div>
            </button>

            <button
              onClick={onSelectEmbed}
              className="flex items-center gap-3 p-4 rounded-2xl border-2 border-blue-200 hover:border-blue-400 bg-blue-50/50 hover:bg-blue-50 transition-all group text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <ExternalLink size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-blue-700">Insertar URL</p>
                <p className="text-[11px] text-blue-500">iFrame de h5p.org u otro servidor</p>
              </div>
            </button>
          </div>

          {/* Content type grid */}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center mb-4">
              Tipos de contenido disponibles
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {H5P_CONTENT_TYPES.map((ct) => (
                <div
                  key={ct.machineName}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-100 hover:border-teal-200 hover:bg-teal-50/50 transition-all cursor-default"
                  title={ct.description}
                >
                  <span className="text-base flex-shrink-0">{ct.icon}</span>
                  <span className="text-xs font-semibold text-slate-600 line-clamp-1">{ct.title}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!canEdit && (
        <p className="text-center text-sm text-slate-400">No hay actividades H5P en este curso.</p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Create embed form
// ─────────────────────────────────────────────────────────────────────────────

function CreateEmbedForm({
  courseSlug,
  onCancel,
  onCreated,
}: {
  courseSlug?: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [embedUrl, setEmbedUrl] = useState('');
  const [embedHtml, setEmbedHtml] = useState('');
  const [inputMode, setInputMode] = useState<'url' | 'html'>('url');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('El título es obligatorio'); return; }
    if (inputMode === 'url' && !embedUrl.trim()) { setError('La URL es obligatoria'); return; }
    if (inputMode === 'html' && !embedHtml.trim()) { setError('El código HTML es obligatorio'); return; }

    // Extract src from iframe HTML if needed
    let finalUrl = embedUrl;
    if (inputMode === 'html') {
      const match = embedHtml.match(/src="([^"]+)"/);
      finalUrl = match ? match[1] : '';
    }

    setSubmitting(true);
    setError(null);
    try {
      const resp = await fetch('/api/h5p/content', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          kind: 'embed',
          embedUrl: finalUrl || undefined,
          embedHtml: inputMode === 'html' ? embedHtml.trim() : undefined,
          courseSlug,
        }),
      });
      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error ?? 'Error al crear');
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="text-sm font-bold text-slate-500 hover:text-slate-800">
          ← Cancelar
        </button>
        <h3 className="text-base font-bold text-slate-800">Insertar H5P desde URL</h3>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Título *
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Cuestionario Unidad 1"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
            required
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Descripción
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción breve de la actividad"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
          />
        </div>

        {/* Input mode toggle */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          {(['url', 'html'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setInputMode(mode)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                inputMode === mode ? 'bg-white shadow text-slate-800' : 'text-slate-500'
              }`}
            >
              {mode === 'url' ? 'URL directa' : 'Código iframe'}
            </button>
          ))}
        </div>

        {inputMode === 'url' ? (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              URL del contenido H5P *
            </label>
            <input
              type="url"
              value={embedUrl}
              onChange={(e) => setEmbedUrl(e.target.value)}
              placeholder="https://h5p.org/h5p/embed/12345"
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400 font-mono"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              URL de cualquier servidor H5P (h5p.org, Lumi Education, Moodle, etc.)
            </p>
          </div>
        ) : (
          <div>
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
              Código de inserción (iframe) *
            </label>
            <textarea
              value={embedHtml}
              onChange={(e) => setEmbedHtml(e.target.value)}
              placeholder={'<iframe src="https://..." width="1090" height="675" ...></iframe>'}
              rows={4}
              className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400 font-mono resize-none"
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Zap size={15} />}
            Guardar actividad
          </button>
          <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload .h5p package form
// ─────────────────────────────────────────────────────────────────────────────

function UploadForm({
  courseSlug,
  onCancel,
  onCreated,
}: {
  courseSlug?: string;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) { setError('Selecciona un archivo .h5p'); return; }

    setUploading(true);
    setProgress('Procesando archivo…');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title.trim()) formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (courseSlug) formData.append('courseSlug', courseSlug);

      setProgress('Subiendo a R2…');

      const resp = await fetch('/api/h5p/upload', {
        method: 'POST',
        body: formData,
      });

      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error ?? 'Error al subir');
      }

      const result = await resp.json() as { filesUploaded: number };
      setProgress(`✓ ${result.filesUploaded} archivos subidos`);
      setSuccess(true);
      setTimeout(() => onCreated(), 1200);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir el archivo');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="text-sm font-bold text-slate-500 hover:text-slate-800">
          ← Cancelar
        </button>
        <h3 className="text-base font-bold text-slate-800">Subir paquete .h5p</h3>
      </div>

      {/* Lumi tip */}
      <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-2xl mb-6">
        <span className="text-2xl flex-shrink-0">💡</span>
        <div>
          <p className="text-sm font-bold text-teal-800 mb-1">¿Cómo crear archivos .h5p?</p>
          <p className="text-xs text-teal-700 leading-relaxed">
            Usa <strong>Lumi Education Desktop</strong> (app gratuita) para crear y exportar actividades H5P
            en tu computador, o descarga contenido de{' '}
            <a href="https://h5p.org/content-types-and-applications" target="_blank" rel="noopener noreferrer" className="underline font-bold">
              h5p.org
            </a>.
          </p>
        </div>
      </div>

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        {/* File drop zone */}
        <div
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
            file ? 'border-teal-400 bg-teal-50' : 'border-slate-200 hover:border-teal-300 hover:bg-slate-50'
          }`}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = e.dataTransfer.files[0];
            if (dropped?.name.endsWith('.h5p')) {
              setFile(dropped);
              if (!title) setTitle(dropped.name.replace('.h5p', ''));
            }
          }}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".h5p"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFile(f);
                if (!title) setTitle(f.name.replace('.h5p', ''));
              }
            }}
          />
          {file ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 size={32} className="text-teal-500" />
              <p className="text-sm font-bold text-teal-700">{file.name}</p>
              <p className="text-xs text-teal-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <FileUp size={32} className="text-slate-300" />
              <p className="text-sm font-bold text-slate-500">Arrastra un archivo .h5p aquí</p>
              <p className="text-xs text-slate-400">o haz clic para buscar</p>
            </div>
          )}
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Título
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Se extraerá automáticamente del archivo si no se especifica"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
          />
        </div>

        <div>
          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
            Descripción
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descripción breve de la actividad"
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400"
          />
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {progress && !error && (
          <div className="flex items-center gap-2 p-3 bg-teal-50 border border-teal-200 rounded-xl text-teal-700 text-xs">
            {success ? <CheckCircle2 size={14} /> : <Loader2 size={14} className="animate-spin" />}
            {progress}
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={uploading || !file}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white shadow-sm transition-all active:scale-95 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}
          >
            {uploading ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
            {uploading ? 'Subiendo…' : 'Subir actividad'}
          </button>
          <button type="button" onClick={onCancel} className="text-sm text-slate-500 hover:text-slate-700">
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
