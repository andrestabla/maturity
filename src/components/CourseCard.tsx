import { ArrowUpRight, CalendarDays, CircleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Course } from '../types.js';
import { formatDate } from '../utils/format.js';

interface CourseCardProps {
  course: Course;
  stageName: string;
}

function statusClass(status: Course['status']) {
  switch (status) {
    case 'En ritmo':
      return 'badge badge--sage';
    case 'En revisión':
      return 'badge badge--gold';
    case 'Riesgo':
      return 'badge badge--ocean';
    case 'Bloqueado':
      return 'badge badge--coral';
    case 'Listo':
      return 'badge badge--ink';
    default:
      return 'badge';
  }
}

export function CourseCard({ course, stageName }: CourseCardProps) {
  return (
    <Link to={`/courses/${course.slug}`} className="course-card surface">
      <div className="course-card__top">
        <div>
          <span className="eyebrow">{course.code}</span>
          <h3>{course.title}</h3>
        </div>

        <ArrowUpRight size={18} />
      </div>

      <p className="course-card__summary">{course.summary}</p>

      <div className="course-card__meta">
        <span>{course.faculty}</span>
        <span>{course.credits} créditos</span>
        <span>{course.modality}</span>
      </div>

      <div className="course-card__badges">
        <span className={statusClass(course.status)}>{course.status}</span>
        <span className="badge badge--outline">{stageName}</span>
      </div>

      <div className="course-card__progress">
        <div className="progress-copy">
          <strong>Avance {course.progress}%</strong>
          <span>{course.nextMilestone}</span>
        </div>
        <div className="progress-bar">
          <span style={{ width: `${course.progress}%` }} />
        </div>
      </div>

      <div className="course-card__footer">
        <div className="course-card__date">
          <CalendarDays size={16} />
          <span>Actualizado {formatDate(course.updatedAt)}</span>
        </div>

        <div className="avatar-stack" aria-hidden="true">
          {course.team.slice(0, 3).map((member) => (
            <span key={member.id}>{member.initials}</span>
          ))}
          {course.team.length > 3 ? <span>+{course.team.length - 3}</span> : null}
        </div>
      </div>

      {course.status === 'Bloqueado' ? (
        <div className="inline-alert">
          <CircleAlert size={16} />
          <span>Hay un bloqueo abierto que impide el siguiente paso.</span>
        </div>
      ) : null}
    </Link>
  );
}
