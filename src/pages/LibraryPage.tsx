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
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { SidePanel } from '../components/SidePanel.js';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import { LibraryAssetCard } from '../components/LibraryAssetCard.js';
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
  { id: 'Investigacion', label: 'Investigación', icon: GraduationCap, description: 'Papers de OpenAlex, Semantic Scholar y más.' },
  { id: 'Didacticos', label: 'Didácticos', icon: Globe, description: 'Recursos abiertos y objetos de aprendizaje.' },
  { id: 'YouTube', label: 'YouTube', icon: PlayCircle, description: 'Video-lecciones y contenido multimedia.' },
  { id: 'Institucional', label: 'Institucional', icon: Building2, description: 'Tu propio repositorio y piezas curadas.' },
];

export function LibraryPage({
  role,
  viewer,
  appData,
  refreshAppData,
}: LibraryPageProps) {
  const { showAlert } = useSystemDialog();
  
  // -- State --
  const [searchQuery, setSearchQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<LibraryGroup>('Institucional');
  const [results, setResults] = useState<LibrarySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<{ cached?: boolean; fetchedAt?: string }>({});
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

  // -- Search Implementation --
  const performSearch = useCallback(async (q: string, group: LibraryGroup) => {
    setIsSearching(true);
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

  // Effect: Auto-search institutional when group changes or initially
  useEffect(() => {
    if (activeGroup === 'Institucional') {
      void performSearch(searchQuery, 'Institucional');
    }
  }, [activeGroup, performSearch]);

  const handleManualSearch = (e: React.FormEvent) => {
    e.preventDefault();
    void performSearch(searchQuery, activeGroup);
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
          // Legacy fields for backward compatibility
          title: isIntegrating.title,
          kind: isIntegrating.group === 'Institucional' ? 'Propio' : 'Curado',
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
        message: 'El recurso ha sido vinculado exitosamente a tu curso.',
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
    <div className="page-stack library-page pb-20">
      {/* Header Section */}
      <section className="surface section-card section-card--compact overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <LibraryBig size={180} />
        </div>
        
        <div className="relative z-10">
          <div className="section-heading mb-2">
            <div>
              <span className="eyebrow flex items-center gap-2">
                Hub Federado
                <span className="w-1 h-1 rounded-full bg-secondary opacity-30"></span>
                v2.0
              </span>
              <h1 className="text-4xl font-bold tracking-tight text-ink">Biblioteca Maturity</h1>
            </div>
          </div>
          <p className="text-lg text-secondary max-w-2xl leading-relaxed">
            Busca, previsualiza e integra recursos académicos de cientos de repositorios externos, 
            bases de datos científicas e institucionales en un solo lugar.
          </p>
        </div>
      </section>

      {/* Search Hero Workspace */}
      <section className="library-workspace">
        <div className="search-hero surface border border-line shadow-2xl rounded-[32px] p-2 bg-white/40 backdrop-blur-xl">
          <form onSubmit={handleManualSearch} className="flex flex-col md:flex-row gap-2">
            <div className="flex-grow relative">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted">
                <Search size={22} strokeWidth={2.5} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busca papers, videos, guías o recursos institucionales..."
                className="w-full pl-16 pr-6 py-6 text-xl bg-transparent border-0 focus:ring-0 placeholder:text-muted/60 font-medium"
              />
            </div>
            
            <div className="flex items-center gap-2 p-2 bg-ink/5 rounded-[24px]">
              <div className="hidden lg:flex items-center gap-2 px-4 text-xs font-bold text-muted uppercase tracking-wider">
                <Filter size={14} />
                <span>Fuente</span>
              </div>
              <div className="chip-row p-1">
                {PROVIDER_GROUPS.map((group) => {
                  const Icon = group.icon;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      onClick={() => setActiveGroup(group.id)}
                      className={`flex items-center gap-2 px-5 py-3 rounded-full font-bold transition-all ${
                        activeGroup === group.id 
                          ? 'bg-ink text-white shadow-lg shadow-ink/20 scale-105' 
                          : 'hover:bg-ink/5 text-muted'
                      }`}
                    >
                      <Icon size={18} />
                      <span>{group.label}</span>
                    </button>
                  );
                })}
              </div>
              <button 
                type="submit" 
                className="bg-ocean text-white p-5 rounded-full hover:bg-ocean-strong transition-all shadow-lg shadow-ocean/30 active:scale-95 ml-2"
                disabled={isSearching}
              >
                {isSearching ? <Loader2 size={24} className="animate-spin" /> : <ChevronRight size={24} />}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Results View */}
      <main className="results-container">
        {isSearching && results.length === 0 ? (
          <div className="grid place-items-center py-32">
            <div className="flex flex-col items-center gap-4">
              <Loader2 size={48} className="text-ocean animate-spin" />
              <p className="text-lg font-bold text-secondary">Consultando repositorios federados...</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state py-20 text-center border-dashed border-2 border-line rounded-[32px] bg-white/20">
            <div className="flex flex-col items-center gap-4">
              <div className="p-6 bg-secondary/5 rounded-full text-secondary/30">
                <History size={48} />
              </div>
              <h2 className="text-2xl font-bold text-ink">Comienza tu búsqueda</h2>
              <p className="text-secondary max-w-sm mx-auto">
                Ingresa palabras clave para explorar los recursos de {PROVIDER_GROUPS.find(g => g.id === activeGroup)?.label.toLowerCase()}.
              </p>
            </div>
          </div>
        ) : (
          <div className="page-stack">
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-3">
                <span className="badge badge--ocean text-xs">{results.length} coincidencias</span>
                {searchMeta.cached && (
                  <span className="badge badge--sage text-[10px] py-1 px-2 flex items-center gap-1">
                    <History size={12} />
                    Caché ({new Date(searchMeta.fetchedAt!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                  </span>
                )}
                <span className="text-sm font-medium text-secondary">ordenado por relevancia e impacto</span>
              </div>
            </div>
            
            <div className="resource-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {results.map((asset) => (
                <LibraryAssetCard 
                  key={asset.id} 
                  asset={asset} 
                  onAddToCourse={(a) => {
                    setIsIntegrating(a);
                    setIntegrationForm({ courseSlug: visibleCourses[0]?.slug || '', targetUnit: '' });
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Sidebar Integration Panel */}
      {isIntegrating && (
        <SidePanel
          isOpen={!!isIntegrating}
          onClose={() => setIsIntegrating(null)}
          title="Integrar a Curaduría"
          description="Vincular este recurso a un curso y unidad específica de la institución."
          width="md"
        >
          <form className="page-stack" onSubmit={handleAddToCourse}>
            <div className="p-6 bg-ocean/5 rounded-2xl border border-ocean/10 mb-6">
              <h4 className="font-bold text-ocean mb-1">{isIntegrating.title}</h4>
              <p className="text-xs text-ocean/70 line-clamp-2">{isIntegrating.abstract}</p>
            </div>

            <div className="form-group">
              <label className="form-label">Seleccionar curso de destino</label>
              <div className="modern-select-wrapper">
                <select 
                  className="modern-select"
                  value={integrationForm.courseSlug}
                  onChange={e => setIntegrationForm(prev => ({ ...prev, courseSlug: e.target.value }))}
                  required
                >
                  <option value="">Selecciona un curso...</option>
                  {courseOptions.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="modern-select-icon" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Unidad o Módulo (opcional)</label>
              <input 
                className="modern-input"
                placeholder="Ej: Unidad 1, Semana 4..."
                value={integrationForm.targetUnit}
                onChange={e => setIntegrationForm(prev => ({ ...prev, targetUnit: e.target.value }))}
              />
            </div>

            <div className="pt-8 flex gap-3">
              <button type="submit" className="cta-button flex-grow justify-center py-4">
                <PackageCheck size={20} />
                <span>Confirmar Integración</span>
              </button>
              <button 
                type="button" 
                className="ghost-button px-8" 
                onClick={() => setIsIntegrating(null)}
              >
                Cancelar
              </button>
            </div>

            <div className="mt-8 p-4 border border-line rounded-xl bg-secondary/5">
              <h5 className="text-xs font-bold uppercase text-muted tracking-widest mb-2">Previsualización rápida</h5>
              <a 
                href={isIntegrating.canonicalUrl} 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center justify-between p-3 bg-white border border-line rounded-lg hover:bg-ocean/5 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <ExternalLink size={18} className="text-ocean" />
                  <span className="text-sm font-medium">Abrir en nueva pestaña</span>
                </div>
                <ChevronRight size={16} className="text-muted group-hover:translate-x-1 transition-transform" />
              </a>
            </div>
          </form>
        </SidePanel>
      )}

      {/* Directory Context (Footer of search) */}
      <section className="mt-20 border-t border-line pt-12">
        <div className="section-heading mb-8">
          <div>
            <span className="eyebrow">Gobierno de Datos</span>
            <h3 className="text-xl font-bold">Estructuras del Directorio</h3>
          </div>
          <Building2 size={24} className="text-muted opacity-50" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {appData.institution.structures.map((structure) => {
            const linkedCourses = countCoursesForStructure(visibleCourses, structure);
            return (
              <article key={structure.id} className="surface section-card section-card--compact hover:shadow-lg transition-all">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-bold text-ink">{structure.institution}</h4>
                  <span className="badge badge--outline">{linkedCourses} cursos</span>
                </div>
                <div className="text-xs text-secondary flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span>Tipologías</span>
                    <span className="font-medium text-ink">{structure.courseTypes.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Guías Pedagógicas</span>
                    <span className="font-medium text-ink">{structure.pedagogicalGuidelines.length}</span>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
