import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone: 'coral' | 'sage' | 'ocean' | 'gold' | 'ink';
}

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: MetricCardProps) {
  return (
    <article className={`metric-card metric-card--${tone}`}>
      <div className="metric-card__icon">
        <Icon size={18} />
      </div>
      <div className="metric-card__copy">
        <span>{label}</span>
        <strong>{value}</strong>
        <p>{detail}</p>
      </div>
    </article>
  );
}
