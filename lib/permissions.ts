import type { Role } from '../src/types.js';

export function canManageCourses(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canDeleteCourses(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canCreateTasks(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canManageCourseTeam(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canEditCourseModules(role: Role) {
  return (
    role === 'Administrador' ||
    role === 'Coordinador' ||
    role === 'Experto' ||
    role === 'Diseñador instruccional'
  );
}

export function canEditStageNote(role: Role, ownerRole: Role) {
  return role === 'Administrador' || role === 'Coordinador' || role === ownerRole;
}

export function canCreateCourseProducts(role: Role) {
  return (
    role === 'Administrador' ||
    role === 'Coordinador' ||
    role === 'Experto' ||
    role === 'Diseñador instruccional' ||
    role === 'Diseñador multimedia' ||
    role === 'Analista QA'
  );
}

export function canEditCourseProduct(role: Role, ownerRole: Role) {
  return role === 'Administrador' || role === 'Coordinador' || role === ownerRole;
}

export function canDeleteCourseProducts(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canDeleteTasks(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canEditTask(role: Role, taskRole: Role) {
  return role === 'Administrador' || role === 'Coordinador' || role === taskRole;
}

export function canManageUsers(role: Role) {
  return role === 'Administrador';
}

export function canOperateStageCheckpoint(role: Role, ownerRole: Role) {
  return role === 'Administrador' || role === 'Coordinador' || role === ownerRole;
}

export function canManageHandoffs(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canManageAlerts(role: Role, ownerRole: Role) {
  return role === 'Administrador' || role === 'Coordinador' || role === ownerRole;
}

export function canCreateDeliverables(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canEditDeliverable(role: Role, ownerRole: Role) {
  return role === 'Administrador' || role === 'Coordinador' || role === ownerRole;
}

export function canDeleteDeliverables(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canCreateObservations(role: Role) {
  return (
    role === 'Administrador' ||
    role === 'Coordinador' ||
    role === 'Diseñador instruccional' ||
    role === 'Analista QA' ||
    role === 'Auditor'
  );
}

export function canEditObservation(role: Role, ownerRole: Role) {
  return role === 'Administrador' || role === 'Coordinador' || role === ownerRole;
}

export function canDeleteObservations(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canCreateLibraryResources(role: Role) {
  return role === 'Administrador' || role === 'Coordinador' || role === 'Experto';
}

export function canEditLibraryResource(role: Role) {
  return role === 'Administrador' || role === 'Coordinador' || role === 'Experto';
}

export function canDeleteLibraryResources(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}
