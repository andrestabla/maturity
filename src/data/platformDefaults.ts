import type {
  AppData,
  BrandingSettings,
  ExperienceSettings,
  HomeContentSettings,
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
    id: 'microcurriculo',
    name: 'Microcurrículo',
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
    id: 'escritura',
    name: 'Escritura',
    description: 'Producción de contenidos base, guiones e instrucciones.',
    owner: 'Experto',
    tone: 'sage',
  },
  {
    id: 'validacion',
    name: 'Validación instruccional',
    description: 'Revisión pedagógica y ajuste de contenidos.',
    owner: 'Diseñador instruccional',
    tone: 'ocean',
  },
  {
    id: 'multimedia',
    name: 'Producción multimedia',
    description: 'Diseño visual, piezas gráficas y recursos audiovisuales.',
    owner: 'Diseñador multimedia',
    tone: 'gold',
  },
  {
    id: 'lms',
    name: 'Montaje LMS',
    description: 'Implementación técnica y configuración en plataforma LMS.',
    owner: 'Gestor LMS',
    tone: 'ocean',
  },
  {
    id: 'qa',
    name: 'QA',
    description: 'Control de calidad final, hallazgos y correcciones.',
    owner: 'Analista QA',
    tone: 'ink',
  },
  {
    id: 'entrega',
    name: 'Entrega',
    description: 'Cierre operativo, notificación y entrega final del curso.',
    owner: 'Coordinador',
    tone: 'sage',
  },
];

