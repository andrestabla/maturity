import { MoonStar, SunMedium } from 'lucide-react';
import type { ThemeMode } from '../hooks/useTheme.js';

interface ThemeToggleProps {
  theme: ThemeMode;
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({ theme, onToggle, className }: ThemeToggleProps) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const label = nextTheme === 'light' ? 'Modo claro' : 'Modo oscuro';
  const Icon = nextTheme === 'light' ? SunMedium : MoonStar;

  return (
    <button
      type="button"
      className={className ? `theme-switch ${className}` : 'theme-switch'}
      onClick={onToggle}
      aria-label={`Activar ${label.toLowerCase()}`}
      title={`Activar ${label.toLowerCase()}`}
    >
      <Icon size={16} />
      <span className="theme-switch__label">{label}</span>
    </button>
  );
}
