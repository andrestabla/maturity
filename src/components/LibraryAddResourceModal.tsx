import { useEffect, useState } from 'react';
import {
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  Code2,
  FileUp,
  Globe2,
  Loader2,
  TriangleAlert,
  Youtube,
} from 'lucide-react';
import { SidePanel } from './SidePanel.js';

export interface InstitutionalResourceInput {
  title: string;
  description: string;
  authors: string[];
  thematicAreas: string[];
  keywords: string[];
  year: string;
  resourceType: string;
  extension: string;
  format: string;
  estimatedStudyMinutes: number;
  canonicalUrl: string;
  visibility: 'Institucional' | 'Publico';
  embedCode?: string;
  sourceType: 'link' | 'youtube' | 'iframe' | 'file';
}

interface LibraryAddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InstitutionalResourceInput) => Promise<void>;
}

type SourceType = 'link' | 'youtube' | 'iframe' | 'file';

interface FormState {
  title: string;
  description: string;
  authors: string;
  thematicAreas: string;
  keywords: string;
  year: string;
  resourceType: string;
  extension: string;
  format: string;
  estimatedStudyMinutes: string;
  visibility: 'Institucional' | 'Publico';
}

const SOURCE_TYPES: { id: SourceType; label: string; icon: React.ElementType; placeholder: string }[] = [
  { id: 'link', label: 'Enlace público', icon: Globe2, placeholder: 'https://ejemplo.com/recurso' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/watch?v=...' },
  { id: 'iframe', label: 'Iframe / Embed', icon: Code2, placeholder: '<iframe src="..." width="..." height="..."></iframe>' },
  { id: 'file', label: 'Archivo (URL)', icon: FileUp, placeholder: 'https://servidor.edu/archivo.pdf' },
];

const RESOURCE_TYPES = ['Artículo', 'Paper', 'Video', 'Guía', 'Dataset', 'Simulación', 'Presentación', 'Otro'];
const FORMATS = ['PDF', 'Video', 'Presentación', 'Documento', 'Imagen', 'Enlace externo'];

const DEFAULT_FORM: FormState = {
  title: '',
  description: '',
  authors: '',
  thematicAreas: '',
  keywords: '',
  year: String(new Date().getFullYear()),
  resourceType: 'Artículo',
  extension: '',
  format: 'Enlace externo',
  estimatedStudyMinutes: '',
  visibility: 'Institucional',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputClass =
  'w-full bg-white border border-slate-200 text-sm rounded-xl py-2.5 px-3.5 outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400 placeholder:text-slate-300 text-ink font-medium transition-all';

const selectClass =
  'w-full bg-white border border-slate-200 text-sm rounded-xl py-2.5 px-3.5 pr-8 outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400 text-ink font-medium appearance-none transition-all';

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
    </div>
  );
}

