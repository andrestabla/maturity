import type {
  AppData,
  BrandingSettings,
  ExperienceSettings,
  InstitutionSettings,
  Role,
  RoleProfile,
  StageDefinition,
  WorkflowSettings,
} from '../types.js';
import { buildInstitutionStructureId } from '../utils/institutions.js';

const defaultGuidelines = [
  'Todo curso debe definir resultados de aprendizaje, metodología y evaluación antes de pasar a producción.',
  'Cada handoff debe conservar trazabilidad de cambios, evidencias y responsables dentro de la plataforma.',
];

export const platformRoles: Role[] = [
  'Administrador',
  'Coordinador',
  'Experto',
  'Diseñador instruccional',
  'Diseñador multimedia',
  'Gestor LMS',
  'Analista QA',
  'Auditor',
];

export const platformStages: StageDefinition[] = [
  {
    id: 'configuracion',
    name: 'Configuración',
    description: 'Carga del sílabus, datos estructurales y ficha base del curso.',
    owner: 'Coordinador',
    tone: 'coral',
  },
  {
    id: 'arquitectura',
    name: 'Arquitectura',
    description: 'Diseño del mapa de módulos, actividades y recursos del curso.',
    owner: 'Diseñador instruccional',
    tone: 'gold',
  },
  {
    id: 'planeacion',
    name: 'Planeación',
    description: 'Equipo, cronograma, hitos y dependencias del proyecto.',
    owner: 'Coordinador',
    tone: 'ocean',
  },
  {
    id: 'produccion',
    name: 'Producción',
    description: 'Autoría, validación, curación y desarrollo multimedia.',
    owner: 'Experto',
    tone: 'sage',
  },
  {
    id: 'lms',
    name: 'Montaje LMS',
    description: 'Implementación técnica, navegación y comportamiento en plataforma.',
    owner: 'Gestor LMS',
    tone: 'ocean',
  },
  {
    id: 'calidad',
    name: 'Calidad',
    description: 'Checklist final, hallazgos, auditoría y liberación.',
    owner: 'Analista QA',
    tone: 'ink',
  },
];

export const defaultRoleProfiles: RoleProfile[] = [
  {
    role: 'Administrador',
    overview: 'Gobierna estructura, visibilidad, parámetros y reglas globales del sistema.',
    focus: 'Control total sobre dashboard, cursos, biblioteca y configuración.',
    modules: [
      { name: 'Dashboard', permissions: 'Consulta y administra widgets, reglas e indicadores globales.' },
      { name: 'Mis cursos', permissions: 'Consulta, crea, edita, aprueba, devuelve, cierra y administra.' },
      { name: 'Biblioteca', permissions: 'Control total sobre recursos, metadatos y gobierno documental.' },
    ],
  },
  {
    role: 'Coordinador',
    overview: 'Convierte el curso en un proyecto gestionable, visible y con ritmo operativo.',
    focus: 'Planeación, seguimiento, asignaciones, alertas y cierre.',
    modules: [
      { name: 'Dashboard', permissions: 'Consulta cursos, alertas y cartera de trabajo.' },
      { name: 'Mis cursos', permissions: 'Crea, edita, puede cerrar y opera puntos de control definidos.' },
      { name: 'Biblioteca', permissions: 'Consulta y carga recursos de apoyo cuando lo requiere el flujo.' },
    ],
  },
  {
    role: 'Experto',
    overview: 'Construye contenido académico, actividades y curaduría disciplinar.',
    focus: 'Autoría, consistencia de resultados y justificación de recursos.',
    modules: [
      { name: 'Dashboard', permissions: 'Consulta su cartera de tareas y cursos asociados.' },
      { name: 'Mis cursos', permissions: 'Edita componentes de autoría y curación dentro de su alcance.' },
      { name: 'Biblioteca', permissions: 'Consulta, crea y edita recursos curados o propios.' },
    ],
  },
  {
    role: 'Diseñador instruccional',
    overview: 'Valida la coherencia pedagógica y asegura la secuencia didáctica del curso.',
    focus: 'Arquitectura, revisión, observaciones y aprobación pedagógica.',
    modules: [
      { name: 'Dashboard', permissions: 'Consulta cartera y alertas por revisión pedagógica.' },
      { name: 'Mis cursos', permissions: 'Edita, aprueba o devuelve entregables según la etapa pedagógica.' },
      { name: 'Biblioteca', permissions: 'Consulta, crea y edita recursos; aprueba si el flujo lo define.' },
    ],
  },
  {
    role: 'Diseñador multimedia',
    overview: 'Produce los recursos propios y cuida la experiencia visual del curso.',
    focus: 'Piezas, estados de producción, retroalimentación y versiones.',
    modules: [
      { name: 'Dashboard', permissions: 'Consulta recursos y trabajo asignado.' },
      { name: 'Mis cursos', permissions: 'Edita recursos propios; puede devolver piezas en flujos internos.' },
      { name: 'Biblioteca', permissions: 'Consulta, crea y edita recursos multimedia.' },
    ],
  },
  {
    role: 'Gestor LMS',
    overview: 'Implementa el curso en la plataforma educativa y resuelve el detalle técnico.',
    focus: 'Montaje, navegación, etiquetas, enlaces y funcionamiento.',
    modules: [
      { name: 'Dashboard', permissions: 'Consulta cursos listos para implementación o con bloqueos técnicos.' },
      { name: 'Mis cursos', permissions: 'Consulta y edita la capa de implementación técnica.' },
      { name: 'Biblioteca', permissions: 'Consulta recursos aprobados y los integra al LMS.' },
    ],
  },
  {
    role: 'Analista QA',
    overview: 'Aplica criterios de control de calidad y emite aprobación o devolución.',
    focus: 'Checklist final, hallazgos, cierre y liberación.',
    modules: [
      { name: 'Dashboard', permissions: 'Consulta cursos en revisión final y hallazgos abiertos.' },
      { name: 'Mis cursos', permissions: 'Edita registros de revisión y puede aprobar o devolver.' },
      { name: 'Biblioteca', permissions: 'Consulta evidencias y recursos para validar integridad.' },
    ],
  },
  {
    role: 'Auditor',
    overview: 'Observa la trazabilidad completa y participa cuando la gobernanza lo activa.',
    focus: 'Visibilidad, control formal y validación institucional.',
    modules: [
      { name: 'Dashboard', permissions: 'Consulta indicadores, cartera final y alertas relevantes.' },
      { name: 'Mis cursos', permissions: 'Consulta; puede aprobar o devolver si existe punto formal de auditoría.' },
      { name: 'Biblioteca', permissions: 'Consulta evidencias y materiales asociados al curso.' },
    ],
  },
];

