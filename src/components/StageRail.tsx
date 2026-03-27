import type { StageCheckpoint } from '../types.js';

interface StageRailProps {
  items: StageCheckpoint[];
}

export function StageRail({ items }: StageRailProps) {
  return (
    <div className="stage-rail">
      {items.map((item) => (
        <article
          key={item.id}
          className={`stage-pill stage-pill--${item.status}`}
          aria-label={`${item.label} · ${item.owner}`}
        >
          <span className="stage-pill__dot" />
          <div>
            <strong>{item.label}</strong>
            <span>{item.owner}</span>
          </div>
        </article>
      ))}
    </div>
  );
}
