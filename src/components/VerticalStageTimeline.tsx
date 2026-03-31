import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TimelineStage {
  key: string;
  stageId: string | null;
  section: string;
  title: string;
  owner: string;
  status: string;
  summary: string;
  actionLabel: string;
}

interface VerticalStageTimelineProps {
  stages: TimelineStage[];
  currentStageId: string | null;
  courseSlug: string;
  badgeClass: (status: string) => string;
}

export function VerticalStageTimeline({
  stages,
  currentStageId,
  courseSlug,
  badgeClass,
}: VerticalStageTimelineProps) {
  return (
    <div className="vertical-timeline">
      {stages.map((stage, index) => {
        const isCurrentStage = stage.stageId ? currentStageId === stage.stageId : false;
        const isLast = index === stages.length - 1;

        return (
          <div key={stage.key} className="vertical-timeline__item">
            <div className="vertical-timeline__indicator">
              <div
                className={`vertical-timeline__dot ${
                  isCurrentStage ? 'vertical-timeline__dot--active' : ''
                }`}
              />
              {!isLast && <div className="vertical-timeline__connector" />}
            </div>

            <div className="vertical-timeline__content">
              <Link
                to={stage.section === 'summary' ? `/courses/${courseSlug}` : `/courses/${courseSlug}/${stage.section}`}
                className={`surface-muted timeline-stage-card ${
                  isCurrentStage ? 'timeline-stage-card--active' : ''
                }`}
              >
                <div className="timeline-stage-card__header">
                  <div>
                    <span className="eyebrow">{stage.owner}</span>
                    <h4>{stage.title}</h4>
                    <p className="timeline-stage-card__summary">{stage.summary}</p>
                  </div>
                  <div className="timeline-stage-card__meta">
                    <span className={badgeClass(stage.status)}>{stage.status}</span>
                    <div className="timeline-stage-card__action">
                      <ArrowUpRight size={16} />
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
