/**
 * H5PAICreator — Wizard for AI-powered H5P content creation.
 *
 * Steps:
 *  1. source-select  — pick a validation product OR paste/upload text
 *  2. type-select    — choose H5P content type (7 AI-generatable types)
 *  3. generating     — POST /api/h5p/ai-generate and show progress
 *  4. preview        — H5PAIPlayer preview + title edit
 *  5. saving         — POST /api/h5p/content with kind='ai-generated'
 */

import { useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  FileText,
  Loader2,
  PenLine,
  Sparkles,
  Upload,
  Wand2,
} from 'lucide-react';
import { H5PAIPlayer } from './H5PAIPlayer.js';
import type { AIGeneratedContent, AIGeneratableType } from '../../api/h5p/ai-generate.js';
import { AI_GENERATABLE_TYPES } from '../../api/h5p/ai-generate.js';
import type { CourseProduct } from '../types.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface H5PAICreatorProps {
  courseSlug?: string;
  validationProducts?: CourseProduct[];
  onCreated: () => void;
  onCancel: () => void;
}

type Step = 'source-select' | 'type-select' | 'generating' | 'preview' | 'saving' | 'done';

type SourceMode = 'product' | 'paste' | 'upload';

const TYPE_META: Record<AIGeneratableType, { icon: string; label: string; description: string }> = {
  'H5P.QuestionSet':    { icon: '📝', label: 'Cuestionario',          description: '5–8 preguntas de opción múltiple con explicaciones' },
  'H5P.Flashcards':     { icon: '🃏', label: 'Tarjetas didácticas',   description: '8–12 tarjetas frente/reverso para memorización' },
  'H5P.Accordion':      { icon: '📂', label: 'Acordeón',              description: '4–7 secciones temáticas expandibles con HTML' },
  'H5P.TrueFalse':      { icon: '✅', label: 'Verdadero / Falso',     description: '8–12 afirmaciones con retroalimentación' },
  'H5P.Blanks':         { icon: '✏️', label: 'Completar espacios',    description: '6–10 oraciones con palabras clave omitidas' },
  'H5P.Summary':        { icon: '📋', label: 'Resumen interactivo',   description: '6–10 puntos clave del contenido' },
  'H5P.SingleChoiceSet':{ icon: '⚡', label: 'Opción única rápida',   description: '8–10 preguntas de respuesta inmediata' },
};

