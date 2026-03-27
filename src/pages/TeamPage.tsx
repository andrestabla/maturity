import {
  AlertTriangle,
  BadgeCheck,
  Brush,
  Building2,
  Cable,
  Clock3,
  Database,
  Eye,
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
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
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
  description: string;
}> = [
  { id: 'users', label: 'Usuarios', description: 'Usuarios creados, roles y estados de acceso.' },
  {
    id: 'institution',
    label: 'Institución',
    description: 'Parámetros institucionales, catálogos y estructura académica.',
  },
  {
    id: 'branding',
    label: 'Branding',
    description: 'Marca, tipografía, login, loader y recursos visuales base.',
  },
  {
    id: 'integrations',
    label: 'Integraciones',
    description: 'Configuración y asistentes por servicio externo.',
  },
  {
    id: 'services',
    label: 'Servicios',
    description: 'Catálogo operativo y estado resumido de conectores.',
  },
  {
    id: 'logs',
    label: 'Logs',
    description: 'Eventos técnicos, autenticación e integraciones.',
  },
  {
    id: 'audit',
    label: 'Auditoría',
    description: 'Bitácora administrativa y trazabilidad de cambios críticos.',
  },
];

function getAdminTabFromPath(pathname: string): AdminTab | null {
  const [, base, section] = pathname.split('/');

  if (base !== 'admin' || !section) {
    return null;
  }

  return adminTabs.some((tab) => tab.id === section) ? (section as AdminTab) : null;
}

