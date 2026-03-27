import type { AppData, Course, Role } from '../types.js';

export function getVisibleCourses(appData: AppData, role: Role) {
  if (role === 'Administrador' || role === 'Auditor') {
    return appData.courses;
  }

  return appData.courses.filter(
    (course) =>
      course.team.some((member) => member.role === role) ||
      course.deliverables.some((deliverable) => deliverable.owner === role) ||
      course.observations.some((observation) => observation.role === role) ||
      appData.tasks.some((task) => task.courseSlug === course.slug && task.role === role),
  );
}

export function getVisibleTasks(appData: AppData, role: Role) {
  if (role === 'Administrador' || role === 'Auditor') {
    return appData.tasks;
  }

  return appData.tasks.filter((task) => task.role === role);
}

export function getVisibleAlerts(appData: AppData, role: Role) {
  if (role === 'Administrador' || role === 'Auditor' || role === 'Coordinador') {
    return appData.alerts;
  }

  return appData.alerts.filter((alert) => alert.owner === role);
}

export function getVisibleResources(appData: AppData, role: Role) {
  const courseSet = new Set(getVisibleCourses(appData, role).map((course) => course.slug));
  return appData.libraryResources.filter((resource) => courseSet.has(resource.courseSlug));
}

export function getStageName(appData: AppData, stageId: string) {
  return appData.stages.find((stage) => stage.id === stageId)?.name ?? stageId;
}

export function getStageMeta(appData: AppData, stageId: string) {
  return appData.stages.find((stage) => stage.id === stageId);
}

export function getCourseBySlug(appData: AppData, slug: string) {
  return appData.courses.find((course) => course.slug === slug);
}

export function averageProgress(items: Course[]) {
  if (items.length === 0) {
    return 0;
  }

  const total = items.reduce((sum, item) => sum + item.progress, 0);
  return Math.round(total / items.length);
}
