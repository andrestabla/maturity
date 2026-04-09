export type Role =
  | 'Administrador'
  | 'Coordinador'
  | 'Experto'
  | 'Diseñador instruccional'
  | 'Diseñador multimedia'
  | 'Gestor LMS'
  | 'Analista QA'
  | 'Auditor';

export type CourseStatus =
  | 'Sin iniciar'
  | 'En curso'
  | 'En QA'
  | 'Entregado'
  | 'Bloqueado'
  | 'En riesgo';

export type DeliverableStatus =
  | 'En curso'
  | 'En revisión'
  | 'Listo'
  | 'Bloqueado';

export type ObservationStatus = 'Pendiente' | 'En ajuste' | 'Resuelta';
export type Priority = 'Alta' | 'Media' | 'Baja';
export type HelpDeskTicketStatus =
  | 'Abierto'
  | 'En análisis'
  | 'En progreso'
  | 'Resuelto'
  | 'Cerrado';
export type HelpDeskTicketCategory =
  | 'Soporte técnico'
  | 'Funcionalidad del sistema'
  | 'Flujo de trabajo'
  | 'Acceso y permisos'
  | 'Metodología y entregables';
export type Tone = 'coral' | 'sage' | 'ocean' | 'gold' | 'ink';
export type StageCheckpointStatus = 'done' | 'active' | 'pending' | 'blocked';
export type RiskLevel = 'Bajo' | 'Medio' | 'Alto';
export type StageNoteStatus = 'Pendiente' | 'En curso' | 'Listo';
export type UserAccountStatus = 'Activo' | 'Inactivo' | 'Suspendido' | 'Pendiente';
export type AdminIntegrationStatus =
  | 'Activa'
  | 'Inactiva'
  | 'Pendiente'
  | 'En prueba'
  | 'Con error';
export type AdminIntegrationSource = 'runtime' | 'governance' | 'none';
export type AdminIntegrationCategory =
  | 'Correo'
  | 'IA'
  | 'Académicas'
  | 'Google'
  | 'Storage'
  | 'Audiovisual'
  | 'Sistema';
export type BrandingFontPreset = 'Control' | 'Editorial' | 'Institutional';
export type BrandingLoginVariant = 'Minimal' | 'Split' | 'Command';
export type WorkspaceStudioMode = 'Profundo' | 'Contextual';
export type StageRailVisibility = 'Solo workflow' | 'Siempre' | 'Oculto';
export type ProfileLayoutMode = 'Dos columnas' | 'Apilado';
export type AdminLogSeverity = 'Info' | 'Success' | 'Warning' | 'Error';
export type AdminLogCategory =
  | 'Sistema'
  | 'Autenticación'
  | 'Integración'
  | 'Administración';
export type AdminAuditClassification = 'Funcional' | 'Técnica' | 'Administrativa';
export type CourseStageNoteKey =
  | 'microcurriculo'
  | 'arquitectura'
  | 'planeacion'
  | 'escritura'
  | 'validacion'
  | 'multimedia'
  | 'lms'
  | 'qa'
  | 'entrega';
export type CourseProductStage =
  | 'microcurriculo'
  | 'arquitectura'
  | 'planeacion'
  | 'escritura'
  | 'validacion'
  | 'multimedia'
  | 'lms'
  | 'qa'
  | 'entrega';
export type CourseProductFormat =
  | 'Sílabus'
  | 'Lineamiento'
  | 'Actividad'
  | 'Recurso'
  | 'Documento'
  | 'PDF'
  | 'HTML'
  | 'Pódcast'
  | 'Lectura'
  | 'Infografía'
  | 'Rúbrica'
  | 'Taller'
  | 'Video'
  | 'RED'
  | 'Evaluación';
export type CourseProductStatus = 'Borrador' | 'En revisión' | 'Aprobado';
export type ProductPlanningPhase =
  | 'escritura'
  | 'validacion'
  | 'multimedia'
  | 'lms'
  | 'qa';

