import type {
  Alert,
  AppData,
  BrandingSettings,
  Course,
  CourseAuditEntry,
  CourseMetadata,
  CourseProduct,
  CourseStageNotes,
  ExperienceSettings,
  LibraryResource,
  Role,
  RoleProfile,
  StageDefinition,
  Task,
  WorkflowSettings,
} from '../types.js';

type BaseCourse = Omit<Course, 'metadata' | 'auditLog' | 'stageNotes' | 'products'>;

const metadataOverrides: Partial<Record<string, Partial<CourseMetadata>>> = {
  'pensamiento-sistemico': {
    institution: 'Maturity University',
    shortName: 'Pensamiento Sistémico',
    semester: '6',
    academicPeriod: '2026-1',
    courseType: 'Troncal',
    learningOutcomes: [
      'Analizar sistemas organizacionales con enfoque causal.',
      'Modelar relaciones entre actores, variables y tensiones.',
      'Tomar decisiones sostenibles con mirada relacional.',
    ],
    topics: ['Mapas causales', 'Bucles de retroalimentación', 'Intervención sistémica'],
    methodology: 'Aprendizaje basado en casos, recursos breves y trabajo aplicado por unidad.',
    evaluation: 'Reto integrador por unidad, actividades guiadas y validación pedagógica progresiva.',
    bibliography: [
      'Senge, P. - La quinta disciplina',
      'Meadows, D. - Thinking in Systems',
      'Colección interna de casos organizacionales',
    ],
    targetCloseDate: '2026-04-04',
    currentVersion: 'v1.4',
    priority: 'Media',
    riskLevel: 'Medio',
  },
  'bioetica-aplicada': {
    institution: 'Maturity University',
    shortName: 'Bioética Aplicada',
    semester: '5',
    academicPeriod: '2026-1',
    courseType: 'Disciplinar',
    learningOutcomes: [
      'Analizar dilemas clínicos con criterio bioético.',
      'Construir argumentos éticos sustentados en casos.',
    ],
    topics: ['Principios bioéticos', 'Dilemas clínicos', 'Argumentación'],
    methodology: 'Estudio de casos, discusión guiada y reflexión argumentativa.',
    evaluation: 'Análisis de dilemas, participación en foros y actividad de cierre reflexivo.',
    bibliography: [
      'Beauchamp, T. y Childress, J. - Principles of Biomedical Ethics',
      'Selección institucional de casos clínicos',
    ],
    targetCloseDate: '2026-04-01',
    currentVersion: 'v0.9',
    priority: 'Media',
    riskLevel: 'Medio',
  },
  'calculo-integral': {
    institution: 'Maturity University',
    shortName: 'Cálculo Integral',
    semester: '3',
    academicPeriod: '2026-1',
    courseType: 'Fundamentación',
    learningOutcomes: [
      'Resolver integrales y justificar procedimientos.',
      'Aplicar la integral a problemas de área, volumen y acumulación.',
    ],
    topics: ['Antiderivadas', 'Aplicaciones', 'Simuladores y práctica guiada'],
    methodology: 'Práctica procedimental, simuladores y acompañamiento por resolución paso a paso.',
    evaluation: 'Talleres, cuestionarios progresivos y validación técnica final en LMS.',
    bibliography: [
      'Stewart, J. - Cálculo',
      'Repositorio institucional de ejercicios y simuladores',
    ],
    targetCloseDate: '2026-03-30',
    currentVersion: 'v2.1',
    priority: 'Alta',
    riskLevel: 'Alto',
  },
  'transformacion-organizacional': {
    institution: 'Maturity University',
    shortName: 'Transformación Organizacional',
    semester: '8',
    academicPeriod: '2026-1',
    courseType: 'Énfasis',
    learningOutcomes: [
      'Diseñar hojas de ruta para procesos de cambio.',
      'Relacionar liderazgo, cultura y gobernanza del cambio.',
    ],
    topics: ['Cambio cultural', 'Liderazgo adaptativo', 'Roadmaps organizacionales'],
    methodology: 'Análisis de escenarios, trabajo aplicado y diseño de iniciativas de cambio.',
    evaluation: 'Proyecto de transformación, bitácora por etapas y entregables de equipo.',
    bibliography: [
      'Hiatt, J. - ADKAR',
      'Kotter, J. - Leading Change',
    ],
    targetCloseDate: '2026-04-02',
    currentVersion: 'v0.7',
    priority: 'Alta',
    riskLevel: 'Alto',
  },
};

function makeCourseRoute(course: Pick<BaseCourse, 'faculty' | 'program' | 'title'>) {
  return `Repositorio institucional / ${course.faculty} / ${course.program} / ${course.title}`;
}

