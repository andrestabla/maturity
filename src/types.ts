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
  | 'En ritmo'
  | 'En revisión'
  | 'Riesgo'
  | 'Bloqueado'
  | 'Listo';

export type DeliverableStatus =
  | 'En curso'
  | 'En revisión'
  | 'Listo'
  | 'Bloqueado';

export type ObservationStatus = 'Pendiente' | 'En ajuste' | 'Resuelta';
export type Priority = 'Alta' | 'Media' | 'Baja';
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
  | 'architecture'
  | 'production'
  | 'curation'
  | 'multimedia'
  | 'lms'
  | 'qa';
export type CourseProductStage =
  | 'general'
  | 'architecture'
  | 'production'
  | 'curation'
  | 'multimedia'
  | 'qa';
export type CourseProductFormat =
  | 'Sílabus'
  | 'Lineamiento'
  | 'Actividad'
  | 'Recurso'
  | 'Documento'
  | 'HTML'
  | 'Pódcast'
  | 'Lectura'
  | 'Infografía'
  | 'Rúbrica';
export type CourseProductStatus = 'Borrador' | 'En revisión' | 'Aprobado';

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
  methodology: string;
  evaluation: string;
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
  architecture: CourseStageNote;
  production: CourseStageNote;
  curation: CourseStageNote;
  multimedia: CourseStageNote;
  lms: CourseStageNote;
  qa: CourseStageNote;
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
  updatedAt: string;
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
  libraryResources: LibraryResource[];
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

export interface CourseMetadataMutationInput {
  institution: string;
  shortName: string;
  semester: string;
  academicPeriod: string;
  courseType: string;
  learningOutcomes: string[];
  topics: string[];
  methodology: string;
  evaluation: string;
  bibliography: string[];
  targetCloseDate: string;
  currentVersion: string;
  priority: Priority;
  riskLevel: RiskLevel;
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
  role: Role;
  stageId: string;
  dueDate: string;
  priority: Priority;
  status: Task['status'];
  summary: string;
}
