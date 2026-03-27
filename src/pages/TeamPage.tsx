import {
  AlertTriangle,
  BadgeCheck,
  Brush,
  Building2,
  Cable,
  Clock3,
  Database,
  KeyRound,
  Logs,
  RefreshCcw,
  ShieldCheck,
  TestTube2,
  Trash2,
  UserCog,
  UserPlus,
  UsersRound,
  Waypoints,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type {
  AdminCenterData,
  AdminIntegration,
  AdminIntegrationMutationInput,
  AppData,
  AuthUser,
  BrandingSettings,
  InstitutionSettings,
  PasswordChangeInput,
  Role,
  UserMutationInput,
  UserUpdateInput,
} from '../types.js';
import { formatDate, formatDateTime, formatLongDate } from '../utils/format.js';
import { canManageUsers } from '../utils/permissions.js';

interface TeamPageProps {
  user: AuthUser;
  appData: AppData;
  refreshAppData: () => void;
  refreshSession: () => Promise<void>;
}

type AdminTab = 'users' | 'institution' | 'branding' | 'integrations' | 'services' | 'logs' | 'audit';

interface AdminCenterResponse {
  data: AdminCenterData;
}

interface AdminCenterPatchResponse {
  institution?: InstitutionSettings;
  branding?: BrandingSettings;
}

interface AdminIntegrationResponse {
  integration: AdminIntegration;
}

function buildUserForm(settings?: InstitutionSettings): UserMutationInput {
  return {
    name: '',
    email: '',
    role: 'Coordinador',
    secondaryRoles: [],
    status: settings?.defaultUserState ?? 'Pendiente',
    institution: settings?.institutions[0] ?? settings?.displayName ?? '',
    faculty: settings?.faculties[0] ?? '',
    program: settings?.programs[0] ?? '',
    scope: 'Global',
    statusReason: '',
    password: '',
  };
}

function buildPasswordForm(): PasswordChangeInput {
  return {
    currentPassword: '',
    nextPassword: '',
  };
}

function createIntegrationDraft(
  integration: AdminIntegration | null,
): AdminIntegrationMutationInput | null {
  if (!integration) {
    return null;
  }

  return {
    id: integration.id,
    enabled: integration.enabled,
    scopes: [...integration.scopes],
    config: { ...integration.config },
    notes: integration.notes,
    fallbackTo: integration.fallbackTo,
  };
}

function parseListInput(value: string) {
  return Array.from(
    new Set(
      value
        .split(/\n|,/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
}

function stringifyList(values: string[]) {
  return values.join('\n');
}

function getBadgeClass(status: string) {
  if (
    status === 'Activo' ||
    status === 'Activa' ||
    status === 'Success' ||
    status === 'ok'
  ) {
    return 'badge badge--sage';
  }

  if (status === 'Suspendido' || status === 'Con error' || status === 'Error') {
    return 'badge badge--coral';
  }

  if (status === 'Pendiente' || status === 'En prueba' || status === 'Warning') {
    return 'badge badge--gold';
  }

  if (status === 'Inactivo') {
    return 'badge badge--ink';
  }

  return 'badge badge--ocean';
}

function formatUserStateLabel(status?: string | null) {
  return status ?? 'Pendiente';
}

function deriveUserInitials(name: string) {
  return name
    .split(/\s+/)
    .map((item) => item[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

const adminTabs: Array<{
  id: AdminTab;
  label: string;
}> = [
  { id: 'users', label: 'Usuarios' },
  { id: 'institution', label: 'Institución' },
  { id: 'branding', label: 'Branding' },
  { id: 'integrations', label: 'Integraciones' },
  { id: 'services', label: 'Servicios' },
  { id: 'logs', label: 'Logs' },
  { id: 'audit', label: 'Auditoría' },
];

export function TeamPage({
  user,
  appData,
  refreshAppData,
  refreshSession,
}: TeamPageProps) {
  const isAdmin = canManageUsers(user.role);
  const location = useLocation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  const [adminData, setAdminData] = useState<AdminCenterData | null>(null);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [userError, setUserError] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [integrationError, setIntegrationError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isAdminLoading, setIsAdminLoading] = useState(isAdmin);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isSavingInstitution, setIsSavingInstitution] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isSavingIntegration, setIsSavingIntegration] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [testingIntegrationId, setTestingIntegrationId] = useState<string | null>(null);
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<string | null>(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [showCreateUserAssistant, setShowCreateUserAssistant] = useState(false);
  const [focusRoleAssignment, setFocusRoleAssignment] = useState(false);
  const [isRolePickerOpen, setIsRolePickerOpen] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('Todos');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('Todos');
  const [userForm, setUserForm] = useState<UserMutationInput>(() => buildUserForm());
  const [editingDraft, setEditingDraft] = useState<UserUpdateInput | null>(null);
  const [institutionDraft, setInstitutionDraft] = useState<InstitutionSettings | null>(null);
  const [brandingDraft, setBrandingDraft] = useState<BrandingSettings | null>(null);
  const [integrationDraft, setIntegrationDraft] = useState<AdminIntegrationMutationInput | null>(null);
  const [passwordForm, setPasswordForm] = useState<PasswordChangeInput>(() => buildPasswordForm());
  const [serviceStatusFilter, setServiceStatusFilter] = useState<string>('Todas');
  const [serviceCategoryFilter, setServiceCategoryFilter] = useState<string>('Todas');
  const [logQuery, setLogQuery] = useState('');
  const [logCategoryFilter, setLogCategoryFilter] = useState<string>('Todas');
  const [logSeverityFilter, setLogSeverityFilter] = useState<string>('Todas');
  const [auditQuery, setAuditQuery] = useState('');
  const [auditClassificationFilter, setAuditClassificationFilter] = useState<string>('Todas');

  const roleCoverage = useMemo(
    () =>
      appData.roleProfiles.map((profile) => ({
        profile,
        count: appData.courses.filter((course) =>
          course.team.some((member) => member.role === profile.role),
        ).length,
      })),
    [appData.courses, appData.roleProfiles],
  );

  async function loadAdminCenter() {
    if (!isAdmin) {
      return;
    }

    setIsAdminLoading(true);
    setAdminError(null);

    try {
      const response = await fetch('/api/admin-center', {
        credentials: 'same-origin',
        headers: {
          Accept: 'application/json',
        },
      });

      const payload = (await response.json()) as AdminCenterResponse | { error?: string };

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? 'No fue posible cargar Gobierno.');
      }

      const nextData = (payload as AdminCenterResponse).data;
      setAdminData(nextData);
      setInstitutionDraft(nextData.institution);
      setBrandingDraft(nextData.branding);
      setUserForm(buildUserForm(nextData.institution));
      setSelectedIntegrationId((current) =>
        current ??
        nextData.integrations.find((item) => item.envReady)?.id ??
        nextData.integrations[0]?.id ??
        null,
      );
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'No fue posible cargar Gobierno.');
    } finally {
      setIsAdminLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminCenter();
  }, [isAdmin]);

  useEffect(() => {
    const hash = location.hash.replace('#', '');

    if (!hash) {
      return;
    }

    if (adminTabs.some((tab) => tab.id === hash) && hash !== activeTab) {
      setActiveTab(hash as AdminTab);
    }
  }, [activeTab, location.hash]);

  useEffect(() => {
    if (!adminData) {
      return;
    }

    const userId = new URLSearchParams(location.search).get('user');

    if (!userId) {
      return;
    }

    const target = adminData.users.find((member) => member.id === userId);

    if (target) {
      startEditing(target);
    }
  }, [adminData, location.search]);

  function handleTabChange(nextTab: AdminTab) {
    setActiveTab(nextTab);
    navigate(
      {
        pathname: location.pathname,
        hash: nextTab,
      },
      { replace: true },
    );
  }

  useEffect(() => {
    if (!adminData || !selectedIntegrationId) {
      return;
    }

    const integration =
      adminData.integrations.find((item) => item.id === selectedIntegrationId) ?? null;
    setIntegrationDraft(createIntegrationDraft(integration));
  }, [adminData, selectedIntegrationId]);

  const activeUsers = adminData?.users.filter((item) => item.status === 'Activo').length ?? 0;
  const suspendedUsers = adminData?.users.filter((item) => item.status === 'Suspendido').length ?? 0;
  const activeIntegrations =
    adminData?.integrations.filter((item) => item.enabled && item.status === 'Activa').length ?? 0;
  const degradedIntegrations =
    adminData?.integrations.filter((item) => item.status === 'Con error').length ?? 0;
  const authenticationLogs =
    adminData?.logs.filter((entry) => entry.category === 'Autenticación') ?? [];
  const filteredServices = useMemo(() => {
    const integrations = adminData?.integrations ?? [];

    return integrations.filter((integration) => {
      const statusMatch =
        serviceStatusFilter === 'Todas' || integration.status === serviceStatusFilter;
      const categoryMatch =
        serviceCategoryFilter === 'Todas' || integration.category === serviceCategoryFilter;
      return statusMatch && categoryMatch;
    });
  }, [adminData?.integrations, serviceCategoryFilter, serviceStatusFilter]);

  const filteredUsers = useMemo(() => {
    const query = userSearch.trim().toLowerCase();
    const users = adminData?.users ?? [];

    return users.filter((member) => {
      const roleMatch =
        userRoleFilter === 'Todos' ||
        member.role === userRoleFilter ||
        (member.secondaryRoles ?? []).includes(userRoleFilter as Role);
      const statusMatch =
        userStatusFilter === 'Todos' || formatUserStateLabel(member.status) === userStatusFilter;

      if (!query) {
        return roleMatch && statusMatch;
      }

      const queryMatch = [
        member.name,
        member.email,
        member.role,
        ...(member.secondaryRoles ?? []),
        member.institution ?? '',
        member.faculty ?? '',
        member.program ?? '',
        member.scope ?? '',
        member.status ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(query);

      return roleMatch && statusMatch && queryMatch;
    });
  }, [adminData?.users, userRoleFilter, userSearch, userStatusFilter]);

  const filteredLogs = useMemo(() => {
    const query = logQuery.trim().toLowerCase();
    const entries = adminData?.logs ?? [];

    return entries.filter((entry) => {
      const categoryMatch =
        logCategoryFilter === 'Todas' || entry.category === logCategoryFilter;
      const severityMatch =
        logSeverityFilter === 'Todas' || entry.severity === logSeverityFilter;
      const queryMatch =
        !query ||
        [
          entry.event,
          entry.detail,
          entry.module,
          entry.service,
          entry.userName ?? '',
          entry.result,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);

      return categoryMatch && severityMatch && queryMatch;
    });
  }, [adminData?.logs, logCategoryFilter, logQuery, logSeverityFilter]);

  const filteredAudit = useMemo(() => {
    const query = auditQuery.trim().toLowerCase();
    const entries = adminData?.audit ?? [];

    return entries.filter((entry) => {
      const classificationMatch =
        auditClassificationFilter === 'Todas' ||
        entry.classification === auditClassificationFilter;
      const queryMatch =
        !query ||
        [
          entry.action,
          entry.detail,
          entry.entityType,
          entry.actorName,
          entry.entityId,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);

      return classificationMatch && queryMatch;
    });
  }, [adminData?.audit, auditClassificationFilter, auditQuery]);

  const selectedIntegration =
    adminData?.integrations.find((item) => item.id === selectedIntegrationId) ?? null;

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUserError(null);
    setIsCreatingUser(true);

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(userForm),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible crear el usuario.');
      }

      await loadAdminCenter();
      refreshAppData();
      setUserForm(buildUserForm(institutionDraft ?? undefined));
      setShowCreateUserAssistant(false);
      setIsRolePickerOpen(false);
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'No fue posible crear el usuario.');
    } finally {
      setIsCreatingUser(false);
    }
  }

  function startEditing(target: AuthUser) {
    setShowCreateUserAssistant(false);
    setFocusRoleAssignment(false);
    setIsRolePickerOpen(false);
    setEditingUserId(target.id);
    setEditingDraft({
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
      secondaryRoles: [...(target.secondaryRoles ?? [])],
      status: target.status ?? 'Pendiente',
      institution: target.institution ?? '',
      faculty: target.faculty ?? '',
      program: target.program ?? '',
      scope: target.scope ?? '',
      statusReason: target.statusReason ?? '',
      password: '',
    });
  }

  async function handleUpdateUser() {
    if (!editingDraft) {
      return;
    }

    setIsSavingUser(true);
    setUserError(null);

    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(editingDraft),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible actualizar el usuario.');
      }

      await loadAdminCenter();
      refreshAppData();
      setEditingDraft(null);
      setEditingUserId(null);
      setFocusRoleAssignment(false);
      setIsRolePickerOpen(false);

      if (editingDraft.id === user.id) {
        await refreshSession();
      }
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'No fue posible actualizar el usuario.');
    } finally {
      setIsSavingUser(false);
    }
  }

  async function handleDeleteUser(id: string, name: string) {
    const confirmed = window.confirm(`Eliminarás a ${name} del directorio activo. ¿Continuar?`);

    if (!confirmed) {
      return;
    }

    setUserError(null);

    const response = await fetch('/api/users', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ id }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setUserError(payload.error ?? 'No fue posible eliminar el usuario.');
      return;
    }

    await loadAdminCenter();
    refreshAppData();
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    setIsChangingPassword(true);

    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(passwordForm),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible actualizar la contraseña.');
      }

      setPasswordForm(buildPasswordForm());
      setPasswordSuccess('La contraseña se actualizó correctamente.');
      await loadAdminCenter();
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : 'No fue posible actualizar la contraseña.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleSaveInstitution(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!institutionDraft) {
      return;
    }

    setSettingsError(null);
    setIsSavingInstitution(true);

    try {
      const response = await fetch('/api/admin-center', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          section: 'institution',
          data: institutionDraft,
        }),
      });

      const payload = (await response.json()) as AdminCenterPatchResponse | { error?: string };

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? 'No fue posible guardar la configuración institucional.');
      }

      const nextInstitution = (payload as AdminCenterPatchResponse).institution ?? institutionDraft;
      setInstitutionDraft(nextInstitution);
      setUserForm((current) => ({
        ...current,
        institution: current.institution || nextInstitution.institutions[0] || nextInstitution.displayName,
        faculty: current.faculty || nextInstitution.faculties[0] || '',
        program: current.program || nextInstitution.programs[0] || '',
        status: current.status || nextInstitution.defaultUserState,
      }));
      await loadAdminCenter();
    } catch (error) {
      setSettingsError(
        error instanceof Error
          ? error.message
          : 'No fue posible guardar la configuración institucional.',
      );
    } finally {
      setIsSavingInstitution(false);
    }
  }

  async function handleSaveBranding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!brandingDraft) {
      return;
    }

    setSettingsError(null);
    setIsSavingBranding(true);

    try {
      const response = await fetch('/api/admin-center', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          section: 'branding',
          data: brandingDraft,
        }),
      });

      const payload = (await response.json()) as AdminCenterPatchResponse | { error?: string };

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? 'No fue posible guardar la identidad visual.');
      }

      setBrandingDraft((payload as AdminCenterPatchResponse).branding ?? brandingDraft);
      await loadAdminCenter();
      refreshAppData();
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : 'No fue posible guardar la identidad visual.',
      );
    } finally {
      setIsSavingBranding(false);
    }
  }

  async function handleSaveIntegration() {
    if (!integrationDraft) {
      return;
    }

    setIntegrationError(null);
    setIsSavingIntegration(true);

    try {
      const response = await fetch('/api/admin-integrations', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(integrationDraft),
      });

      const payload = (await response.json()) as AdminIntegrationResponse | { error?: string };

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? 'No fue posible guardar la integración.');
      }

      const nextIntegration = (payload as AdminIntegrationResponse).integration;
      setAdminData((current) =>
        current
          ? {
              ...current,
              integrations: current.integrations.map((item) =>
                item.id === nextIntegration.id ? nextIntegration : item,
              ),
            }
          : current,
      );
      setSelectedIntegrationId(nextIntegration.id);
      await loadAdminCenter();
    } catch (error) {
      setIntegrationError(
        error instanceof Error ? error.message : 'No fue posible guardar la integración.',
      );
    } finally {
      setIsSavingIntegration(false);
    }
  }

  async function handleTestIntegration(id: string) {
    setIntegrationError(null);
    setTestingIntegrationId(id);

    try {
      const response = await fetch('/api/admin-integrations', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      const payload = (await response.json()) as AdminIntegrationResponse | { error?: string };

      if (!response.ok) {
        throw new Error((payload as { error?: string }).error ?? 'No fue posible probar la integración.');
      }

      const nextIntegration = (payload as AdminIntegrationResponse).integration;
      setAdminData((current) =>
        current
          ? {
              ...current,
              integrations: current.integrations.map((item) =>
                item.id === nextIntegration.id ? nextIntegration : item,
              ),
            }
          : current,
      );
      await loadAdminCenter();
    } catch (error) {
      setIntegrationError(
        error instanceof Error ? error.message : 'No fue posible probar la integración.',
      );
    } finally {
      setTestingIntegrationId(null);
    }
  }

  function toggleSecondaryRole<T extends { role: Role; secondaryRoles: Role[] }>(
    state: T,
    roleToToggle: Role,
  ): T {
    const nextRoles = state.secondaryRoles.includes(roleToToggle)
      ? state.secondaryRoles.filter((item) => item !== roleToToggle)
      : [...state.secondaryRoles, roleToToggle];

    return {
      ...state,
      secondaryRoles: nextRoles.filter((item) => item !== state.role),
    } satisfies T;
  }

  function renderAccountSecurity() {
    return (
      <article className="surface section-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Cuenta</span>
            <h3>Seguridad y acceso</h3>
          </div>
          <KeyRound size={18} />
        </div>

        <div className="checklist">
          <div className="checklist__item">
            <strong>Sesión actual</strong>
            <p>
              {user.name} está operando como <strong>{user.role}</strong>. El acceso actual usa
              cookie `httpOnly` y respeta el estado de cuenta definido por Gobierno.
            </p>
          </div>
          <div className="checklist__item">
            <strong>Último acceso conocido</strong>
            <p>{user.lastAccessAt ? formatDateTime(user.lastAccessAt) : 'Aún no registrado.'}</p>
          </div>
        </div>

        <form className="editor-card" onSubmit={handlePasswordChange}>
          <div className="editor-card__header">
            <div>
              <span className="eyebrow">Contraseña</span>
              <h3>Actualizar credenciales</h3>
            </div>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Contraseña actual</span>
              <div className="field__control">
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      currentPassword: event.target.value,
                    }))
                  }
                  required
                />
              </div>
            </label>

            <label className="field">
              <span>Nueva contraseña</span>
              <div className="field__control">
                <input
                  type="password"
                  value={passwordForm.nextPassword}
                  onChange={(event) =>
                    setPasswordForm((current) => ({
                      ...current,
                      nextPassword: event.target.value,
                    }))
                  }
                  minLength={10}
                  required
                />
              </div>
            </label>
          </div>

          {passwordError ? <p className="form-error">{passwordError}</p> : null}
          {passwordSuccess ? <p className="form-success">{passwordSuccess}</p> : null}

          <div className="action-row">
            <button type="submit" className="cta-button" disabled={isChangingPassword}>
              <span>{isChangingPassword ? 'Actualizando…' : 'Actualizar contraseña'}</span>
            </button>
          </div>
        </form>
      </article>
    );
  }

  function renderUsersTab() {
    const users = adminData?.users ?? [];
    const selectedUser =
      users.find((member) => member.id === editingUserId) ??
      users.find((member) => member.id === editingDraft?.id) ??
      null;

    return (
      <div className="page-stack page-stack--governance">
        <section className="surface section-card section-card--compact admin-subhead">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Gestión de usuarios</span>
              <h3>Directorio, roles y edición sin saturar la vista</h3>
            </div>
            <UsersRound size={18} />
          </div>
          <p className="section-lead">
            Consulta el listado, filtra por rol o estado y abre el asistente lateral solo cuando necesites editar.
          </p>

          <div className="admin-inline-metrics">
            <span><strong>{users.length}</strong> usuarios</span>
            <span><strong>{activeUsers}</strong> activos</span>
            <span><strong>{suspendedUsers}</strong> suspendidos</span>
            <span><strong>{authenticationLogs.slice(0, 14).length}</strong> accesos recientes</span>
          </div>
        </section>

        <section className="admin-split admin-split--users">
          <article className="surface section-card admin-pane">
            <div className="admin-directory-shell">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Directorio</span>
                  <h3>Usuarios creados</h3>
                </div>
                <UserCog size={18} />
              </div>

              <div className="admin-filter-row admin-filter-row--directory">
                <label className="field field--search">
                  <span>Buscar</span>
                  <div className="field__control">
                    <input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Nombre o correo..."
                    />
                  </div>
                </label>

                <label className="field field--compact">
                  <span>Rol</span>
                  <div className="field__control">
                    <select
                      value={userRoleFilter}
                      onChange={(event) => setUserRoleFilter(event.target.value)}
                    >
                      <option value="Todos">Todos</option>
                      {appData.roles.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="field field--compact">
                  <span>Estado</span>
                  <div className="field__control">
                    <select
                      value={userStatusFilter}
                      onChange={(event) => setUserStatusFilter(event.target.value)}
                    >
                      {['Todos', 'Activo', 'Inactivo', 'Suspendido', 'Pendiente'].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <div className="admin-filter-actions">
                  <button
                    type="button"
                    className="cta-button"
                    onClick={() => {
                      setShowCreateUserAssistant(true);
                      setEditingDraft(null);
                      setEditingUserId(null);
                      setFocusRoleAssignment(false);
                      setIsRolePickerOpen(false);
                    }}
                  >
                    <UserPlus size={16} />
                    <span>Nuevo usuario</span>
                  </button>

                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      if (!selectedUser) {
                        return;
                      }
                      startEditing(selectedUser);
                      setFocusRoleAssignment(true);
                      setIsRolePickerOpen(true);
                    }}
                    disabled={!selectedUser}
                  >
                    <Waypoints size={16} />
                    <span>Asignar rol</span>
                  </button>
                </div>
              </div>

              <div className="admin-directory">
                <div className="admin-directory__head">
                  <span>Usuario</span>
                  <span>Rol</span>
                  <span>Estado</span>
                  <span>Alcance</span>
                  <span>Acción</span>
                </div>

                <div className="admin-directory__body">
                  {filteredUsers.length === 0 ? (
                    <div className="empty-state empty-state--positive">
                      <strong>No hay usuarios para este filtro</strong>
                      <p>Ajusta búsqueda, rol o estado para volver a poblar el directorio.</p>
                    </div>
                  ) : (
                    filteredUsers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        className={
                          member.id === selectedUser?.id && !showCreateUserAssistant
                            ? 'admin-directory__row admin-directory__row--active'
                            : 'admin-directory__row'
                        }
                        onClick={() => startEditing(member)}
                      >
                        <div className="admin-directory__user">
                          <div className="avatar-pill">{deriveUserInitials(member.name)}</div>
                          <div>
                            <strong>{member.name}</strong>
                            <p>{member.email}</p>
                          </div>
                        </div>

                        <div className="admin-directory__role">
                          <span className="badge badge--outline">{member.role}</span>
                          {(member.secondaryRoles ?? []).slice(0, 2).map((secondaryRole) => (
                            <span key={`${member.id}-${secondaryRole}`} className="badge badge--outline">
                              {secondaryRole}
                            </span>
                          ))}
                        </div>

                        <div className="admin-directory__state">
                          <span className={getBadgeClass(formatUserStateLabel(member.status))}>
                            {formatUserStateLabel(member.status)}
                          </span>
                        </div>

                        <div className="admin-directory__scope">
                          <span>{member.scope || member.program || member.faculty || 'Sin alcance'}</span>
                        </div>

                        <div className="admin-directory__action">
                          <span className="ghost-pill">Ver</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              <div className="coverage-list coverage-list--compact coverage-list--inline">
                {roleCoverage.map(({ profile, count }) => (
                  <div key={profile.role} className="coverage-list__item">
                    <div>
                      <strong>{profile.role}</strong>
                      <p>{profile.focus}</p>
                    </div>
                    <span>{count} cursos</span>
                  </div>
                ))}
              </div>
            </div>

            {userError ? <p className="form-error">{userError}</p> : null}
          </article>

          <article className="surface section-card admin-pane">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Asistente</span>
                <h3>
                  {showCreateUserAssistant
                    ? 'Crear nuevo usuario'
                    : selectedUser
                      ? `Editar a ${selectedUser.name}`
                      : 'Selecciona un usuario'}
                </h3>
              </div>
              <ShieldCheck size={18} />
            </div>

            {!showCreateUserAssistant && selectedUser ? (
              <div className="admin-detail-hero">
                <div className="admin-detail-hero__identity">
                  <div className="avatar-pill avatar-pill--large">{deriveUserInitials(selectedUser.name)}</div>
                  <div>
                    <strong>{selectedUser.name}</strong>
                    <p>{selectedUser.email}</p>
                  </div>
                </div>

                <div className="admin-detail-hero__meta">
                  <span className="badge badge--outline">{selectedUser.role}</span>
                  <span className={getBadgeClass(formatUserStateLabel(selectedUser.status))}>
                    {formatUserStateLabel(selectedUser.status)}
                  </span>
                  <span className="badge badge--outline">
                    {selectedUser.scope || selectedUser.program || 'Sin alcance'}
                  </span>
                </div>
              </div>
            ) : null}

            {showCreateUserAssistant ? (
              <form className="editor-card" onSubmit={handleCreateUser}>
                <fieldset className="form-section">
                  <legend>Datos personales</legend>
                  <div className="form-grid">
                    <label className="field">
                      <span>Nombre</span>
                      <div className="field__control">
                        <input
                          value={userForm.name}
                          onChange={(event) =>
                            setUserForm((current) => ({ ...current, name: event.target.value }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Correo</span>
                      <div className="field__control">
                        <input
                          type="email"
                          value={userForm.email}
                          onChange={(event) =>
                            setUserForm((current) => ({ ...current, email: event.target.value }))
                          }
                          required
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Contraseña temporal</span>
                      <div className="field__control">
                        <input
                          type="password"
                          minLength={10}
                          value={userForm.password}
                          onChange={(event) =>
                            setUserForm((current) => ({ ...current, password: event.target.value }))
                          }
                          required
                        />
                      </div>
                    </label>
                  </div>
                </fieldset>

                <fieldset className="form-section">
                  <legend>Rol y permisos</legend>
                  <div className="form-grid">
                    <label className="field">
                      <span>Rol principal</span>
                      <div className="field__control">
                        <select
                          value={userForm.role}
                          onChange={(event) =>
                            setUserForm((current) => ({
                              ...current,
                              role: event.target.value as Role,
                              secondaryRoles: current.secondaryRoles.filter(
                                (item) => item !== event.target.value,
                              ),
                            }))
                          }
                        >
                          {appData.roles.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>

                    <label className="field">
                      <span>Estado</span>
                      <div className="field__control">
                        <select
                          value={userForm.status}
                          onChange={(event) =>
                            setUserForm((current) => ({
                              ...current,
                              status: event.target.value as UserMutationInput['status'],
                            }))
                          }
                        >
                          {['Activo', 'Inactivo', 'Suspendido', 'Pendiente'].map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                  </div>

                  <label className="field field--full">
                    <span>Roles complementarios</span>
                    <div className="tag-token-list">
                      {userForm.secondaryRoles.length === 0 ? (
                        <span className="tag-token tag-token--muted">Sin roles complementarios</span>
                      ) : (
                        userForm.secondaryRoles.map((item) => (
                          <span key={`summary-role-${item}`} className="tag-token">
                            {item}
                          </span>
                        ))
                      )}
                    </div>
                    <div className="action-row action-row--inline">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => setIsRolePickerOpen((current) => !current)}
                      >
                        <span>
                          {isRolePickerOpen ? 'Ocultar selector' : 'Seleccionar roles complementarios'}
                        </span>
                      </button>
                    </div>

                    {isRolePickerOpen ? (
                      <div className="role-picker-panel">
                        {appData.roles
                          .filter((item) => item !== userForm.role)
                          .map((item) => (
                            <button
                              key={`new-user-${item}`}
                              type="button"
                              className={
                                userForm.secondaryRoles.includes(item)
                                  ? 'filter-chip filter-chip--active'
                                  : 'filter-chip'
                              }
                              onClick={() =>
                                setUserForm((current) => toggleSecondaryRole(current, item))
                              }
                            >
                              <span>{item}</span>
                            </button>
                          ))}
                      </div>
                    ) : null}
                  </label>

                  <label className="field field--full">
                    <span>Motivo de estado</span>
                    <div className="field__control">
                      <textarea
                        rows={3}
                        value={userForm.statusReason}
                        onChange={(event) =>
                          setUserForm((current) => ({
                            ...current,
                            statusReason: event.target.value,
                          }))
                        }
                        placeholder="Úsalo si el usuario no inicia activo."
                      />
                    </div>
                  </label>
                </fieldset>

                <fieldset className="form-section">
                  <legend>Organización</legend>
                  <div className="form-grid">
                    <label className="field">
                      <span>Institución</span>
                      <div className="field__control">
                        <input
                          list="institution-options"
                          value={userForm.institution}
                          onChange={(event) =>
                            setUserForm((current) => ({
                              ...current,
                              institution: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Facultad</span>
                      <div className="field__control">
                        <input
                          list="faculty-options"
                          value={userForm.faculty}
                          onChange={(event) =>
                            setUserForm((current) => ({
                              ...current,
                              faculty: event.target.value,
                            }))
                          }
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Programa</span>
                      <div className="field__control">
                        <input
                          list="program-options"
                          value={userForm.program}
                          onChange={(event) =>
                            setUserForm((current) => ({ ...current, program: event.target.value }))
                          }
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Alcance organizacional</span>
                      <div className="field__control">
                        <input
                          value={userForm.scope}
                          onChange={(event) =>
                            setUserForm((current) => ({ ...current, scope: event.target.value }))
                          }
                          placeholder="Global, facultad, cohorte..."
                        />
                      </div>
                      <small className="field-help">
                        Define si el usuario verá datos de toda la institución o solo de una
                        facultad, programa o cohorte.
                      </small>
                    </label>
                  </div>
                </fieldset>

                <datalist id="institution-options">
                  {(institutionDraft?.institutions ?? []).map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
                <datalist id="faculty-options">
                  {(institutionDraft?.faculties ?? []).map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
                <datalist id="program-options">
                  {(institutionDraft?.programs ?? []).map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>

                <div className="action-row">
                  <button type="submit" className="cta-button" disabled={isCreatingUser}>
                    <span>{isCreatingUser ? 'Creando…' : 'Crear usuario'}</span>
                  </button>
                  <button
                    type="button"
                    className="filter-chip"
                    onClick={() => {
                      setShowCreateUserAssistant(false);
                      setIsRolePickerOpen(false);
                    }}
                  >
                    <span>Cerrar</span>
                  </button>
                </div>
              </form>
            ) : editingDraft && selectedUser ? (
              <div className="editor-card">
                <div className="admin-assistant-intro">
                  <span className={getBadgeClass(formatUserStateLabel(selectedUser.status))}>
                    {formatUserStateLabel(selectedUser.status)}
                  </span>
                  <p>
                    {focusRoleAssignment
                      ? 'Modo rápido para asignar o retirar roles sin perder el contexto del usuario.'
                      : 'Ajusta cuenta, acceso y alcance desde un solo panel lateral.'}
                  </p>
                </div>

                {!focusRoleAssignment ? (
                  <div className="form-grid">
                    <label className="field">
                      <span>Nombre</span>
                      <div className="field__control">
                        <input
                          value={editingDraft.name}
                          onChange={(event) =>
                            setEditingDraft((current) =>
                              current ? { ...current, name: event.target.value } : current,
                            )
                          }
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Correo</span>
                      <div className="field__control">
                        <input
                          value={editingDraft.email}
                          onChange={(event) =>
                            setEditingDraft((current) =>
                              current ? { ...current, email: event.target.value } : current,
                            )
                          }
                        />
                      </div>
                    </label>
                  </div>
                ) : null}

                <div className="form-grid">
                  <label className="field">
                    <span>Rol principal</span>
                    <div className="field__control">
                      <select
                        value={editingDraft.role}
                        onChange={(event) =>
                          setEditingDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  role: event.target.value as Role,
                                  secondaryRoles: current.secondaryRoles.filter(
                                    (item) => item !== event.target.value,
                                  ),
                                }
                              : current,
                          )
                        }
                      >
                        {appData.roles.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>

                  <label className="field">
                    <span>Estado</span>
                    <div className="field__control">
                      <select
                        value={editingDraft.status}
                        onChange={(event) =>
                          setEditingDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  status: event.target.value as UserUpdateInput['status'],
                                }
                              : current,
                          )
                        }
                      >
                        {['Activo', 'Inactivo', 'Suspendido', 'Pendiente'].map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>

                <label className="field">
                  <span>Roles complementarios</span>
                  <div className="tag-token-list">
                    {editingDraft.secondaryRoles.length === 0 ? (
                      <span className="tag-token tag-token--muted">Sin roles complementarios</span>
                    ) : (
                      editingDraft.secondaryRoles.map((item) => (
                        <span key={`editing-role-${item}`} className="tag-token">
                          {item}
                        </span>
                      ))
                    )}
                  </div>
                  <div className="action-row action-row--inline">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => setIsRolePickerOpen((current) => !current)}
                    >
                      <span>{isRolePickerOpen ? 'Ocultar selector' : 'Editar roles complementarios'}</span>
                    </button>
                  </div>
                  {isRolePickerOpen ? (
                    <div className="role-picker-panel">
                      {appData.roles
                        .filter((item) => item !== editingDraft.role)
                        .map((item) => (
                          <button
                            key={`${editingDraft.id}-${item}`}
                            type="button"
                            className={
                              editingDraft.secondaryRoles.includes(item)
                                ? 'filter-chip filter-chip--active'
                                : 'filter-chip'
                            }
                            onClick={() =>
                              setEditingDraft((current) =>
                                current ? toggleSecondaryRole(current, item) : current,
                              )
                            }
                          >
                            <span>{item}</span>
                          </button>
                        ))}
                    </div>
                  ) : null}
                </label>

                {!focusRoleAssignment ? (
                  <div className="form-grid">
                    <label className="field">
                      <span>Institución</span>
                      <div className="field__control">
                        <input
                          value={editingDraft.institution}
                          onChange={(event) =>
                            setEditingDraft((current) =>
                              current ? { ...current, institution: event.target.value } : current,
                            )
                          }
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Facultad</span>
                      <div className="field__control">
                        <input
                          value={editingDraft.faculty}
                          onChange={(event) =>
                            setEditingDraft((current) =>
                              current ? { ...current, faculty: event.target.value } : current,
                            )
                          }
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Programa</span>
                      <div className="field__control">
                        <input
                          value={editingDraft.program}
                          onChange={(event) =>
                            setEditingDraft((current) =>
                              current ? { ...current, program: event.target.value } : current,
                            )
                          }
                        />
                      </div>
                    </label>

                    <label className="field">
                      <span>Alcance organizacional</span>
                      <div className="field__control">
                        <input
                          value={editingDraft.scope}
                          onChange={(event) =>
                            setEditingDraft((current) =>
                              current ? { ...current, scope: event.target.value } : current,
                            )
                          }
                        />
                      </div>
                      <small className="field-help">
                        Define si este usuario opera sobre toda la institución o sobre un ámbito
                        acotado.
                      </small>
                    </label>

                    <label className="field">
                      <span>Nueva contraseña</span>
                      <div className="field__control">
                        <input
                          type="password"
                          value={editingDraft.password ?? ''}
                          onChange={(event) =>
                            setEditingDraft((current) =>
                              current ? { ...current, password: event.target.value } : current,
                            )
                          }
                          placeholder="Opcional"
                        />
                      </div>
                    </label>
                  </div>
                ) : null}

                <label className="field">
                  <span>Motivo de estado</span>
                  <div className="field__control">
                    <textarea
                      rows={3}
                      value={editingDraft.statusReason}
                      onChange={(event) =>
                        setEditingDraft((current) =>
                          current ? { ...current, statusReason: event.target.value } : current,
                        )
                      }
                      placeholder="Describe el motivo si el acceso no está activo."
                    />
                  </div>
                </label>

                <div className="admin-user-signals">
                  <span>
                    Último acceso {selectedUser.lastAccessAt ? formatDateTime(selectedUser.lastAccessAt) : 'sin registro'}
                  </span>
                  <span>Institución {selectedUser.institution || 'sin definir'}</span>
                  <span>Programa {selectedUser.program || 'sin definir'}</span>
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="cta-button"
                    onClick={() => void handleUpdateUser()}
                    disabled={isSavingUser}
                  >
                    <span>{isSavingUser ? 'Guardando…' : 'Guardar cambios'}</span>
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setFocusRoleAssignment((current) => !current)}
                  >
                    <span>{focusRoleAssignment ? 'Volver a edición general' : 'Enfocar roles'}</span>
                  </button>
                  {selectedUser.id !== user.id ? (
                    <button
                      type="button"
                      className="danger-button danger-button--ghost"
                      onClick={() => void handleDeleteUser(selectedUser.id, selectedUser.name)}
                    >
                      <Trash2 size={16} />
                      <span>Eliminar</span>
                    </button>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="empty-state">
                <strong>Selecciona un usuario o crea uno nuevo</strong>
                <p>
                  El asistente lateral concentra edición, asignación de roles y ajuste de acceso para
                  no saturar la vista principal.
                </p>
              </div>
            )}
          </article>
        </section>

        {renderAccountSecurity()}
      </div>
    );
  }

  function renderInstitutionTab() {
    if (!institutionDraft) {
      return null;
    }

    return (
      <div className="page-stack">
        <section className="surface section-card section-card--compact">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Modelo institucional</span>
              <h3>Estructura académica y reglas de aprovisionamiento</h3>
            </div>
            <Building2 size={18} />
          </div>
          <p className="section-lead">
            Define instituciones, facultades, programas, periodos y estado por defecto para que
            formularios y alcances de usuario se comporten de forma consistente.
          </p>
        </section>

        <form className="surface section-card" onSubmit={handleSaveInstitution}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Parámetros</span>
              <h3>Configuración institucional</h3>
            </div>
            <Database size={18} />
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Nombre visible</span>
              <div className="field__control">
                <input
                  value={institutionDraft.displayName}
                  onChange={(event) =>
                    setInstitutionDraft((current) =>
                      current ? { ...current, displayName: event.target.value } : current,
                    )
                  }
                />
              </div>
            </label>

            <label className="field">
              <span>Correo de soporte</span>
              <div className="field__control">
                <input
                  type="email"
                  value={institutionDraft.supportEmail}
                  onChange={(event) =>
                    setInstitutionDraft((current) =>
                      current ? { ...current, supportEmail: event.target.value } : current,
                    )
                  }
                />
              </div>
            </label>

            <label className="field">
              <span>Dominio por defecto</span>
              <div className="field__control">
                <input
                  value={institutionDraft.defaultDomain}
                  onChange={(event) =>
                    setInstitutionDraft((current) =>
                      current ? { ...current, defaultDomain: event.target.value } : current,
                    )
                  }
                />
              </div>
            </label>

            <label className="field">
              <span>Estado inicial de usuario</span>
              <div className="field__control">
                <select
                  value={institutionDraft.defaultUserState}
                  onChange={(event) =>
                    setInstitutionDraft((current) =>
                      current
                        ? {
                            ...current,
                            defaultUserState: event.target.value as InstitutionSettings['defaultUserState'],
                          }
                        : current,
                    )
                  }
                >
                  {['Activo', 'Inactivo', 'Suspendido', 'Pendiente'].map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Instituciones</span>
              <div className="field__control">
                <textarea
                  rows={5}
                  value={stringifyList(institutionDraft.institutions)}
                  onChange={(event) =>
                    setInstitutionDraft((current) =>
                      current
                        ? { ...current, institutions: parseListInput(event.target.value) }
                        : current,
                    )
                  }
                />
              </div>
            </label>

            <label className="field">
              <span>Facultades</span>
              <div className="field__control">
                <textarea
                  rows={5}
                  value={stringifyList(institutionDraft.faculties)}
                  onChange={(event) =>
                    setInstitutionDraft((current) =>
                      current
                        ? { ...current, faculties: parseListInput(event.target.value) }
                        : current,
                    )
                  }
                />
              </div>
            </label>

            <label className="field">
              <span>Programas</span>
              <div className="field__control">
                <textarea
                  rows={5}
                  value={stringifyList(institutionDraft.programs)}
                  onChange={(event) =>
                    setInstitutionDraft((current) =>
                      current
                        ? { ...current, programs: parseListInput(event.target.value) }
                        : current,
                    )
                  }
                />
              </div>
            </label>

            <label className="field">
              <span>Periodos académicos</span>
              <div className="field__control">
                <textarea
                  rows={5}
                  value={stringifyList(institutionDraft.academicPeriods)}
                  onChange={(event) =>
                    setInstitutionDraft((current) =>
                      current
                        ? { ...current, academicPeriods: parseListInput(event.target.value) }
                        : current,
                    )
                  }
                />
              </div>
            </label>
          </div>

          <div className="form-grid">
            <label className="field">
              <span>Tipologías de curso</span>
              <div className="field__control">
                <textarea
                  rows={4}
                  value={stringifyList(institutionDraft.courseTypes)}
                  onChange={(event) =>
                    setInstitutionDraft((current) =>
                      current
                        ? { ...current, courseTypes: parseListInput(event.target.value) }
                        : current,
                    )
                  }
                />
              </div>
            </label>

            <label className="field field--toggle">
              <span>Aprovisionamiento automático por SSO</span>
              <div className="field__toggle">
                <input
                  type="checkbox"
                  checked={institutionDraft.allowAutoProvisioning}
                  onChange={(event) =>
                    setInstitutionDraft((current) =>
                      current
                        ? { ...current, allowAutoProvisioning: event.target.checked }
                        : current,
                    )
                  }
                />
                <p>Si está activo, nuevos usuarios por dominio aprobado pueden quedar creados automáticamente.</p>
              </div>
            </label>
          </div>

          {settingsError ? <p className="form-error">{settingsError}</p> : null}

          <div className="action-row">
            <button type="submit" className="cta-button" disabled={isSavingInstitution}>
              <span>{isSavingInstitution ? 'Guardando…' : 'Guardar configuración institucional'}</span>
            </button>
          </div>
        </form>
      </div>
    );
  }

  function renderBrandingTab() {
    if (!brandingDraft) {
      return null;
    }

    return (
      <div className="page-stack page-stack--governance">
        <section className="surface section-card section-card--compact admin-subhead">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Branding y marca</span>
              <h3>Identidad visual, login y comportamiento base</h3>
            </div>
            <Brush size={18} />
          </div>
          <p className="section-lead">
            Ajusta nombre, color, tipografía, logo, favicon, loader y las tres variantes de acceso desde un flujo más limpio.
          </p>
        </section>

        <div className="admin-brand-layout">
          <aside className="surface section-card admin-brand-aside">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Vista previa</span>
                <h3>Resumen de marca</h3>
              </div>
              <BadgeCheck size={18} />
            </div>

            <div className="admin-brand-preview">
              {brandingDraft.logoMode === 'Imagen' && brandingDraft.logoUrl.trim() ? (
                <img
                  className="admin-brand-logo"
                  src={brandingDraft.logoUrl}
                  alt={brandingDraft.logoText}
                />
              ) : brandingDraft.logoMode === 'Wordmark' ? (
                <div className="admin-brand-wordmark">{brandingDraft.logoText}</div>
              ) : (
                <div className="admin-brand-mark" style={{ background: brandingDraft.primaryColor }}>
                  {brandingDraft.shortMark}
                </div>
              )}
              <div>
                <strong>{brandingDraft.logoText}</strong>
                <p>{brandingDraft.institutionName}</p>
              </div>
            </div>

            <div className="admin-brand-stat-list">
              <div>
                <span>Login activo</span>
                <strong>{brandingDraft.loginVariant}</strong>
              </div>
              <div>
                <span>Preset tipográfico</span>
                <strong>{brandingDraft.fontPreset}</strong>
              </div>
              <div>
                <span>Color principal</span>
                <strong>{brandingDraft.primaryColor}</strong>
              </div>
              <div>
                <span>Loader</span>
                <strong>{brandingDraft.loaderLabel}</strong>
              </div>
            </div>

            <div className="login-preview-grid">
              {(['Minimal', 'Split', 'Command'] as const).map((variant) => (
                <button
                  key={variant}
                  type="button"
                  className={
                    brandingDraft.loginVariant === variant
                      ? 'login-preview-card login-preview-card--active'
                      : 'login-preview-card'
                  }
                  onClick={() =>
                    setBrandingDraft((current) =>
                      current ? { ...current, loginVariant: variant } : current,
                    )
                  }
                >
                  <span>{variant}</span>
                  <strong>
                    {variant === 'Minimal'
                      ? 'Pantalla limpia'
                      : variant === 'Split'
                        ? 'Imagen y formulario'
                        : 'Control center'}
                  </strong>
                  <p>
                    {variant === 'Minimal'
                      ? 'Acceso directo con baja carga visual.'
                      : variant === 'Split'
                        ? 'Presentación institucional con dos columnas.'
                        : 'Acceso técnico con lenguaje más operativo.'}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <form className="admin-brand-sections" onSubmit={handleSaveBranding}>
            <fieldset className="form-section">
              <legend>Identidad institucional</legend>
              <div className="form-grid">
                <label className="field">
                  <span>Nombre de plataforma</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.platformName}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, platformName: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Nombre institucional</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.institutionName}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, institutionName: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Marca corta</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.shortMark}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, shortMark: event.target.value } : current,
                        )
                      }
                      maxLength={4}
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Texto del logo</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.logoText}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, logoText: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Modo de logo</span>
                  <div className="field__control">
                    <select
                      value={brandingDraft.logoMode}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current
                            ? {
                                ...current,
                                logoMode: event.target.value as BrandingSettings['logoMode'],
                              }
                            : current,
                        )
                      }
                    >
                      {['Monograma', 'Wordmark', 'Imagen'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="field">
                  <span>URL del logo</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.logoUrl}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, logoUrl: event.target.value } : current,
                        )
                      }
                      placeholder="https://..."
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Modo de favicon</span>
                  <div className="field__control">
                    <select
                      value={brandingDraft.faviconMode}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current
                            ? {
                                ...current,
                                faviconMode: event.target.value as BrandingSettings['faviconMode'],
                              }
                            : current,
                        )
                      }
                    >
                      {['Monograma', 'Imagen'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="field">
                  <span>Favicon</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.faviconLabel}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, faviconLabel: event.target.value } : current,
                        )
                      }
                      maxLength={2}
                    />
                  </div>
                </label>

                <label className="field">
                  <span>URL del favicon</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.faviconUrl}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, faviconUrl: event.target.value } : current,
                        )
                      }
                      placeholder="https://..."
                    />
                  </div>
                </label>

                <label className="field">
                  <span>URL de soporte</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.supportUrl}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, supportUrl: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Tipografía y color</legend>
              <div className="form-grid">
                <label className="field">
                  <span>Preset tipográfico</span>
                  <div className="field__control">
                    <select
                      value={brandingDraft.fontPreset}
                      onChange={(event) =>
                        setBrandingDraft((current) => {
                          if (!current) {
                            return current;
                          }

                          const preset = event.target.value as BrandingSettings['fontPreset'];

                          if (preset === 'Editorial') {
                            return {
                              ...current,
                              fontPreset: preset,
                              bodyFontFamily: 'IBM Plex Sans',
                              displayFontFamily: 'Fraunces',
                              monoFontFamily: 'IBM Plex Mono',
                            };
                          }

                          if (preset === 'Institutional') {
                            return {
                              ...current,
                              fontPreset: preset,
                              bodyFontFamily: 'Manrope',
                              displayFontFamily: 'Space Grotesk',
                              monoFontFamily: 'IBM Plex Mono',
                            };
                          }

                          return {
                            ...current,
                            fontPreset: preset,
                            bodyFontFamily: 'IBM Plex Sans',
                            displayFontFamily: 'Space Grotesk',
                            monoFontFamily: 'IBM Plex Mono',
                          };
                        })
                      }
                    >
                      {['Control', 'Editorial', 'Institutional'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="field">
                  <span>Fuente de interfaz</span>
                  <div className="field__control">
                    <select
                      value={brandingDraft.bodyFontFamily}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, bodyFontFamily: event.target.value } : current,
                        )
                      }
                    >
                      {['IBM Plex Sans', 'Manrope', 'Space Grotesk'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="field">
                  <span>Fuente de títulos</span>
                  <div className="field__control">
                    <select
                      value={brandingDraft.displayFontFamily}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, displayFontFamily: event.target.value } : current,
                        )
                      }
                    >
                      {['Space Grotesk', 'Fraunces', 'IBM Plex Sans'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="field">
                  <span>Fuente mono</span>
                  <div className="field__control">
                    <select
                      value={brandingDraft.monoFontFamily}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, monoFontFamily: event.target.value } : current,
                        )
                      }
                    >
                      {['IBM Plex Mono', 'Space Grotesk'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="field">
                  <span>Color principal</span>
                  <div className="field__control field__control--color">
                    <input
                      type="color"
                      value={brandingDraft.primaryColor}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, primaryColor: event.target.value } : current,
                        )
                      }
                    />
                    <input
                      value={brandingDraft.primaryColor}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, primaryColor: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Color acento</span>
                  <div className="field__control field__control--color">
                    <input
                      type="color"
                      value={brandingDraft.accentColor}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, accentColor: event.target.value } : current,
                        )
                      }
                    />
                    <input
                      value={brandingDraft.accentColor}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, accentColor: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <label className="field field--full">
                  <span>Dirección visual</span>
                  <div className="field__control">
                    <textarea
                      rows={3}
                      value={brandingDraft.surfaceStyle}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, surfaceStyle: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>
              </div>
            </fieldset>

            <fieldset className="form-section">
              <legend>Login y loader</legend>
              <div className="form-grid">
                <label className="field">
                  <span>Variante de login</span>
                  <div className="field__control">
                    <select
                      value={brandingDraft.loginVariant}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current
                            ? {
                                ...current,
                                loginVariant: event.target.value as BrandingSettings['loginVariant'],
                              }
                            : current,
                        )
                      }
                    >
                      {['Minimal', 'Split', 'Command'].map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="field">
                  <span>Etiqueta superior</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.loginEyebrow}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, loginEyebrow: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Título del login</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.loginHeadline}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, loginHeadline: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <label className="field field--full">
                  <span>Mensaje del login</span>
                  <div className="field__control">
                    <textarea
                      rows={3}
                      value={brandingDraft.loginMessage}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, loginMessage: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Etiqueta del loader</span>
                  <div className="field__control">
                    <input
                      value={brandingDraft.loaderLabel}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, loaderLabel: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <label className="field field--full">
                  <span>Mensaje del loader</span>
                  <div className="field__control">
                    <textarea
                      rows={3}
                      value={brandingDraft.loaderMessage}
                      onChange={(event) =>
                        setBrandingDraft((current) =>
                          current ? { ...current, loaderMessage: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>
              </div>
            </fieldset>

            {settingsError ? <p className="form-error">{settingsError}</p> : null}

            <div className="action-row">
              <button type="submit" className="cta-button" disabled={isSavingBranding}>
                <span>{isSavingBranding ? 'Guardando…' : 'Guardar branding'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function renderIntegrationsTab() {
    const integrations = adminData?.integrations ?? [];
    const sortedIntegrations = [...integrations].sort((left, right) => {
      if (left.envReady !== right.envReady) {
        return Number(right.envReady) - Number(left.envReady);
      }

      if (left.enabled !== right.enabled) {
        return Number(right.enabled) - Number(left.enabled);
      }

      return left.name.localeCompare(right.name, 'es');
    });
    const readyIntegrations = integrations.filter((integration) => integration.envReady);
    const pendingIntegrations = integrations.filter((integration) => !integration.envReady);

    return (
      <div className="page-stack">
        <section className="surface section-card section-card--compact">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Integraciones</span>
              <h3>Integraciones activas por runtime y asistentes de configuración</h3>
            </div>
            <Cable size={18} />
          </div>
          <p className="section-lead">
            Las que ya están configuradas en Vercel aparecen activas en la interfaz. Desde aquí
            terminas de ajustar alcance, fallback y prueba técnica con un asistente por servicio.
          </p>

          <div className="admin-kpi-grid">
            <div className="admin-kpi">
              <span>Activas por runtime</span>
              <strong>{readyIntegrations.length}</strong>
              <p>Configuradas ya en variables del entorno.</p>
            </div>
            <div className="admin-kpi">
              <span>Por configurar</span>
              <strong>{pendingIntegrations.length}</strong>
              <p>Aún requieren credenciales o parámetros base.</p>
            </div>
            <div className="admin-kpi">
              <span>Con prueba</span>
              <strong>{integrations.filter((item) => item.lastTestAt).length}</strong>
              <p>Servicios ya validados desde Gobierno.</p>
            </div>
            <div className="admin-kpi">
              <span>Con error</span>
              <strong>{degradedIntegrations}</strong>
              <p>Integraciones degradadas o con fallas recientes.</p>
            </div>
          </div>
        </section>

        <section className="admin-split">
          <article className="surface section-card admin-pane">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Conectores</span>
                <h3>Disponibles hoy</h3>
              </div>
              <Waypoints size={18} />
            </div>

            <div className="admin-service-list">
              {sortedIntegrations.map((integration) => (
                <button
                  key={integration.id}
                  type="button"
                  className={
                    integration.id === selectedIntegrationId
                      ? 'admin-service-card admin-service-card--active'
                      : 'admin-service-card'
                  }
                  onClick={() => setSelectedIntegrationId(integration.id)}
                >
                  <div>
                    <strong>{integration.name}</strong>
                    <p>{integration.provider}</p>
                  </div>
                  <div className="admin-service-card__meta">
                    <span className={getBadgeClass(integration.status)}>{integration.status}</span>
                    <span className="badge badge--outline">
                      {integration.envReady ? 'Activa por runtime' : integration.category}
                    </span>
                  </div>
                  <small>{integration.assistantSummary}</small>
                </button>
              ))}
            </div>
          </article>

          <article className="surface section-card admin-pane">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Detalle</span>
                <h3>{selectedIntegration?.name ?? 'Selecciona una integración'}</h3>
              </div>
              <TestTube2 size={18} />
            </div>

            {selectedIntegration && integrationDraft ? (
              <>
                <div className="integration-summary">
                  <div className="integration-summary__row">
                    <span className={getBadgeClass(selectedIntegration.status)}>
                      {selectedIntegration.status}
                    </span>
                    <span className="badge badge--outline">{selectedIntegration.category}</span>
                    <span className="badge badge--outline">
                      Runtime {selectedIntegration.envReady ? 'listo' : 'incompleto'}
                    </span>
                  </div>
                  <p>{selectedIntegration.description}</p>
                  <small>{selectedIntegration.runtimeSummary}</small>
                </div>

                <div className="integration-assistant">
                  <strong>{selectedIntegration.assistantTitle}</strong>
                  <p>{selectedIntegration.assistantSummary}</p>
                  <div className="integration-assistant__steps">
                    {selectedIntegration.assistantSteps.map((step, index) => (
                      <div key={`${selectedIntegration.id}-step-${index}`} className="integration-assistant__step">
                        <span>{index + 1}</span>
                        <p>{step}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-grid">
                  <label className="field field--toggle">
                    <span>Estado visible en front</span>
                    <div className="field__toggle">
                      <input
                        type="checkbox"
                        checked={integrationDraft.enabled}
                        onChange={(event) =>
                          setIntegrationDraft((current) =>
                            current ? { ...current, enabled: event.target.checked } : current,
                          )
                        }
                      />
                      <p>
                        Si el runtime ya está completo, esta integración se mostrará activa aunque
                        aún estés afinando el asistente.
                      </p>
                    </div>
                  </label>

                  <label className="field">
                    <span>Fallback operativo</span>
                    <div className="field__control">
                      <input
                        value={integrationDraft.fallbackTo}
                        onChange={(event) =>
                          setIntegrationDraft((current) =>
                            current ? { ...current, fallbackTo: event.target.value } : current,
                          )
                        }
                      />
                    </div>
                  </label>
                </div>

                <label className="field">
                  <span>Alcances habilitados por el asistente</span>
                  <div className="role-pill-group">
                    {selectedIntegration.scopes.map((scope) => (
                      <button
                        key={`${selectedIntegration.id}-${scope}`}
                        type="button"
                        className={
                          integrationDraft.scopes.includes(scope)
                            ? 'filter-chip filter-chip--active'
                            : 'filter-chip'
                        }
                        onClick={() =>
                          setIntegrationDraft((current) =>
                            current
                              ? {
                                  ...current,
                                  scopes: current.scopes.includes(scope)
                                    ? current.scopes.filter((item) => item !== scope)
                                    : [...current.scopes, scope],
                                }
                              : current,
                          )
                        }
                      >
                        <span>{scope}</span>
                      </button>
                    ))}
                  </div>
                </label>

                <div className="form-grid">
                  {Object.entries(integrationDraft.config).map(([key, value]) => (
                    <label key={`${selectedIntegration.id}-${key}`} className="field">
                      <span>{key}</span>
                      <div className="field__control">
                        <input
                          value={value}
                          onChange={(event) =>
                            setIntegrationDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    config: {
                                      ...current.config,
                                      [key]: event.target.value,
                                    },
                                  }
                                : current,
                            )
                          }
                        />
                      </div>
                    </label>
                  ))}
                </div>

                <label className="field">
                  <span>Notas del asistente</span>
                  <div className="field__control">
                    <textarea
                      rows={4}
                      value={integrationDraft.notes}
                      onChange={(event) =>
                        setIntegrationDraft((current) =>
                          current ? { ...current, notes: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <div className="integration-runtime">
                  <strong>Variables esperadas</strong>
                  <div className="role-pill-group">
                    {selectedIntegration.requiredEnvKeys.map((key) => (
                      <span key={`${selectedIntegration.id}-${key}`} className="role-pill">
                        {key}
                      </span>
                    ))}
                  </div>
                  <p>
                    Última prueba:{' '}
                    {selectedIntegration.lastTestAt
                      ? formatDateTime(selectedIntegration.lastTestAt)
                      : 'Aún no ejecutada'}
                  </p>
                  <p>
                    {selectedIntegration.envReady
                      ? 'El runtime ya detecta las variables necesarias.'
                      : 'Completa variables en Vercel para que se active automáticamente en el front.'}
                  </p>
                  {selectedIntegration.lastError ? (
                    <p className="form-error">{selectedIntegration.lastError}</p>
                  ) : null}
                </div>

                {integrationError ? <p className="form-error">{integrationError}</p> : null}

                <div className="action-row">
                  <button
                    type="button"
                    className="cta-button"
                    onClick={() => void handleSaveIntegration()}
                    disabled={isSavingIntegration}
                  >
                    <span>{isSavingIntegration ? 'Guardando…' : 'Guardar integración'}</span>
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => void handleTestIntegration(selectedIntegration.id)}
                    disabled={testingIntegrationId === selectedIntegration.id}
                  >
                    <RefreshCcw size={16} />
                    <span>
                      {testingIntegrationId === selectedIntegration.id
                        ? 'Probando…'
                        : 'Probar conectividad'}
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Selecciona una integración para ver configuración, alcance y diagnóstico.</p>
              </div>
            )}
          </article>
        </section>
      </div>
    );
  }

  function renderServicesTab() {
    return (
      <div className="page-stack">
        <section className="insight-grid">
          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Catálogo</span>
                <h3>Estado operativo de servicios conectados</h3>
              </div>
              <Cable size={18} />
            </div>

            <div className="admin-kpi-grid">
              <div className="admin-kpi">
                <span>Servicios activos</span>
                <strong>{activeIntegrations}</strong>
                <p>Integraciones habilitadas y listas.</p>
              </div>
              <div className="admin-kpi">
                <span>Con error</span>
                <strong>{degradedIntegrations}</strong>
                <p>Requieren atención técnica o de configuración.</p>
              </div>
              <div className="admin-kpi">
                <span>Pendientes</span>
                <strong>
                  {adminData?.integrations.filter((item) => item.status === 'Pendiente').length ?? 0}
                </strong>
                <p>Necesitan activación o primera validación.</p>
              </div>
              <div className="admin-kpi">
                <span>Últimas pruebas</span>
                <strong>
                  {adminData?.integrations.filter((item) => item.lastTestAt).length ?? 0}
                </strong>
                <p>Servicios con diagnóstico ejecutado.</p>
              </div>
            </div>
          </article>
        </section>

        <section className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Filtro operativo</span>
              <h3>Catálogo unificado</h3>
            </div>
            <Logs size={18} />
          </div>

          <div className="admin-filter-row">
            <label className="field field--compact">
              <span>Estado</span>
              <div className="field__control">
                <select
                  value={serviceStatusFilter}
                  onChange={(event) => setServiceStatusFilter(event.target.value)}
                >
                  {['Todas', 'Activa', 'Inactiva', 'Pendiente', 'En prueba', 'Con error'].map(
                    (status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </label>

            <label className="field field--compact">
              <span>Categoría</span>
              <div className="field__control">
                <select
                  value={serviceCategoryFilter}
                  onChange={(event) => setServiceCategoryFilter(event.target.value)}
                >
                  {[
                    'Todas',
                    'Correo',
                    'IA',
                    'Académicas',
                    'Google',
                    'Storage',
                    'Audiovisual',
                    'Sistema',
                  ].map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="admin-catalog-grid">
            {filteredServices.map((service) => (
              <article key={service.id} className="admin-catalog-card">
                <div className="admin-catalog-card__head">
                  <div>
                    <strong>{service.name}</strong>
                    <p>{service.provider}</p>
                  </div>
                  <span className={getBadgeClass(service.status)}>{service.status}</span>
                </div>
                <p>{service.description}</p>
                <div className="admin-service-signals">
                  <span>{service.category}</span>
                  <span>{service.envReady ? 'Runtime listo' : 'Runtime incompleto'}</span>
                  <span>
                    {service.lastTestAt ? `Probado ${formatDate(service.lastTestAt)}` : 'Sin prueba'}
                  </span>
                </div>
                <small>{service.runtimeSummary}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderLogsTab() {
    return (
      <div className="page-stack">
        <section className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Monitoreo</span>
              <h3>Logs técnicos, administrativos y de autenticación</h3>
            </div>
            <Logs size={18} />
          </div>

          <div className="admin-filter-row">
            <label className="field field--compact field--search">
              <span>Buscar</span>
              <div className="field__control">
                <input
                  value={logQuery}
                  onChange={(event) => setLogQuery(event.target.value)}
                  placeholder="Usuario, evento, detalle, servicio..."
                />
              </div>
            </label>

            <label className="field field--compact">
              <span>Categoría</span>
              <div className="field__control">
                <select
                  value={logCategoryFilter}
                  onChange={(event) => setLogCategoryFilter(event.target.value)}
                >
                  {['Todas', 'Sistema', 'Autenticación', 'Integración', 'Administración'].map(
                    (item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ),
                  )}
                </select>
              </div>
            </label>

            <label className="field field--compact">
              <span>Severidad</span>
              <div className="field__control">
                <select
                  value={logSeverityFilter}
                  onChange={(event) => setLogSeverityFilter(event.target.value)}
                >
                  {['Todas', 'Info', 'Success', 'Warning', 'Error'].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="admin-log-list">
            {filteredLogs.map((entry) => (
              <article key={entry.id} className="admin-log-card">
                <div className="admin-log-card__head">
                  <div>
                    <strong>{entry.event}</strong>
                    <p>
                      {entry.module} · {entry.service}
                    </p>
                  </div>
                  <div className="admin-log-card__meta">
                    <span className={getBadgeClass(entry.severity)}>{entry.severity}</span>
                    <span className="badge badge--outline">{entry.category}</span>
                  </div>
                </div>
                <p>{entry.detail}</p>
                <div className="admin-log-card__foot">
                  <span>{formatDateTime(entry.createdAt)}</span>
                  <span>{entry.userName ?? 'Sistema'}</span>
                  <span>{entry.result}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  function renderAuditTab() {
    return (
      <div className="page-stack">
        <section className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Auditoría</span>
              <h3>Trazabilidad funcional, técnica y administrativa</h3>
            </div>
            <ShieldCheck size={18} />
          </div>

          <div className="admin-filter-row">
            <label className="field field--compact field--search">
              <span>Buscar</span>
              <div className="field__control">
                <input
                  value={auditQuery}
                  onChange={(event) => setAuditQuery(event.target.value)}
                  placeholder="Acción, actor, entidad..."
                />
              </div>
            </label>

            <label className="field field--compact">
              <span>Clasificación</span>
              <div className="field__control">
                <select
                  value={auditClassificationFilter}
                  onChange={(event) => setAuditClassificationFilter(event.target.value)}
                >
                  {['Todas', 'Funcional', 'Técnica', 'Administrativa'].map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            </label>
          </div>

          <div className="admin-audit-list">
            {filteredAudit.map((entry) => (
              <article key={entry.id} className="admin-audit-card">
                <div className="admin-audit-card__head">
                  <div>
                    <strong>{entry.action}</strong>
                    <p>
                      {entry.entityType} · {entry.entityId}
                    </p>
                  </div>
                  <div className="admin-log-card__meta">
                    <span className={getBadgeClass(entry.classification)}>{entry.classification}</span>
                  </div>
                </div>
                <p>{entry.detail}</p>
                <div className="admin-log-card__foot">
                  <span>{formatDateTime(entry.createdAt)}</span>
                  <span>{entry.actorName}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="page-stack team-page">
        <section className="surface section-card section-card--compact">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Gobierno</span>
              <h3>Acceso restringido</h3>
            </div>
            <AlertTriangle size={18} />
          </div>

          <p className="section-lead">
            Este módulo concentra configuración estructural, integraciones, logs y auditoría del
            sistema. Solo perfiles administradores pueden operarlo.
          </p>
        </section>

        {renderAccountSecurity()}
      </div>
    );
  }

  if (isAdminLoading || !adminData || !institutionDraft || !brandingDraft) {
    return (
      <div className="page-stack team-page">
        <section className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Gobierno</span>
              <h3>Preparando centro administrativo</h3>
            </div>
            <Clock3 size={18} />
          </div>
          <p className="section-lead">
            Estamos cargando usuarios, integraciones, configuraciones, logs y auditoría.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page-stack team-page team-page--admin">
      <section className="surface section-card section-card--compact admin-hero">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Módulo Administración</span>
            <h3>Gobierno técnico y funcional</h3>
          </div>
          <ShieldCheck size={18} />
        </div>

        <p className="section-lead">
          Configura la plataforma sin mezclar esta capa con la operación de cursos. Todo está organizado por pestañas para reducir carga cognitiva.
        </p>

        <div className="admin-inline-metrics">
          <span><strong>{activeUsers}</strong> usuarios activos</span>
          <span><strong>{activeIntegrations}</strong> integraciones listas</span>
          <span>
            <strong>{degradedIntegrations === 0 ? '0' : degradedIntegrations}</strong>{' '}
            alertas técnicas
          </span>
          <span>
            <strong>
              {adminData.audit[0]?.createdAt
                ? formatLongDate(adminData.audit[0].createdAt.slice(0, 10))
                : 'Sin registros'}
            </strong>{' '}
            última actividad
          </span>
        </div>
      </section>

      <section className="surface section-card section-card--compact">
        <div className="admin-tabs" role="tablist" aria-label="Submódulos de Gobierno">
          {adminTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'admin-tab admin-tab--active' : 'admin-tab'}
              onClick={() => handleTabChange(tab.id)}
            >
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </section>

      {adminError ? <p className="form-error">{adminError}</p> : null}

      {activeTab === 'users' ? renderUsersTab() : null}
      {activeTab === 'institution' ? renderInstitutionTab() : null}
      {activeTab === 'branding' ? renderBrandingTab() : null}
      {activeTab === 'integrations' ? renderIntegrationsTab() : null}
      {activeTab === 'services' ? renderServicesTab() : null}
      {activeTab === 'logs' ? renderLogsTab() : null}
      {activeTab === 'audit' ? renderAuditTab() : null}
    </div>
  );
}