export const defaultBranding: BrandingSettings = {
  platformName: 'Maturity',
  institutionName: 'Maturity University',
  shortMark: 'M',
  logoText: 'Maturity',
  logoUrl: '',
  logoMode: 'Monograma',
  faviconLabel: 'M',
  faviconUrl: '',
  faviconMode: 'Monograma',
  primaryColor: '#22b9d2',
  accentColor: '#65ddf0',
  surfaceStyle: 'Control center técnico con contraste alto y superficies limpias.',
  fontPreset: 'Control',
  bodyFontFamily: 'IBM Plex Sans',
  displayFontFamily: 'Space Grotesk',
  monoFontFamily: 'IBM Plex Mono',
  loginVariant: 'Minimal',
  loginEyebrow: 'Academic Production OS',
  loginHeadline: 'Entrar a Maturity',
  loginMessage: 'Accede para operar cursos, tareas y entregables desde una sola capa de control.',
  loaderLabel: 'Preparando la sesión',
  loaderMessage: 'Estamos validando acceso y preparando la capa operativa.',
  supportUrl: 'mailto:soporte@maturity360.co',
};

export const defaultExperienceSettings: ExperienceSettings = {
  studioMode: 'Profundo',
  showSummaryHero: true,
  showFocusedStageHeader: true,
  stageRailVisibility: 'Solo workflow',
  profileLayout: 'Dos columnas',
};

export const defaultWorkflowSettings: WorkflowSettings = {
  showWorkflowStageCards: true,
  showQuickAccessPanel: true,
  handoffRequiresCheckpoint: true,
  handoffBlocksOnBlockedCheckpoints: true,
  handoffBlocksOnCriticalObservations: true,
};

export const defaultInstitutionSettings: InstitutionSettings = {
  displayName: 'Maturity University',
  structures: [
    {
      id: buildInstitutionStructureId('Maturity University'),
      institution: 'Maturity University',
      faculties: [],
      programs: [],
      academicPeriods: [],
      courseTypes: [],
      pedagogicalGuidelines: [...defaultGuidelines],
      allowAutoProvisioning: false,
    },
  ],
  institutions: ['Maturity University'],
  faculties: [],
  programs: [],
  academicPeriods: [],
  courseTypes: [],
  supportEmail: 'soporte@maturity360.co',
  defaultDomain: 'maturity360.co',
  defaultUserState: 'Pendiente',
  allowAutoProvisioning: false,
};

export function createEmptyAppData(): AppData {
  return {
    roles: [...platformRoles],
    stages: platformStages.map((stage) => ({ ...stage })),
    courses: [],
    tasks: [],
    alerts: [],
    libraryResources: [],
    roleProfiles: defaultRoleProfiles.map((profile) => ({
      ...profile,
      modules: profile.modules.map((module) => ({ ...module })),
    })),
    users: [],
    institution: {
      ...defaultInstitutionSettings,
      institutions: [...defaultInstitutionSettings.institutions],
      faculties: [...defaultInstitutionSettings.faculties],
      programs: [...defaultInstitutionSettings.programs],
      academicPeriods: [...defaultInstitutionSettings.academicPeriods],
      courseTypes: [...defaultInstitutionSettings.courseTypes],
      structures: defaultInstitutionSettings.structures.map((structure) => ({
        ...structure,
        faculties: [...structure.faculties],
        programs: [...structure.programs],
        academicPeriods: [...structure.academicPeriods],
        courseTypes: [...structure.courseTypes],
        pedagogicalGuidelines: [...structure.pedagogicalGuidelines],
      })),
    },
    branding: { ...defaultBranding },
    experience: { ...defaultExperienceSettings },
    workflow: { ...defaultWorkflowSettings },
  };
}
