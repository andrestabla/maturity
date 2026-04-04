import type { LibrarySearchResult } from '../../../src/types.js';
import type { SearchParams } from '../orchestrator.js';

const PHET_METADATA_URL =
  'https://phet.colorado.edu/services/metadata/1.2/simulations?format=json&type=html&locale=en&summary';

/**
 * PhET Interactive Simulations Adapter
 * No API key required. Uses the public PhET metadata endpoint.
 * Docs: https://phet.colorado.edu/services/metadata/1.2/simulations
 */
export async function searchPhET(
  params: SearchParams,
  signal?: AbortSignal,
): Promise<LibrarySearchResult[]> {
  const { query, limit = 20 } = params;

  const response = await fetch(PHET_METADATA_URL, {
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`PhET ${response.status}: ${response.statusText}`);
  }

  const data = await response.json() as Record<string, unknown>;

  const projects = ((data.projects ?? []) as unknown[]) as Array<Record<string, unknown>>;

  const sims: LibrarySearchResult[] = [];

  for (const project of projects) {
    const simulations = ((project.simulations ?? []) as unknown[]) as Array<Record<string, unknown>>;
    for (const sim of simulations) {
      const result = normalizePhetSim(project, sim);
      if (result) sims.push(result);
    }
  }

  const q = query.toLowerCase().trim();
  const filtered = q
    ? sims.filter((s) =>
        s.title.toLowerCase().includes(q) ||
        s.abstract.toLowerCase().includes(q) ||
        s.tags.some((t) => t.toLowerCase().includes(q)),
      )
    : sims;

  return filtered
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function normalizePhetSim(
  project: Record<string, unknown>,
  sim: Record<string, unknown>,
): LibrarySearchResult | null {
  const simName = String(project.name ?? sim.name ?? '');
  if (!simName) return null;

  const simId = simName;
  const localizedSimulations = (sim.localizedSimulations ?? []) as Array<Record<string, unknown>>;
  const enVersion = localizedSimulations.find((ls) => String(ls.locale ?? '') === 'en') ?? localizedSimulations[0];
  const title = String(enVersion?.title ?? sim.title ?? simName);
  const description = String(sim.description ?? sim.designedForDescription ?? '');

  const topics = ((sim.topics ?? sim.keywords ?? []) as string[]).map(String);
  const subjects = ((sim.subject ?? sim.subjects ?? []) as unknown[]).map((s) => {
    if (typeof s === 'string') return s;
    const rec = s as Record<string, unknown>;
    return String(rec.category ?? rec.name ?? rec.id ?? '');
  }).filter(Boolean);

  const embedUrl = `https://phet.colorado.edu/sims/html/${simName}/latest/${simName}_all.html`;
  const thumbnailUrl = `https://phet.colorado.edu/sims/html/${simName}/latest/${simName}-600.png`;

  return {
    id: `ph-${simId}`,
    canonicalKey: `phet:${simId}`,
    provider: 'phet',
    providerRecordId: simId,
    providers: ['phet'],
    group: 'Didacticos',
    title,
    authors: ['PhET Interactive Simulations, University of Colorado Boulder'],
    publishedAt: String(sim.versionMajor ? `${new Date().getFullYear()}` : ''),
    abstract: description || `Simulación interactiva de PhET sobre ${title}. Herramienta educativa gratuita para explorar conceptos STEM de forma visual.`,
    descriptionHtml: `<p>${description}</p>`,
    doi: '',
    canonicalUrl: `https://phet.colorado.edu/en/simulations/${simName}`,
    resourceType: 'Simulación Interactiva',
    language: 'es',
    openAccess: true,
    citationCount: 0,
    thumbnailUrl,
    embedUrl,
    institutionId: undefined,
    institutionName: 'University of Colorado Boulder',
    visibility: 'Publico',
    previewKind: 'simulation',
    license: {
      label: 'CC BY 4.0',
      code: 'cc-by',
      url: 'https://creativecommons.org/licenses/by/4.0/',
      open: true,
    },
    tags: [...new Set([...topics, ...subjects])].slice(0, 8),
    metadata: {
      simName,
      embedUrl,
      thumbnailUrl,
    },
    score: computePhetScore(title, [...topics, ...subjects]),
    sourceKinds: ['PhET'],
    cached: false,
  };
}

function computePhetScore(title: string, tags: string[]): number {
  const hasSTEM = /physics|chemistry|biology|math|earth|energy|wave|force|circuit|atom|motion/i.test(
    [title, ...tags].join(' '),
  );
  return hasSTEM ? 0.92 : 0.80;
}
