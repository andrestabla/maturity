import { useEffect, useRef, useState } from 'react';
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
  UploadCloud,
  X,
  Youtube,
} from 'lucide-react';
import { SidePanel } from './SidePanel.js';
import type { InstitutionSettings, InstitutionStructure } from '../types.js';

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
  institutionId?: string;
  institutionName?: string;
  faculty?: string;
  program?: string;
}

interface LibraryAddResourceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InstitutionalResourceInput) => Promise<void>;
  institutionSettings: InstitutionSettings;
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
  institutionStructureId: string;
  faculty: string;
  program: string;
}

const SOURCE_TYPES: { id: SourceType; label: string; icon: React.ElementType; placeholder: string }[] = [
  { id: 'link', label: 'Enlace', icon: Globe2, placeholder: 'https://ejemplo.com/recurso' },
  { id: 'youtube', label: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/watch?v=...' },
  { id: 'iframe', label: 'Embed', icon: Code2, placeholder: '<iframe src="..." width="640" height="360"></iframe>' },
  { id: 'file', label: 'Archivo', icon: FileUp, placeholder: '' },
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
  institutionStructureId: '',
  faculty: '',
  program: '',
};

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0">
      <label className="flex items-baseline gap-1 text-[10px] font-bold text-muted uppercase tracking-wider mb-1.5">
        <span>{label}{required && <span className="text-red-400 ml-0.5">*</span>}</span>
        {hint && <span className="font-normal text-slate-400" style={{ textTransform: 'none', letterSpacing: 0 }}>· {hint}</span>}
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

export function LibraryAddResourceModal({
  isOpen,
  onClose,
  onSubmit,
  institutionSettings,
}: LibraryAddResourceModalProps) {
  const [sourceType, setSourceType] = useState<SourceType>('link');
  const [sourceInput, setSourceInput] = useState('');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [isAssisting, setIsAssisting] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiDone, setAiDone] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [success, setSuccess] = useState(false);

  // File upload state
  const [uploadedFile, setUploadedFile] = useState<{ name: string; url: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setUploadedFile(null);
      setIsUploading(false);
      setUploadError('');
    }
  }, [isOpen]);

  // ── Institution hierarchy ────────────────────────────────────────────────────

  const structures = institutionSettings.structures ?? [];
  const institutionOptions: InstitutionStructure[] = structures.length > 0 ? structures : [];
  const selectedStructure = structures.find((s) => s.id === form.institutionStructureId) ?? null;

  const facultyOptions: string[] =
    selectedStructure?.faculties.length
      ? selectedStructure.faculties
      : (institutionSettings.faculties ?? []);

  const programOptions: string[] =
    selectedStructure?.programs.length
      ? selectedStructure.programs
      : (institutionSettings.programs ?? []);

  const hasInstitutionData =
    institutionOptions.length > 0 ||
    (institutionSettings.faculties ?? []).length > 0 ||
    (institutionSettings.programs ?? []).length > 0;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function set(field: keyof FormState, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  function handleSourceTypeChange(type: SourceType) {
    setSourceType(type);
    setSourceInput('');
    setAiDone(false);
    setAiError('');
    setUploadedFile(null);
    setUploadError('');
  }

  // ── File upload ──────────────────────────────────────────────────────────────

  async function handleFileSelect(file: File) {
    setIsUploading(true);
    setUploadError('');
    setUploadedFile(null);
    setSourceInput('');
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('scope', 'library');
      const resp = await fetch('/api/uploads', { method: 'POST', body: fd });
      if (!resp.ok) {
        const err = (await resp.json()) as { error?: string };
        throw new Error(err.error ?? 'Error al cargar el archivo');
      }
      const { url } = (await resp.json()) as { key: string; url: string };
      setUploadedFile({ name: file.name, url });
      setSourceInput(url);
      // Auto-detect extension and format
      const ext = file.name.split('.').pop()?.toUpperCase() ?? '';
      if (ext) {
        set('extension', ext);
        if (['PDF'].includes(ext)) set('format', 'PDF');
        else if (['MP4', 'WEBM', 'MOV', 'AVI'].includes(ext)) set('format', 'Video');
        else if (['PPT', 'PPTX'].includes(ext)) set('format', 'Presentación');
        else if (['DOC', 'DOCX', 'TXT', 'ODT'].includes(ext)) set('format', 'Documento');
        else if (['JPG', 'JPEG', 'PNG', 'GIF', 'WEBP'].includes(ext)) set('format', 'Imagen');
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Error al cargar el archivo');
    } finally {
      setIsUploading(false);
    }
  }

  function handleRemoveFile() {
    setUploadedFile(null);
    setSourceInput('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── AI Assist ────────────────────────────────────────────────────────────────

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
        const err = (await resp.json()) as { error?: string };
        throw new Error(err.error ?? 'Error al consultar al asistente');
      }
      const data = (await resp.json()) as { metadata: Record<string, unknown> };
      const m = data.metadata;
      setForm((f) => ({
        ...f,
        title: (m.title as string) || f.title,
        description: (m.description as string) || f.description,
        authors: Array.isArray(m.authors) ? (m.authors as string[]).join(', ') : f.authors,
        thematicAreas: Array.isArray(m.thematicAreas)
          ? (m.thematicAreas as string[]).join(', ')
          : f.thematicAreas,
        keywords: Array.isArray(m.keywords) ? (m.keywords as string[]).join(', ') : f.keywords,
        year: m.year ? String(m.year) : f.year,
        resourceType: (m.resourceType as string) || f.resourceType,
        extension: (m.extension as string) || f.extension,
        format: (m.format as string) || f.format,
        estimatedStudyMinutes: m.estimatedStudyMinutes
          ? String(m.estimatedStudyMinutes)
          : f.estimatedStudyMinutes,
      }));
      setAiDone(true);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : 'Error al consultar el asistente');
    } finally {
      setIsAssisting(false);
    }
  }

  // ── Submit ───────────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const structure = structures.find((s) => s.id === form.institutionStructureId);
      await onSubmit({
        title: form.title.trim(),
        description: form.description.trim(),
        authors: form.authors
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        thematicAreas: form.thematicAreas
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        keywords: form.keywords
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        year: form.year,
        resourceType: form.resourceType,
        extension: form.extension.trim(),
        format: form.format,
        estimatedStudyMinutes: Number(form.estimatedStudyMinutes) || 0,
        canonicalUrl: sourceType !== 'iframe' ? sourceInput.trim() : '',
        visibility: form.visibility,
        embedCode: sourceType === 'iframe' ? sourceInput.trim() : undefined,
        sourceType,
        institutionId: form.institutionStructureId || undefined,
        institutionName: structure?.institution || undefined,
        faculty: form.faculty || undefined,
        program: form.program || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Error al agregar el recurso');
    } finally {
      setIsSubmitting(false);
    }
  }

  const canAssist = sourceInput.trim().length > 0 && sourceType !== 'iframe' && sourceType !== 'file';
  const canSubmit =
    !isSubmitting &&
    form.title.trim().length > 0 &&
    (sourceType === 'iframe' ? sourceInput.trim().length > 0 : sourceInput.trim().length > 0);

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Agregar Recurso Institucional"
      description="Añade un recurso al repositorio con metadatos curados por IA."
      sideLabel="REPOSITORIO"
      sideDescription="Institucional"
      width="xl"
      footer={
        success ? null : (
          <button
            type="submit"
            form="add-resource-form"
            disabled={!canSubmit}
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
        <form id="add-resource-form" onSubmit={handleSubmit} className="space-y-5">

          {/* ── Source type tabs ──────────────────────────────────────── */}
          <div>
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">
              Tipo de origen
            </div>
            <div className="flex gap-1 p-1 bg-slate-100 rounded-2xl">
              {SOURCE_TYPES.map((src) => {
                const Icon = src.icon;
                const active = sourceType === src.id;
                return (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => handleSourceTypeChange(src.id)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-1 rounded-xl text-xs font-bold transition-all ${
                      active
                        ? 'bg-white text-teal-700 shadow-sm'
                        : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <Icon size={14} />
                    <span>{src.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Source input ──────────────────────────────────────────── */}
          <div className="space-y-2">
            <div className="text-[10px] font-bold text-muted uppercase tracking-wider">
              {sourceType === 'file' ? 'Archivo' : sourceType === 'iframe' ? 'Código embed' : 'URL'}
            </div>

            {sourceType === 'file' ? (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileSelect(f);
                  }}
                />
                {uploadedFile ? (
                  <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />
                    <span className="text-sm font-medium text-emerald-800 truncate flex-1">
                      {uploadedFile.name}
                    </span>
                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      className="text-emerald-500 hover:text-emerald-700 shrink-0 transition-colors"
                      title="Quitar archivo"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const f = e.dataTransfer.files[0];
                      if (f) void handleFileSelect(f);
                    }}
                    className={`w-full border-2 border-dashed rounded-xl py-7 flex flex-col items-center gap-2 transition-all ${
                      isDragOver
                        ? 'border-teal-400 bg-teal-50 text-teal-600'
                        : 'border-slate-200 text-slate-400 hover:border-teal-300 hover:text-teal-500'
                    }`}
                  >
                    {isUploading ? (
                      <Loader2 size={22} className="animate-spin text-teal-500" />
                    ) : (
                      <UploadCloud size={22} />
                    )}
                    <span className="text-xs font-semibold">
                      {isUploading ? 'Subiendo archivo…' : 'Arrastra o haz clic para seleccionar'}
                    </span>
                    <span className="text-[11px] text-slate-300">PDF, MP4, DOCX, PPTX · Máx. 25 MB</span>
                  </button>
                )}
                {uploadError && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                    <TriangleAlert size={13} />
                    <span>{uploadError}</span>
                  </div>
                )}
              </div>
            ) : sourceType === 'iframe' ? (
              <textarea
                className={`${inputClass} resize-y font-mono text-xs`}
                rows={7}
                placeholder={SOURCE_TYPES.find((s) => s.id === 'iframe')!.placeholder}
                value={sourceInput}
                onChange={(e) => setSourceInput(e.target.value)}
              />
            ) : (
              <input
                type="url"
                className={inputClass}
                placeholder={SOURCE_TYPES.find((s) => s.id === sourceType)!.placeholder}
                value={sourceInput}
                onChange={(e) => { setSourceInput(e.target.value); setAiDone(false); }}
              />
            )}

            {/* AI Assist */}
            {sourceType !== 'iframe' && (
              <button
                type="button"
                onClick={handleAiAssist}
                disabled={!canAssist || isAssisting}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold border transition-all ${
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
                      : sourceType === 'file'
                        ? 'Completar metadatos con IA (requiere URL)'
                        : 'Completar metadatos con IA'}
                </span>
              </button>
            )}

            {aiError && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                <TriangleAlert size={13} />
                <span>{aiError}</span>
              </div>
            )}
          </div>

          {/* ── Metadata ─────────────────────────────────────────────── */}
          <div className="space-y-3.5 pt-4 border-t border-slate-100">
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
                rows={2}
                placeholder="Describe brevemente el contenido y su utilidad académica"
                value={form.description}
                onChange={(e) => set('description', e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Field label="Autor(es)" hint="separar por comas">
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="Apellido, Nombre; …"
                    value={form.authors}
                    onChange={(e) => set('authors', e.target.value)}
                  />
                </Field>
              </div>
              <Field label="Año">
                <input
                  type="number"
                  className={inputClass}
                  min={1900}
                  max={new Date().getFullYear() + 1}
                  value={form.year}
                  onChange={(e) => set('year', e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Áreas temáticas" hint="por comas">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="Educación, Tecnología…"
                  value={form.thematicAreas}
                  onChange={(e) => set('thematicAreas', e.target.value)}
                />
              </Field>
              <Field label="Palabras clave" hint="por comas">
                <input
                  type="text"
                  className={inputClass}
                  placeholder="aprendizaje, IA…"
                  value={form.keywords}
                  onChange={(e) => set('keywords', e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Tipo de recurso">
                <SelectWrapper>
                  <select
                    className={selectClass}
                    value={form.resourceType}
                    onChange={(e) => set('resourceType', e.target.value)}
                  >
                    {RESOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
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
                    {FORMATS.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                </SelectWrapper>
              </Field>
              <Field label="Extensión">
                <input
                  type="text"
                  className={`${inputClass} uppercase`}
                  placeholder="PDF"
                  value={form.extension}
                  onChange={(e) => set('extension', e.target.value.toUpperCase())}
                  maxLength={8}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Tiempo estimado" hint="minutos">
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
                    onChange={(e) =>
                      set('visibility', e.target.value as 'Institucional' | 'Publico')
                    }
                  >
                    <option value="Institucional">Institucional</option>
                    <option value="Publico">Público</option>
                  </select>
                </SelectWrapper>
              </Field>
            </div>
          </div>

          {/* ── Institutional scope ───────────────────────────────────── */}
          {hasInstitutionData && (
            <div className="space-y-3.5 pt-4 border-t border-slate-100">
              <div className="text-[10px] font-bold text-muted uppercase tracking-wider">
                Alcance institucional
                <span className="ml-1.5 font-normal normal-case tracking-normal text-slate-400">
                  (opcional)
                </span>
              </div>

              {institutionOptions.length > 0 ? (
                <Field label="Institución">
                  <SelectWrapper>
                    <select
                      className={selectClass}
                      value={form.institutionStructureId}
                      onChange={(e) => {
                        set('institutionStructureId', e.target.value);
                        set('faculty', '');
                        set('program', '');
                      }}
                    >
                      <option value="">— Todas las instituciones —</option>
                      {institutionOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.institution}
                        </option>
                      ))}
                    </select>
                  </SelectWrapper>
                </Field>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                {facultyOptions.length > 0 && (
                  <Field label="Facultad / Área">
                    <SelectWrapper>
                      <select
                        className={selectClass}
                        value={form.faculty}
                        onChange={(e) => set('faculty', e.target.value)}
                      >
                        <option value="">— Seleccionar —</option>
                        {facultyOptions.map((f) => (
                          <option key={f} value={f}>{f}</option>
                        ))}
                      </select>
                    </SelectWrapper>
                  </Field>
                )}
                {programOptions.length > 0 && (
                  <Field label="Programa">
                    <SelectWrapper>
                      <select
                        className={selectClass}
                        value={form.program}
                        onChange={(e) => set('program', e.target.value)}
                      >
                        <option value="">— Seleccionar —</option>
                        {programOptions.map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </SelectWrapper>
                  </Field>
                )}
              </div>
            </div>
          )}

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