function makeCourseMetadata(course: BaseCourse): CourseMetadata {
  const override = metadataOverrides[course.slug] ?? {};

  return {
    institution: override.institution ?? 'Maturity University',
    shortName: override.shortName ?? course.title,
    semester: override.semester ?? 'Por definir',
    academicPeriod: override.academicPeriod ?? '2026-1',
    courseType: override.courseType ?? 'Curso',
    learningOutcomes: override.learningOutcomes ?? [course.summary],
    topics: override.topics ?? course.modules.map((module) => module.title),
    methodology:
      override.methodology ?? `${course.modality} con seguimiento por etapas y evidencias del proyecto.`,
    evaluation:
      override.evaluation ??
      'Seguimiento por entregables, validación por etapa y observaciones persistentes del expediente.',
    bibliography:
      override.bibliography ?? ['Documento base del curso', 'Biblioteca asociada al expediente'],
    targetCloseDate:
      override.targetCloseDate ??
      course.schedule
        .slice()
        .sort((left, right) => right.dueDate.localeCompare(left.dueDate))[0]?.dueDate ??
      course.updatedAt,
    currentVersion: override.currentVersion ?? 'v1.0',
    priority: override.priority ?? (course.status === 'Riesgo' || course.status === 'Bloqueado' ? 'Alta' : 'Media'),
    riskLevel:
      override.riskLevel ??
      (course.status === 'Bloqueado'
        ? 'Alto'
        : course.status === 'Riesgo'
          ? 'Alto'
          : course.status === 'En revisión'
            ? 'Medio'
            : 'Bajo'),
    route: makeCourseRoute(course),
  };
}

function makeCourseAuditLog(course: BaseCourse): CourseAuditEntry[] {
  return [
    {
      id: `audit-${course.slug}-latest`,
      title: 'Expediente operativo vigente',
      detail: `El curso se encuentra en ${course.stageId} con estado ${course.status.toLowerCase()} y próximo paso "${course.nextMilestone}".`,
      happenedAt: course.updatedAt,
      type: 'history',
    },
    {
      id: `audit-${course.slug}-bootstrap`,
      title: 'Ficha base consolidada',
      detail: `Se consolidó la ruta ${makeCourseRoute(course)} dentro del módulo Mis cursos.`,
      happenedAt: course.updatedAt,
      type: 'course',
    },
    ...course.schedule.slice(0, 3).map((item, index) => ({
      id: `audit-${course.slug}-schedule-${index}`,
      title: item.label,
      detail: `Hito de planeación registrado como ${item.status}.`,
      happenedAt: item.dueDate,
      type: 'planning' as const,
    })),
    ...course.deliverables.slice(0, 2).map((item, index) => ({
      id: `audit-${course.slug}-deliverable-${index}`,
      title: item.title,
      detail: `Entregable de ${item.owner} en estado ${item.status}.`,
      happenedAt: item.dueDate,
      type: 'production' as const,
    })),
    ...course.observations.slice(0, 2).map((item, index) => ({
      id: `audit-${course.slug}-qa-${index}`,
      title: item.title,
      detail: `Observación ${item.severity.toLowerCase()} con estado ${item.status}.`,
      happenedAt: course.updatedAt,
      type: 'qa' as const,
    })),
  ];
}

function makeCourseStageNotes(course: BaseCourse): CourseStageNotes {
  return {
    architecture: {
      owner: 'Diseñador instruccional',
      heading: 'Arquitectura de aprendizaje',
      status: course.stageId === 'arquitectura' ? 'En curso' : 'Listo',
      summary: `La arquitectura del curso ${course.title} organiza módulos, actividades y progresión de aprendizaje sobre ${course.program}.`,
      evidence: [
        `${course.modules.length} módulo(s) mapeado(s)`,
        `${course.modules.reduce((sum, module) => sum + module.activities, 0)} actividad(es) definidas`,
      ],
      blockers: [],
      updatedAt: course.updatedAt,
    },
    production: {
      owner: 'Experto',
      heading: 'Producción académica',
      status:
        course.stageId === 'produccion'
          ? 'En curso'
          : course.stageId === 'lms' || course.stageId === 'calidad'
            ? 'Listo'
            : 'Pendiente',
      summary: `La producción académica concentra autoría, instrucciones, contenidos y entregables clave del curso.`,
      evidence: course.deliverables.slice(0, 3).map((item) => item.title),
      blockers: course.deliverables
        .filter((item) => item.status === 'Bloqueado')
        .map((item) => item.title),
      updatedAt: course.updatedAt,
    },
    curation: {
      owner: 'Experto',
      heading: 'Curación de contenidos',
      status: course.stageId === 'arquitectura' || course.stageId === 'produccion' ? 'En curso' : 'Pendiente',
      summary: 'La curación prioriza fuentes externas, referencias vigentes y criterios de pertinencia para cada unidad.',
      evidence: [
        `${course.modules.reduce((sum, module) => sum + module.curatedResources, 0)} recurso(s) curado(s) asociados`,
      ],
      blockers: [],
      updatedAt: course.updatedAt,
    },
    multimedia: {
      owner: 'Diseñador multimedia',
      heading: 'Multimedia',
      status: course.team.some((member) => member.role === 'Diseñador multimedia') ? 'En curso' : 'Pendiente',
      summary: 'La capa multimedia integra piezas propias, versiones y observaciones para una experiencia consistente en móvil y LMS.',
      evidence: course.deliverables
        .filter((item) => item.owner === 'Diseñador multimedia')
        .map((item) => item.title),
      blockers: course.observations
        .filter((item) => item.role === 'Analista QA' && item.status !== 'Resuelta')
        .map((item) => item.title),
      updatedAt: course.updatedAt,
    },
    lms: {
      owner: 'Gestor LMS',
      heading: 'Montaje LMS',
      status:
        course.stageId === 'lms'
          ? 'En curso'
          : course.stageId === 'calidad'
            ? 'Listo'
            : 'Pendiente',
      summary: 'La implementación en LMS conserva evidencias de montaje, incidencias y checklist técnico del curso.',
      evidence: course.deliverables
        .filter((item) => item.owner === 'Gestor LMS')
        .map((item) => item.title),
      blockers: course.stageChecklist
        .filter((item) => item.owner === 'Gestor LMS' && item.status === 'blocked')
        .map((item) => item.label),
      updatedAt: course.updatedAt,
    },
    qa: {
      owner: 'Analista QA',
      heading: 'QA y validación',
      status:
        course.stageId === 'calidad'
          ? 'En curso'
          : course.status === 'Listo'
            ? 'Listo'
            : 'Pendiente',
      summary: 'La validación reúne revisión pedagógica, hallazgos, devoluciones y aprobación final antes del cierre.',
      evidence: course.observations.map((item) => item.title),
      blockers: course.observations
        .filter((item) => item.status !== 'Resuelta' && item.severity === 'Alta')
        .map((item) => item.title),
      updatedAt: course.updatedAt,
    },
  };
}

