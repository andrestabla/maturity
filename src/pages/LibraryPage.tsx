import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronDown,
  Filter,
  GraduationCap,
  LibraryBig,
  Loader2,
  PackageCheck,
  PlayCircle,
  Search,
  Sparkles,
  X,
  Zap,
  Puzzle,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { LibraryAssetCard } from '../components/LibraryAssetCard.js';
import { LibraryPreviewModal } from '../components/LibraryPreviewModal.js';
import { BatchIntegrationPanel } from '../components/BatchIntegrationPanel.js';
import { SidePanel } from '../components/SidePanel.js';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import type {
  AppData,
  AuthUser,
  LibraryGroup,
  LibraryProvider,
  LibrarySearchResult,
  Role,
} from '../types.js';
import { getVisibleCourses } from '../utils/domain.js';
import { buildCourseScopeLabel, countCoursesForStructure } from '../utils/institutions.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface LibraryPageProps {
  role: Role;
  userRole: Role;
  viewer: AuthUser;
  appData: AppData;
  refreshAppData: () => void;
}

interface ProviderState {
  provider: LibraryProvider | string;
  count: number;
  error?: string;
  durationMs?: number;
}

interface SearchMeta {
  cached?: boolean;
  fetchedAt?: string;
  providerStates?: ProviderState[];
  total?: number;
}

interface SearchFilters {
  language: string;
  year: string;
  openAccess: boolean;
  providers: LibraryProvider[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GROUPS: { id: LibraryGroup; label: string; icon: React.ElementType; description: string; color: string }[] = [
  { id: 'Investigacion', label: 'Investigación', icon: GraduationCap, description: 'Papers, preprints y artículos científicos de repositorios globales.', color: '#1d4ed8' },
  { id: 'Didacticos', label: 'Didácticos', icon: Puzzle, description: 'Recursos educativos abiertos: OER Commons y simulaciones PhET.', color: '#d97706' },
  { id: 'YouTube', label: 'YouTube', icon: PlayCircle, description: 'Videos académicos con ranking por calidad educativa.', color: '#dc2626' },
  { id: 'Institucional', label: 'Institucional', icon: Building2, description: 'Repositorio propio de la institución.', color: '#4f46e5' },
];

const INVESTIGATION_PROVIDERS: LibraryProvider[] = [
  'semantic-scholar', 'openalex', 'arxiv', 'core', 'scielo', 'redalyc',
];
const DIDACTICOS_PROVIDERS: LibraryProvider[] = ['oer-commons', 'phet'];

const PROVIDER_LABELS: Record<string, string> = {
  'semantic-scholar': 'Semantic Scholar',
  openalex: 'OpenAlex',
  arxiv: 'arXiv',
  core: 'CORE',
  scielo: 'SciELO',
  redalyc: 'Redalyc',
  'oer-commons': 'OER Commons',
  phet: 'PhET',
  youtube: 'YouTube',
  institutional: 'Institucional',
};

const PROVIDER_COLORS: Record<string, string> = {
  'semantic-scholar': '#1d4ed8',
  openalex: '#0f766e',
  arxiv: '#b91c1c',
  core: '#15803d',
  scielo: '#0ea5e9',
  redalyc: '#7c3aed',
  'oer-commons': '#d97706',
  phet: '#0891b2',
  youtube: '#dc2626',
  institutional: '#4f46e5',
};

const LANGUAGES = [
  { value: 'all', label: 'Todos los idiomas' },
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
  { value: 'pt', label: 'Português' },
  { value: 'fr', label: 'Français' },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [
  { value: '', label: 'Todos los años' },
  { value: String(CURRENT_YEAR), label: `${CURRENT_YEAR}` },
  { value: String(CURRENT_YEAR - 1), label: `${CURRENT_YEAR - 1}` },
  { value: String(CURRENT_YEAR - 3), label: `Desde ${CURRENT_YEAR - 3}` },
  { value: String(CURRENT_YEAR - 5), label: `Desde ${CURRENT_YEAR - 5}` },
  { value: String(CURRENT_YEAR - 10), label: `Desde ${CURRENT_YEAR - 10}` },
];

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function LibraryPage({ role, viewer, appData, refreshAppData }: LibraryPageProps) {
  const { showAlert } = useSystemDialog();

  // Search state
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState<LibraryGroup>('Investigacion');
  const [results, setResults] = useState<LibrarySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchMeta, setSearchMeta] = useState<SearchMeta>({});
  const [filters, setFilters] = useState<SearchFilters>({
    language: 'all',
    year: '',
    openAccess: false,
    providers: [],
  });

  // UI state
  const [showFilters, setShowFilters] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(24);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchPanelOpen, setIsBatchPanelOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<LibrarySearchResult | null>(null);
  const [integrating, setIntegrating] = useState<LibrarySearchResult | null>(null);
  const [integrationForm, setIntegrationForm] = useState({ courseSlug: '', targetUnit: '', targetStage: '' });

  const searchRef = useRef<HTMLFormElement>(null);
  const visibleCourses = getVisibleCourses(appData, role, viewer);
  const courseOptions = visibleCourses.map((c) => ({
    value: c.slug,
    label: `${c.title} · ${buildCourseScopeLabel(c)}`,
  }));
  const selectedAssets = results.filter((r) => selectedIds.includes(r.id));
  const visibleResults = results.slice(0, visibleLimit);

  // ── Search ─────────────────────────────────────────────────────────────────

  const performSearch = useCallback(async (q: string, group: LibraryGroup, f: SearchFilters) => {
    setIsSearching(true);
    setSelectedIds([]);
    setVisibleLimit(24);

    try {
      const params = new URLSearchParams({ q, group });
      if (f.language !== 'all') params.set('language', f.language);
      if (f.year) params.set('year', f.year);
      if (f.openAccess) params.set('open_access', 'true');
      if (f.providers.length > 0) params.set('providers', f.providers.join(','));

      const resp = await fetch(`/api/library/search?${params.toString()}`);

      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error ?? 'Error en la búsqueda federada');
      }

      const data = await resp.json() as {
        results: LibrarySearchResult[];
        total: number;
        cached: boolean;
        fetchedAt: string;
        providerStates: ProviderState[];
      };

      setResults(data.results ?? []);
      setSearchMeta({
        cached: data.cached,
        fetchedAt: data.fetchedAt,
        providerStates: data.providerStates ?? [],
        total: data.total,
      });
    } catch (err) {
      setResults([]);
      setSearchMeta({});
      await showAlert({
        title: 'Error de búsqueda',
        message: err instanceof Error ? err.message : 'No se pudo conectar al hub de búsqueda',
        tone: 'error',
      });
    } finally {
      setIsSearching(false);
    }
  }, [showAlert]);

