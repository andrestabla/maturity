import type { Course, InstitutionSettings, InstitutionStructure } from '../types.js';

export function getInstitutionStructures(settings?: InstitutionSettings | null) {
  return settings?.structures ?? [];
}

function slugifyInstitutionValue(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function hashInstitutionValue(value: string) {
  let hash = 2166136261;

  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36).padStart(8, '0').slice(0, 8);
}

function buildInstitutionEntropySeed() {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function isInstitutionStructureId(value: string | null | undefined) {
  return /^inst-[a-z0-9]{8}$/.test(value?.trim().toLowerCase() ?? '');
}

export function buildLegacyInstitutionStructureId(name: string) {
  const slug = slugifyInstitutionValue(name);
  return `institution-structure-${slug || 'structure'}`;
}

export function buildInstitutionStructureId(name: string, existingId?: string | null) {
  const normalizedExistingId = existingId?.trim().toLowerCase() ?? '';

  if (isInstitutionStructureId(normalizedExistingId)) {
    return normalizedExistingId;
  }

  const seed = normalizedExistingId || name.trim() || buildInstitutionEntropySeed();
  return `inst-${hashInstitutionValue(seed)}`;
}

export function buildInstitutionStructurePath(structureId: string) {
  return `/admin/institution/${structureId}`;
}

export function buildInstitutionStructureEditPath(structureId: string) {
  return `${buildInstitutionStructurePath(structureId)}/edit`;
}

export function matchesInstitutionStructureRoute(
  structure: Pick<InstitutionStructure, 'id' | 'institution'>,
  routeId: string | null | undefined,
) {
  const normalizedRouteId = routeId?.trim().toLowerCase();

  if (!normalizedRouteId) {
    return false;
  }

  return (
    structure.id.trim().toLowerCase() === normalizedRouteId ||
    buildLegacyInstitutionStructureId(structure.institution) === normalizedRouteId
  );
}

export function findInstitutionStructureByRouteId(
  settings: InstitutionSettings | null | undefined,
  routeId: string | null | undefined,
) {
  return (
    getInstitutionStructures(settings).find((structure) =>
      matchesInstitutionStructureRoute(structure, routeId),
    ) ?? null
  );
}

export function getFirstInstitutionStructure(settings?: InstitutionSettings | null) {
  return getInstitutionStructures(settings)[0] ?? null;
}

export function findInstitutionStructure(
  settings: InstitutionSettings | null | undefined,
  institution: string | null | undefined,
) {
  const normalizedInstitution = institution?.trim().toLowerCase();

  if (!normalizedInstitution) {
    return null;
  }

  return (
    getInstitutionStructures(settings).find(
      (structure) => structure.institution.trim().toLowerCase() === normalizedInstitution,
    ) ?? null
  );
}

function getStructureValues(
  settings: InstitutionSettings | null | undefined,
  institution: string | null | undefined,
  key: 'faculties' | 'programs' | 'academicPeriods' | 'courseTypes' | 'pedagogicalGuidelines',
) {
  const structure = findInstitutionStructure(settings, institution);

  if (structure) {
    return [...structure[key]];
  }

  if (!settings) {
    return [];
  }

  switch (key) {
    case 'faculties':
      return [...settings.faculties];
    case 'programs':
      return [...settings.programs];
    case 'academicPeriods':
      return [...settings.academicPeriods];
    case 'courseTypes':
      return [...settings.courseTypes];
    case 'pedagogicalGuidelines':
      return [];
    default:
      return [];
  }
}

export function getInstitutionFaculties(
  settings: InstitutionSettings | null | undefined,
  institution: string | null | undefined,
) {
  return getStructureValues(settings, institution, 'faculties');
}

export function getInstitutionPrograms(
  settings: InstitutionSettings | null | undefined,
  institution: string | null | undefined,
) {
  return getStructureValues(settings, institution, 'programs');
}

export function getInstitutionAcademicPeriods(
  settings: InstitutionSettings | null | undefined,
  institution: string | null | undefined,
) {
  return getStructureValues(settings, institution, 'academicPeriods');
}

export function getInstitutionCourseTypes(
  settings: InstitutionSettings | null | undefined,
  institution: string | null | undefined,
) {
  return getStructureValues(settings, institution, 'courseTypes');
}

export function getInstitutionPedagogicalGuidelines(
  settings: InstitutionSettings | null | undefined,
  institution: string | null | undefined,
) {
  return getStructureValues(settings, institution, 'pedagogicalGuidelines');
}

export function buildCourseScopeLabel(course: Pick<Course, 'faculty' | 'program' | 'metadata'>) {
  const institution = course.metadata.institution || 'Institución sin definir';
  return `${institution} / ${course.faculty} / ${course.program}`;
}

export function countCoursesForStructure(
  courses: Course[],
  structure: Pick<InstitutionStructure, 'institution'>,
) {
  return courses.filter((course) => (course.metadata.institution || '').trim() === structure.institution).length;
}
