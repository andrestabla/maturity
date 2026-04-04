import { useEffect, useState, useCallback } from 'react';
import { 
  ChevronDown, 
  LibraryBig, 
  Search, 
  Filter, 
  Loader2, 
  Globe, 
  History,
  GraduationCap,
  PlayCircle,
  Building2,
  PackageCheck,
  Sparkles,
  X,
  Plus,
  BookOpen,
  ArrowRight
} from 'lucide-react';
import { SidePanel } from '../components/SidePanel.js';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import { LibraryAssetCard } from '../components/LibraryAssetCard.js';
import { BatchIntegrationPanel } from '../components/BatchIntegrationPanel.js';
import type {
  AppData,
  AuthUser,
  LibraryGroup,
  LibrarySearchResult,
  Role,
} from '../types.js';
import { getVisibleCourses } from '../utils/domain.js';
import { buildCourseScopeLabel, countCoursesForStructure } from '../utils/institutions.js';

interface LibraryPageProps {
  role: Role;
  userRole: Role;
  viewer: AuthUser;
  appData: AppData;
  refreshAppData: () => void;
}

const PROVIDER_GROUPS: { id: LibraryGroup; label: string; icon: any; description: string }[] = [
  { id: 'Investigacion', label: 'Investigación', icon: GraduationCap, description: 'Papers científicos y académicos.' },
  { id: 'Didacticos', label: 'Didácticos', icon: Globe, description: 'Recursos abiertos (OER).' },
  { id: 'YouTube', label: 'YouTube', icon: PlayCircle, description: 'Lecciones en video.' },
  { id: 'Institucional', label: 'Institucional', icon: Building2, description: 'Repositorio propio.' },
];

