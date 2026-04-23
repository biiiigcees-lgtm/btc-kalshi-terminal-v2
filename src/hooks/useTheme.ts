'use client';

import { useState, useEffect } from 'react';

type Theme = 'dark' | 'light';

const THEME_KEY = 'btc-terminal-theme';

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>('dark');

  useEffect(() => {
    // Load from localStorage on mount
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    if (saved && (saved === 'dark' || saved === 'light')) {
      setThemeState(saved);
    }
  }, []);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    localStorage.setItem(THEME_KEY, newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return { theme, setTheme, toggleTheme };
}