function makeCourseProducts(course: BaseCourse): CourseProduct[] {
  return [
    {
      id: `prod-${course.slug}-syllabus`,
      title: 'Sílabus base del curso',
      stage: 'general',
      format: 'Sílabus',
      owner: 'Coordinador',
      status: 'Aprobado',
      summary: 'Documento base con configuración académica, enfoque metodológico y trazabilidad curricular.',
      body: [
        `Curso: ${course.title} (${course.code})`,
        `Programa: ${course.program}`,
        `Modalidad: ${course.modality}`,
        `Resultados de aprendizaje: ${course.summary}`,
      ].join('\n'),
      tags: ['base', 'curricular', 'sílabus'],
      version: 'v1.0',
      updatedAt: course.updatedAt,
    },
    {
      id: `prod-${course.slug}-architecture`,
      title: 'Lineamiento pedagógico del curso',
      stage: 'architecture',
      format: 'Lineamiento',
      owner: 'Diseñador instruccional',
      status: course.stageId === 'arquitectura' ? 'En revisión' : 'Aprobado',
      summary: 'Define unidades, criterios de secuencia, actividades y lectura pedagógica del curso.',
      body: course.modules
        .map(
          (module, index) =>
            `Unidad ${index + 1}: ${module.title}\nObjetivo: ${module.learningGoal}\nActividades: ${module.activities}`,
        )
        .join('\n\n'),
      tags: ['arquitectura', 'pedagogía', 'módulos'],
      version: 'v1.1',
      updatedAt: course.updatedAt,
    },
    {
      id: `prod-${course.slug}-authoring`,
      title: 'Guía de actividades y recursos',
      stage: 'production',
      format: 'Actividad',
      owner: 'Experto',
      status: course.stageId === 'produccion' ? 'En revisión' : 'Borrador',
      summary: 'Contiene instrucciones, actividades y recursos escritos del curso en desarrollo.',
      body: course.deliverables
        .map(
          (item) =>
            `${item.title}\nResponsable: ${item.owner}\nEstado: ${item.status}\nNota: ${item.note}`,
        )
        .join('\n\n'),
      tags: ['autoría', 'actividades', 'recursos'],
      version: 'v0.9',
      updatedAt: course.updatedAt,
    },
    {
      id: `prod-${course.slug}-curation`,
      title: 'Inventario de recursos curados',
      stage: 'curation',
      format: 'Documento',
      owner: 'Experto',
      status: 'En revisión',
      summary: 'Registro de fuentes externas, selección y justificación pedagógica por unidad.',
      body: course.modules
        .map(
          (module) =>
            `${module.title}\nRecursos curados estimados: ${module.curatedResources}\nJustificación: Reforzar ${module.learningGoal.toLowerCase()}.`,
        )
        .join('\n\n'),
      tags: ['curación', 'fuentes', 'bibliografía'],
      version: 'v0.8',
      updatedAt: course.updatedAt,
    },
    {
      id: `prod-${course.slug}-multimedia`,
      title: 'Paquete multimedia del curso',
      stage: 'multimedia',
      format: 'HTML',
      owner: 'Diseñador multimedia',
      status: course.team.some((member) => member.role === 'Diseñador multimedia')
        ? 'En revisión'
        : 'Borrador',
      summary: 'Compila piezas propias del curso, guiones y salidas multimedia listas para revisión.',
      body: [
        'Piezas previstas:',
        '1. HTML interactivo por unidad prioritaria',
        '2. Guion de pódcast o microaudio',
        '3. Lectura complementaria',
        '4. Infografía o apoyo visual',
      ].join('\n'),
      tags: ['multimedia', 'html', 'propio'],
      version: 'v0.6',
      updatedAt: course.updatedAt,
    },
    {
      id: `prod-${course.slug}-qa`,
      title: 'Rúbrica de validación del curso',
      stage: 'qa',
      format: 'Rúbrica',
      owner: 'Analista QA',
      status: course.stageId === 'calidad' ? 'En revisión' : 'Borrador',
      summary: 'Checklist y criterio de validación para revisión pedagógica y control de calidad.',
      body: [
        '1. Coherencia pedagógica',
        '2. Calidad de actividades y recursos',
        '3. Accesibilidad y legibilidad',
        '4. Preparación para cierre',
      ].join('\n'),
      tags: ['qa', 'rúbrica', 'quality-matters'],
      version: 'v1.0',
      updatedAt: course.updatedAt,
    },
  ];
}

