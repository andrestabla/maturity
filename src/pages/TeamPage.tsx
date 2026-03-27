import { ArrowRightLeft, ShieldCheck, UsersRound } from 'lucide-react';
import type { AppData, Role } from '../types.js';
import { getVisibleCourses } from '../utils/domain.js';

interface TeamPageProps {
  role: Role;
  appData: AppData;
}

export function TeamPage({ role, appData }: TeamPageProps) {
  const visibleCourses = getVisibleCourses(appData, role);

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
            {appData.roleProfiles.map((profile) => {
              const count = visibleCourses.filter((course) =>
                course.team.some((member) => member.role === profile.role),
              ).length;

              return (
                <div key={profile.role} className="coverage-list__item">
                  <div>
                    <strong>{profile.role}</strong>
                    <p>{profile.focus}</p>
                  </div>
                  <span>{count} cursos</span>
                </div>
              );
            })}
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