export function TeamPage({
  user,
  appData,
  refreshAppData,
  refreshSession,
}: TeamPageProps) {
  const isAdmin = canManageUsers(user.role);
  const location = useLocation();
  const navigate = useNavigate();
  const activeTab = useMemo(() => getAdminTabFromPath(location.pathname), [location.pathname]);
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
    if (location.pathname.startsWith('/admin/') && activeTab === null) {
      navigate('/admin', { replace: true });
    }
  }, [activeTab, location.pathname, navigate]);

  useEffect(() => {
    if (!adminData) {
      return;
    }

    const userId = new URLSearchParams(location.search).get('user');

    if (!userId) {
      return;
    }

    if (activeTab !== 'users') {
      navigate(
        {
          pathname: '/admin/users',
          search: `?user=${userId}`,
        },
        { replace: true },
      );
      return;
    }

    const target = adminData.users.find((member) => member.id === userId);

    if (target) {
      startEditing(target);
    }
  }, [activeTab, adminData, location.search, navigate]);

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
      if (!query) {
        return true;
      }

      return [
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
    });
  }, [adminData?.users, userSearch]);

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
      closeUserAssistant();
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'No fue posible crear el usuario.');
    } finally {
      setIsCreatingUser(false);
    }
  }

  function closeUserAssistant() {
    setShowCreateUserAssistant(false);
    setEditingDraft(null);
    setEditingUserId(null);
    setFocusRoleAssignment(false);
    setIsRolePickerOpen(false);

    if (location.pathname === '/admin/users' && new URLSearchParams(location.search).get('user')) {
      navigate('/admin/users', { replace: true });
    }
  }

  function openCreateUserAssistant() {
    setUserError(null);
    setUserForm(buildUserForm(institutionDraft ?? undefined));
    closeUserAssistant();
    setShowCreateUserAssistant(true);
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

  function openUserAssistant(target: AuthUser) {
    startEditing(target);
    navigate(
      {
        pathname: '/admin/users',
        search: `?user=${target.id}`,
      },
      { replace: true },
    );
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
      closeUserAssistant();

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
    closeUserAssistant();
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

  function renderGovernmentRoutes() {
    return (
      <section className="surface section-card section-card--compact">
        <div className="admin-route-grid">
          <NavLink
            to="/admin"
            className={
              activeTab === null && location.pathname === '/admin'
                ? 'admin-route-card admin-route-card--active'
                : 'admin-route-card'
            }
          >
            <strong>Resumen</strong>
            <p>Portada del módulo y acceso rápido a la capa de gobierno.</p>
          </NavLink>

          {adminTabs.map((tab) => (
            <NavLink
              key={tab.id}
              to={`/admin/${tab.id}`}
              className={
                activeTab === tab.id ? 'admin-route-card admin-route-card--active' : 'admin-route-card'
              }
            >
              <strong>{tab.label}</strong>
              <p>{tab.description}</p>
            </NavLink>
          ))}
        </div>
      </section>
    );
  }

  function renderUsersTab() {
    const users = adminData?.users ?? [];
    const selectedUser =
      users.find((member) => member.id === editingUserId) ??
      users.find((member) => member.id === editingDraft?.id) ??
      null;

    return (
      <div className="page-stack">
        <section className="surface section-card section-card--compact">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Usuarios y roles</span>
              <h3>Resumen de acceso y directorio operativo</h3>
            </div>
            <UsersRound size={18} />
          </div>
          <p className="section-lead">
            Aquí ves el estado general de acceso. El detalle y las acciones sobre cada usuario se
            abren solo cuando entras por <strong>Acciones</strong>.
          </p>

          <div className="admin-kpi-grid">
            <div className="admin-kpi">
              <span>Usuarios</span>
              <strong>{users.length}</strong>
              <p>Directorio total.</p>
            </div>
            <div className="admin-kpi">
              <span>Activos</span>
              <strong>{activeUsers}</strong>
              <p>Con ingreso habilitado.</p>
            </div>
            <div className="admin-kpi">
              <span>Suspendidos</span>
              <strong>{suspendedUsers}</strong>
              <p>Con acceso bloqueado.</p>
            </div>
            <div className="admin-kpi">
              <span>Accesos recientes</span>
              <strong>{authenticationLogs.slice(0, 14).length}</strong>
              <p>Eventos de autenticación.</p>
            </div>
          </div>
        </section>

        <article className="surface section-card admin-pane">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Directorio</span>
              <h3>Usuarios creados</h3>
            </div>
            <UserCog size={18} />
          </div>

          <div className="admin-filter-row">
            <label className="field field--compact field--search">
              <span>Buscar usuario</span>
              <div className="field__control">
                <input
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                  placeholder="Nombre, correo, rol..."
                />
              </div>
            </label>

            <button type="button" className="cta-button" onClick={openCreateUserAssistant}>
              <UserPlus size={16} />
              <span>Nuevo usuario</span>
            </button>
          </div>

          <div className="admin-user-directory">
            <div className="admin-user-directory__header">
              <span>Usuario</span>
              <span>Rol</span>
              <span>Estado</span>
              <span>Seguimiento</span>
              <span>Acciones</span>
            </div>

            {filteredUsers.length === 0 ? (
              <div className="empty-state empty-state--embedded">
                <strong>No encontramos usuarios con ese filtro</strong>
                <p>Ajusta la búsqueda para volver a ver el directorio completo.</p>
              </div>
            ) : (
              filteredUsers.map((member) => {
                const trackingDetail = member.lastAccessAt
                  ? `Último acceso ${formatDateTime(member.lastAccessAt)}`
                  : member.createdAt
                    ? `Creado ${formatDate(member.createdAt)}`
                    : 'Sin trazabilidad registrada';

                return (
                  <div
                    key={member.id}
                    className={
                      member.id === selectedUser?.id && !showCreateUserAssistant
                        ? 'admin-user-directory__row admin-user-directory__row--active'
                        : 'admin-user-directory__row'
                    }
                  >
                    <div className="admin-user-directory__cell" data-label="Usuario">
                      <div className="admin-user-directory__identity">
                        <div className="avatar-pill">{deriveUserInitials(member.name)}</div>
                        <div>
                          <strong>{member.name}</strong>
                          <p>{member.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="admin-user-directory__cell" data-label="Rol">
                      <div className="admin-user-directory__role">
                        <strong>{member.role}</strong>
                        {(member.secondaryRoles ?? []).length > 0 ? (
                          <span>+ {(member.secondaryRoles ?? []).length} complementario(s)</span>
                        ) : (
                          <span>Sin roles adicionales</span>
                        )}
                      </div>
                    </div>

                    <div className="admin-user-directory__cell" data-label="Estado">
                      <span className={getBadgeClass(formatUserStateLabel(member.status))}>
                        {formatUserStateLabel(member.status)}
                      </span>
                    </div>

                    <div className="admin-user-directory__cell" data-label="Seguimiento">
                      <div className="admin-user-directory__tracking">
                        <span className="badge badge--outline">
                          {member.scope || member.program || 'Global'}
                        </span>
                        <small>{trackingDetail}</small>
                      </div>
                    </div>

                    <div className="admin-user-directory__cell" data-label="Acciones">
                      <button
                        type="button"
                        className="ghost-button admin-user-directory__action"
                        onClick={() => openUserAssistant(member)}
                      >
                        <Eye size={16} />
                        <span>Ver</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {userError ? <p className="form-error">{userError}</p> : null}
        </article>

        {showCreateUserAssistant ? (
          <article className="surface section-card admin-pane">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Acciones</span>
                <h3>Crear nuevo usuario</h3>
              </div>
              <ShieldCheck size={18} />
            </div>

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
                <button type="button" className="filter-chip" onClick={closeUserAssistant}>
                  <span>Cerrar</span>
                </button>
              </div>
            </form>
          </article>
        ) : editingDraft && selectedUser ? (
          <article className="surface section-card admin-pane">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Acciones</span>
                <h3>{selectedUser.name}</h3>
              </div>
              <ShieldCheck size={18} />
            </div>

            <div className="editor-card">
              <div className="admin-assistant-intro">
                <span className={getBadgeClass(formatUserStateLabel(selectedUser.status))}>
                  {formatUserStateLabel(selectedUser.status)}
                </span>
                <p>
                  {focusRoleAssignment
                    ? 'Modo rápido para asignar o retirar roles sin perder el contexto del usuario.'
                    : 'Desde aquí ajustas cuenta, acceso, alcance y roles del usuario seleccionado.'}
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
                  Último acceso{' '}
                  {selectedUser.lastAccessAt ? formatDateTime(selectedUser.lastAccessAt) : 'sin registro'}
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
                  <Waypoints size={16} />
                  <span>{focusRoleAssignment ? 'Volver a edición general' : 'Enfocar roles'}</span>
                </button>
                <button type="button" className="filter-chip" onClick={closeUserAssistant}>
                  <span>Cerrar</span>
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
          </article>
        ) : null}

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
      <div className="page-stack">
        <section className="insight-grid">
          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Branding</span>
                <h3>Marca, login y lenguaje visual operativo</h3>
              </div>
              <Brush size={18} />
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

            <p className="section-lead">{brandingDraft.surfaceStyle}</p>
          </article>

          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Previews</span>
                <h3>Login, tipografía y loader</h3>
              </div>
              <BadgeCheck size={18} />
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
                        ? 'Copia + formulario'
                        : 'Control center'}
                  </strong>
                  <p>
                    {variant === 'Minimal'
                      ? 'Acceso directo con una sola columna.'
                      : variant === 'Split'
                        ? 'Presentación editorial con panel lateral.'
                        : 'Estética técnica con sensación de consola.'}
                  </p>
                </button>
              ))}
            </div>

            <div className="admin-font-preview">
              <div>
                <span>Tipografía de títulos</span>
                <strong style={{ fontFamily: `"${brandingDraft.displayFontFamily}", sans-serif` }}>
                  {brandingDraft.displayFontFamily}
                </strong>
              </div>
              <div>
                <span>Tipografía de interfaz</span>
                <strong style={{ fontFamily: `"${brandingDraft.bodyFontFamily}", sans-serif` }}>
                  {brandingDraft.bodyFontFamily}
                </strong>
              </div>
              <div>
                <span>Loader</span>
                <strong>{brandingDraft.loaderLabel}</strong>
                <p>{brandingDraft.loaderMessage}</p>
              </div>
            </div>
          </article>
        </section>

        <form className="surface section-card" onSubmit={handleSaveBranding}>
          <div className="section-heading">
            <div>
              <span className="eyebrow">Identidad visual</span>
              <h3>Configurar marca completa</h3>
            </div>
            <ShieldCheck size={18} />
          </div>

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
          </div>

          <div className="form-grid">
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
          </div>

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

            <label className="field">
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

            <label className="field">
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

          <label className="field">
            <span>Dirección visual</span>
            <div className="field__control">
              <textarea
                rows={4}
                value={brandingDraft.surfaceStyle}
                onChange={(event) =>
                  setBrandingDraft((current) =>
                    current ? { ...current, surfaceStyle: event.target.value } : current,
                  )
                }
              />
            </div>
          </label>

          {settingsError ? <p className="form-error">{settingsError}</p> : null}

          <div className="action-row">
            <button type="submit" className="cta-button" disabled={isSavingBranding}>
              <span>{isSavingBranding ? 'Guardando…' : 'Guardar branding'}</span>
            </button>
          </div>
        </form>
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
      {adminError ? <p className="form-error">{adminError}</p> : null}

      {activeTab === null ? (
        <>
          <section className="surface section-card section-card--compact">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Módulo Administración</span>
                <h3>Centro de gobierno técnico y funcional de la plataforma</h3>
              </div>
              <ShieldCheck size={18} />
            </div>

            <p className="section-lead">
              Desde aquí administras usuarios, estructuras institucionales, branding, integraciones,
              servicios conectados, logs y auditoría, sin mezclar esta capa con la operación diaria de
              producción de cursos.
            </p>

            <div className="admin-kpi-grid">
              <div className="admin-kpi">
                <span>Usuarios activos</span>
                <strong>{activeUsers}</strong>
                <p>Con acceso vigente a la plataforma.</p>
              </div>
              <div className="admin-kpi">
                <span>Integraciones activas</span>
                <strong>{activeIntegrations}</strong>
                <p>Conectores operando o listos para uso.</p>
              </div>
              <div className="admin-kpi">
                <span>Errores visibles</span>
                <strong>{degradedIntegrations === 0 ? 'Sin alertas' : degradedIntegrations}</strong>
                <p>
                  {degradedIntegrations === 0
                    ? 'No hay servicios degradados en este momento.'
                    : 'Servicios degradados o con falla reciente.'}
                </p>
              </div>
              <div className="admin-kpi">
                <span>Última actividad</span>
                <strong>
                  {adminData.audit[0]?.createdAt
                    ? formatLongDate(adminData.audit[0].createdAt.slice(0, 10))
                    : 'Sin registros'}
                </strong>
                <p>Último cambio crítico auditado.</p>
              </div>
            </div>
          </section>

          {renderGovernmentRoutes()}
        </>
      ) : null}

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