export const roles: Role[] = [
  'Administrador',
  'Coordinador',
  'Experto',
  'Diseñador instruccional',
  'Diseñador multimedia',
  'Gestor LMS',
  'Analista QA',
  'Auditor',
];

export const stages: StageDefinition[] = [
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

const courseCatalog: BaseCourse[] = [
  {
    id: 'course-01',
    slug: 'pensamiento-sistemico',
    title: 'Pensamiento Sistémico',
    code: 'MAT-214',
    faculty: 'Ciencias Económicas',
    program: 'Gestión Organizacional',
    modality: 'Virtual guiado',
    credits: 3,
    stageId: 'produccion',
    status: 'En ritmo',
    progress: 62,
    summary:
      'Curso troncal orientado a mapas causales, lectura de sistemas y toma de decisiones con enfoque relacional.',
    nextMilestone: 'Validación pedagógica · 29 mar 2026',
    updatedAt: '2026-03-26',
    pulse: {
      velocity: 78,
      quality: 84,
      alignment: 91,
    },
    team: [
      { id: 'tm-01', name: 'Laura Acosta', role: 'Coordinador', focus: 'Ritmo general del proyecto', initials: 'LA' },
      { id: 'tm-02', name: 'Daniel Ríos', role: 'Experto', focus: 'Autoría y curación disciplinar', initials: 'DR' },
      {
        id: 'tm-03',
        name: 'Pilar Soto',
        role: 'Diseñador instruccional',
        focus: 'Alineación pedagógica',
        initials: 'PS',
      },
      {
        id: 'tm-04',
        name: 'Nicolás Vega',
        role: 'Diseñador multimedia',
        focus: 'Piezas explicativas y visuales',
        initials: 'NV',
      },
    ],
    deliverables: [
      {
        id: 'del-01',
        title: 'Guía de trabajo de la Unidad 3',
        owner: 'Experto',
        status: 'En revisión',
        dueDate: '2026-03-29',
        note: 'Quedó pendiente ajustar la consigna de evaluación para evitar doble esfuerzo.',
      },
      {
        id: 'del-02',
        title: 'Microvideo sobre bucles de retroalimentación',
        owner: 'Diseñador multimedia',
        status: 'En curso',
        dueDate: '2026-03-31',
        note: 'Se está diseñando una versión corta para móvil y LMS.',
      },
      {
        id: 'del-03',
        title: 'Checklist de coherencia por módulo',
        owner: 'Diseñador instruccional',
        status: 'Listo',
        dueDate: '2026-03-25',
        note: 'Documento base aprobado y enlazado al flujo del curso.',
      },
    ],
    modules: [
      {
        id: 'mod-01',
        title: 'Leer el sistema',
        learningGoal: 'Interpretar relaciones, actores y tensiones dentro de un sistema organizacional.',
        activities: 3,
        ownResources: 2,
        curatedResources: 2,
        completion: 82,
      },
      {
        id: 'mod-02',
        title: 'Modelar dinámicas',
        learningGoal: 'Construir mapas causales y detectar patrones de cambio.',
        activities: 4,
        ownResources: 3,
        curatedResources: 1,
        completion: 68,
      },
      {
        id: 'mod-03',
        title: 'Intervenir con criterio',
        learningGoal: 'Diseñar decisiones sostenibles desde la lectura sistémica.',
        activities: 2,
        ownResources: 2,
        curatedResources: 2,
        completion: 39,
      },
    ],
    observations: [
      {
        id: 'obs-01',
        title: 'Carga de trabajo elevada en Unidad 2',
        role: 'Diseñador instruccional',
        severity: 'Media',
        status: 'En ajuste',
        detail: 'La secuencia actual acumula dos entregas fuertes en la misma semana. Se propuso redistribuir evidencia.',
      },
      {
        id: 'obs-02',
        title: 'Falta accesibilidad en subtítulos del video',
        role: 'Analista QA',
        severity: 'Alta',
        status: 'Pendiente',
        detail: 'Antes de pasar a LMS se deben cargar subtítulos cerrados y versión descargable del guion.',
      },
    ],
    schedule: [
      { id: 'sch-01', label: 'Autoría núcleo', dueDate: '2026-03-21', status: 'done' },
      { id: 'sch-02', label: 'Validación pedagógica parcial', dueDate: '2026-03-29', status: 'active' },
      { id: 'sch-03', label: 'Entrega multimedia', dueDate: '2026-03-31', status: 'pending' },
      { id: 'sch-04', label: 'Preparación LMS', dueDate: '2026-04-04', status: 'pending' },
    ],
    stageChecklist: [
      { id: 'ck-01', label: 'Ficha base', owner: 'Coordinador', status: 'done' },
      { id: 'ck-02', label: 'Arquitectura aprobada', owner: 'Diseñador instruccional', status: 'done' },
      { id: 'ck-03', label: 'Cronograma activo', owner: 'Coordinador', status: 'done' },
      { id: 'ck-04', label: 'Autoría', owner: 'Experto', status: 'active' },
      { id: 'ck-05', label: 'Montaje LMS', owner: 'Gestor LMS', status: 'pending' },
      { id: 'ck-06', label: 'QA y cierre', owner: 'Analista QA', status: 'pending' },
    ],
    assistants: [
      {
        id: 'as-01',
        name: 'Arquitecta Pedagógica',
        mission: 'Sugiere ajustes entre resultados, actividades y evaluación antes del envío a revisión.',
        tone: 'gold',
      },
      {
        id: 'as-02',
        name: 'Curadora Científica',
        mission: 'Prioriza recursos académicos recientes y deja trazabilidad por unidad.',
        tone: 'ocean',
      },
      {
        id: 'as-03',
        name: 'Radar de Coherencia',
        mission: 'Detecta huecos entre instrucciones, evidencias y rúbricas en todo el curso.',
        tone: 'coral',
      },
    ],
  },
  {
    id: 'course-02',
    slug: 'bioetica-aplicada',
    title: 'Bioética Aplicada',
    code: 'BIO-302',
    faculty: 'Ciencias de la Salud',
    program: 'Enfermería',
    modality: 'Virtual asincrónico',
    credits: 2,
    stageId: 'arquitectura',
    status: 'En revisión',
    progress: 41,
    summary:
      'Diseño de curso centrado en dilemas clínicos, toma de decisiones éticas y argumentación basada en casos.',
    nextMilestone: 'Aprobación de arquitectura · 28 mar 2026',
    updatedAt: '2026-03-25',
    pulse: {
      velocity: 64,
      quality: 88,
      alignment: 86,
    },
    team: [
      { id: 'tm-05', name: 'Sara Luna', role: 'Coordinador', focus: 'Planeación operativa', initials: 'SL' },
      { id: 'tm-06', name: 'Marta Pineda', role: 'Experto', focus: 'Casos y bibliografía base', initials: 'MP' },
      {
        id: 'tm-07',
        name: 'Iván Pardo',
        role: 'Diseñador instruccional',
        focus: 'Ruta didáctica por dilemas',
        initials: 'IP',
      },
    ],
    deliverables: [
      {
        id: 'del-04',
        title: 'Mapa de módulos y actividades',
        owner: 'Diseñador instruccional',
        status: 'En revisión',
        dueDate: '2026-03-28',
        note: 'El comité pidió reforzar el componente de discusión ética comparada.',
      },
      {
        id: 'del-05',
        title: 'Inventario de recursos curados',
        owner: 'Experto',
        status: 'En curso',
        dueDate: '2026-03-30',
        note: 'Ya hay 12 referencias priorizadas y 4 pendientes de validación.',
      },
    ],
    modules: [
      {
        id: 'mod-04',
        title: 'Fundamentos bioéticos',
        learningGoal: 'Reconocer principios y tensiones éticas en contextos de cuidado.',
        activities: 2,
        ownResources: 1,
        curatedResources: 3,
        completion: 71,
      },
      {
        id: 'mod-05',
        title: 'Dilemas clínicos',
        learningGoal: 'Analizar casos con criterio argumentativo y sensibilidad contextual.',
        activities: 3,
        ownResources: 1,
        curatedResources: 2,
        completion: 36,
      },
    ],
    observations: [
      {
        id: 'obs-03',
        title: 'Falta un cierre explícito de metacognición',
        role: 'Diseñador instruccional',
        severity: 'Media',
        status: 'Pendiente',
        detail: 'Se recomienda incluir una actividad corta de reflexión final por cada dilema.',
      },
    ],
    schedule: [
      { id: 'sch-05', label: 'Carga base del sílabus', dueDate: '2026-03-18', status: 'done' },
      { id: 'sch-06', label: 'Arquitectura para comité', dueDate: '2026-03-28', status: 'active' },
      { id: 'sch-07', label: 'Cronograma de producción', dueDate: '2026-04-01', status: 'pending' },
    ],
    stageChecklist: [
      { id: 'ck-07', label: 'Ficha base', owner: 'Coordinador', status: 'done' },
      { id: 'ck-08', label: 'Arquitectura aprobada', owner: 'Diseñador instruccional', status: 'active' },
      { id: 'ck-09', label: 'Cronograma activo', owner: 'Coordinador', status: 'pending' },
      { id: 'ck-10', label: 'Autoría', owner: 'Experto', status: 'pending' },
      { id: 'ck-11', label: 'Montaje LMS', owner: 'Gestor LMS', status: 'pending' },
      { id: 'ck-12', label: 'QA y cierre', owner: 'Analista QA', status: 'pending' },
    ],
    assistants: [
      {
        id: 'as-04',
        name: 'Traductora de Sílabus',
        mission: 'Convierte el microcurrículo en una estructura inicial de módulos y entregables.',
        tone: 'coral',
      },
      {
        id: 'as-05',
        name: 'Curadora de Casos',
        mission: 'Agrupa casos clínicos comparables por complejidad y pertinencia disciplinar.',
        tone: 'sage',
      },
    ],
  },
  {
    id: 'course-03',
    slug: 'calculo-integral',
    title: 'Cálculo Integral',
    code: 'MAT-118',
    faculty: 'Ingenierías',
    program: 'Ingeniería Industrial',
    modality: 'Virtual con encuentros',
    credits: 4,
    stageId: 'calidad',
    status: 'Bloqueado',
    progress: 88,
    summary:
      'Curso con alto componente procedimental, simuladores y recursos de práctica paso a paso.',
    nextMilestone: 'Corrección LMS · 27 mar 2026',
    updatedAt: '2026-03-26',
    pulse: {
      velocity: 52,
      quality: 79,
      alignment: 90,
    },
    team: [
      { id: 'tm-08', name: 'Camilo Torres', role: 'Coordinador', focus: 'Escalamiento y desbloqueos', initials: 'CT' },
      { id: 'tm-09', name: 'Valeria Mora', role: 'Gestor LMS', focus: 'Montaje técnico y navegación', initials: 'VM' },
      { id: 'tm-10', name: 'Ana Cardona', role: 'Analista QA', focus: 'Checklist técnico y funcional', initials: 'AC' },
    ],
    deliverables: [
      {
        id: 'del-06',
        title: 'Corrección de vínculos rotos en actividades',
        owner: 'Gestor LMS',
        status: 'Bloqueado',
        dueDate: '2026-03-27',
        note: 'Se detectaron 7 enlaces rotos en la unidad 4 y un cuestionario con navegación truncada.',
      },
      {
        id: 'del-07',
        title: 'Checklist final QA',
        owner: 'Analista QA',
        status: 'En revisión',
        dueDate: '2026-03-28',
        note: 'Avance al 82% con hallazgos ya registrados para cierre.',
      },
    ],
    modules: [
      {
        id: 'mod-06',
        title: 'Antiderivadas',
        learningGoal: 'Resolver integrales básicas y justificar procedimientos.',
        activities: 4,
        ownResources: 2,
        curatedResources: 1,
        completion: 100,
      },
      {
        id: 'mod-07',
        title: 'Aplicaciones',
        learningGoal: 'Aplicar la integral a área, volumen y acumulación.',
        activities: 5,
        ownResources: 3,
        curatedResources: 2,
        completion: 89,
      },
    ],
    observations: [
      {
        id: 'obs-04',
        title: 'Enlaces rotos en la unidad 4',
        role: 'Analista QA',
        severity: 'Alta',
        status: 'Pendiente',
        detail: 'Bloquea liberación. Debe resolverse antes de emitir aprobación final del curso.',
      },
      {
        id: 'obs-05',
        title: 'Simulador sin versión móvil en práctica 2',
        role: 'Auditor',
        severity: 'Media',
        status: 'Pendiente',
        detail: 'Se requiere alternativa descargable o guía equivalente para pantallas pequeñas.',
      },
    ],
    schedule: [
      { id: 'sch-08', label: 'Montaje técnico', dueDate: '2026-03-20', status: 'done' },
      { id: 'sch-09', label: 'QA funcional', dueDate: '2026-03-26', status: 'active' },
      { id: 'sch-10', label: 'Liberación', dueDate: '2026-03-30', status: 'pending' },
    ],
    stageChecklist: [
      { id: 'ck-13', label: 'Ficha base', owner: 'Coordinador', status: 'done' },
      { id: 'ck-14', label: 'Arquitectura aprobada', owner: 'Diseñador instruccional', status: 'done' },
      { id: 'ck-15', label: 'Cronograma activo', owner: 'Coordinador', status: 'done' },
      { id: 'ck-16', label: 'Autoría', owner: 'Experto', status: 'done' },
      { id: 'ck-17', label: 'Montaje LMS', owner: 'Gestor LMS', status: 'active' },
      { id: 'ck-18', label: 'QA y cierre', owner: 'Analista QA', status: 'blocked' },
    ],
    assistants: [
      {
        id: 'as-06',
        name: 'Verificador LMS',
        mission: 'Revisa consistencia de enlaces, etiquetas y disponibilidad de archivos antes del cierre.',
        tone: 'ink',
      },
      {
        id: 'as-07',
        name: 'Traductor Móvil',
        mission: 'Señala elementos que no responden bien en móvil y propone alternativas equivalentes.',
        tone: 'coral',
      },
    ],
  },
  {
    id: 'course-04',
    slug: 'transformacion-organizacional',
    title: 'Transformación Organizacional',
    code: 'ORG-420',
    faculty: 'Ciencias Sociales',
    program: 'Administración',
    modality: 'Híbrido',
    credits: 3,
    stageId: 'planeacion',
    status: 'Riesgo',
    progress: 28,
    summary:
      'Curso orientado a cambio cultural, liderazgo adaptativo y diseño de hojas de ruta organizacionales.',
    nextMilestone: 'Ajuste de cronograma · 30 mar 2026',
    updatedAt: '2026-03-24',
    pulse: {
      velocity: 46,
      quality: 75,
      alignment: 82,
    },
    team: [
      { id: 'tm-11', name: 'Juliana Mesa', role: 'Coordinador', focus: 'Ruta operativa y fechas', initials: 'JM' },
      { id: 'tm-12', name: 'Esteban Guerra', role: 'Experto', focus: 'Marco conceptual y casos', initials: 'EG' },
      {
        id: 'tm-13',
        name: 'Lucía Giraldo',
        role: 'Diseñador instruccional',
        focus: 'Secuencia de aprendizaje',
        initials: 'LG',
      },
    ],
    deliverables: [
      {
        id: 'del-08',
        title: 'Cronograma por etapas',
        owner: 'Coordinador',
        status: 'En curso',
        dueDate: '2026-03-30',
        note: 'Falta confirmar disponibilidad del diseñador multimedia para semana 2.',
      },
      {
        id: 'del-09',
        title: 'Asignación de roles del equipo',
        owner: 'Coordinador',
        status: 'Bloqueado',
        dueDate: '2026-03-27',
        note: 'El auditor aún no está definido y eso afecta el cierre de planeación.',
      },
    ],
    modules: [
      {
        id: 'mod-08',
        title: 'Cambio y cultura',
        learningGoal: 'Relacionar transformación organizacional con hábitos, estructura y liderazgo.',
        activities: 2,
        ownResources: 1,
        curatedResources: 2,
        completion: 34,
      },
      {
        id: 'mod-09',
        title: 'Diseño de hoja de ruta',
        learningGoal: 'Construir iniciativas de cambio con indicadores y gobernanza.',
        activities: 3,
        ownResources: 2,
        curatedResources: 1,
        completion: 14,
      },
    ],
    observations: [
      {
        id: 'obs-06',
        title: 'Dependencia no resuelta con equipo multimedia',
        role: 'Coordinador',
        severity: 'Alta',
        status: 'Pendiente',
        detail: 'La producción de piezas visuales no tiene responsable asignado todavía y afecta fechas posteriores.',
      },
    ],
    schedule: [
      { id: 'sch-11', label: 'Definición de equipo', dueDate: '2026-03-27', status: 'active' },
      { id: 'sch-12', label: 'Cronograma validado', dueDate: '2026-03-30', status: 'pending' },
      { id: 'sch-13', label: 'Activación del flujo', dueDate: '2026-04-02', status: 'pending' },
    ],
    stageChecklist: [
      { id: 'ck-19', label: 'Ficha base', owner: 'Coordinador', status: 'done' },
      { id: 'ck-20', label: 'Arquitectura aprobada', owner: 'Diseñador instruccional', status: 'done' },
      { id: 'ck-21', label: 'Cronograma activo', owner: 'Coordinador', status: 'active' },
      { id: 'ck-22', label: 'Autoría', owner: 'Experto', status: 'pending' },
      { id: 'ck-23', label: 'Montaje LMS', owner: 'Gestor LMS', status: 'pending' },
      { id: 'ck-24', label: 'QA y cierre', owner: 'Analista QA', status: 'pending' },
    ],
    assistants: [
      {
        id: 'as-08',
        name: 'Planner Operativo',
        mission: 'Propone secuencias realistas por rol y detecta huecos en asignación o dependencias.',
        tone: 'ocean',
      },
      {
        id: 'as-09',
        name: 'Balanceador de Carga',
        mission: 'Advierte picos de trabajo y reacomoda hitos antes de que el curso entre en riesgo.',
        tone: 'gold',
      },
    ],
  },
];

export const courses: Course[] = courseCatalog.map((course) => ({
  ...course,
  metadata: makeCourseMetadata(course),
  auditLog: makeCourseAuditLog(course),
  stageNotes: makeCourseStageNotes(course),
  products: makeCourseProducts(course),
}));

export const tasks: Task[] = [
  {
    id: 'task-01',
    title: 'Ajustar la actividad integradora de la Unidad 3',
    courseSlug: 'pensamiento-sistemico',
    role: 'Experto',
    stageId: 'produccion',
    dueDate: '2026-03-29',
    priority: 'Alta',
    status: 'Pendiente',
    summary: 'Hay que simplificar la evidencia para que no compita con la lectura guiada.',
  },
  {
    id: 'task-02',
    title: 'Aprobar mapa de arquitectura',
    courseSlug: 'bioetica-aplicada',
    role: 'Diseñador instruccional',
    stageId: 'arquitectura',
    dueDate: '2026-03-28',
    priority: 'Alta',
    status: 'En revisión',
    summary: 'El comité académico espera una versión con cierre reflexivo por unidad.',
  },
  {
    id: 'task-03',
    title: 'Desbloquear vínculos rotos antes del cierre',
    courseSlug: 'calculo-integral',
    role: 'Gestor LMS',
    stageId: 'lms',
    dueDate: '2026-03-27',
    priority: 'Alta',
    status: 'Bloqueada',
    summary: 'El paso a calidad final depende de corregir enlaces y navegación.',
  },
  {
    id: 'task-04',
    title: 'Asignar auditor del proyecto',
    courseSlug: 'transformacion-organizacional',
    role: 'Coordinador',
    stageId: 'planeacion',
    dueDate: '2026-03-27',
    priority: 'Alta',
    status: 'Pendiente',
    summary: 'Sin auditor no se puede cerrar la planeación formal del curso.',
  },
  {
    id: 'task-05',
    title: 'Subir subtítulos cerrados del microvideo',
    courseSlug: 'pensamiento-sistemico',
    role: 'Diseñador multimedia',
    stageId: 'produccion',
    dueDate: '2026-03-31',
    priority: 'Media',
    status: 'Pendiente',
    summary: 'La revisión QA marcó este punto como condición de liberación.',
  },
  {
    id: 'task-06',
    title: 'Registrar hallazgos del checklist final',
    courseSlug: 'calculo-integral',
    role: 'Analista QA',
    stageId: 'calidad',
    dueDate: '2026-03-28',
    priority: 'Media',
    status: 'En revisión',
    summary: 'Se requiere emitir hallazgos y confirmar si el curso puede liberarse el 30 de marzo.',
  },
  {
    id: 'task-07',
    title: 'Completar inventario curado',
    courseSlug: 'bioetica-aplicada',
    role: 'Experto',
    stageId: 'arquitectura',
    dueDate: '2026-03-30',
    priority: 'Media',
    status: 'Pendiente',
    summary: 'Faltan cuatro artículos base para cerrar el paquete de recursos externos.',
  },
  {
    id: 'task-08',
    title: 'Recalcular disponibilidad del equipo',
    courseSlug: 'transformacion-organizacional',
    role: 'Coordinador',
    stageId: 'planeacion',
    dueDate: '2026-03-30',
    priority: 'Media',
    status: 'Pendiente',
    summary: 'El cronograma debe ajustarse a la capacidad real del diseñador multimedia.',
  },
];

export const alerts: Alert[] = [
  {
    id: 'alert-01',
    title: 'Cálculo Integral no puede cerrarse',
    courseSlug: 'calculo-integral',
    tone: 'coral',
    owner: 'Gestor LMS',
    detail: 'Hay un bloqueo técnico abierto desde el 26 de marzo de 2026 y detiene QA final.',
  },
  {
    id: 'alert-02',
    title: 'Transformación Organizacional tiene hueco de capacidad',
    courseSlug: 'transformacion-organizacional',
    tone: 'gold',
    owner: 'Coordinador',
    detail: 'La planeación sigue sin cobertura multimedia confirmada para la segunda iteración.',
  },
  {
    id: 'alert-03',
    title: 'Pensamiento Sistémico requiere ajuste de accesibilidad',
    courseSlug: 'pensamiento-sistemico',
    tone: 'ocean',
    owner: 'Diseñador multimedia',
    detail: 'Los subtítulos cerrados siguen pendientes en un recurso clave antes del paso a LMS.',
  },
];

export const libraryResources: LibraryResource[] = [
  {
    id: 'res-01',
    title: 'Guía interactiva de mapas causales',
    kind: 'Propio',
    courseSlug: 'pensamiento-sistemico',
    unit: 'Unidad 2',
    source: 'Producción interna',
    status: 'En revisión',
    tags: ['visual', 'móvil', 'microlearning'],
    summary: 'Pieza ligera con recorrido táctil para explicar ciclos de refuerzo y balance.',
  },
  {
    id: 'res-02',
    title: 'Colección de casos clínicos comparados',
    kind: 'Curado',
    courseSlug: 'bioetica-aplicada',
    unit: 'Unidad 2',
    source: 'Scopus / PubMed',
    status: 'Listo',
    tags: ['casos', 'ética', 'vigencia'],
    summary: 'Paquete de lecturas cortas para discusión argumentada en dilemas clínicos.',
  },
  {
    id: 'res-03',
    title: 'Simulador de volúmenes por revolución',
    kind: 'Propio',
    courseSlug: 'calculo-integral',
    unit: 'Unidad 4',
    source: 'Producción interna',
    status: 'En revisión',
    tags: ['simulador', 'accesibilidad', 'lms'],
    summary: 'Recurso interactivo para practicar problemas de volumen con retroalimentación inmediata.',
  },
  {
    id: 'res-04',
    title: 'Marco ADKAR aplicado a educación',
    kind: 'Curado',
    courseSlug: 'transformacion-organizacional',
    unit: 'Unidad 1',
    source: 'Base académica institucional',
    status: 'Pendiente',
    tags: ['cambio', 'liderazgo', 'referente'],
    summary: 'Referencia base para comparar modelos de adopción del cambio y gestión cultural.',
  },
  {
    id: 'res-05',
    title: 'Plantilla de bitácora de observaciones',
    kind: 'Propio',
    courseSlug: 'pensamiento-sistemico',
    unit: 'Transversal',
    source: 'Producción interna',
    status: 'Listo',
    tags: ['qa', 'trazabilidad', 'plantilla'],
    summary: 'Formato reusable para conectar observaciones, ajustes y validaciones por etapa.',
  },
];

export const roleProfiles: RoleProfile[] = [
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

export const mockAppData: AppData = {
  roles,
  stages,
  courses,
  tasks,
  alerts,
  libraryResources,
  roleProfiles,
  branding: defaultBranding,
  experience: defaultExperienceSettings,
  workflow: defaultWorkflowSettings,
  users: [
    {
      id: 'user-admin-demo',
      name: 'Administrador Maturity',
      email: 'admin@maturity.local',
      role: 'Administrador',
      secondaryRoles: [],
      status: 'Activo',
      headline: 'Gobierno funcional y técnico de la plataforma',
      phone: '+57 300 000 0000',
      location: 'Bogotá, Colombia',
      bio: 'Administra la configuración central, accesos e integraciones de la operación.',
      institution: 'Maturity University',
      faculty: 'Gobierno del sistema',
      program: 'Operación central',
      scope: 'Global',
      createdAt: '2026-03-01T09:00:00.000Z',
      createdBy: 'system',
      lastAccessAt: '2026-03-27T08:00:00.000Z',
      statusReason: null,
    },
  ],
};
