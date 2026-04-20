import { useCallback, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  FlaskConical,
  Landmark,
  Layers,
  Library,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Youtube,
  X,
} from 'lucide-react';
import { LibraryAssetCard } from '../components/LibraryAssetCard.js';
import { LibraryPreviewModal } from '../components/LibraryPreviewModal.js';
import { LibraryAddResourceModal } from '../components/LibraryAddResourceModal.js';
import { BatchIntegrationPanel } from '../components/BatchIntegrationPanel.js';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import type { InstitutionalResourceInput } from '../components/LibraryAddResourceModal.js';
import type {
  AppData,
  AuthUser,
  LibraryGroup,
  LibraryProvider,
  LibrarySearchResult,
  Role,
} from '../types.js';
import { getVisibleCourses } from '../utils/domain.js';
import { buildCourseScopeLabel } from '../utils/institutions.js';

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
  resourceTypes: string[];
  minScore: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const GROUPS: { id: LibraryGroup; label: string; icon: React.ElementType; description: string; color: string }[] = [
  { id: 'Investigacion', label: 'Investigación', icon: FlaskConical, description: 'Papers, preprints y artículos científicos de repositorios globales.', color: '#1d4ed8' },
  { id: 'Didacticos', label: 'Didácticos', icon: Layers, description: 'Recursos educativos abiertos: OER Commons y simulaciones PhET.', color: '#d97706' },
  { id: 'YouTube', label: 'YouTube', icon: Youtube, description: 'Videos académicos con ranking por calidad educativa.', color: '#dc2626' },
  { id: 'Institucional', label: 'Institucional', icon: Landmark, description: 'Repositorio propio de la institución.', color: '#4f46e5' },
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
    resourceTypes: [],
    minScore: 0,
  });

  // UI state
  const [hasSearched, setHasSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(24);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchPanelOpen, setIsBatchPanelOpen] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<LibrarySearchResult | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  const isAdminOrGestor = role === 'Administrador' || role === 'Gestor LMS';

  const visibleCourses = getVisibleCourses(appData, role, viewer);
  const courseOptions = visibleCourses.map((c) => ({
    value: c.slug,
    label: `${c.title} · ${buildCourseScopeLabel(c)}`,
  }));
  const selectedAssets = results.filter((r) => selectedIds.includes(r.id));

  // Client-side post-filtering for resource type and score
  const filteredResults = results.filter((r) => {
    if (filters.minScore > 0 && r.score * 100 < filters.minScore) return false;
    if (filters.resourceTypes.length > 0) {
      const rt = r.resourceType.toLowerCase();
      const match = filters.resourceTypes.some((t) => rt.includes(t.toLowerCase()));
      if (!match) return false;
    }
    return true;
  });
  const visibleResults = filteredResults.slice(0, visibleLimit);

  // ── Search ─────────────────────────────────────────────────────────────────

  const performSearch = useCallback(async (q: string, group: LibraryGroup, f: SearchFilters) => {
    setHasSearched(true);
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
        let errMsg = 'Error en la búsqueda federada';
        try {
          const err = await resp.json() as { error?: string };
          errMsg = err.error ?? errMsg;
        } catch {
          errMsg = `Error del servidor (${resp.status})`;
        }
        throw new Error(errMsg);
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

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    void performSearch(query, activeGroup, filters);
  }

  function switchGroup(group: LibraryGroup) {
    setActiveGroup(group);
    setResults([]);
    setFilters((f) => ({ ...f, providers: [] }));
    // For Institucional tab in landing state: don't auto-search, just show empty state
    if (group === 'Institucional' && !hasSearched) return;
    void performSearch(query, group, { ...filters, providers: [] });
  }

  function applyFilters(newFilters: SearchFilters) {
    setFilters(newFilters);
    void performSearch(query, activeGroup, newFilters);
  }

  // ── Add institutional resource ─────────────────────────────────────────────

  async function handleAddInstitutionalResource(data: InstitutionalResourceInput) {
    const resp = await fetch('/api/library/institutional-asset', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!resp.ok) {
      let errMsg = 'No se pudo agregar el recurso';
      try {
        const err = await resp.json() as { error?: string };
        errMsg = err.error ?? errMsg;
      } catch { /* ignore */ }
      throw new Error(errMsg);
    }
    refreshAppData();
  }

  // ── Add to course ──────────────────────────────────────────────────────────

  async function handleAddToCourse(asset: LibrarySearchResult, courseSlug: string, targetUnit?: string) {
    const resp = await fetch('/api/library/course-links', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ asset, courseSlug, targetUnit }),
    });

    if (!resp.ok) {
      let errMsg = 'No se pudo vincular el recurso';
      try {
        const err = await resp.json() as { error?: string };
        errMsg = err.error ?? errMsg;
      } catch { /* ignore */ }
      throw new Error(errMsg);
    }

    refreshAppData();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────

  const activeGroupCfg = GROUPS.find((g) => g.id === activeGroup)!;
  const hasActiveFilters = filters.language !== 'all' || filters.year !== '' || filters.openAccess || filters.providers.length > 0 || filters.resourceTypes.length > 0 || filters.minScore > 0;

  // ── Filter panel (shared between landing and results) ─────────────────────
  const filterPanel = showFilters && (
    <div
      className="absolute left-0 right-0 mt-2 bg-white border border-line rounded-2xl shadow-2xl z-40 p-5"
      style={{ top: '100%' }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-black uppercase tracking-widest text-slate-500">
          Filtros Avanzados (Adaptadores)
        </span>
        <button
          type="button"
          onClick={() => { setShowFilters(false); applyFilters(filters); }}
          className="px-5 py-2 rounded-xl text-sm font-bold text-white shadow-sm transition-all active:scale-95"
          style={{ background: 'var(--library-teal-gradient)' }}
        >
          Aplicar Filtros
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
        {/* Tipo de Recurso */}
        <div>
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Tipo de Recurso</label>
          <div className="space-y-2">
            {['Paper', 'Video', 'Artículo', 'Dataset'].map((type) => {
              const checked = filters.resourceTypes.includes(type);
              return (
                <label key={type} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setFilters((f) => ({
                      ...f,
                      resourceTypes: checked
                        ? f.resourceTypes.filter((t) => t !== type)
                        : [...f.resourceTypes, type],
                    }))}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: 'var(--library-teal)' }}
                  />
                  <span className="text-sm text-secondary group-hover:text-ink transition-colors">{type}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Fuente */}
        <div>
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">Fuente</label>
          <div className="space-y-2">
            {(activeGroup === 'Investigacion' ? INVESTIGATION_PROVIDERS : activeGroup === 'Didacticos' ? DIDACTICOS_PROVIDERS : []).map((p) => {
              const active = filters.providers.length === 0 || filters.providers.includes(p);
              return (
                <label key={p} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => {
                      setFilters((f) => {
                        const all = f.providers.length === 0 ? INVESTIGATION_PROVIDERS : f.providers;
                        const next = all.includes(p) ? all.filter((x) => x !== p) : [...all, p];
                        return { ...f, providers: next.length === INVESTIGATION_PROVIDERS.length ? [] : next };
                      });
                    }}
                    className="w-4 h-4 rounded cursor-pointer"
                    style={{ accentColor: 'var(--library-teal)' }}
                  />
                  <span className="text-sm text-secondary group-hover:text-ink transition-colors">{PROVIDER_LABELS[p] ?? p}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Puntuación Mínima */}
        <div>
          <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-2">
            Puntuación Mínima
            <span className="ml-2 font-bold text-teal-600">
              {filters.minScore > 0 ? `${filters.minScore}%` : 'Todas'}
            </span>
          </label>
          <input
            type="range"
            min={0} max={90} step={10}
            value={filters.minScore}
            onChange={(e) => setFilters((f) => ({ ...f, minScore: Number(e.target.value) }))}
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: 'var(--library-teal)', background: '#e2e8f0' }}
          />
          <div className="flex justify-between text-[9px] text-muted mt-1">
            <span>0%</span><span>50%</span><span>90%</span>
          </div>
        </div>

        {/* Idioma + Año + Open Access */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Idioma</label>
            <div className="relative">
              <select
                className="w-full bg-slate-50 border border-line text-ink text-sm rounded-xl py-2 px-3 outline-none focus:ring-1 appearance-none"
                value={filters.language}
                onChange={(e) => setFilters((f) => ({ ...f, language: e.target.value }))}
              >
                {LANGUAGES.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-muted uppercase tracking-wider block mb-1.5">Año</label>
            <div className="relative">
              <select
                className="w-full bg-slate-50 border border-line text-ink text-sm rounded-xl py-2 px-3 outline-none focus:ring-1 appearance-none"
                value={filters.year}
                onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
              >
                {YEAR_OPTIONS.map((y) => <option key={y.value} value={y.value}>{y.label}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filters.openAccess}
              onChange={() => setFilters((f) => ({ ...f, openAccess: !f.openAccess }))}
              className="w-4 h-4 rounded cursor-pointer"
              style={{ accentColor: 'var(--library-teal)' }}
            />
            <span className="text-sm text-secondary font-medium">Solo Open Access</span>
          </label>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  // ── Group tab strip (reused in both states) ───────────────────────────────
  const groupTabs = (
    <div className="library-search-stage__chips">
      {GROUPS.map((g) => {
        const Icon = g.icon;
        const isActive = activeGroup === g.id;
        return (
          <button
            key={g.id}
            onClick={() => switchGroup(g.id)}
            className={isActive ? 'is-active' : ''}
            style={isActive ? { background: g.color, color: 'white' } : {}}
          >
            <Icon size={16} />
            <span>{g.label}</span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="library-page pb-32" style={{ background: '#f8fafc', minHeight: '100vh' }}>

      {/* ══════════════════════════════════════════════════════════════════
          LANDING STATE — centered hero, shown before first search
      ══════════════════════════════════════════════════════════════════ */}
      {!hasSearched && (
        <div className="library-search-stage">
          <div className="library-search-stage__topline">
            <Library size={22} />
            <span className="library-search-stage__eyebrow">
              Biblioteca Inteligente
            </span>
          </div>
          
          <div className="library-search-stage__heading">
            <h1>Barra de Búsqueda Semántica</h1>
            <p>Acceso directo a recursos académicos, didácticos e institucionales curados con IA.</p>
          </div>

          <form
            onSubmit={handleSearch}
            className="library-search-shell"
          >
            <div className="library-search-shell__field">
              <Search size={20} />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="¿Qué concepto necesitas dominar hoy?"
                autoComplete="off"
              />
            </div>
            
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`library-search-shell__toggle ${showFilters || hasActiveFilters ? 'is-active' : ''}`}
            >
              <SlidersHorizontal size={18} />
              <span>Filtros</span>
            </button>

            <button
              type="submit"
              disabled={isSearching}
              className="library-search-shell__submit"
              style={{ background: isSearching ? '#94a3b8' : 'var(--library-teal)', color: 'white' }}
            >
              {isSearching
                ? <Loader2 size={20} className="animate-spin" />
                : <span>Buscar Recursos</span>}
            </button>
            {filterPanel}
          </form>

          {/* Group tabs */}
          <div className="library-search-stage__context">
            {groupTabs}
          </div>

          {/* Empty state */}
          <div className="w-full max-w-xl text-center py-12">
            <div
              className="inline-flex items-center justify-center w-20 h-20 rounded-3xl mb-6"
              style={{ background: `${activeGroupCfg.color}10` }}
            >
              <activeGroupCfg.icon size={36} style={{ color: activeGroupCfg.color, opacity: 0.7 }} />
            </div>
            <h2 className="text-2xl font-bold font-display text-ink mb-3">
              ¿Qué quieres explorar hoy?
            </h2>
            <p className="text-muted text-base leading-relaxed">
              Escribe un concepto en la barra de búsqueda para descubrir{' '}
              {activeGroupCfg.description.toLowerCase()}
            </p>

            {/* Add resource button for admin/gestor in Institucional tab */}
            {isAdminOrGestor && activeGroup === 'Institucional' && (
              <button
                onClick={() => setShowAddModal(true)}
                className="mt-8 inline-flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold text-white shadow-lg transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
                style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
              >
                <Plus size={16} />
                Agregar Recurso al Repositorio
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          RESULTS STATE — compact header + 3-col grid
      ══════════════════════════════════════════════════════════════════ */}
      {hasSearched && (
        <>
          {/* ── Compact header ─────────────────────────────────────────── */}
          <div className="bg-white border-b border-line sticky top-0 z-30 shadow-sm">
            <div className="max-w-6xl mx-auto px-6 py-3 space-y-3">

              {/* Row 1: title + search bar + filters button */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setHasSearched(false); setResults([]); setQuery(''); }}
                  className="flex-shrink-0 text-base font-bold text-ink font-display whitespace-nowrap hover:text-teal-600 transition-colors"
                  title="Volver a inicio"
                >
                  Biblioteca Inteligente
                </button>

                <form
                  onSubmit={handleSearch}
                  className="relative flex-1"
                >
                  <div
                    className="flex items-center bg-white border-2 rounded-xl transition-all"
                    style={{ borderColor: showFilters || hasActiveFilters ? 'var(--library-teal)' : '#e2e8f0' }}
                  >
                    <input
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="¿Qué concepto necesitas dominar hoy?"
                      className="flex-1 bg-transparent border-0 focus:ring-0 text-sm text-ink placeholder:text-slate-300 font-medium py-2.5 pl-4"
                      autoComplete="off"
                    />
                    <button
                      type="submit"
                      disabled={isSearching}
                      className="flex items-center justify-center w-9 h-9 mr-1 rounded-lg text-white transition-all"
                      style={{ backgroundColor: isSearching ? '#94a3b8' : 'var(--library-teal)' }}
                    >
                      {isSearching
                        ? <Loader2 size={14} className="animate-spin" />
                        : <Search size={14} />}
                    </button>
                  </div>
                  {filterPanel}
                </form>

                <button
                  type="button"
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-bold border-2 transition-all ${
                    showFilters || hasActiveFilters
                      ? 'text-white border-teal-600'
                      : 'border-slate-200 text-slate-500 hover:border-slate-300'
                  }`}
                  style={showFilters || hasActiveFilters ? { backgroundColor: 'var(--library-teal)', borderColor: 'var(--library-teal)' } : {}}
                >
                  <SlidersHorizontal size={14} />
                  <span>Filtros</span>
                  {hasActiveFilters && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
                </button>
              </div>

              {/* Row 2: group tabs + result count */}
              <div className="flex items-center gap-2">
                {groupTabs}
                <div className="ml-auto flex items-center gap-2 flex-shrink-0 pl-4 border-l border-slate-200">
                  {isAdminOrGestor && activeGroup === 'Institucional' && (
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white transition-all active:scale-95"
                      style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
                    >
                      <Plus size={13} />
                      <span>Agregar</span>
                    </button>
                  )}
                  {filteredResults.length > 0 && (
                    <>
                      <span className="text-xs font-bold text-slate-400">
                        {filteredResults.length}{filteredResults.length < results.length ? `/${results.length}` : ''} resultados
                      </span>
                      <button
                        onClick={() => void performSearch(query, activeGroup, filters)}
                        className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-ink rounded-lg transition-colors"
                        title="Actualizar"
                      >
                        <RotateCcw size={13} />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Provider status pills ───────────────────────────────────── */}
          {searchMeta.providerStates && searchMeta.providerStates.length > 0 && (
            <div className="px-6 py-2 max-w-6xl mx-auto">
              <div className="flex flex-wrap gap-2">
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
                      {hasError ? <AlertCircle size={10} /> : <CheckCircle2 size={10} />}
                      <span>{PROVIDER_LABELS[ps.provider] ?? ps.provider}</span>
                      {!hasError && <span className="opacity-60">· {ps.count}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Results grid ────────────────────────────────────────────── */}
          <main className="px-6 mt-4 max-w-6xl mx-auto w-full">
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
            ) : filteredResults.length === 0 ? (
              <div className="py-24 text-center border-2 border-dashed border-line rounded-[32px] bg-white/40">
                <div className="max-w-sm mx-auto">
                  <div className="inline-flex p-6 rounded-full mb-5" style={{ backgroundColor: `${activeGroupCfg.color}10` }}>
                    <activeGroupCfg.icon size={48} style={{ color: activeGroupCfg.color, opacity: 0.5 }} />
                  </div>
                  <h3 className="text-2xl font-bold font-display text-ink mb-2">Sin resultados</h3>
                  <p className="text-sm text-muted leading-relaxed">
                    {`No encontramos recursos para "${query}". Prueba con otros términos o ajusta los filtros.`}
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* 3-column results grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {visibleResults.map((asset) => (
                    <LibraryAssetCard
                      key={asset.id}
                      asset={asset}
                      isSelected={selectedIds.includes(asset.id)}
                      onToggleSelect={(id, sel) =>
                        setSelectedIds((prev) => sel ? [...prev, id] : prev.filter((i) => i !== id))
                      }
                      onPreview={setPreviewAsset}
                      onAddToCourse={setPreviewAsset}
                    />
                  ))}
                </div>

                {visibleLimit < filteredResults.length && (
                  <div className="flex justify-center mt-10">
                    <button
                      onClick={() => setVisibleLimit((n) => n + 24)}
                      className="flex items-center gap-2 px-10 py-4 rounded-[20px] border-2 border-ink text-ink font-bold hover:bg-ink hover:text-white transition-all shadow-lg active:scale-95"
                    >
                      <span>Cargar más ({filteredResults.length - visibleLimit} restantes)</span>
                      <ArrowRight size={18} />
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </>
      )}

      {/* ── Floating batch selection bar (both states) ───────────────── */}
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

      {/* ── Preview panel (right-side drawer) ────────────────────────── */}
      <LibraryPreviewModal
        asset={previewAsset}
        onClose={() => setPreviewAsset(null)}
        courseOptions={courseOptions}
        onAddToCourse={handleAddToCourse}
      />

      {/* ── Add institutional resource panel ─────────────────────────── */}
      <LibraryAddResourceModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSubmit={handleAddInstitutionalResource}
      />

      {/* ── Batch AI panel ────────────────────────────────────────────── */}
      {isBatchPanelOpen && (
        <BatchIntegrationPanel
          isOpen={isBatchPanelOpen}
          onClose={() => { setIsBatchPanelOpen(false); setSelectedIds([]); }}
          selectedAssets={selectedAssets}
          appData={appData}
          courseSlug={visibleCourses[0]?.slug ?? ''}
          courseOptions={courseOptions}
          refreshAppData={refreshAppData}
        />
      )}
    </div>
  );
}