export function LibraryPage({
  role,
  viewer,
  appData,
  refreshAppData,
}: LibraryPageProps) {
  const { showAlert } = useSystemDialog();
  
  // -- Search & Results State --
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<LibraryGroup>('Investigacion');
  const [results, setResults] = useState<LibrarySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<{ cached?: boolean; fetchedAt?: string }>({});
  
  // -- UI State --
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(24);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchPanelOpen, setIsBatchPanelOpen] = useState(false);
  const [isIntegrating, setIsIntegrating] = useState<LibrarySearchResult | null>(null);
  
  const [integrationForm, setIntegrationForm] = useState({
    courseSlug: '',
    targetUnit: '',
  });

  const visibleCourses = getVisibleCourses(appData, role, viewer);
  const courseOptions = visibleCourses.map((course) => ({
    value: course.slug,
    label: `${course.title} · ${buildCourseScopeLabel(course)}`,
  }));

  const selectedAssets = results.filter(r => selectedIds.includes(r.id));
  const visibleResults = results.slice(0, visibleLimit);

  // -- Search Implementation --
  const performSearch = useCallback(async (q: string, group: LibraryGroup) => {
    setIsSearching(true);
    setSelectedIds([]); 
    setVisibleLimit(24);
    try {
      const resp = await fetch(`/api/library/search?q=${encodeURIComponent(q)}&group=${group}`);
      if (!resp.ok) {
        const errData = await resp.json();
        throw new Error(errData.error || 'Error en el orquestador de búsqueda');
      }
      const data = await resp.json();
      setResults(data.results || []);
      setSearchMeta({ cached: data.cached, fetchedAt: data.fetchedAt });
    } catch (err) {
      console.error(err);
      setResults([]);
      setSearchMeta({});
    } finally {
      setIsSearching(false);
    }
  }, []);

  useEffect(() => {
    // Initial search for Research group
    if (results.length === 0 && !isSearching) {
      void performSearch('', activeGroup);
    }
  }, []);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void performSearch(searchQuery, activeGroup);
  };

  const toggleSelect = (id: string, selected: boolean) => {
    setSelectedIds(prev => selected ? [...prev, id] : prev.filter(i => i !== id));
  };

  const handleAddToCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isIntegrating) return;

    try {
      const resp = await fetch('/api/resources', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          assetId: isIntegrating.id,
          courseSlug: integrationForm.courseSlug,
          unit: integrationForm.targetUnit,
          title: isIntegrating.title,
          kind: 'Curado',
          source: isIntegrating.canonicalUrl,
          status: 'Listo',
          summary: isIntegrating.abstract,
          tags: isIntegrating.tags
        })
      });

      if (!resp.ok) throw new Error('No se pudo vincular el recurso');

      refreshAppData();
      setIsIntegrating(null);
      await showAlert({
        title: 'Recurso integrado',
        message: 'El recurso ha sido vinculado exitosamente.',
        tone: 'success',
      });
    } catch (err) {
      await showAlert({
        title: 'Error de integración',
        message: err instanceof Error ? err.message : 'Error desconocido',
        tone: 'error',
      });
    }
  };

  return (
    <div className="page-stack library-page pb-32">
      {/* Premium Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 px-8 rounded-[40px] bg-ink text-white shadow-2xl">
        <div className="absolute top-0 right-0 w-1/2 h-full opacity-10 pointer-events-none overflow-hidden">
          <LibraryBig size={400} className="absolute -top-20 -right-20 rotate-12" />
        </div>
        
        <div className="relative z-10 max-w-4xl">
          <header className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="bg-ocean text-white px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-ocean/30">
                Hub Federado v4.0
              </span>
              <div className="w-1 h-1 rounded-full bg-white/20" />
              <span className="text-white/50 text-[10px] font-bold uppercase tracking-widest">
                IA Curatorial Activa
              </span>
            </div>
            <h1 className="text-6xl font-bold leading-none tracking-tighter mb-4 font-display">
              Biblioteca Inteligente
            </h1>
            <p className="text-xl text-white/60 max-w-2xl font-medium leading-relaxed">
              Metabuscador de alta densidad sincronizado con repositorios globales. 
              Encuentra, previsualiza e integra conocimiento científico y multimedia en segundos.
            </p>
          </header>

          {/* Smart Search Bar */}
          <div className="search-container relative group">
            <form onSubmit={handleManualSearch} className="flex flex-col gap-3">
              <div className="flex items-center bg-white/10 hover:bg-white/15 backdrop-blur-2xl border border-white/10 rounded-[28px] p-2 transition-all shadow-2xl focus-within:ring-4 focus-within:ring-ocean/20">
                <div className="pl-6 pr-4 text-white/40">
                  <Search size={24} strokeWidth={2.5} />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Busca por DOI, título, autor o palabras clave..."
                  className="flex-grow bg-transparent border-0 focus:ring-0 text-xl text-white placeholder:text-white/30 font-medium py-4"
                />
                <div className="flex items-center gap-2 pr-2">
                  <button 
                    type="button" 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`p-4 rounded-2xl transition-all ${showAdvanced ? 'bg-white text-ink shadow-lg' : 'hover:bg-white/10 text-white/60'}`}
                  >
                    <Filter size={20} />
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSearching}
                    className="bg-ocean hover:bg-ocean-strong text-white px-8 py-4 rounded-2xl font-bold transition-all shadow-xl shadow-ocean/20 flex items-center gap-2 active:scale-95"
                  >
                    {isSearching ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                    <span>Buscar</span>
                  </button>
                </div>
              </div>

              {/* Advanced Filters Drawer */}
              {showAdvanced && (
                <div className="advanced-filters grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-white/5 border border-white/10 rounded-[32px] backdrop-blur-xl animate-in slide-in-from-top-4">
                  <div className="filter-group">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2 px-1">Idioma</label>
                    <select className="w-full bg-white/10 border-0 text-white text-sm rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-ocean/50">
                      <option className="bg-ink">Todos los idiomas</option>
                      <option className="bg-ink">Español</option>
                      <option className="bg-ink">Inglés</option>
                    </select>
                  </div>
                  <div className="filter-group">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2 px-1">Acceso</label>
                    <div className="flex gap-2">
                      <button className="bg-white text-ink px-4 py-3 rounded-xl text-xs font-bold flex-grow transition-all">Open Access</button>
                      <button className="bg-white/10 text-white px-4 py-3 rounded-xl text-xs font-bold flex-grow hover:bg-white/20 transition-all">Todos</button>
                    </div>
                  </div>
                  <div className="filter-group">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2 px-1">Antigüedad</label>
                    <select className="w-full bg-white/10 border-0 text-white text-sm rounded-xl py-3 px-4 outline-none focus:ring-2 focus:ring-ocean/50">
                      <option className="bg-ink">Último año</option>
                      <option className="bg-ink">Últimos 5 años</option>
                      <option className="bg-ink">Histórico</option>
                    </select>
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>
      </section>

      {/* Provider Selector & Results Header */}
      <section className="library-controls px-4 -mt-8 relative z-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 p-4 bg-white border border-line shadow-xl rounded-[32px]">
          <div className="flex items-center gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide no-scrollbar w-full md:w-auto">
            {PROVIDER_GROUPS.map((group) => {
              const Icon = group.icon;
              const isActive = activeGroup === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => {
                    setActiveGroup(group.id);
                    void performSearch(searchQuery, group.id);
                  }}
                  className={`flex items-center gap-2 px-6 py-3 rounded-full font-bold transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                    isActive 
                      ? 'bg-ink text-white shadow-xl shadow-ink/10' 
                      : 'hover:bg-ink/5 text-muted'
                  }`}
                >
                  <Icon size={18} />
                  <span className="text-sm">{group.label}</span>
                </button>
              );
            })}
          </div>
          
          {results.length > 0 && (
            <div className="flex items-center gap-4 border-l border-line pl-6">
              <div className="flex flex-col text-right">
                <span className="text-[10px] font-bold text-muted uppercase tracking-widest">{results.length} Hallazgos</span>
                <span className="text-xs font-bold text-ink">Mostrando {visibleLimit}</span>
              </div>
              {searchMeta.cached && (
                <div className="bg-sage/10 text-sage p-2 rounded-full" title="Resultados optimizados por caché">
                  <History size={18} />
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Results High-Density Grid */}
      <main className="results-view px-4 mt-12">
        {isSearching && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-40 gap-6 opacity-60">
            <Loader2 size={64} className="text-ocean animate-spin" />
            <div className="text-center">
              <h3 className="text-2xl font-bold font-display">Interconectando nodos externos</h3>
              <p className="text-secondary">Consultando repositorios federados y aplicando filtros de impacto...</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state py-40 text-center bg-white/40 border-2 border-dashed border-line rounded-[40px]">
             <div className="max-w-md mx-auto page-stack items-center">
                <div className="bg-ocean/5 text-ocean p-8 rounded-full mb-4">
                  <BookOpen size={64} strokeWidth={1.5} />
                </div>
                <h3 className="text-3xl font-bold font-display text-ink">Explora el conocimiento global</h3>
                <p className="text-secondary leading-relaxed">
                  Ingresa una temática para descubrir recursos en {PROVIDER_GROUPS.find(g => g.id === activeGroup)?.label}.
                </p>
             </div>
          </div>
        ) : (
          <div className="results-stack space-y-12">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {visibleResults.map((asset) => (
                <LibraryAssetCard 
                  key={asset.id} 
                  asset={asset} 
                  isSelected={selectedIds.includes(asset.id)}
                  onToggleSelect={toggleSelect}
                  onAddToCourse={(a) => {
                    setIsIntegrating(a);
                    setIntegrationForm({ courseSlug: visibleCourses[0]?.slug || '', targetUnit: '' });
                  }}
                />
              ))}
            </div>

            {/* Load More Trigger */}
            {visibleLimit < results.length && (
              <div className="flex justify-center pt-8">
                <button 
                  onClick={() => setVisibleLimit(prev => prev + 24)}
                  className="bg-white border-2 border-ink text-ink font-bold px-12 py-5 rounded-[24px] hover:bg-ink hover:text-white transition-all shadow-xl active:scale-95 flex items-center gap-3"
                >
                  <span>Ver más recursos</span>
                  <ArrowRight size={20} />
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Floating Batch Action Bar (Phase 3 Integration) */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-8">
          <div className="bg-ink text-white py-5 px-8 rounded-[32px] shadow-2xl flex items-center gap-8 border border-white/10 backdrop-blur-2xl">
            <div className="flex items-center gap-4 pr-8 border-r border-white/10">
              <div className="w-10 h-10 bg-ocean rounded-full flex items-center justify-center font-bold text-lg shadow-lg shadow-ocean/30">
                {selectedIds.length}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Seleccionados</span>
                <span className="font-bold">Recursos listos</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsBatchPanelOpen(true)}
                className="bg-gold text-ink font-bold px-8 py-3 rounded-2xl flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-gold/20"
              >
                <Sparkles size={18} />
                <span>Mapear con IA</span>
              </button>
              
              <button 
                onClick={() => setSelectedIds([])}
                className="bg-white/10 hover:bg-white/20 p-3 rounded-full transition-all text-white/50 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panels */}
      {isBatchPanelOpen && (
        <BatchIntegrationPanel
          isOpen={isBatchPanelOpen}
          onClose={() => {
            setIsBatchPanelOpen(false);
            setSelectedIds([]);
          }}
          selectedAssets={selectedAssets}
          appData={appData}
          courseSlug={visibleCourses[0]?.slug || ''}
          refreshAppData={refreshAppData}
        />
      )}

      {isIntegrating && (
        <SidePanel
          isOpen={!!isIntegrating}
          onClose={() => setIsIntegrating(null)}
          title="Integración Individual"
          description="Vincula este activo a una unidad específica del curso."
          width="md"
        >
          <form className="page-stack" onSubmit={handleAddToCourse}>
            <div className="p-6 bg-ocean/5 rounded-2xl border border-ocean/10 mb-2">
              <h4 className="font-bold text-ocean text-lg leading-tight mb-2">{isIntegrating.title}</h4>
              <p className="text-xs text-secondary leading-relaxed line-clamp-3">{isIntegrating.abstract}</p>
            </div>

            <div className="form-group pt-4">
              <label className="form-label">Destino</label>
              <div className="modern-select-wrapper">
                <select 
                  className="modern-select"
                  value={integrationForm.courseSlug}
                  onChange={e => setIntegrationForm(prev => ({ ...prev, courseSlug: e.target.value }))}
                  required
                >
                  {courseOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="modern-select-icon" />
              </div>
            </div>

            <div className="form-group pt-2">
              <label className="form-label">Unidad de Ubicación</label>
              <input 
                className="modern-input"
                placeholder="Ej: Unidad 2, Módulo 1..."
                value={integrationForm.targetUnit}
                onChange={e => setIntegrationForm(prev => ({ ...prev, targetUnit: e.target.value }))}
              />
            </div>

            <div className="pt-8 flex gap-3">
              <button type="submit" className="cta-button flex-grow justify-center py-4 text-lg">
                <PackageCheck size={20} />
                <span>Integrar</span>
              </button>
            </div>
          </form>
        </SidePanel>
      )}

      {/* Directory Context */}
      <section className="mt-40 px-4">
        <div className="max-w-7xl mx-auto border-t border-line pt-20">
          <div className="section-heading mb-12 flex justify-between items-end">
            <div>
              <span className="eyebrow">Gobierno de Datos</span>
              <h3 className="text-4xl font-bold font-display mt-2">Arquitectura Institucional</h3>
            </div>
            <Building2 size={48} className="text-muted opacity-10 pb-2" />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {appData.institution.structures.slice(0, 4).map((structure) => {
              const linkedCourses = countCoursesForStructure(visibleCourses, structure);
              return (
                <article key={structure.id} className="surface group p-8 hover:shadow-2xl transition-all cursor-default">
                  <div className="flex items-center justify-between mb-8">
                    <div className="bg-secondary/5 group-hover:bg-ocean/10 p-3 rounded-2xl transition-colors">
                      <Building2 size={24} className="text-muted group-hover:text-ocean transition-colors" />
                    </div>
                    <span className="badge badge--outline font-bold">{linkedCourses} cursos</span>
                  </div>
                  <h4 className="text-lg font-bold text-ink mb-1">{structure.institution}</h4>
                  <p className="text-xs text-muted font-medium mb-6 uppercase tracking-wider">{structure.programs.length} Programas Activos</p>
                  
                  <div className="space-y-3 pt-6 border-t border-line/40">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Tipologías</span>
                      <span className="font-bold text-ink">{structure.courseTypes.length}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted">Políticas Pedagógicas</span>
                      <span className="font-bold text-ink">{structure.pedagogicalGuidelines.length}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
