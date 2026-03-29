import type { Course, InstitutionSettings, InstitutionStructure } from '../types.js';

export function getInstitutionStructures(settings?: InstitutionSettings | null) {
  return settings?.structures ?? [];
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