export interface StageDefinition {
  id: string;
  name: string;
  description: string;
  owner: Role;
  tone: Tone;
}

export interface StageCheckpoint {
  id: string;
  label: string;
  owner: Role;
  status: StageCheckpointStatus;
}

export interface TeamMember {
  id: string;
  name: string;
  role: Role;
  focus: string;
  initials: string;
}

export interface Deliverable {
  id: string;
  title: string;
  owner: Role;
  status: DeliverableStatus;
  dueDate: string;
  note: string;
}

export interface LearningModule {
  id: string;
  title: string;
  learningGoal: string;
  activities: number;
  ownResources: number;
  curatedResources: number;
  completion: number;
}

export interface Observation {
  id: string;
  title: string;
  role: Role;
  severity: Priority;
  status: ObservationStatus;
  detail: string;
}

export interface TimelineItem {
  id: string;
  label: string;
  dueDate: string;
  status: 'done' | 'active' | 'pending';
}

export interface CourseMetadata {
  institution: string;
  shortName: string;
  semester: string;
  academicPeriod: string;
  courseType: string;
  learningOutcomes: string[];
  topics: string[];
  units: { tituloUnidad: string; tematicas: string[] }[];
  methodology: string;
  evaluation: string[];
  bibliography: string[];
  targetCloseDate: string;
  currentVersion: string;
  priority: Priority;
  riskLevel: RiskLevel;
  route: string;
}

export interface CourseAuditEntry {
  id: string;
  title: string;
  detail: string;
  happenedAt: string;
  type:
    | 'course'
    | 'planning'
    | 'production'
    | 'resource'
    | 'qa'
    | 'handoff'
    | 'history';
}

export interface CourseStageNote {
  owner: Role;
  heading: string;
  status: StageNoteStatus;
  summary: string;
  evidence: string[];
  blockers: string[];
  updatedAt: string;
}

export interface CourseStageNotes {
  microcurriculo: CourseStageNote;
  arquitectura: CourseStageNote;
  planeacion: CourseStageNote;
  escritura: CourseStageNote;
  validacion: CourseStageNote;
  multimedia: CourseStageNote;
  lms: CourseStageNote;
  qa: CourseStageNote;
  entrega: CourseStageNote;
}

export interface CourseProduct {
  id: string;
  title: string;
  stage: CourseProductStage;
  format: CourseProductFormat;
  owner: Role;
  status: CourseProductStatus;
  summary: string;
  body: string;
  tags: string[];
  version: string;
  section?: string;
  phasePlan: ProductPhasePlan[];
  writingData: ProductWritingData;
  validationData: ProductValidationData;
  updatedAt: string;
}

export interface ProductPhasePlan {
  phase: ProductPlanningPhase;
  startDate: string;
  endDate: string;
  assigneeId?: string;
  assigneeName?: string;
}

export type ProductWritingMode = 'upload' | 'ai' | 'manual';

export interface ProductWritingAsset {
  key: string;
  url: string;
  name: string;
  contentType?: string;
  size?: number;
  uploadedAt: string;
}

export interface ProductWritingSection {
  id: string;
  title: string;
  instructions: string;
  content: string;
  updatedAt?: string;
}

export interface ProductWritingData {
  mode: ProductWritingMode;
  submittedAsset?: ProductWritingAsset | null;
  supportAssets: ProductWritingAsset[];
  libraryResourceIds: string[];
  aiPrompt?: string;
  extractedText: string;
  draftText: string;
  sections: ProductWritingSection[];
  lastSavedAt?: string;
  lastGeneratedAt?: string;
}

export type ProductValidationChecklistStatus = 'Cumple' | 'Parcial' | 'No cumple' | 'No aplica';
export type ProductValidationCommentStatus = 'Abierto' | 'Resuelto';

export interface ProductValidationChecklistItem {
  id: string;
  label: string;
  status: ProductValidationChecklistStatus;
  notes?: string;
  updatedAt?: string;
}

