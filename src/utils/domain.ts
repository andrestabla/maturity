import { alerts, courses, libraryResources, stages, tasks } from '../data/mockData';
import type { Course, Role } from '../types';

export function getVisibleCourses(role: Role) {
  if (role === 'Administrador' || role === 'Auditor') {
    return courses;
  }

  return courses.filter(
    (course) =>
      course.team.some((member) => member.role === role) ||
      course.deliverables.some((deliverable) => deliverable.owner === role) ||
      course.observations.some((observation) => observation.role === role) ||
      tasks.some((task) => task.courseSlug === course.slug && task.role === role),
  );
}

export function getVisibleTasks(role: Role) {
  if (role === 'Administrador' || role === 'Auditor') {
    return tasks;
  }

  return tasks.filter((task) => task.role === role);
}

export function getVisibleAlerts(role: Role) {
  if (role === 'Administrador' || role === 'Auditor') {
    return alerts;
  }

  return alerts.filter((alert) => alert.owner === role);
}

export function getVisibleResources(role: Role) {
  const courseSet = new Set(getVisibleCourses(role).map((course) => course.slug));
  return libraryResources.filter((resource) => courseSet.has(resource.courseSlug));
}

export function getStageName(stageId: string) {
  return stages.find((stage) => stage.id === stageId)?.name ?? stageId;
}

export function getStageMeta(stageId: string) {
  return stages.find((stage) => stage.id === stageId);
}

export function getCourseBySlug(slug: string) {
  return courses.find((course) => course.slug === slug);
}

export function averageProgress(items: Course[]) {
  if (items.length === 0) {
    return 0;
  }

  const total = items.reduce((sum, item) => sum + item.progress, 0);
  return Math.round(total / items.length);
}