export const defaultRoleProfiles: RoleProfile[] = [
  {
    role: 'Administrador',
    overview: 'Gobierna estructura, visibilidad, parámetros y reglas globales del sistema.',
    focus: 'Control total sobre dashboard, cursos, biblioteca y configuración.',
    modules: [
      { name: 'Dashboard', permissions: 'Consulta y administra widgets, reglas e indicadores globales.' },
      { name: 'Analítica', permissions: 'Control total sobre KPI operativos, calidad, tiempos y comportamiento del portafolio.' },
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
      { name: 'Analítica', permissions: 'Consulta desempeño del portafolio, cumplimiento y cargas por rol.' },
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
      { name: 'Analítica', permissions: 'Consulta indicadores de productividad, tiempos y retrabajo en su alcance.' },
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
      { name: 'Analítica', permissions: 'Consulta calidad instruccional, devoluciones y eficiencia por etapa.' },
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
      { name: 'Analítica', permissions: 'Consulta tiempos multimedia, carga de trabajo y cuellos de botella.' },
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
      { name: 'Analítica', permissions: 'Consulta desempeño técnico, tiempos LMS y alertas de implementación.' },
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
      { name: 'Analítica', permissions: 'Consulta tasas de devolución, retrabajo y señales de calidad final.' },
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
      { name: 'Analítica', permissions: 'Consulta indicadores globales de control y cumplimiento del sistema.' },
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

export const defaultHomeContent: HomeContentSettings = {
  navBrandTagline: 'Diseño y producción de experiencias',
  navFlowLabel: 'Flujo',
  navLibraryLabel: 'Biblioteca',
  navAnalyticsLabel: 'Analítica',
  navContactLabel: 'Contacto',
  navLoginLabel: 'Ingresar',
  navDemoLabel: 'Solicitar una demo',
  heroKicker: 'Gestión de la operación de punta a punta',
  heroTitle: 'Escala el diseño de experiencias de aprendizaje y la producción de contenidos educativos.',
  heroLead:
    'Maturity360 te ayuda a escalar el diseño de experiencias de aprendizaje y la producción de contenidos educativos, asegurando estándares de calidad, control y trazabilidad del 100% del proceso.',
  heroPrimaryCta: 'Solicitar una demo',
  heroSecondaryCta: 'Entrar a la plataforma',
  heroSignals: [
    { title: '100%', description: 'trazabilidad del proceso académico y productivo.' },
    { title: 'IA + control', description: 'asistencia operativa sin perder gobierno institucional.' },
    { title: 'Una sola capa', description: 'planeación, diseño, biblioteca, analítica y QA conectados.' },
  ],
  heroCourseLabel: 'Curso activo',
  heroCourseTitle: 'Diseño de experiencia de aprendizaje',
  heroCourseProgressLabel: '12 entregables en progreso',
  heroStatusChip: 'Maturity360',
  heroStatusText: 'Producción sincronizada',
  heroSidebarDashboard: 'Dashboard',
  heroSidebarCourses: 'Cursos',
  heroSidebarLibrary: 'Biblioteca',
  heroSidebarAnalytics: 'Analítica',
  heroStageOneTitle: 'Arquitectura',
  heroStageOneDescription: 'Momentos, dispositivos y mapa didáctico.',
  heroStageTwoTitle: 'Diseño con IA',
  heroStageTwoDescription: 'Actividades, contenidos y criterios editables.',
  heroStageThreeTitle: 'Validación institucional',
  heroStageThreeDescription: 'Checklist y control pedagógico antes de publicar.',
  heroGlobalStatusLabel: 'Estado global',
  heroCourseProgressValue: '92%',
  heroCourseProgressDescription: 'Calidad, control y trazabilidad alineados por etapa.',
  stripItems: [
    'Diseño, producción y distribución coordinados en un solo flujo.',
    'Estándares institucionales visibles en cada decisión y entregable.',
    'Lectura operativa en tiempo real para actuar antes del retraso.',
  ],
  flowKicker: 'Timeline operativo',
  flowTitle: 'Un recorrido que ordena el proyecto, el equipo y la calidad.',
  flowLead:
    'Cada etapa aparece como una decisión concreta del proceso. La plataforma no solo acelera tareas: también conserva el hilo lógico, el control institucional y la evidencia de cómo se produjo cada curso.',
  timelineSteps: [
    {
      title: 'Microcurrículo',
      eyebrow: 'La experiencia inicia aquí',
      description: 'Crea o carga en el sistema tu planificación microcurricular.',
    },
    {
      title: 'Arquitectura',
      eyebrow: 'Estructura pedagógica',
      description:
        'A partir de los lineamientos institucionales, el sistema genera la arquitectura de la experiencia de aprendizaje (momentos y dispositivos didácticos).',
    },
    {
      title: 'Planificación',
      eyebrow: 'Ritmo operativo',
      description: 'Define tiempos y asigna el equipo de trabajo encargado de diseñar y producir la experiencia de aprendizaje.',
    },
    {
      title: 'Diseño',
      eyebrow: 'Construcción asistida',
      description:
        'Construye, con asistencia IA, las actividades de aprendizaje y los contenidos educativos digitales. Integra recursos disponibles en la biblioteca.',
    },
    {
      title: 'Validación institucional',
      eyebrow: 'Gobierno pedagógico',
      description:
        'Valida que los productos generados cumplan con los lineamientos pedagógicos definidos a nivel institucional.',
    },
    {
      title: 'Producción multimedia',
      eyebrow: 'Recursos listos para salir',
      description:
        'Genera los recursos educativos digitales mediante las herramientas de autor integradas o descarga los guiones para producir con otros medios.',
    },
    {
      title: 'Distribución (LMS)',
      eyebrow: 'Publicación controlada',
      description: 'Asegura que el contenido generado se cargue en las plataformas definidas para tal fin.',
    },
    {
      title: 'QA',
      eyebrow: 'Control de calidad final',
      description: 'Realiza el control de calidad de los productos finales e integrados antes de su publicación.',
    },
  ],
  libraryKicker: 'Biblioteca integrada',
  libraryTitle: 'Curación asistida para incorporar mejores recursos sin salir del flujo.',
  libraryLead: 'Integra material educativo a partir de la curación asistida de recursos disponibles en bases de datos académicas y científicas.',
  libraryFeatures: [
    'Recursos científicos, académicos y abiertos vinculados al curso.',
    'Selección guiada para reutilizar contenidos con criterio pedagógico.',
    'Integración inmediata en diseño, producción y validación.',
  ],
  librarySearchLabel: 'Buscar evidencia, artículos y recursos',
  librarySearchSources: '+ 14 fuentes conectadas',
  libraryCards: [
    { title: 'Artículo científico', source: 'OpenAlex + SciELO', tag: 'Curado' },
    { title: 'Recurso abierto', source: 'CORE + OER', tag: 'Listo para integrar' },
    { title: 'Video académico', source: 'YouTube educativo', tag: 'Relacionado con módulo 2' },
  ],
  librarySuggestionLabel: 'Sugerencia IA',
  librarySuggestionText: 'Recursos alineados con la actividad de aprendizaje del módulo 2.',
  analyticsKicker: 'Analítica accionable',
  analyticsTitle: 'Visibilidad operativa para detectar alertas antes de que se conviertan en cuello de botella.',
  analyticsLead: 'Visualiza en tiempo real el progreso de producción por curso, identificando alertas tempranas y comparte los tableros con los stakeholders del proyecto.',
  analyticsNotes: [
    'Lectura por curso, etapa, equipo y estado de avance.',
    'Conversación ejecutiva con datos listos para compartir.',
    'Alertas tempranas para actuar sobre carga, riesgo y calidad.',
  ],
  analyticsChartLabel: 'Progreso por curso',
  analyticsChartTitle: 'Lectura semanal en tiempo real',
  analyticsStats: [
    { label: 'Cursos activos', value: '24' },
    { label: 'Riesgos tempranos', value: '05' },
    { label: 'Cumplimiento global', value: '92%' },
  ],
  analyticsRows: [
    { label: 'Producción académica', value: '89%' },
    { label: 'Multimedia', value: '74%' },
    { label: 'Montaje LMS', value: '67%' },
    { label: 'QA final', value: '81%' },
  ],
  ctaKicker: 'Nueva forma de operar',
  ctaTitle: 'Preparemos a tu equipo para una nueva forma de trabajar en tiempos de IA.',
  ctaLead:
    'Maturity360 conecta criterio pedagógico, producción y control institucional en una sola operación más clara, más rápida y más gobernable.',
  ctaButtonLabel: 'Hablemos',
  footerText: 'Soluciones digitales con sentido humano.',
  footerLinkLabel: 'Producto desarrollado por Algoritmo T',
  footerLinkUrl: 'https://www.algoritmot.com/educacion',
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
    helpdeskTickets: [],
    libraryResources: [],
    libraryAssets: [],
    libraryCourseLinks: [],
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
    homeContent: { ...defaultHomeContent },
    experience: { ...defaultExperienceSettings },
    workflow: { ...defaultWorkflowSettings },
  };
}
