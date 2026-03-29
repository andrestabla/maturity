import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  KeyRound,
  Mail,
  MapPin,
  MoonStar,
  Phone,
  ShieldCheck,
  SunMedium,
  Trash2,
  UserRound,
  Waypoints,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useSystemDialog } from '../components/SystemDialogProvider.js';
import type { ThemeMode } from '../hooks/useTheme.js';
import type {
  AppData,
  AuthUser,
  PasswordChangeInput,
  Role,
  UserProfileUpdateInput,
  UserUpdateInput,
} from '../types.js';
import { formatDateTime } from '../utils/format.js';
import { canManageUsers } from '../utils/permissions.js';

interface UserProfilePageProps {
  viewer: AuthUser;
  appData: AppData;
  refreshAppData: () => void;
  refreshSession: () => Promise<void>;
  theme: ThemeMode;
  onThemeChange: (theme: ThemeMode) => void;
  activeRole: Role;
  availableRoles: Role[];
  onRoleChange: (role: Role) => void;
}

function buildProfileDraft(user: AuthUser): UserProfileUpdateInput {
  return {
    name: user.name,
    email: user.email,
    headline: user.headline ?? '',
    phone: user.phone ?? '',
    location: user.location ?? '',
    bio: user.bio ?? '',
  };
}

function buildAdminDraft(user: AuthUser): UserUpdateInput {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    secondaryRoles: [...(user.secondaryRoles ?? [])],
    status: user.status ?? 'Pendiente',
    headline: user.headline ?? '',
    phone: user.phone ?? '',
    location: user.location ?? '',
    bio: user.bio ?? '',
    institution: user.institution ?? '',
    faculty: user.faculty ?? '',
    program: user.program ?? '',
    scope: user.scope ?? '',
    statusReason: user.statusReason ?? '',
    password: '',
  };
}

function buildPasswordForm(): PasswordChangeInput {
  return {
    currentPassword: '',
    nextPassword: '',
  };
}

