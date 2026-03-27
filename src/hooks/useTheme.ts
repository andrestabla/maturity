import { startTransition, useLayoutEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

const THEME_STORAGE_KEY = 'maturity-theme';

function readStoredTheme(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const storedValue = window.localStorage.getItem(THEME_STORAGE_KEY);
  return storedValue === 'light' ? 'light' : 'dark';
}

function applyTheme(theme: ThemeMode) {
  if (typeof document === 'undefined') {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setTheme] = useState<ThemeMode>(() => readStoredTheme());

  useLayoutEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  function toggleTheme() {
    startTransition(() => {
      setTheme((current) => (current === 'dark' ? 'light' : 'dark'));
    });
  }

  return {
    theme,
    setTheme,
    toggleTheme,
  };
}