export interface ProductValidationComment {
  id: string;
  fragment: string;
  comment: string;
  author: Role;
  status: ProductValidationCommentStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

export interface ProductValidationData {
  criteria: string[];
  reviewerNotes: string;
  readyForProduction: boolean;
  checklist: ProductValidationChecklistItem[];
  comments: ProductValidationComment[];
  lastReviewedAt?: string;
}

export interface AssistantCard {
  id: string;
  name: string;
  mission: string;
  tone: Tone;
}

export interface Course {
  id: string;
  slug: string;
  title: string;
  code: string;
  institutionStructureId?: string;
  faculty: string;
  program: string;
  modality: string;
  credits: number;
  stageId: string;
  status: CourseStatus;
  progress: number;
  summary: string;
  nextMilestone: string;
  updatedAt: string;
  pulse: {
    velocity: number;
    quality: number;
    alignment: number;
  };
  team: TeamMember[];
  deliverables: Deliverable[];
  modules: LearningModule[];
  observations: Observation[];
  schedule: TimelineItem[];
  stageChecklist: StageCheckpoint[];
  assistants: AssistantCard[];
  metadata: CourseMetadata;
  auditLog: CourseAuditEntry[];
  stageNotes: CourseStageNotes;
  products: CourseProduct[];
}

export interface Task {
  id: string;
  title: string;
  courseSlug: string;
  productId?: string;
  productTitle?: string;
  role: Role;
  stageId: string;
  dueDate: string;
  priority: Priority;
  status: 'Pendiente' | 'En revisión' | 'Bloqueada' | 'Lista';
  summary: string;
}

export interface Alert {
  id: string;
  title: string;
  courseSlug: string;
  tone: Tone;
  owner: Role;
  detail: string;
}

export interface HelpDeskTicket {
  id: string;
  title: string;
  description: string;
  category: HelpDeskTicketCategory;
  status: HelpDeskTicketStatus;
  priority: Priority;
  courseSlug?: string;
  stageId?: CourseProductStage;
  requesterId: string;
  requesterName: string;
  assigneeId?: string;
  assigneeName?: string;
  resolutionSummary?: string;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string;
}

export interface LibraryResource {
  id: string;
  title: string;
  kind: 'Curado' | 'Propio';
  courseSlug: string;
  unit: string;
  source: string;
  status: 'Listo' | 'En revisión' | 'Pendiente';
  tags: string[];
  summary: string;
}

export type LibraryGroup =
  | 'Investigacion'
  | 'Didacticos'
  | 'YouTube'
  | 'Institucional'
  | 'Otros';

export type LibraryProvider =
  | 'institutional'
  | 'semantic-scholar'
  | 'openalex'
  | 'arxiv'
  | 'core'
  | 'oer-commons'
  | 'phet'
  | 'redalyc'
  | 'scielo'
  | 'youtube';

export type LibraryVisibility = 'Publico' | 'Institucional';

export type LibraryPreviewKind =
  | 'article'
  | 'paper'
  | 'video'
  | 'pdf'
  | 'audio'
  | 'image'
  | 'scorm'
  | 'simulation'
  | 'external-link'
  | 'unknown';

export interface LibraryLicense {
  label: string;
  code?: string;
  url?: string;
  open?: boolean;
}

export interface LibraryAssetFile {
  id: string;
  assetId: string;
  fileName: string;
  mimeType: string;
  key: string;
  url: string;
  sizeBytes: number;
  manifest?: Record<string, unknown> | null;
  previewText?: string | null;
  createdAt: string;
}

export interface LibraryAsset {
  id: string;
  canonicalKey: string;
  provider: LibraryProvider;
  providerRecordId: string;
  group: LibraryGroup;
  title: string;
  authors: string[];
  publishedAt: string;
  abstract: string;
  descriptionHtml: string;
  doi?: string;
  canonicalUrl: string;
  resourceType: string;
  language: string;
  license?: LibraryLicense | null;
  openAccess: boolean;
  citationCount: number;
  thumbnailUrl?: string;
  embedUrl?: string;
  institutionId?: string;
  institutionName?: string;
  visibility: LibraryVisibility;
  previewKind: LibraryPreviewKind;
  tags: string[];
  metadata: Record<string, unknown>;
  files?: LibraryAssetFile[];
  createdAt: string;
  updatedAt: string;
}

export interface LibraryCourseLink {
  id: string;
  assetId: string;
  courseSlug: string;
  targetStage?: string;
  targetUnit?: string;
  addedBy?: string;
  addedAt: string;
}

export interface LibrarySearchResult {
  id: string;
  canonicalKey: string;
  provider: LibraryProvider;
  providerRecordId: string;
  providers: LibraryProvider[];
  group: LibraryGroup;
  title: string;
  authors: string[];
  publishedAt: string;
  abstract: string;
  descriptionHtml: string;
  doi?: string;
  canonicalUrl: string;
  resourceType: string;
  language: string;
  license?: LibraryLicense | null;
  openAccess: boolean;
  citationCount: number;
  thumbnailUrl?: string;
  embedUrl?: string;
  institutionId?: string;
  institutionName?: string;
  visibility: LibraryVisibility;
  previewKind: LibraryPreviewKind;
  tags: string[];
  metadata: Record<string, unknown>;
  score: number;
  sourceKinds: string[];
  cached: boolean;
}

export interface RoleProfile {
  role: Role;
  overview: string;
  focus: string;
  modules: {
    name: string;
    permissions: string;
  }[];
}

export interface AppData {
  roles: Role[];
  stages: StageDefinition[];
  courses: Course[];
  tasks: Task[];
  alerts: Alert[];
  helpdeskTickets: HelpDeskTicket[];
  libraryResources: LibraryResource[];
  libraryAssets: LibraryAsset[];
  libraryCourseLinks: LibraryCourseLink[];
  roleProfiles: RoleProfile[];
  users: AuthUser[];
  institution: InstitutionSettings;
  branding: BrandingSettings;
  experience: ExperienceSettings;
  workflow: WorkflowSettings;
}

export interface UserInstitutionMembership {
  id: string;
  institutionId: string;
  institution: string;
  role: Role;
  faculty?: string;
  program?: string;
  scope?: string;
  primary: boolean;
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  secondaryRoles?: Role[];
  status?: UserAccountStatus;
  headline?: string;
  phone?: string;
  location?: string;
  bio?: string;
  institutionId?: string;
  institution?: string;
  facultyId?: string;
  faculty?: string;
  programId?: string;
  program?: string;
  scope?: string;
  createdAt?: string;
  createdBy?: string | null;
  lastAccessAt?: string | null;
  statusReason?: string | null;
  memberships?: UserInstitutionMembership[];
}

export interface AuthSession {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface UserMutationInput {
  name: string;
  email: string;
  role: Role;
  secondaryRoles: Role[];
  status: UserAccountStatus;
  headline?: string;
  phone?: string;
  location?: string;
  bio?: string;
  institution: string;
  faculty: string;
  program: string;
  institutionMembershipIds?: string[];
  scope: string;
  statusReason: string;
  password: string;
}

export interface UserUpdateInput {
  id: string;
  name: string;
  email: string;
  role: Role;
  secondaryRoles: Role[];
  status: UserAccountStatus;
  headline?: string;
  phone?: string;
  location?: string;
  bio?: string;
  institution: string;
  faculty: string;
  program: string;
  institutionMembershipIds?: string[];
  scope: string;
  statusReason: string;
  password?: string;
}

export interface UserProfileUpdateInput {
  name: string;
  email: string;
  headline: string;
  phone: string;
  location: string;
  bio: string;
}

export interface InstitutionStructure {
  id: string;
  institution: string;
  faculties: string[];
  programs: string[];
  academicPeriods: string[];
  courseTypes: string[];
  pedagogicalGuidelines: string[];
  allowAutoProvisioning: boolean;
}

export interface InstitutionSettings {
  displayName: string;
  structures: InstitutionStructure[];
  institutions: string[];
  faculties: string[];
  programs: string[];
  academicPeriods: string[];
  courseTypes: string[];
  supportEmail: string;
  defaultDomain: string;
  defaultUserState: UserAccountStatus;
  allowAutoProvisioning: boolean;
}

export interface BrandingSettings {
  platformName: string;
  institutionName: string;
  shortMark: string;
  logoText: string;
  logoUrl: string;
  logoMode: 'Monograma' | 'Wordmark' | 'Imagen';
  faviconLabel: string;
  faviconUrl: string;
  faviconMode: 'Monograma' | 'Imagen';
  primaryColor: string;
  accentColor: string;
  surfaceStyle: string;
  fontPreset: BrandingFontPreset;
  bodyFontFamily: string;
  displayFontFamily: string;
  monoFontFamily: string;
  loginVariant: BrandingLoginVariant;
  loginEyebrow: string;
  loginHeadline: string;
  loginMessage: string;
  loaderLabel: string;
  loaderMessage: string;
  supportUrl: string;
}

export interface ExperienceSettings {
  studioMode: WorkspaceStudioMode;
  showSummaryHero: boolean;
  showFocusedStageHeader: boolean;
  stageRailVisibility: StageRailVisibility;
  profileLayout: ProfileLayoutMode;
}

export interface WorkflowSettings {
  showWorkflowStageCards: boolean;
  showQuickAccessPanel: boolean;
  handoffRequiresCheckpoint: boolean;
  handoffBlocksOnBlockedCheckpoints: boolean;
  handoffBlocksOnCriticalObservations: boolean;
}

export interface AdminIntegration {
  id: string;
  name: string;
  category: AdminIntegrationCategory;
  provider: string;
  description: string;
  enabled: boolean;
  status: AdminIntegrationStatus;
  requiredEnvKeys: string[];
  envReady: boolean;
  runtimeSource: AdminIntegrationSource;
  runtimeSummary: string;
  scopes: string[];
  config: Record<string, string>;
  lastTestAt: string | null;
  lastError: string | null;
  notes: string;
  fallbackTo: string;
  assistantTitle: string;
  assistantSummary: string;
  assistantSteps: string[];
}

export interface AdminLogEntry {
  id: string;
  createdAt: string;
  category: AdminLogCategory;
  module: string;
  service: string;
  severity: AdminLogSeverity;
  event: string;
  result: string;
  detail: string;
  userId: string | null;
  userName: string | null;
}

export interface AdminAuditEntry {
  id: string;
  createdAt: string;
  classification: AdminAuditClassification;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorName: string;
  detail: string;
  beforeValue: string | null;
  afterValue: string | null;
}

export interface AdminCenterData {
  users: AuthUser[];
  institution: InstitutionSettings;
  branding: BrandingSettings;
  experience: ExperienceSettings;
  workflow: WorkflowSettings;
  integrations: AdminIntegration[];
  logs: AdminLogEntry[];
  audit: AdminAuditEntry[];
}

export interface AdminIntegrationMutationInput {
  id: string;
  enabled: boolean;
  scopes: string[];
  config: Record<string, string>;
  notes: string;
  fallbackTo: string;
}

export interface PasswordChangeInput {
  currentPassword: string;
  nextPassword: string;
}

export interface StageCheckpointMutationInput {
  status: StageCheckpointStatus;
}

export interface AlertMutationInput {
  title: string;
  courseSlug: string;
  tone: Tone;
  owner: Role;
  detail: string;
}

export interface HelpDeskTicketMutationInput {
  title: string;
  description: string;
  category: HelpDeskTicketCategory;
  priority: Priority;
  courseSlug?: string;
  stageId?: CourseProductStage;
  assigneeId?: string;
  assigneeName?: string;
}

export interface HelpDeskTicketUpdateInput {
  id: string;
  title?: string;
  description?: string;
  category?: HelpDeskTicketCategory;
  status?: HelpDeskTicketStatus;
  priority?: Priority;
  courseSlug?: string;
  stageId?: CourseProductStage;
  assigneeId?: string;
  assigneeName?: string;
  resolutionSummary?: string;
}

export interface CourseMetadataMutationInput {
  institution: string;
  shortName: string;
  semester: string;
  academicPeriod: string;
  courseType: string;
  learningOutcomes: string[];
  topics: string[];
  units: { tituloUnidad: string; tematicas: string[] }[];
  methodology: string;
  evaluation: string[];
  bibliography: string[];
  targetCloseDate: string;
  currentVersion: string;
  priority: Priority;
  riskLevel: RiskLevel;
  // Master record fields (optional sync)
  faculty?: string;
  program?: string;
  credits?: number;
  summary?: string;
}

export interface TimelineItemMutationInput {
  label: string;
  dueDate: string;
  status: TimelineItem['status'];
}

export interface TeamMemberMutationInput {
  name: string;
  role: Role;
  focus: string;
  initials: string;
}

export interface LearningModuleMutationInput {
  title: string;
  learningGoal: string;
  activities: number;
  ownResources: number;
  curatedResources: number;
  completion: number;
}

export interface CourseStageNoteMutationInput {
  status: StageNoteStatus;
  summary: string;
  evidence: string[];
  blockers: string[];
}

export interface CourseProductMutationInput {
  title: string;
  stage: CourseProductStage;
  format: CourseProductFormat;
  owner: Role;
  status: CourseProductStatus;
  summary: string;
  body: string;
  tags: string[];
  version: string;
  section?: string;
  phasePlan?: ProductPhasePlan[];
  writingData?: ProductWritingData;
  validationData?: ProductValidationData;
}

export interface DeliverableMutationInput {
  title: string;
  owner: Role;
  status: DeliverableStatus;
  dueDate: string;
  note: string;
}

export interface ObservationMutationInput {
  title: string;
  role: Role;
  severity: Priority;
  status: ObservationStatus;
  detail: string;
}

export interface LibraryResourceMutationInput {
  title: string;
  kind: LibraryResource['kind'];
  courseSlug: string;
  unit: string;
  source: string;
  status: LibraryResource['status'];
  tags: string[];
  summary: string;
}

export interface LibraryAssetMutationInput {
  title: string;
  group: LibraryGroup;
  provider: LibraryProvider;
  resourceType: string;
  language: string;
  visibility: LibraryVisibility;
  institutionId?: string;
  institutionName?: string;
  canonicalUrl: string;
  abstract: string;
  descriptionHtml: string;
  tags: string[];
  thumbnailUrl?: string;
  embedUrl?: string;
  license?: LibraryLicense | null;
  openAccess?: boolean;
  citationCount?: number;
  metadata?: Record<string, unknown>;
  files?: Array<{
    fileName: string;
    mimeType: string;
    key: string;
    url: string;
    sizeBytes: number;
    manifest?: Record<string, unknown> | null;
    previewText?: string | null;
  }>;
}

export interface LibraryCourseLinkMutationInput {
  assetId: string;
  courseSlug: string;
  targetStage?: string;
  targetUnit?: string;
}

export interface CourseMutationInput {
  title: string;
  code: string;
  institution: string;
  faculty: string;
  program: string;
  academicPeriod: string;
  courseType: string;
  modality: string;
  credits: number;
  stageId: string;
  status: CourseStatus;
  summary: string;
  nextMilestone: string;
}

export interface TaskMutationInput {
  title: string;
  courseSlug: string;
  productId?: string;
  role: Role;
  stageId: string;
  dueDate: string;
  priority: Priority;
  status: Task['status'];
  summary: string;
}
