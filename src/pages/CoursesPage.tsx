import { useState } from 'react';
import { FolderKanban, LayoutGrid, Rows3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { CourseCard } from '../components/CourseCard';
import { stages } from '../data/mockData';
import type { CourseStatus, Role } from '../types';
import { getStageName, getVisibleCourses } from '../utils/domain';

interface CoursesPageProps {
  role: Role;
}

type ViewMode = 'portfolio' | 'pipeline';
type FilterMode = 'Todos' | CourseStatus;

const filters: FilterMode[] = ['Todos', 'En ritmo', 'En revisión', 'Riesgo', 'Bloqueado', 'Listo'];

export function CoursesPage({ role }: CoursesPageProps) {
  const [view, setView] = useState<ViewMode>('portfolio');
  const [filter, setFilter] = useState<FilterMode>('Todos');

  const visibleCourses = getVisibleCourses(role);
  const filteredCourses =
    filter === 'Todos'
      ? visibleCourses
      : visibleCourses.filter((course) => course.status === filter);

  return (
    <div className="page-stack">
      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Portafolio</span>
            <h3>Cursos y proyectos activos</h3>
          </div>
          <FolderKanban size={18} />
        </div>

        <p className="section-lead">
          Vista pensada para operar el flujo de producción completo con filtros rápidos por estado y lectura por etapa.
        </p>

        <div className="toolbar">
          <div className="segmented-control">
            <button
              type="button"
              className={view === 'portfolio' ? 'segmented-control__button is-active' : 'segmented-control__button'}
              onClick={() => setView('portfolio')}
            >
              <LayoutGrid size={16} />
              <span>Portfolio</span>
            </button>
            <button
              type="button"
              className={view === 'pipeline' ? 'segmented-control__button is-active' : 'segmented-control__button'}
              onClick={() => setView('pipeline')}
            >
              <Rows3 size={16} />
              <span>Pipeline</span>
            </button>
          </div>

          <div className="chip-row">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'filter-chip filter-chip--active' : 'filter-chip'}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </section>

      {view === 'portfolio' ? (
        <section className="courses-grid">
          {filteredCourses.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </section>
      ) : (
        <section className="pipeline-grid">
          {stages.map((stage) => {
            const items = filteredCourses.filter((course) => course.stageId === stage.id);

            return (
              <article key={stage.id} className="pipeline-column surface">
                <div className="pipeline-column__header">
                  <div>
                    <span className="eyebrow">{stage.owner}</span>
                    <h3>{stage.name}</h3>
                  </div>
                  <span className={`badge badge--${stage.tone}`}>{items.length}</span>
                </div>

                <p className="pipeline-column__copy">{stage.description}</p>

                <div className="pipeline-column__list">
                  {items.length === 0 ? (
                    <div className="empty-state">
                      <strong>Sin cursos en esta etapa</strong>
                      <p>Cuando el flujo alcance este punto aparecerá aquí.</p>
                    </div>
                  ) : (
                    items.map((course) => (
                      <Link key={course.id} to={`/courses/${course.slug}`} className="pipeline-item">
                        <div>
                          <strong>{course.title}</strong>
                          <p>{course.status}</p>
                        </div>
                        <span>{course.progress}%</span>
                      </Link>
                    ))
                  )}
                </div>
              </article>
            );
          })}
        </section>
      )}

      <section className="surface section-card section-card--compact">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Lectura rápida</span>
            <h3>Cómo se ve hoy el flujo</h3>
          </div>
        </div>

        <div className="flow-glance">
          {filteredCourses.map((course) => (
            <div key={course.id} className="flow-glance__item">
              <strong>{course.title}</strong>
              <span>{getStageName(course.stageId)}</span>
              <p>{course.nextMilestone}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