export function LibraryAddResourceModal({ isOpen, onClose, onSubmit }: LibraryAddResourceModalProps) {
  const [sourceType, setSourceType] = useState<SourceType>('link');
  const [sourceInput, setSourceInput] = useState('');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isAssisting, setIsAssisting] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiDone, setAiDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSourceType('link');
      setSourceInput('');
      setForm(DEFAULT_FORM);
      setIsAssisting(false);
      setAiError('');
      setAiDone(false);
      setIsSubmitting(false);
      setSubmitError('');
      setSuccess(false);
    }
  }, [isOpen]);

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleAiAssist() {
    if (!sourceInput.trim()) return;
    setIsAssisting(true);
    setAiError('');
    setAiDone(false);
    try {
      const resp = await fetch('/api/library/metadata-assist', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: sourceInput, sourceType, existingTitle: form.title || undefined }),
      });
      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error ?? 'Error al consultar al asistente');
      }
      const data = await resp.json() as { metadata: Record<string, unknown> };
      const m = data.metadata;
      setForm((f) => ({
        ...f,
        title: (m.title as string) || f.title,
        description: (m.description as string) || f.description,
        authors: Array.isArray(m.authors) ? (m.authors as string[]).join(', ') : f.authors,
        thematicAreas: Array.isArray(m.thematicAreas) ? (m.thematicAreas as string[]).join(', ') : f.thematicAreas,
        keywords: Array.isArray(m.keywords) ? (m.keywords as string[]).join(', ') : f.keywords,
        year: m.year ? String(m.year) : f.year,
        resourceType: (m.resourceType as string) || f.resourceType,
        extension: (m.extension as string) || f.extension,
        format: (m.format as string) || f.format,
        estimatedStudyMinutes: m.estimatedStudyMinutes ? String(m.estimatedStudyMinutes) : f.estimatedStudyMinutes,
      }));
      setAiDone(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al consultar el asistente');
    } finally {
      setIsAssisting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
        authors: form.authors.split(',').map((s) => s.trim()).filter(Boolean),
        thematicAreas: form.thematicAreas.split(',').map((s) => s.trim()).filter(Boolean),
        keywords: form.keywords.split(',').map((s) => s.trim()).filter(Boolean),
        year: form.year,
        resourceType: form.resourceType,
        extension: form.extension.trim(),
        format: form.format,
        estimatedStudyMinutes: Number(form.estimatedStudyMinutes) || 0,
        canonicalUrl: sourceType !== 'iframe' ? sourceInput.trim() : '',
        visibility: form.visibility,
        embedCode: sourceType === 'iframe' ? sourceInput.trim() : undefined,
        sourceType,
      });
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al agregar el recurso');
    } finally {
      setIsSubmitting(false);
    }
  }

  const activeSrc = SOURCE_TYPES.find((s) => s.id === sourceType)!;
  const canAssist = sourceInput.trim().length > 0 && sourceType !== 'iframe';

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar Recurso Institucional"
      description="Añade un recurso al repositorio con metadatos curados por IA."
      sideLabel="REPOSITORIO"
      sideDescription="Institucional"
      width="lg"
      footer={
        success ? null : (
          <button
            type="submit"
            form="add-resource-form"
            disabled={isSubmitting || !form.title.trim() || (!sourceInput.trim() && sourceType !== 'iframe')}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white transition-all shadow-lg active:scale-[0.98] disabled:opacity-40"
            style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            <span>{isSubmitting ? 'Guardando…' : 'Agregar al Repositorio'}</span>
          </button>
        )
      }
    >
      {success ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCircle2 size={44} className="text-emerald-500" />
          </div>
          <div>
            <div className="text-xl font-bold text-ink mb-1">¡Recurso agregado!</div>
            <div className="text-sm text-muted">Ya está disponible en el repositorio institucional.</div>
          </div>
          <button
            onClick={onClose}
            className="mt-2 px-6 py-2.5 rounded-xl text-sm font-bold border-2 border-ink text-ink hover:bg-ink hover:text-white transition-all"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <form id="add-resource-form" onSubmit={handleSubmit} className="space-y-6">

          {/* ── Source type ─────────────────────────────────────── */}
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">
              Tipo de origen
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SOURCE_TYPES.map((src) => {
                const Icon = src.icon;
                const active = sourceType === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => { setSourceType(src.id); setSourceInput(''); setAiDone(false); setAiError(''); }}
                    className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-2xl border-2 text-xs font-bold transition-all ${
                      active
                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                        : 'border-slate-200 text-slate-500 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <Icon size={18} />
                    <span className="text-center leading-tight">{src.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Source input ─────────────────────────────────────── */}
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
              {activeSrc.label}
            </div>
            {sourceType === 'iframe' ? (
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder={activeSrc.placeholder}
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
              />
            ) : (
              <input
                type="url"
                className={inputClass}
                placeholder={activeSrc.placeholder}
                value={sourceInput}
                onChange={(e) => { setSourceInput(e.target.value); setAiDone(false); }}
              />
            )}

            {/* AI Assist button */}
            <button
              type="button"
              onClick={handleAiAssist}
              disabled={!canAssist || isAssisting}
              className={`mt-2.5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${
                aiDone
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                  : canAssist
                    ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
                    : 'border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
              }`}
            >
              {isAssisting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : aiDone ? (
                <CheckCircle2 size={14} />
              ) : (
                <BrainCircuit size={14} />
              )}
              <span>
                {isAssisting
                  ? 'Analizando con IA…'
                  : aiDone
                    ? 'Metadatos completados por IA'
                    : 'Completar metadatos con IA'}
              </span>
            </button>

            {aiError && (
              <div className="mt-2 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <TriangleAlert size={13} />
                <span>{aiError}</span>
              </div>
            )}
          </div>

          {/* ── Metadata fields ──────────────────────────────────── */}
          <div className="space-y-4 pt-2 border-t border-slate-100">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider">Metadatos</div>

            <Field label="Título" required>
              <input
                type="text"
                className={inputClass}
                placeholder="Título del recurso"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                required
              />
            </Field>

            <Field label="Descripción">
              <textarea
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Describe brevemente el contenido y su utilidad académica"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Autor(es)">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Apellido, Nombre; ..."
                  value={form.authors}
                  onChange={(e) => set('authors', e.target.value)}
                />
              </Field>

              <Field label="Año">
                <input
                  type="number"
                  className={inputClass}
                  placeholder={String(new Date().getFullYear())}
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  value={form.year}
                  onChange={(e) => set('year', e.target.value)}
                />
              </Field>
            </div>

            <Field label="Áreas temáticas">
              <input
                type="text"
                className={inputClass}
                placeholder="Educación, Tecnología, Ciencias… (separar por comas)"
                value={form.thematicAreas}
                onChange={(e) => set('thematicAreas', e.target.value)}
              />
            </Field>

            <Field label="Palabras clave">
              <input
                type="text"
                className={inputClass}
                placeholder="aprendizaje, IA, didáctica… (separar por comas)"
                value={form.keywords}
                onChange={(e) => set('keywords', e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Tipo de recurso">
                <SelectWrapper>
                  <select
                    className={selectClass}
                    value={form.resourceType}
                    onChange={(e) => set('resourceType', e.target.value)}
                  >
                    {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </SelectWrapper>
              </Field>

              <Field label="Formato">
                <SelectWrapper>
                  <select
                    className={selectClass}
                    value={form.format}
                    onChange={(e) => set('format', e.target.value)}
                  >
                    {FORMATS.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </SelectWrapper>
              </Field>

              <Field label="Extensión">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="PDF, MP4…"
                  value={form.extension}
                  onChange={(e) => set('extension', e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tiempo de estudio (min)">
                <input
                  type="number"
                  className={inputClass}
                  placeholder="30"
                  min={1}
                  value={form.estimatedStudyMinutes}
                  onChange={(e) => set('estimatedStudyMinutes', e.target.value)}
                />
              </Field>

              <Field label="Visibilidad">
                <SelectWrapper>
                  <select
                    className={selectClass}
                    value={form.visibility}
                    onChange={(e) => set('visibility', e.target.value as 'Institucional' | 'Publico')}
                  >
                    <option value="Institucional">Institucional</option>
                    <option value="Publico">Público</option>
                  </select>
                </SelectWrapper>
              </Field>
            </div>

            {sourceType !== 'iframe' && (
              <Field label="Enlace público">
                <input
                  type="url"
                  className={`${inputClass} font-mono text-xs`}
                  placeholder="https://..."
                  value={sourceInput}
                  onChange={(e) => setSourceInput(e.target.value)}
                />
              </Field>
            )}
          </div>

          {submitError && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
              <TriangleAlert size={13} />
              <span>{submitError}</span>
            </div>
          )}
        </form>
      )}
    </SidePanel>
  );
}