  // Initial load
  useEffect(() => {
    void performSearch('', activeGroup, filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void performSearch(query, activeGroup, filters);
  }

  function switchGroup(group: LibraryGroup) {
    setActiveGroup(group);
    setResults([]);
    setFilters((f) => ({ ...f, providers: [] }));
    void performSearch(query, group, { ...filters, providers: [] });
  }

  function applyFilters(newFilters: SearchFilters) {
    setFilters(newFilters);
    void performSearch(query, activeGroup, newFilters);
  }

  // ── Add to course ──────────────────────────────────────────────────────────

  async function handleAddToCourse(e: React.FormEvent) {
    e.preventDefault();
    if (!integrating) return;

    try {
      const resp = await fetch('/api/library/course-links', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          asset: integrating,
          courseSlug: integrationForm.courseSlug,
          targetStage: integrationForm.targetStage || undefined,
          targetUnit: integrationForm.targetUnit || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json() as { error?: string };
        throw new Error(err.error ?? 'No se pudo vincular el recurso');
      }

      refreshAppData();
      setIntegrating(null);
      setPreviewAsset(null);
      await showAlert({
        title: 'Recurso integrado',
        message: 'El recurso ha sido vinculado exitosamente al curso.',
        tone: 'success',
      });
    } catch (err) {
      await showAlert({
        title: 'Error de integración',
        message: err instanceof Error ? err.message : 'Error desconocido',
        tone: 'error',
      });
    }
  }

  function openAddToCourse(asset: LibrarySearchResult) {
    setPreviewAsset(null);
    setIntegrating(asset);
    setIntegrationForm({
      courseSlug: visibleCourses[0]?.slug ?? '',
      targetUnit: '',
      targetStage: '',
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  const activeGroupCfg = GROUPS.find((g) => g.id === activeGroup)!;
  const hasActiveFilters = filters.language !== 'all' || filters.year !== '' || filters.openAccess || filters.providers.length > 0;

  return (
    <div className="page-stack library-page pb-32">

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="library-hero relative overflow-hidden pt-10 pb-16 px-8 rounded-[40px] bg-ink text-white shadow-2xl">
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-5 pointer-events-none overflow-hidden">
          <LibraryBig size={380} className="absolute -top-16 -right-16 rotate-12" />
        </div>
        <div
          className="absolute bottom-0 left-0 w-64 h-64 rounded-full opacity-10 pointer-events-none"
          style={{ background: `radial-gradient(circle, ${activeGroupCfg.color} 0%, transparent 70%)`, transform: 'translate(-30%, 50%)' }}
        />

        <div className="relative z-10 max-w-4xl">
          {/* Eyebrow */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/10 border border-white/10 text-white/70">
              Hub Federado · {INVESTIGATION_PROVIDERS.length + DIDACTICOS_PROVIDERS.length + 1} Fuentes
            </span>
            {searchMeta.cached && (
              <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold bg-gold/20 text-gold border border-gold/20">
                <Clock size={10} />
                Caché activa
              </span>
            )}
          </div>

          <h1 className="text-5xl font-bold leading-none tracking-tighter mb-3 font-display">
            Biblioteca Inteligente
          </h1>
          <p className="text-lg text-white/50 max-w-2xl font-medium leading-relaxed mb-8">
            Metabuscador federado: artículos científicos, recursos educativos abiertos, simulaciones y video académico en una búsqueda unificada.
          </p>

          {/* Search bar */}
          <form ref={searchRef} onSubmit={handleSearch}>
            <div className="flex items-center bg-white/10 hover:bg-white/14 backdrop-blur-2xl border border-white/10 rounded-[24px] p-1.5 transition-all shadow-2xl focus-within:ring-2 focus-within:ring-white/20">
              <div className="pl-5 pr-3 text-white/30">
                <Search size={22} strokeWidth={2.5} />
              </div>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Busca en ${activeGroupCfg.label}... título, DOI, autor, tema`}
                className="flex-grow bg-transparent border-0 focus:ring-0 text-lg text-white placeholder:text-white/25 font-medium py-3.5"
                autoComplete="off"
              />
              <div className="flex items-center gap-1.5 pr-1.5">
                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-3 rounded-xl transition-all ${
                    showFilters || hasActiveFilters
                      ? 'bg-white text-ink shadow-lg'
                      : 'hover:bg-white/10 text-white/50'
                  }`}
                  title="Filtros avanzados"
                >
                  <Filter size={18} />
                  {hasActiveFilters && !showFilters && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-gold rounded-full" />
                  )}
                </button>
                <button
                  type="submit"
                  disabled={isSearching}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-xl active:scale-95 text-ink"
                  style={{ backgroundColor: isSearching ? '#6b7280' : activeGroupCfg.color === '#dc2626' ? '#ef4444' : activeGroupCfg.color }}
                >
                  {isSearching ? <Loader2 size={18} className="animate-spin text-white" /> : <Zap size={18} className="text-white" />}
                  <span className="text-white">{isSearching ? 'Buscando…' : 'Buscar'}</span>
                </button>
              </div>
            </div>

            {/* Advanced filters drawer */}
            {showFilters && (
              <div className="mt-3 p-5 bg-white/8 border border-white/10 rounded-[20px] backdrop-blur-xl grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Language */}
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">Idioma</label>
                  <div className="relative">
                    <select
                      className="w-full bg-white/10 border-0 text-white text-sm rounded-xl py-2.5 px-3 outline-none focus:ring-1 focus:ring-white/30 appearance-none"
                      value={filters.language}
                      onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value }))}
                    >
                      {LANGUAGES.map((l) => (
                        <option key={l.value} value={l.value} className="bg-ink">{l.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                  </div>
                </div>

                {/* Year */}
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">Publicación</label>
                  <div className="relative">
                    <select
                      className="w-full bg-white/10 border-0 text-white text-sm rounded-xl py-2.5 px-3 outline-none focus:ring-1 focus:ring-white/30 appearance-none"
                      value={filters.year}
                      onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
                    >
                      {YEAR_OPTIONS.map((y) => (
                        <option key={y.value} value={y.value} className="bg-ink">{y.label}</option>
                      ))}
                    </select>
                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
                  </div>
                </div>

                {/* Open Access */}
                <div>
                  <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">Acceso</label>
                  <button
                    type="button"
                    onClick={() => setFilters((f) => ({ ...f, openAccess: !f.openAccess }))}
                    className={`w-full py-2.5 px-3 rounded-xl text-sm font-bold transition-all border ${
                      filters.openAccess
                        ? 'bg-emerald-500 text-white border-emerald-400'
                        : 'bg-white/10 text-white/60 border-white/10 hover:bg-white/15'
                    }`}
                  >
                    {filters.openAccess ? '✓ Open Access' : 'Open Access'}
                  </button>
                </div>

                {/* Apply button */}
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => applyFilters(filters)}
                    className="w-full py-2.5 px-3 rounded-xl text-sm font-bold bg-white text-ink hover:bg-white/90 transition-all shadow"
                  >
                    Aplicar filtros
                  </button>
                </div>

                {/* Provider toggles (Investigacion only) */}
                {activeGroup === 'Investigacion' && (
                  <div className="col-span-2 md:col-span-4">
                    <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest block mb-2">Fuentes activas</label>
                    <div className="flex flex-wrap gap-2">
                      {INVESTIGATION_PROVIDERS.map((p) => {
                        const active = filters.providers.length === 0 || filters.providers.includes(p);
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => {
                              setFilters((f) => {
                                const all = f.providers.length === 0 ? INVESTIGATION_PROVIDERS : f.providers;
                                const next = all.includes(p)
                                  ? all.filter((x) => x !== p)
                                  : [...all, p];
                                return { ...f, providers: next.length === INVESTIGATION_PROVIDERS.length ? [] : next };
                              });
                            }}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all border ${
                              active
                                ? 'border-white/20 text-white bg-white/15'
                                : 'border-white/5 text-white/30 bg-transparent'
                            }`}
                          >
                            {PROVIDER_LABELS[p] ?? p}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </section>

      {/* ── Group tabs + stats ────────────────────────────────────────── */}
      <section className="library-controls px-4 -mt-6 relative z-20">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-stretch md:items-center gap-3 p-3 bg-white border border-line shadow-2xl rounded-[28px]">
          {/* Group tabs */}
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar flex-1">
            {GROUPS.map((g) => {
              const Icon = g.icon;
              const isActive = activeGroup === g.id;
              return (
                <button
                  key={g.id}
                  onClick={() => switchGroup(g.id)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-full font-bold transition-all whitespace-nowrap text-sm active:scale-95 ${
                    isActive
                      ? 'text-white shadow-lg'
                      : 'hover:bg-slate-50 text-muted'
                  }`}
                  style={isActive ? { backgroundColor: g.color } : {}}
                >
                  <Icon size={16} />
                  <span>{g.label}</span>
                </button>
              );
            })}
          </div>

          {/* Stats & meta */}
          <div className="flex items-center gap-3 px-4 border-t md:border-t-0 md:border-l border-line pt-3 md:pt-0 flex-shrink-0">
            {isSearching ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <Loader2 size={16} className="animate-spin" style={{ color: activeGroupCfg.color }} />
                <span>Consultando fuentes…</span>
              </div>
            ) : results.length > 0 ? (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-[10px] font-bold text-muted uppercase tracking-widest">{results.length} resultados</div>
                  <div className="text-xs font-bold text-ink">Mostrando {Math.min(visibleLimit, results.length)}</div>
                </div>
                {searchMeta.cached && (
                  <div className="p-2 bg-gold/10 text-gold rounded-xl" title="Desde caché">
                    <Clock size={16} />
                  </div>
                )}
                <button
                  onClick={() => void performSearch(query, activeGroup, filters)}
                  className="p-2 hover:bg-slate-100 text-muted hover:text-ink rounded-xl transition-colors"
                  title="Actualizar resultados"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* ── Provider status pills ─────────────────────────────────────── */}
      {searchMeta.providerStates && searchMeta.providerStates.length > 0 && (
        <div className="px-4">
          <div className="flex flex-wrap gap-2 max-w-7xl mx-auto">
            {searchMeta.providerStates.map((ps) => {
              const color = PROVIDER_COLORS[ps.provider] ?? '#6b7280';
              const hasError = Boolean(ps.error);
              return (
                <div
                  key={ps.provider}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold border"
                  style={{
                    color: hasError ? '#ef4444' : color,
                    borderColor: hasError ? '#fecaca' : `${color}30`,
                    backgroundColor: hasError ? '#fef2f2' : `${color}08`,
                  }}
                >
                  {hasError ? (
                    <AlertCircle size={10} />
                  ) : (
                    <CheckCircle2 size={10} />
                  )}
                  <span>{PROVIDER_LABELS[ps.provider] ?? ps.provider}</span>
                  {!hasError && <span className="opacity-60">· {ps.count}</span>}
                  {ps.durationMs !== undefined && (
                    <span className="opacity-40">· {ps.durationMs}ms</span>
                  )}
                  {hasError && ps.error && (
                    <span className="opacity-70 max-w-[120px] truncate" title={ps.error}> · {ps.error}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Results ──────────────────────────────────────────────────── */}
      <main className="px-4 mt-4">
        {isSearching && results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-6">
            <div className="relative">
              <Loader2 size={56} className="animate-spin" style={{ color: activeGroupCfg.color }} />
              <div className="absolute inset-0 flex items-center justify-center">
                <activeGroupCfg.icon size={20} style={{ color: activeGroupCfg.color }} />
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-bold font-display text-ink">Consultando {activeGroupCfg.label}</h3>
              <p className="text-sm text-muted mt-1">Buscando en múltiples repositorios en paralelo…</p>
            </div>
          </div>
        ) : results.length === 0 ? (
          <div className="py-24 text-center border-2 border-dashed border-line rounded-[32px] bg-white/40">
            <div className="max-w-sm mx-auto">
              <div className="inline-flex p-6 rounded-full mb-5" style={{ backgroundColor: `${activeGroupCfg.color}10` }}>
                <activeGroupCfg.icon size={48} style={{ color: activeGroupCfg.color, opacity: 0.6 }} />
              </div>
              <h3 className="text-2xl font-bold font-display text-ink mb-2">
                {query ? 'Sin resultados' : `Explora ${activeGroupCfg.label}`}
              </h3>
              <p className="text-sm text-muted leading-relaxed">
                {query
                  ? `No encontramos recursos para "${query}". Prueba con otros términos o ajusta los filtros.`
                  : activeGroupCfg.description}
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {visibleResults.map((asset) => (
                <LibraryAssetCard
                  key={asset.id}
                  asset={asset}
                  isSelected={selectedIds.includes(asset.id)}
                  onToggleSelect={(id, sel) =>
                    setSelectedIds((prev) => sel ? [...prev, id] : prev.filter((i) => i !== id))
                  }
                  onPreview={setPreviewAsset}
                  onAddToCourse={openAddToCourse}
                />
              ))}
            </div>

            {visibleLimit < results.length && (
              <div className="flex justify-center mt-10">
                <button
                  onClick={() => setVisibleLimit((n) => n + 24)}
                  className="flex items-center gap-2 px-10 py-4 rounded-[20px] border-2 border-ink text-ink font-bold hover:bg-ink hover:text-white transition-all shadow-lg active:scale-95"
                >
                  <span>Cargar más ({results.length - visibleLimit} restantes)</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ── Institutional directory ───────────────────────────────────── */}
      {appData.institution.structures.length > 0 && (
        <section className="mt-24 px-4">
          <div className="max-w-7xl mx-auto border-t border-line pt-16">
            <div className="flex items-end justify-between mb-10">
              <div>
                <span className="eyebrow">Gobernanza</span>
                <h3 className="text-3xl font-bold font-display mt-1">Arquitectura Institucional</h3>
              </div>
              <Building2 size={40} className="text-muted opacity-10" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              {appData.institution.structures.slice(0, 4).map((structure) => {
                const linked = countCoursesForStructure(visibleCourses, structure);
                return (
                  <article key={structure.id} className="surface group p-7 hover:shadow-2xl transition-all">
                    <div className="flex items-center justify-between mb-6">
                      <div className="p-2.5 rounded-xl bg-slate-50 group-hover:bg-indigo-50 transition-colors">
                        <Building2 size={22} className="text-muted group-hover:text-indigo-500 transition-colors" />
                      </div>
                      <span className="badge badge--outline font-bold">{linked} cursos</span>
                    </div>
                    <h4 className="text-base font-bold text-ink mb-1">{structure.institution}</h4>
                    <p className="text-xs text-muted font-medium mb-5 uppercase tracking-wider">
                      {structure.programs.length} Programas
                    </p>
                    <div className="space-y-2 pt-5 border-t border-line/40">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Tipologías</span>
                        <span className="font-bold text-ink">{structure.courseTypes.length}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted">Lineamientos pedagógicos</span>
                        <span className="font-bold text-ink">{structure.pedagogicalGuidelines.length}</span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ── Floating batch bar ────────────────────────────────────────── */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-6">
          <div className="bg-ink text-white py-4 px-7 rounded-[28px] shadow-2xl flex items-center gap-6 border border-white/10">
            <div className="flex items-center gap-3 pr-6 border-r border-white/10">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center font-black text-base shadow-lg"
                style={{ backgroundColor: activeGroupCfg.color }}
              >
                {selectedIds.length}
              </div>
              <div>
                <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Seleccionados</div>
                <div className="text-sm font-bold">Recursos listos</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsBatchPanelOpen(true)}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm active:scale-95 transition-all shadow-lg"
                style={{ backgroundColor: activeGroupCfg.color }}
              >
                <Sparkles size={16} />
                <span>Mapear con IA</span>
              </button>
              <button
                onClick={() => setSelectedIds([])}
                className="p-2.5 rounded-xl hover:bg-white/10 transition-colors text-white/50 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview modal ─────────────────────────────────────────────── */}
      <LibraryPreviewModal
        asset={previewAsset}
        onClose={() => setPreviewAsset(null)}
        onAddToCourse={openAddToCourse}
      />

      {/* ── Add to course panel ───────────────────────────────────────── */}
      {integrating && (
        <SidePanel
          isOpen={!!integrating}
          onClose={() => setIntegrating(null)}
          title="Añadir al curso"
          description="Vincula este activo como recurso de una unidad específica."
          width="md"
        >
          <form className="page-stack" onSubmit={handleAddToCourse}>
            <div className="p-5 rounded-2xl border border-line bg-slate-50 mb-2">
              <div
                className="text-[10px] font-black uppercase tracking-widest mb-2"
                style={{ color: PROVIDER_COLORS[integrating.provider] ?? '#6b7280' }}
              >
                {PROVIDER_LABELS[integrating.provider] ?? integrating.provider} · {integrating.resourceType}
              </div>
              <h4 className="font-bold text-ink leading-snug line-clamp-2">{integrating.title}</h4>
              {integrating.authors[0] && (
                <p className="text-xs text-muted mt-1">{integrating.authors[0]}</p>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Curso de destino</label>
              <div className="modern-select-wrapper">
                <select
                  className="modern-select"
                  value={integrationForm.courseSlug}
                  onChange={(e) => setIntegrationForm((f) => ({ ...f, courseSlug: e.target.value }))}
                  required
                >
                  {courseOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <ChevronDown className="modern-select-icon" />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Unidad / Módulo <span className="text-muted font-normal">(opcional)</span></label>
              <input
                className="modern-input"
                placeholder="Ej: Unidad 2 · Módulo 1"
                value={integrationForm.targetUnit}
                onChange={(e) => setIntegrationForm((f) => ({ ...f, targetUnit: e.target.value }))}
              />
            </div>

            <div className="pt-4">
              <button type="submit" className="cta-button w-full justify-center py-4 text-base">
                <PackageCheck size={18} />
                <span>Integrar recurso</span>
              </button>
            </div>
          </form>
        </SidePanel>
      )}

      {/* ── Batch AI panel ────────────────────────────────────────────── */}
      {isBatchPanelOpen && (
        <BatchIntegrationPanel
          isOpen={isBatchPanelOpen}
          onClose={() => { setIsBatchPanelOpen(false); setSelectedIds([]); }}
          selectedAssets={selectedAssets}
          appData={appData}
          courseSlug={visibleCourses[0]?.slug ?? ''}
          refreshAppData={refreshAppData}
        />
      )}
    </div>
  );
}
