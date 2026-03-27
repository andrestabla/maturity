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
export type CourseStageNoteKey =
  | 'architecture'
  | 'production'
  | 'curation'
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
}

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthSession {
  authenticated: boolean;
  user: AuthUser | null;
}

export interface UserMutationInput {
  name: string;
  email: string;
  role: Role;
  password: string;
}

export interface UserUpdateInput {
  id: string;
  name: string;
  email: string;
  role: Role;
  password?: string;
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
  faculty: string;
  program: string;
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
