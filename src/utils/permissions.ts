import type { Role } from '../types.js';

export function canManageCourses(role: Role) {
  return role === 'Administrador' || role === 'Coordinador';
}

export function canCreateTasks(role: Role) {
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
