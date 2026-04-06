import { useState, useEffect } from 'react';
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { SidePanel } from './SidePanel.js';
import type { AppData, LibrarySearchResult } from '../types.js';

interface BatchIntegrationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAssets: LibrarySearchResult[];
  appData: AppData;
  courseSlug: string;
  refreshAppData: () => void;
}

interface AIMapping {
  assetId: string;
  suggestedModuleId: string;
  suggestedUnit: string;
  justification: string;
  pedagogicalSummary: string;
  suggestedTags: string[];
}

export function BatchIntegrationPanel({
  isOpen,
  onClose,
  selectedAssets,
  appData,
  courseSlug,
  refreshAppData
}: BatchIntegrationPanelProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [mappings, setMappings] = useState<AIMapping[]>([]);
  const [isIntegrating, setIsIntegrating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const course = appData.courses.find(c => c.slug === courseSlug);
  const modules = course?.modules || [];

  useEffect(() => {
    if (isOpen && selectedAssets.length > 0) {
      void runAIAnalysis();
    }
  }, [isOpen]);

  const runAIAnalysis = async () => {
    setIsAnalyzing(true);
    setError(null);
    try {
      const resp = await fetch('/api/library/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseSlug, assets: selectedAssets })
      });
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || 'Error en el análisis de IA');
      }
      const data = await resp.json();
      setMappings(data.mappings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleIntegrateAll = async () => {
    setIsIntegrating(true);
    try {
      // Execute each integration using the federated course-links API
      const promises = selectedAssets.map(asset => {
        const mapping = mappings.find(m => m.assetId === asset.id);
        return fetch('/api/library/course-links', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            asset: {
              ...asset,
              tags: [...new Set([...asset.tags, ...(mapping?.suggestedTags || [])])],
              metadata: {
                ...asset.metadata,
                pedagogicalSummary: mapping?.pedagogicalSummary,
                aiJustification: mapping?.justification,
              },
            },
            courseSlug,
            targetStage: mapping?.suggestedModuleId,
            targetUnit: mapping?.suggestedUnit || 'Sin unidad',
          })
        });
      });

      await Promise.all(promises);
      refreshAppData();
      onClose();
    } catch (err) {
      setError('Error al integrar recursos.');
    } finally {
      setIsIntegrating(false);
    }
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onClose={onClose}
      title="Asistente de Integración IA"
      description={`Mapeando ${selectedAssets.length} recursos al curso ${course?.title || 'seleccionado'}`}
      width="lg"
    >
      <div className="page-stack h-full flex flex-col">
        {isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center flex-grow">
            <div className="relative">
              <Loader2 size={64} className="text-ocean animate-spin" />
              <Sparkles size={24} className="text-gold absolute -top-2 -right-2 animate-pulse" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-ink">Analizando alineación pedagógica...</h3>
              <p className="text-secondary max-w-xs mx-auto">Comparando recursos federados con los objetivos de aprendizaje del curso.</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-50 text-red-600 rounded-2xl border border-red-100 flex items-start gap-4">
            <AlertCircle className="shrink-0" />
            <div>
              <h4 className="font-bold">Error en el análisis</h4>
              <p className="text-sm">{error}</p>
              <button 
                onClick={() => void runAIAnalysis()} 
                className="mt-4 text-xs font-bold underline"
              >
                Reintentar análisis
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-grow overflow-y-auto pr-2 space-y-4">
              {selectedAssets.map(asset => {
                const mapping = mappings.find(m => m.assetId === asset.id);
                const targetModule = modules.find(m => m.id === mapping?.suggestedModuleId);
                
                return (
                  <div key={asset.id} className="p-4 bg-white border border-line rounded-2xl shadow-sm hover:border-ocean transition-all group">
                    <div className="flex justify-between items-start mb-3">
                      <div className="max-w-[80%]">
                        <h4 className="font-bold text-sm text-ink line-clamp-1 group-hover:text-ocean transition-colors">{asset.title}</h4>
                        <span className="text-[10px] text-secondary font-bold tracking-widest uppercase">{asset.resourceType}</span>
                      </div>
                      {mapping && (
                        <div className="bg-emerald-50 text-emerald-600 p-1 rounded-full">
                          <CheckCircle2 size={16} />
                        </div>
                      )}
                    </div>

                    {mapping ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold text-ocean uppercase tracking-wider">Ubicación:</span>
                          <span className="bg-ocean/5 text-ocean px-3 py-1 rounded-full text-xs font-bold">
                            {targetModule?.title || mapping.suggestedUnit}
                          </span>
                        </div>
                        <div className="p-3 bg-secondary/5 rounded-xl border border-line/30 text-xs">
                          <span className="text-[10px] font-bold text-secondary uppercase block mb-1 opacity-60">Resumen Curatorial</span>
                          <p className="leading-relaxed">{mapping.pedagogicalSummary}</p>
                        </div>
                        <div className="text-[10px] text-secondary/60 italic font-medium">
                          Razón: {mapping.justification}
                        </div>
                      </div>
                    ) : (
                      <div className="py-4 text-center opacity-30">
                        <Loader2 size={24} className="animate-spin mx-auto" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-6 border-t border-line mt-6">
              <button
                type="button"
                className="cta-button w-full justify-center py-4 text-lg shadow-xl shadow-ocean/20"
                disabled={isIntegrating || mappings.length === 0}
                onClick={handleIntegrateAll}
              >
                {isIntegrating ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    <span>Relacionando contenidos...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={20} />
                    <span>Aprobar y Vincular {selectedAssets.length} recursos</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </SidePanel>
  );
}
