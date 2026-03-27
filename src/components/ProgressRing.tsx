interface ProgressRingProps {
  value: number;
  label: string;
  detail: string;
}

export function ProgressRing({ value, label, detail }: ProgressRingProps) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (value / 100) * circumference;

  return (
    <div className="progress-ring">
      <svg viewBox="0 0 120 120" role="img" aria-label={`${label}: ${value}%`}>
        <circle className="progress-ring__track" cx="60" cy="60" r={radius} />
        <circle
          className="progress-ring__value"
          cx="60"
          cy="60"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className="progress-ring__copy">
        <span>{label}</span>
        <strong>{value}%</strong>
        <p>{detail}</p>
      </div>
    </div>
  );
}
