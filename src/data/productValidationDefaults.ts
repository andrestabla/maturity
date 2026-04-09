import type {
  CourseProductStage,
  ProductValidationChecklistItem,
  ProductValidationData,
  ProductValidationChecklistStatus,
  ProductWritingSection,
} from '../types.js';

const validationChecklistTemplates: Record<CourseProductStage, string[]> = {
  microcurriculo: [
    'El producto explicita propósito, contexto y resultados.',
    'La estructura curricular está completa y coherente.',
    'Las referencias y criterios de evaluación están visibles.',
    'El lenguaje es claro, institucional y consistente.',
    'No quedan vacíos críticos para su aprobación.',
  ],
  arquitectura: [
    'La secuencia pedagógica está alineada con el curso.',
    'La experiencia de aprendizaje es clara por unidades.',
    'Los recursos y actividades responden al propósito.',
    'El documento tiene trazabilidad operativa.',
    'No quedan ajustes críticos de estructura.',
  ],
  planeacion: [
    'Las fechas, responsables y hitos están definidos.',
    'Las dependencias y entregables son verificables.',
    'La carga de trabajo es razonable y trazable.',
    'Los bloqueos y riesgos están documentados.',
    'La planeación permite seguimiento operativo.',
  ],
  escritura: [
    'El producto tiene estructura pedagógica completa.',
    'Las instrucciones son accionables y sin ambiguedad.',
    'Los recursos y actividades están integrados.',
    'El tono y la redacción son consistentes.',
    'El material está listo para validación instruccional.',
  ],
  validacion: [
    'El producto responde al propósito del curso.',
    'La estructura es completa y legible.',
    'Las observaciones están vinculadas a fragmentos concretos.',
    'La checklist refleja el criterio de calidad esperado.',
    'El producto queda listo para corrección o aprobación.',
  ],
  multimedia: [
    'La pieza multimedia tiene guion o estructura clara.',
    'Los formatos previstos son coherentes con la experiencia.',
    'La accesibilidad y la legibilidad están consideradas.',
    'Los recursos de apoyo están listos para producción.',
    'No quedan dependencias críticas antes del montaje.',
  ],
  lms: [
    'El montaje técnico está documentado.',
    'Los enlaces y rutas se encuentran operativos.',
    'Las actividades quedan visibles y accesibles.',
    'Los permisos y la visualización están validados.',
    'No quedan bloqueos previos al lanzamiento.',
  ],
  qa: [
    'La validación final cubre calidad, acceso y consistencia.',
    'Los criterios de aceptación están visibles y trazables.',
    'Las incidencias están clasificadas y documentadas.',
    'El producto está listo para el cierre del flujo.',
    'No quedan observaciones críticas abiertas.',
  ],
  entrega: [
    'El expediente final está completo.',
    'Las evidencias quedan organizadas y accesibles.',
    'La entrega está alineada con el alcance acordado.',
    'Se registran responsabilidades y cierre.',
    'El handoff queda sin pendientes críticos.',
  ],
};

export function buildDefaultValidationCriteria(stage: CourseProductStage = 'validacion') {
  return (validationChecklistTemplates[stage] ?? validationChecklistTemplates.validacion).slice();
}

function normalizeValidationCriteria(criteria: string[]) {
  return criteria.map((item) => item.trim()).filter(Boolean);
}

function makeChecklistItem(label: string, index: number): ProductValidationChecklistItem {
  return {
    id: `validation-check-${index + 1}`,
    label,
    status: 'Parcial',
    notes: '',
    updatedAt: new Date().toISOString(),
  };
}

export function buildDefaultValidationChecklist(
  stage: CourseProductStage = 'validacion',
): ProductValidationChecklistItem[] {
  return buildDefaultValidationCriteria(stage).map(makeChecklistItem);
}

export function buildDefaultValidationData(
  stage: CourseProductStage = 'validacion',
): ProductValidationData {
  const criteria = normalizeValidationCriteria(buildDefaultValidationCriteria(stage));

  return {
    criteria,
    reviewerNotes: '',
    checklist: criteria.map(makeChecklistItem),
    comments: [],
    lastReviewedAt: undefined,
  };
}

export function buildValidationChecklistFromCriteria(
  criteria: string[],
): ProductValidationChecklistItem[] {
  const normalizedCriteria = normalizeValidationCriteria(criteria);
  const sourceCriteria =
    normalizedCriteria.length > 0
      ? normalizedCriteria
      : buildDefaultValidationCriteria('validacion');

  return sourceCriteria.map((label, index) => ({
    id: `validation-check-${index + 1}`,
    label,
    status: 'Parcial',
    notes: '',
    updatedAt: new Date().toISOString(),
  }));
}

export function buildValidationChecklistFromWritingSections(
  sections: ProductWritingSection[],
): ProductValidationChecklistItem[] {
  const criteria = sections.length > 0
    ? sections.map((section) => section.instructions.trim() || section.title.trim()).filter(Boolean)
    : buildDefaultValidationCriteria('validacion');

  return buildValidationChecklistFromCriteria(criteria);
}

export function normalizeValidationChecklistStatus(
  status?: string | null,
): ProductValidationChecklistStatus {
  if (status === 'Cumple' || status === 'Parcial' || status === 'No cumple' || status === 'No aplica') {
    return status;
  }

  return 'Parcial';
}
