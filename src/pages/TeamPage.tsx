import { ArrowRightLeft, KeyRound, ShieldCheck, Trash2, UserPlus, UsersRound } from 'lucide-react';
import { useMemo, useState } from 'react';
import type {
  AppData,
  AuthUser,
  PasswordChangeInput,
  Role,
  UserMutationInput,
  UserUpdateInput,
} from '../types.js';
import { getVisibleCourses } from '../utils/domain.js';
import { canManageUsers } from '../utils/permissions.js';

interface TeamPageProps {
  role: Role;
  user: AuthUser;
  appData: AppData;
  refreshAppData: () => void;
  refreshSession: () => Promise<void>;
}

function buildUserForm(): UserMutationInput {
  return {
    name: '',
    email: '',
    role: 'Coordinador',
    password: '',
  };
}

function buildPasswordForm(): PasswordChangeInput {
  return {
    currentPassword: '',
    nextPassword: '',
  };
}

export function TeamPage({
  role,
  user,
  appData,
  refreshAppData,
  refreshSession,
}: TeamPageProps) {
  const visibleCourses = getVisibleCourses(appData, role);
  const isAdmin = canManageUsers(user.role);
  const [userForm, setUserForm] = useState<UserMutationInput>(() => buildUserForm());
  const [passwordForm, setPasswordForm] = useState<PasswordChangeInput>(() => buildPasswordForm());
  const [userError, setUserError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<UserUpdateInput | null>(null);
  const [isSavingUser, setIsSavingUser] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const roleCoverage = useMemo(
    () =>
      appData.roleProfiles.map((profile) => ({
        profile,
        count: visibleCourses.filter((course) =>
          course.team.some((member) => member.role === profile.role),
        ).length,
      })),
    [appData.roleProfiles, visibleCourses],
  );

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

      refreshAppData();
      setUserForm(buildUserForm());
    } catch (error) {
      setUserError(error instanceof Error ? error.message : 'No fue posible crear el usuario.');
    } finally {
      setIsCreatingUser(false);
    }
  }

  function startEditing(target: AuthUser) {
    setEditingUserId(target.id);
    setEditingDraft({
      id: target.id,
      name: target.name,
      email: target.email,
      role: target.role,
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

      refreshAppData();
      setEditingDraft(null);
      setEditingUserId(null);

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
    } catch (error) {
      setPasswordError(
        error instanceof Error ? error.message : 'No fue posible actualizar la contraseña.',
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Gobierno</span>
            <h3>Roles, permisos y relevo del flujo</h3>
          </div>
          <ShieldCheck size={18} />
        </div>

        <p className="section-lead">
          Maturity se apoya en una cadena de trabajo clara: cada rol entra con un objetivo distinto y deja evidencia
          para el siguiente.
        </p>

        <div className="handoff-flow">
          {appData.stages.map((stage) => (
            <div key={stage.id} className={`handoff-step handoff-step--${stage.tone}`}>
              <strong>{stage.name}</strong>
              <span>{stage.owner}</span>
              <p>{stage.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="insight-grid">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Cobertura</span>
              <h3>Presencia de roles en el portafolio</h3>
            </div>
            <UsersRound size={18} />
          </div>

          <div className="coverage-list">
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
        </article>

        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Regla central</span>
              <h3>Cómo se transfiere el trabajo</h3>
            </div>
            <ArrowRightLeft size={18} />
          </div>

          <div className="checklist">
            <div className="checklist__item">
              <strong>Consultar</strong>
              <p>Permite visibilidad operativa del módulo o del recurso dentro del alcance del rol.</p>
            </div>
            <div className="checklist__item">
              <strong>Editar</strong>
              <p>Habilita ajustes dentro de la etapa correspondiente sin romper la trazabilidad del curso.</p>
            </div>
            <div className="checklist__item">
              <strong>Aprobar o devolver</strong>
              <p>Marca puntos de control reales del flujo: pedagogía, multimedia, LMS o QA final.</p>
            </div>
            <div className="checklist__item">
              <strong>Cerrar y administrar</strong>
              <p>Se reserva a gobierno o coordinación según el momento y el módulo del sistema.</p>
            </div>
          </div>
        </article>
      </section>

      <section className="insight-grid">
        <article className="surface section-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Directorio</span>
              <h3>Equipo activo en plataforma</h3>
            </div>
            <UsersRound size={18} />
          </div>

          <div className="user-grid">
            {appData.users.map((member) => (
              <article key={member.id} className="user-card">
                <div className="user-card__top">
                  <div className="avatar-pill">{member.name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
                  <div>
                    <strong>{member.name}</strong>
                    <p>{member.email}</p>
                  </div>
                </div>

                <span className="badge badge--outline">{member.role}</span>

                {isAdmin ? (
                  editingUserId === member.id && editingDraft ? (
                    <div className="user-editor">
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

                      <label className="field">
                        <span>Rol</span>
                        <div className="field__control">
                          <select
                            value={editingDraft.role}
                            onChange={(event) =>
                              setEditingDraft((current) =>
                                current
                                  ? { ...current, role: event.target.value as Role }
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

                      <div className="action-row">
                        <button
                          type="button"
                          className="ghost-button"
                          onClick={() => void handleUpdateUser()}
                          disabled={isSavingUser}
                        >
                          <span>{isSavingUser ? 'Guardando…' : 'Guardar usuario'}</span>
                        </button>
                        <button
                          type="button"
                          className="filter-chip"
                          onClick={() => {
                            setEditingUserId(null);
                            setEditingDraft(null);
                          }}
                        >
                          <span>Cancelar</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="action-row">
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => startEditing(member)}
                      >
                        <span>Editar</span>
                      </button>

                      {member.id !== user.id ? (
                        <button
                          type="button"
                          className="danger-button danger-button--ghost"
                          onClick={() => void handleDeleteUser(member.id, member.name)}
                        >
                          <Trash2 size={16} />
                          <span>Eliminar</span>
                        </button>
                      ) : null}
                    </div>
                  )
                ) : null}
              </article>
            ))}
          </div>

          {userError ? <p className="form-error">{userError}</p> : null}
        </article>

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
                {user.name} está operando como <strong>{user.role}</strong> con acceso persistente
                protegido por cookie `httpOnly`.
              </p>
            </div>
          </div>

          <form className="editor-card" onSubmit={handlePasswordChange}>
            <div className="editor-card__header">
              <div>
                <span className="eyebrow">Contraseña</span>
                <h3>Cambiar contraseña</h3>
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

          {isAdmin ? (
            <form className="editor-card" onSubmit={handleCreateUser}>
              <div className="editor-card__header">
                <div>
                  <span className="eyebrow">Administración</span>
                  <h3>Crear nuevo usuario</h3>
                </div>
                <UserPlus size={18} />
              </div>

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
                  <span>Rol</span>
                  <div className="field__control">
                    <select
                      value={userForm.role}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          role: event.target.value as Role,
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
                  <span>Contraseña temporal</span>
                  <div className="field__control">
                    <input
                      type="password"
                      value={userForm.password}
                      onChange={(event) =>
                        setUserForm((current) => ({ ...current, password: event.target.value }))
                      }
                      minLength={10}
                      required
                    />
                  </div>
                </label>
              </div>

              <div className="action-row">
                <button type="submit" className="cta-button" disabled={isCreatingUser}>
                  <span>{isCreatingUser ? 'Creando…' : 'Crear usuario'}</span>
                </button>
              </div>
            </form>
          ) : null}
        </article>
      </section>

      <section className="profile-grid">
        {appData.roleProfiles.map((profile) => (
          <article key={profile.role} className="surface role-card">
            <span className="eyebrow">{profile.role}</span>
            <h3>{profile.overview}</h3>
            <p>{profile.focus}</p>

            <div className="role-card__modules">
              {profile.modules.map((module) => (
                <div key={module.name} className="role-module">
                  <strong>{module.name}</strong>
                  <span>{module.permissions}</span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
