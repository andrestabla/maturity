import type { AppData, AuthUser, Course, Role } from '../types.js';

function hasDirectCourseAssignment(course: Course, viewer?: AuthUser) {
  if (!viewer?.id) {
    return false;
  }

  return course.products.some((product) =>
    product.phasePlan.some((phase) => phase.assigneeId === viewer.id),
  );
}

export function getVisibleCourses(appData: AppData, role: Role, viewer?: AuthUser) {
  if (role === 'Administrador' || role === 'Auditor') {
    return appData.courses;
  }

  const membershipInstitutionIds = new Set(
    (viewer?.memberships ?? [])
      .map((membership) => membership.institutionId?.trim() ?? '')
      .filter(Boolean),
  );

  return appData.courses.filter(
    (course) => {
      const hasDirectPlanningAssignment = hasDirectCourseAssignment(course, viewer);
      const hasRoleBasedAssignment =
        course.team.some((member) => member.role === role) ||
        course.deliverables.some((deliverable) => deliverable.owner === role) ||
        course.observations.some((observation) => observation.role === role) ||
        appData.tasks.some((task) => task.courseSlug === course.slug && task.role === role);
      const isInAffiliatedInstitution =
        membershipInstitutionIds.size === 0 ||
        membershipInstitutionIds.has(course.institutionStructureId?.trim() ?? '');

      return hasDirectPlanningAssignment || (hasRoleBasedAssignment && isInAffiliatedInstitution);
    },
  );
}

export function getVisibleTasks(appData: AppData, role: Role, viewer?: AuthUser) {
  if (role === 'Administrador' || role === 'Auditor') {
    return appData.tasks;
  }

  const visibleCourseSet = new Set(getVisibleCourses(appData, role, viewer).map((course) => course.slug));

  return appData.tasks.filter(
    (task) => task.role === role && visibleCourseSet.has(task.courseSlug),
  );
}

export function getVisibleAlerts(appData: AppData, role: Role, viewer?: AuthUser) {
  if (role === 'Administrador' || role === 'Auditor' || role === 'Coordinador') {
    return appData.alerts;
  }

  const visibleCourseSet = new Set(getVisibleCourses(appData, role, viewer).map((course) => course.slug));

  return appData.alerts.filter(
    (alert) => alert.owner === role && visibleCourseSet.has(alert.courseSlug),
  );
}

export function getVisibleResources(appData: AppData, role: Role, viewer?: AuthUser) {
  const courseSet = new Set(getVisibleCourses(appData, role, viewer).map((course) => course.slug));
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