function deriveUserInitials(name: string) {
  return name
    .split(/\s+/)
    .map((item) => item[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

function getStatusBadge(status?: string) {
  if (status === 'Activo') {
    return 'badge badge--sage';
  }

  if (status === 'Suspendido') {
    return 'badge badge--coral';
  }

  if (status === 'Pendiente') {
    return 'badge badge--gold';
  }

  if (status === 'Inactivo') {
    return 'badge badge--ink';
  }

  return 'badge badge--outline';
}

function toggleSecondaryRole(draft: UserUpdateInput, role: Role) {
  const nextRoles = draft.secondaryRoles.includes(role)
    ? draft.secondaryRoles.filter((item) => item !== role)
    : [...draft.secondaryRoles, role];

  return {
    ...draft,
    secondaryRoles: nextRoles.filter((item) => item !== draft.role),
  };
}

export function UserProfilePage({
  viewer,
  appData,
  refreshAppData,
  refreshSession,
  theme,
  onThemeChange,
  activeRole,
  availableRoles,
  onRoleChange,
}: UserProfilePageProps) {
  const { userId } = useParams<{ userId?: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { showAlert, showConfirm } = useSystemDialog();
  const isAdmin = canManageUsers(viewer.role);
  const isAdminDirectoryView = location.pathname.startsWith('/admin/users/');
  const fallbackUser = viewer.id === userId || !userId ? viewer : null;
  const targetUser = useMemo(
    () => appData.users.find((item) => item.id === userId) ?? fallbackUser,
    [appData.users, fallbackUser, userId],
  );
  const isSelfProfile = !userId || targetUser?.id === viewer.id;
  const [profileDraft, setProfileDraft] = useState<UserProfileUpdateInput>(
    buildProfileDraft(targetUser ?? viewer),
  );
  const [adminDraft, setAdminDraft] = useState<UserUpdateInput | null>(
    targetUser ? buildAdminDraft(targetUser) : null,
  );
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [isAdminSaving, setIsAdminSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState<PasswordChangeInput>(buildPasswordForm());
  const [isRolePickerOpen, setIsRolePickerOpen] = useState(false);

  useEffect(() => {
    if (targetUser) {
      setProfileDraft(buildProfileDraft(targetUser));
      setAdminDraft(buildAdminDraft(targetUser));
      setIsRolePickerOpen(false);
    }
  }, [targetUser]);

  if (isAdminDirectoryView && !isAdmin) {
    return (
      <section className="surface empty-state">
        <strong>No tienes acceso a esta vista</strong>
        <p>Solo los administradores pueden consultar perfiles desde Gobierno.</p>
        <Link to="/profile" className="cta-button">
          <span>Ir a mi perfil</span>
        </Link>
      </section>
    );
  }

  if (!targetUser) {
    return (
      <section className="surface empty-state">
        <strong>Usuario no encontrado</strong>
        <p>La ficha solicitada no existe o ya no está disponible en el directorio actual.</p>
        <Link to={isAdminDirectoryView ? '/admin/users' : '/profile'} className="cta-button">
          <span>Volver</span>
        </Link>
      </section>
    );
  }

  const profileUser = targetUser;

  async function handleSaveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsProfileSaving(true);

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(profileDraft),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible actualizar tu perfil.');
      }

      refreshAppData();
      await refreshSession();
      await showAlert({
        title: 'Perfil actualizado',
        message: 'Tus datos básicos quedaron actualizados correctamente.',
        tone: 'success',
        confirmLabel: 'Continuar',
      });
    } catch (error) {
      await showAlert({
        title: 'No fue posible actualizar tu perfil',
        message: error instanceof Error ? error.message : 'No fue posible actualizar tu perfil.',
        tone: 'error',
        confirmLabel: 'Entendido',
      });
    } finally {
      setIsProfileSaving(false);
    }
  }

  async function handleSaveAdmin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adminDraft) {
      return;
    }

    setIsAdminSaving(true);

    try {
      const response = await fetch('/api/users', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify(adminDraft),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? 'No fue posible actualizar el usuario.');
      }

      refreshAppData();

      if (profileUser.id === viewer.id) {
        await refreshSession();
      }

      await showAlert({
        title: 'Usuario actualizado',
        message: 'La ficha del usuario quedó actualizada correctamente.',
        tone: 'success',
        confirmLabel: 'Continuar',
      });
    } catch (error) {
      await showAlert({
        title: 'No fue posible actualizar el usuario',
        message: error instanceof Error ? error.message : 'No fue posible actualizar el usuario.',
        tone: 'error',
        confirmLabel: 'Entendido',
      });
    } finally {
      setIsAdminSaving(false);
    }
  }

  async function handleDeleteUser() {
    if (!isAdminDirectoryView || profileUser.id === viewer.id) {
      return;
    }

    const confirmed = await showConfirm({
      title: `Eliminar a ${profileUser.name}`,
      message: 'Eliminarás este usuario del directorio activo. Esta acción no se puede deshacer.',
      tone: 'warning',
      confirmLabel: 'Eliminar usuario',
      cancelLabel: 'Cancelar',
    });

    if (!confirmed) {
      return;
    }

    const response = await fetch('/api/users', {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        id: profileUser.id,
      }),
    });

    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      await showAlert({
        title: 'No fue posible eliminar el usuario',
        message: payload.error ?? 'No fue posible eliminar el usuario.',
        tone: 'error',
        confirmLabel: 'Entendido',
      });
      return;
    }

    refreshAppData();
    await showAlert({
      title: 'Usuario eliminado',
      message: 'El usuario fue retirado correctamente del directorio.',
      tone: 'success',
      confirmLabel: 'Continuar',
    });
    navigate('/admin/users');
  }

  async function handlePasswordChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      await showAlert({
        title: 'Contraseña actualizada',
        message: 'Tu contraseña quedó actualizada correctamente.',
        tone: 'success',
        confirmLabel: 'Continuar',
      });
    } catch (error) {
      await showAlert({
        title: 'No fue posible actualizar la contraseña',
        message:
          error instanceof Error ? error.message : 'No fue posible actualizar la contraseña.',
        tone: 'error',
        confirmLabel: 'Entendido',
      });
    } finally {
      setIsChangingPassword(false);
    }
  }

  const initials = deriveUserInitials(profileUser.name);

  return (
    <div className="page-stack profile-page">
      <section className="surface section-card section-card--compact profile-hero">
        <div className="profile-hero__cover" aria-hidden />
        <div className="profile-hero__body">
          <div className="profile-hero__identity">
            <div className="profile-avatar">{initials}</div>
            <div>
              <span className="eyebrow">{isSelfProfile ? 'Mi perfil' : 'Ficha de usuario'}</span>
              <h3>{profileUser.name}</h3>
              <p>
                {profileUser.email} · {profileUser.role}
              </p>
              <div className="profile-meta-inline">
                <span className={getStatusBadge(profileUser.status)}>
                  {profileUser.status ?? 'Pendiente'}
                </span>
                {profileUser.headline ? (
                  <span className="badge badge--outline">{profileUser.headline}</span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="profile-hero__actions">
            {isAdminDirectoryView ? (
              <button type="button" className="ghost-button" onClick={() => navigate('/admin/users')}>
                <ArrowLeft size={16} />
                <span>Volver al directorio</span>
              </button>
            ) : null}
          </div>
        </div>

        <p className="section-lead">
          {profileUser.bio?.trim()
            ? profileUser.bio
            : isSelfProfile
              ? 'Actualiza tus datos básicos para que tu identidad operativa esté completa dentro de la plataforma.'
              : 'Este usuario todavía no ha registrado una descripción personal dentro de la plataforma.'}
        </p>
      </section>

      <div className="profile-layout">
        <section className="page-stack">
          <form className="surface section-card" onSubmit={isAdminDirectoryView ? handleSaveAdmin : handleSaveProfile}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">Perfil</span>
                <h3>Información personal</h3>
              </div>
              <UserRound size={18} />
            </div>

            <div className="form-grid">
              <label className="field">
                <span>Nombre</span>
                <div className="field__control">
                  <input
                    value={isAdminDirectoryView ? adminDraft?.name ?? '' : profileDraft.name}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (isAdminDirectoryView) {
                        setAdminDraft((current) => (current ? { ...current, name: value } : current));
                      } else {
                        setProfileDraft((current) => ({ ...current, name: value }));
                      }
                    }}
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Correo</span>
                <div className="field__control">
                  <input
                    type="email"
                    value={isAdminDirectoryView ? adminDraft?.email ?? '' : profileDraft.email}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (isAdminDirectoryView) {
                        setAdminDraft((current) => (current ? { ...current, email: value } : current));
                      } else {
                        setProfileDraft((current) => ({ ...current, email: value }));
                      }
                    }}
                    required
                  />
                </div>
              </label>

              <label className="field">
                <span>Titular profesional</span>
                <div className="field__control">
                  <input
                    value={isAdminDirectoryView ? adminDraft?.headline ?? '' : profileDraft.headline}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (isAdminDirectoryView) {
                        setAdminDraft((current) => (current ? { ...current, headline: value } : current));
                      } else {
                        setProfileDraft((current) => ({ ...current, headline: value }));
                      }
                    }}
                    placeholder="Ej. Coordinación académica, Diseño instruccional..."
                  />
                </div>
              </label>

              <label className="field">
                <span>Teléfono</span>
                <div className="field__control">
                  <input
                    value={isAdminDirectoryView ? adminDraft?.phone ?? '' : profileDraft.phone}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (isAdminDirectoryView) {
                        setAdminDraft((current) => (current ? { ...current, phone: value } : current));
                      } else {
                        setProfileDraft((current) => ({ ...current, phone: value }));
                      }
                    }}
                    placeholder="+57..."
                  />
                </div>
              </label>

              <label className="field field--full">
                <span>Ubicación</span>
                <div className="field__control">
                  <input
                    value={isAdminDirectoryView ? adminDraft?.location ?? '' : profileDraft.location}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (isAdminDirectoryView) {
                        setAdminDraft((current) => (current ? { ...current, location: value } : current));
                      } else {
                        setProfileDraft((current) => ({ ...current, location: value }));
                      }
                    }}
                    placeholder="Ciudad, país"
                  />
                </div>
              </label>

              <label className="field field--full">
                <span>Biografía breve</span>
                <div className="field__control field__control--textarea">
                  <textarea
                    rows={4}
                    value={isAdminDirectoryView ? adminDraft?.bio ?? '' : profileDraft.bio}
                    onChange={(event) => {
                      const value = event.target.value;
                      if (isAdminDirectoryView) {
                        setAdminDraft((current) => (current ? { ...current, bio: value } : current));
                      } else {
                        setProfileDraft((current) => ({ ...current, bio: value }));
                      }
                    }}
                    placeholder="Describe brevemente tu enfoque o tu función dentro de la operación."
                  />
                </div>
              </label>
            </div>

            <div className="action-row">
              <button
                type="submit"
                className="cta-button"
                disabled={isAdminDirectoryView ? isAdminSaving : isProfileSaving}
              >
                <span>
                  {isAdminDirectoryView
                    ? isAdminSaving
                      ? 'Guardando...'
                      : 'Guardar usuario'
                    : isProfileSaving
                      ? 'Guardando...'
                      : 'Guardar perfil'}
                </span>
              </button>
            </div>
          </form>

          {isAdminDirectoryView && adminDraft ? (
            <form className="surface section-card" onSubmit={handleSaveAdmin}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Gobierno</span>
                  <h3>Acceso, roles y alcance</h3>
                </div>
                <ShieldCheck size={18} />
              </div>

              <div className="form-grid">
                <label className="field">
                  <span>Rol principal</span>
                  <div className="field__control">
                    <select
                      value={adminDraft.role}
                      onChange={(event) =>
                        setAdminDraft((current) =>
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
                      value={adminDraft.status}
                      onChange={(event) =>
                        setAdminDraft((current) =>
                          current ? { ...current, status: event.target.value as UserUpdateInput['status'] } : current,
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

                <label className="field">
                  <span>Institución</span>
                  <div className="field__control">
                    <input
                      value={adminDraft.institution}
                      onChange={(event) =>
                        setAdminDraft((current) =>
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
                      value={adminDraft.faculty}
                      onChange={(event) =>
                        setAdminDraft((current) =>
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
                      value={adminDraft.program}
                      onChange={(event) =>
                        setAdminDraft((current) =>
                          current ? { ...current, program: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>

                <label className="field">
                  <span>Alcance</span>
                  <div className="field__control">
                    <input
                      value={adminDraft.scope}
                      onChange={(event) =>
                        setAdminDraft((current) =>
                          current ? { ...current, scope: event.target.value } : current,
                        )
                      }
                    />
                  </div>
                </label>
              </div>

              <label className="field field--full">
                <span>Roles complementarios</span>
                <div className="tag-token-list">
                  {adminDraft.secondaryRoles.length === 0 ? (
                    <span className="tag-token tag-token--muted">Sin roles complementarios</span>
                  ) : (
                    adminDraft.secondaryRoles.map((item) => (
                      <span key={item} className="tag-token">
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
                    <Waypoints size={16} />
                    <span>{isRolePickerOpen ? 'Ocultar selector' : 'Editar roles complementarios'}</span>
                  </button>
                </div>

                {isRolePickerOpen ? (
                  <div className="role-picker-panel">
                    {appData.roles
                      .filter((item) => item !== adminDraft.role)
                      .map((item) => (
                        <button
                          key={item}
                          type="button"
                          className={
                            adminDraft.secondaryRoles.includes(item)
                              ? 'filter-chip filter-chip--active'
                              : 'filter-chip'
                          }
                          onClick={() =>
                            setAdminDraft((current) =>
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

              <label className="field field--full">
                <span>Motivo de estado</span>
                <div className="field__control field__control--textarea">
                  <textarea
                    rows={3}
                    value={adminDraft.statusReason}
                    onChange={(event) =>
                      setAdminDraft((current) =>
                        current ? { ...current, statusReason: event.target.value } : current,
                      )
                    }
                    placeholder="Describe el motivo si el usuario no queda activo."
                  />
                </div>
              </label>

              <label className="field field--full">
                <span>Nueva contraseña</span>
                <div className="field__control">
                  <input
                    type="password"
                    value={adminDraft.password ?? ''}
                    onChange={(event) =>
                      setAdminDraft((current) =>
                        current ? { ...current, password: event.target.value } : current,
                      )
                    }
                    placeholder="Opcional"
                  />
                </div>
              </label>

              <div className="action-row">
                <button type="submit" className="cta-button" disabled={isAdminSaving}>
                  <span>{isAdminSaving ? 'Guardando...' : 'Guardar gobierno'}</span>
                </button>
                {profileUser.id !== viewer.id ? (
                  <button
                    type="button"
                    className="danger-button danger-button--ghost"
                    onClick={() => void handleDeleteUser()}
                  >
                    <Trash2 size={16} />
                    <span>Eliminar usuario</span>
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <form className="surface section-card" onSubmit={handlePasswordChange}>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Seguridad</span>
                  <h3>Contraseña y acceso</h3>
                </div>
                <KeyRound size={18} />
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

              <div className="action-row">
                <button type="submit" className="cta-button" disabled={isChangingPassword}>
                  <span>{isChangingPassword ? 'Actualizando...' : 'Actualizar contraseña'}</span>
                </button>
              </div>
            </form>
          )}
        </section>

        <aside className="page-stack">
          {isSelfProfile && !isAdminDirectoryView ? (
            <article className="surface section-card">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Preferencias</span>
                  <h3>Espacio de trabajo</h3>
                </div>
                <ShieldCheck size={18} />
              </div>

              <div className="checklist">
                <div className="checklist__item">
                  <strong>Apariencia</strong>
                  <p>Elige cómo quieres ver la plataforma en este dispositivo.</p>
                  <div className="preference-chip-row">
                    <button
                      type="button"
                      className={theme === 'light' ? 'filter-chip filter-chip--active' : 'filter-chip'}
                      onClick={() => onThemeChange('light')}
                    >
                      <SunMedium size={16} />
                      <span>Modo claro</span>
                    </button>
                    <button
                      type="button"
                      className={theme === 'dark' ? 'filter-chip filter-chip--active' : 'filter-chip'}
                      onClick={() => onThemeChange('dark')}
                    >
                      <MoonStar size={16} />
                      <span>Modo oscuro</span>
                    </button>
                  </div>
                </div>

                {availableRoles.length > 1 ? (
                  <div className="checklist__item">
                    <strong>Vista operativa</strong>
                    <p>Define con qué rol quieres recorrer la plataforma.</p>
                    <label className="field field--compact">
                      <span>Rol activo</span>
                      <div className="field__control">
                        <select
                          value={activeRole}
                          onChange={(event) => onRoleChange(event.target.value as Role)}
                        >
                          {availableRoles.map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                      </div>
                    </label>
                  </div>
                ) : null}
              </div>
            </article>
          ) : null}

          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Resumen</span>
                <h3>Datos de cuenta</h3>
              </div>
              <BadgeCheck size={18} />
            </div>

            <div className="checklist">
              <div className="checklist__item">
                <strong>Correo</strong>
                <p>
                  <Mail size={14} /> {profileUser.email}
                </p>
              </div>
              <div className="checklist__item">
                <strong>Ubicación</strong>
                <p>
                  <MapPin size={14} /> {profileUser.location || 'Sin ubicación registrada'}
                </p>
              </div>
              <div className="checklist__item">
                <strong>Teléfono</strong>
                <p>
                  <Phone size={14} /> {profileUser.phone || 'Sin teléfono registrado'}
                </p>
              </div>
            </div>
          </article>

          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Contexto</span>
                <h3>Marco institucional</h3>
              </div>
              <Building2 size={18} />
            </div>

            <div className="checklist">
              <div className="checklist__item">
                <strong>Institución</strong>
                <p>{profileUser.institution || 'Sin institución definida'}</p>
              </div>
              <div className="checklist__item">
                <strong>Facultad</strong>
                <p>{profileUser.faculty || 'Sin facultad definida'}</p>
              </div>
              <div className="checklist__item">
                <strong>Programa</strong>
                <p>{profileUser.program || 'Sin programa definido'}</p>
              </div>
              <div className="checklist__item">
                <strong>Alcance</strong>
                <p>{profileUser.scope || 'Global'}</p>
              </div>
            </div>
          </article>

          <article className="surface section-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Actividad</span>
                <h3>Trazabilidad básica</h3>
              </div>
              <ShieldCheck size={18} />
            </div>

            <div className="checklist">
              <div className="checklist__item">
                <strong>Creado</strong>
                <p>{profileUser.createdAt ? formatDateTime(profileUser.createdAt) : 'Sin registro'}</p>
              </div>
              <div className="checklist__item">
                <strong>Último acceso</strong>
                <p>{profileUser.lastAccessAt ? formatDateTime(profileUser.lastAccessAt) : 'Sin registro'}</p>
              </div>
              <div className="checklist__item">
                <strong>Estado</strong>
                <p>{profileUser.status ?? 'Pendiente'}</p>
              </div>
              <div className="checklist__item">
                <strong>Creado por</strong>
                <p>{profileUser.createdBy ?? 'Sistema'}</p>
              </div>
            </div>
          </article>
        </aside>
      </div>
    </div>
  );
}
