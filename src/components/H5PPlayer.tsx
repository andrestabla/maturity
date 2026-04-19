/**
 * H5PPlayer — embeds an H5P interactive activity inside an adaptive iframe.
 *
 * Communication with the iframe happens via postMessage:
 *   h5p:xapi   — xAPI statement from the player
 *   h5p:resize — height resize request
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, Maximize2 } from 'lucide-react';
import type { H5PContent } from '../../lib/h5p.js';
import { H5PAIPlayer } from './H5PAIPlayer.js';
import type { AIGeneratedContent } from '../../api/h5p/ai-generate.js';

interface H5PPlayerProps {
  content: H5PContent;
  /** Called when the user completes / scores the activity */
  onProgress?: (data: { score: number | null; maxScore: number | null; completion: boolean; success: boolean | null }) => void;
  className?: string;
}

interface ProgressState {
  score: number | null;
  maxScore: number | null;
  completion: boolean;
  success: boolean | null;
}

export function H5PPlayer({ content, onProgress, className }: H5PPlayerProps) {
  // AI-generated content renders natively without iframe
  if (content.kind === 'ai-generated' && content.contentJson) {
    return <H5PAIPlayer content={content.contentJson as unknown as AIGeneratedContent} />;
  }
  return <H5PIframePlayer content={content} onProgress={onProgress} className={className} />;
}

function H5PIframePlayer({ content, onProgress, className }: H5PPlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState>({
    score: null,
    maxScore: null,
    completion: false,
    success: null,
  });
  const [height, setHeight] = useState(content.height || 500);
  const [fullscreen, setFullscreen] = useState(false);

  const embedSrc = `/api/h5p/embed?id=${content.id}`;

  // ── Save xAPI to backend ───────────────────────────────────────────────────
  const saveProgress = useCallback(async (update: Partial<ProgressState> & { statement?: unknown }) => {
    try {
      await fetch('/api/h5p/state', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contentId: content.id,
          courseSlug: null,
          ...update,
        }),
      });
    } catch {
      // Best-effort — don't interrupt the learner experience
    }
  }, [content.id]);

  // ── Listen for postMessage from iframe ────────────────────────────────────
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== 'object') return;
      const msg = event.data as { type: string; contentId?: string; [k: string]: unknown };

      if (msg.contentId !== content.id) return;

      if (msg.type === 'h5p:xapi') {
        const stmt = msg.statement as Record<string, unknown> | undefined;
        const result = (stmt?.result ?? {}) as Record<string, unknown>;
        const scoreObj = (result.score ?? {}) as Record<string, unknown>;

        const update: Partial<ProgressState> & { statement?: unknown } = {
          statement: stmt,
          score: scoreObj.raw != null ? Number(scoreObj.raw) : null,
          maxScore: scoreObj.max != null ? Number(scoreObj.max) : null,
          completion: Boolean(result.completion),
          success: result.success != null ? Boolean(result.success) : null,
        };

        setProgress((prev) => ({ ...prev, ...update }));
        void saveProgress(update);
        onProgress?.({
          score: update.score ?? null,
          maxScore: update.maxScore ?? null,
          completion: update.completion ?? false,
          success: update.success ?? null,
        });
      }

      if (msg.type === 'h5p:resize' && typeof msg.height === 'number') {
        setHeight(Math.max(300, msg.height as number));
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [content.id, saveProgress, onProgress]);

  // ── Load user state on mount ──────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const resp = await fetch(`/api/h5p/state?contentId=${content.id}`);
        if (resp.ok) {
          const state = await resp.json() as ProgressState;
          setProgress({
            score: state.score,
            maxScore: state.maxScore,
            completion: state.completion,
            success: state.success,
          });
        }
      } catch { /* ignore */ }
    })();
  }, [content.id]);

  const pct = progress.score != null && progress.maxScore
    ? Math.round((progress.score / progress.maxScore) * 100)
    : null;

  return (
    <div
      className={`relative rounded-2xl overflow-hidden bg-white border border-slate-200 shadow-sm transition-all ${
        fullscreen ? 'fixed inset-4 z-50 shadow-2xl' : ''
      } ${className ?? ''}`}
      style={fullscreen ? {} : { height: loading ? 300 : height + 56 }}
    >
      {/* ── Header bar ────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b border-slate-100"
        style={{ background: 'linear-gradient(135deg, #f8fafc, #f1f5f9)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #0d9488, #0891b2)' }}
          >
            H5P
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800 truncate">{content.title}</p>
            {content.libraryName && (
              <p className="text-[10px] text-slate-400 font-mono">{content.libraryName}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Progress indicator */}
          {progress.completion && (
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              <CheckCircle2 size={12} />
              {pct != null ? `${pct}%` : 'Completado'}
            </div>
          )}
          {!progress.completion && pct != null && (
            <div className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
              {pct}%
            </div>
          )}

          {/* Fullscreen toggle */}
          <button
            onClick={() => setFullscreen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors"
            title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* ── Iframe ────────────────────────────────────────────────────────── */}
      <div className="relative" style={{ height: fullscreen ? 'calc(100% - 56px)' : height }}>
        {loading && !error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-10">
            <Loader2 size={32} className="animate-spin text-teal-500" />
            <p className="text-sm text-slate-500 font-medium">Cargando actividad…</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white z-10 p-8 text-center">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-sm font-bold text-red-600">No se pudo cargar la actividad</p>
            <p className="text-xs text-slate-500">{error}</p>
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={embedSrc}
          title={content.title}
          width="100%"
          height="100%"
          style={{ border: 'none', display: loading || error ? 'none' : 'block' }}
          allow="fullscreen; autoplay; camera; microphone"
          allowFullScreen
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          onLoad={() => setLoading(false)}
          onError={() => {
            setLoading(false);
            setError('No se pudo cargar el contenido H5P');
          }}
        />
      </div>

      {/* Fullscreen close overlay */}
      {fullscreen && (
        <button
          onClick={() => setFullscreen(false)}
          className="absolute top-3 right-3 p-2 bg-white/90 rounded-xl shadow border border-slate-200 text-slate-500 hover:text-slate-800 transition-colors z-50"
        >
          ✕
        </button>
      )}
    </div>
  );
}