const GENERATE_MESSAGES = [
  'Analizando el contenido fuente…',
  'Identificando conceptos clave…',
  'Generando estructura de actividad…',
  'Aplicando diseño instruccional…',
  'Revisando coherencia del contenido…',
  'Finalizando la actividad H5P…',
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export function H5PAICreator({ courseSlug, validationProducts = [], onCreated, onCancel }: H5PAICreatorProps) {
  const [step, setStep] = useState<Step>('source-select');

  // Source
  const [sourceMode, setSourceMode] = useState<SourceMode>(validationProducts.length > 0 ? 'product' : 'paste');
  const [selectedProductId, setSelectedProductId] = useState<string>(validationProducts[0]?.id ?? '');
  const [pastedText, setPastedText] = useState('');
  const [uploadedText, setUploadedText] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // Type selection
  const [selectedType, setSelectedType] = useState<AIGeneratableType>('H5P.QuestionSet');

  // Generation
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationMsgIdx, setGenerationMsgIdx] = useState(0);
  const [generatedContent, setGeneratedContent] = useState<AIGeneratedContent | null>(null);

  // Preview / save
  const [editedTitle, setEditedTitle] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Derived source text ────────────────────────────────────────────────────

  function getSourceText(): string {
    if (sourceMode === 'product') {
      const p = validationProducts.find((p) => p.id === selectedProductId);
      return [p?.title, p?.summary, p?.body].filter(Boolean).join('\n\n');
    }
    if (sourceMode === 'upload') return uploadedText;
    return pastedText;
  }

  function getSourceTitle(): string {
    if (sourceMode === 'product') {
      return validationProducts.find((p) => p.id === selectedProductId)?.title ?? 'Actividad interactiva';
    }
    if (sourceMode === 'upload') return uploadFileName.replace(/\.[^.]+$/, '') || 'Actividad interactiva';
    return 'Actividad interactiva';
  }

  // ── File upload handler ────────────────────────────────────────────────────

  async function handleFileUpload(file: File) {
    setUploadFileName(file.name);
    if (file.type === 'application/pdf') {
      setUploadedText(`[PDF: ${file.name}] Por favor pega el texto del documento manualmente.`);
      return;
    }
    const text = await file.text();
    setUploadedText(text.slice(0, 8000));
  }

  // ── Step: Generate ─────────────────────────────────────────────────────────

  async function startGeneration() {
    setGenerationError(null);
    setStep('generating');

    const sourceText = getSourceText();
    const title = getSourceTitle();

    let msgTimer: ReturnType<typeof setInterval> | null = null;
    let idx = 0;
    msgTimer = setInterval(() => {
      idx = Math.min(idx + 1, GENERATE_MESSAGES.length - 1);
      setGenerationMsgIdx(idx);
    }, 1800);

    try {
      const resp = await fetch('/api/h5p/ai-generate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sourceText, h5pType: selectedType, title, language: 'es' }),
      });

      const data = await resp.json() as { contentJson?: AIGeneratedContent; error?: string };

      if (!resp.ok || !data.contentJson) {
        throw new Error(data.error ?? 'Error al generar el contenido');
      }

      setGeneratedContent(data.contentJson);
      setEditedTitle(data.contentJson.title ?? title);
      setStep('preview');
    } catch (err) {
      setGenerationError(err instanceof Error ? err.message : 'Error desconocido');
      setStep('type-select');
    } finally {
      if (msgTimer) clearInterval(msgTimer);
      setGenerationMsgIdx(0);
    }
  }

  // ── Step: Save ─────────────────────────────────────────────────────────────

  async function saveActivity() {
    if (!generatedContent) return;
    setSaveError(null);
    setStep('saving');

    try {
      const resp = await fetch('/api/h5p/content', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title: editedTitle.trim() || generatedContent.title,
          kind: 'ai-generated',
          libraryName: generatedContent.type,
          contentJson: generatedContent,
          courseSlug,
          xapiTracking: true,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error ?? 'Error al guardar');
      }

      setStep('done');
      setTimeout(() => onCreated(), 1600);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar');
      setStep('preview');
    }
  }

  // ── Step: Done ─────────────────────────────────────────────────────────────

  if (step === 'done') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center">
          <CheckCircle2 size={32} className="text-emerald-500" />
        </div>
        <p className="text-base font-bold text-slate-800">¡Actividad creada con éxito!</p>
        <p className="text-sm text-slate-500">La actividad H5P ya está disponible en tu módulo.</p>
      </div>
    );
  }

  // ── Step: Saving ──────────────────────────────────────────────────────────

  if (step === 'saving') {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <Loader2 size={32} className="animate-spin text-teal-500" />
        <p className="text-sm font-bold text-slate-600">Guardando actividad…</p>
      </div>
    );
  }

  // ── Step: Generating ──────────────────────────────────────────────────────

  if (step === 'generating') {
    return (
      <div className="flex flex-col items-center gap-6 py-16 text-center max-w-md mx-auto">
        <div
          className="w-20 h-20 rounded-[24px] flex items-center justify-center shadow-xl"
          style={{ background: 'var(--library-teal-gradient)' }}
        >
          <Sparkles size={36} className="text-white animate-pulse" />
        </div>
        <div>
          <p className="text-base font-bold text-slate-800 mb-1">Generando con IA…</p>
          <p className="text-sm text-slate-500 transition-all">{GENERATE_MESSAGES[generationMsgIdx]}</p>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-[1800ms]"
            style={{
              width: `${((generationMsgIdx + 1) / GENERATE_MESSAGES.length) * 100}%`,
              background: 'var(--library-teal-gradient)',
            }}
          />
        </div>
        <p className="text-xs text-slate-400">
          Generando {TYPE_META[selectedType].label.toLowerCase()} · Esto puede tomar unos segundos
        </p>
      </div>
    );
  }

  // ── Step: Preview ─────────────────────────────────────────────────────────

  if (step === 'preview' && generatedContent) {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('type-select')}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={14} />
            Volver
          </button>
          <h3 className="text-base font-bold text-slate-800">Vista previa</h3>
          <span
            className="text-[10px] font-bold px-2.5 py-1 rounded-full text-white ml-auto"
            style={{ background: 'var(--library-teal-gradient)' }}
          >
            {TYPE_META[selectedType].icon} {TYPE_META[selectedType].label}
          </span>
        </div>

        {/* Title edit */}
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Título de la actividad
          </label>
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400 font-semibold"
          />
        </div>

        {/* Player preview */}
        <H5PAIPlayer content={generatedContent} />

        {saveError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            <AlertCircle size={14} />
            {saveError}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => void saveActivity()}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white shadow-sm active:scale-95 transition-all"
            style={{ background: 'var(--library-teal-gradient)' }}
          >
            <CheckCircle2 size={16} />
            Guardar actividad
          </button>
          <button
            onClick={() => void startGeneration()}
            className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold border-2 border-slate-200 text-slate-600 hover:border-teal-300 hover:text-teal-600 transition-all"
            title="Regenerar con IA"
          >
            <Wand2 size={15} />
            Regenerar
          </button>
        </div>
      </div>
    );
  }

  // ── Step: Type select ─────────────────────────────────────────────────────

  if (step === 'type-select') {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setStep('source-select')}
            className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft size={14} />
            Volver
          </button>
          <h3 className="text-base font-bold text-slate-800">Tipo de actividad</h3>
        </div>

        <p className="text-sm text-slate-500">¿Qué tipo de actividad interactiva quieres crear?</p>

        {generationError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
            <AlertCircle size={14} />
            {generationError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {AI_GENERATABLE_TYPES.map((t) => {
            const meta = TYPE_META[t];
            const isSelected = selectedType === t;
            return (
              <button
                key={t}
                onClick={() => setSelectedType(t)}
                className="flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all"
                style={{
                  borderColor: isSelected ? 'var(--library-teal)' : '#e2e8f0',
                  background: isSelected ? 'color-mix(in srgb, var(--library-teal) 6%, white)' : 'white',
                }}
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">{meta.icon}</span>
                <div>
                  <p
                    className="text-sm font-bold mb-0.5"
                    style={{ color: isSelected ? 'var(--library-teal)' : '#1e293b' }}
                  >
                    {meta.label}
                  </p>
                  <p className="text-xs text-slate-500 leading-relaxed">{meta.description}</p>
                </div>
                {isSelected && (
                  <CheckCircle2 size={16} className="flex-shrink-0 ml-auto mt-0.5" style={{ color: 'var(--library-teal)' }} />
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => void startGeneration()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg active:scale-[0.98] transition-all"
          style={{ background: 'var(--library-teal-gradient)' }}
        >
          <Sparkles size={16} />
          Generar con IA
        </button>
      </div>
    );
  }

  // ── Step: Source select (default) ─────────────────────────────────────────

  const canProceed =
    (sourceMode === 'product' && !!selectedProductId) ||
    (sourceMode === 'paste' && pastedText.trim().length > 80) ||
    (sourceMode === 'upload' && uploadedText.length > 0);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft size={14} />
          Cancelar
        </button>
        <div>
          <h3 className="text-base font-bold text-slate-800">Crear con IA</h3>
          <p className="text-xs text-slate-400">Selecciona la fuente de contenido</p>
        </div>
        <div
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white text-xs font-bold"
          style={{ background: 'var(--library-teal-gradient)' }}
        >
          <Sparkles size={12} />
          Chispa/IA
        </div>
      </div>

      {/* Source mode tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl">
        {validationProducts.length > 0 && (
          <button
            type="button"
            onClick={() => setSourceMode('product')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
              sourceMode === 'product' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
            }`}
          >
            <CheckCircle2 size={13} />
            Validados
          </button>
        )}
        <button
          type="button"
          onClick={() => setSourceMode('paste')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            sourceMode === 'paste' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
          }`}
        >
          <PenLine size={13} />
          Pegar texto
        </button>
        <button
          type="button"
          onClick={() => setSourceMode('upload')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
            sourceMode === 'upload' ? 'bg-white shadow text-slate-800' : 'text-slate-500'
          }`}
        >
          <Upload size={13} />
          Subir archivo
        </button>
      </div>

      {/* Source: validation products */}
      {sourceMode === 'product' && (
        <div className="space-y-2">
          <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">
            Productos aprobados en Validación instruccional
          </p>
          {validationProducts.length === 0 ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              No hay productos aprobados aún.
            </div>
          ) : (
            <div className="space-y-2">
              {validationProducts.map((p) => {
                const isSelected = selectedProductId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className="w-full flex items-start gap-3 p-4 rounded-2xl border-2 text-left transition-all"
                    style={{
                      borderColor: isSelected ? 'var(--library-teal)' : '#e2e8f0',
                      background: isSelected ? 'color-mix(in srgb, var(--library-teal) 6%, white)' : 'white',
                    }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: isSelected ? 'var(--library-teal-gradient)' : '#f1f5f9' }}
                    >
                      <FileText size={16} style={{ color: isSelected ? 'white' : '#94a3b8' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className="text-sm font-bold truncate"
                        style={{ color: isSelected ? 'var(--library-teal)' : '#1e293b' }}
                      >
                        {p.title}
                      </p>
                      {p.summary && (
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">{p.summary}</p>
                      )}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
                          {p.format}
                        </span>
                        {p.section && (
                          <span className="text-[9px] text-slate-400 font-mono">{p.section}</span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle2 size={16} className="flex-shrink-0 mt-1" style={{ color: 'var(--library-teal)' }} />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Source: paste text */}
      {sourceMode === 'paste' && (
        <div className="space-y-2">
          <label className="text-xs text-slate-400 font-semibold uppercase tracking-wider block">
            Pega el contenido académico
          </label>
          <textarea
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            rows={10}
            placeholder="Pega aquí el contenido del documento, apuntes, capítulo de libro, material de clase… La IA lo transformará en una actividad interactiva."
            className="w-full bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-teal-100 focus:border-teal-400 resize-none placeholder:text-slate-300 leading-relaxed"
          />
          <p className="text-xs text-slate-400">
            {pastedText.length > 0
              ? `${pastedText.length} caracteres${pastedText.length < 80 ? ' · mínimo 80 para continuar' : ''}`
              : 'Mínimo 80 caracteres para una buena generación'}
          </p>
        </div>
      )}

      {/* Source: upload file */}
      {sourceMode === 'upload' && (
        <div className="space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.doc,.docx,.pdf"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleFileUpload(f);
            }}
          />
          {uploadedText ? (
            <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-teal-600 flex-shrink-0" />
                <p className="text-sm font-bold text-teal-700">{uploadFileName}</p>
              </div>
              <p className="text-xs text-teal-600">{uploadedText.length.toLocaleString()} caracteres leídos</p>
              <button
                onClick={() => { setUploadedText(''); setUploadFileName(''); }}
                className="text-xs text-teal-500 hover:text-teal-700 font-semibold underline"
              >
                Cambiar archivo
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-full flex flex-col items-center gap-3 p-8 rounded-2xl border-2 border-dashed border-slate-200 hover:border-teal-300 hover:bg-teal-50/40 transition-all text-center group"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files[0];
                if (f) void handleFileUpload(f);
              }}
            >
              <Upload size={28} className="text-slate-300 group-hover:text-teal-400 transition-colors" />
              <div>
                <p className="text-sm font-bold text-slate-500">Arrastra un archivo aquí</p>
                <p className="text-xs text-slate-400">o haz clic para buscar</p>
              </div>
              <p className="text-[10px] text-slate-300 font-mono">.txt · .md · .doc · .docx · .pdf</p>
            </button>
          )}
        </div>
      )}

      {/* CTA */}
      <button
        disabled={!canProceed}
        onClick={() => setStep('type-select')}
        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white shadow-lg active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        style={{ background: 'var(--library-teal-gradient)' }}
      >
        Continuar
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
