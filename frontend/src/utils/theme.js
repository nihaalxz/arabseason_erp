/**
 * Global Unified Theme Utility for Arab Season ERP
 * Synchronizes dark/light mode seamlessly across ERP Operations, Accounting, and Cashbook.
 */

export const getIsDarkMode = () => {
  if (typeof window === 'undefined') return false;
  try {
    const cbDark = localStorage.getItem('cashbook_dark_mode');
    const appDark = localStorage.getItem('app_dark_mode');
    if (cbDark !== null) return cbDark === 'true';
    if (appDark !== null) return appDark === 'true';
    return document.documentElement.classList.contains('cb-dark-bw') ||
           document.documentElement.getAttribute('data-theme') === 'dark';
  } catch (e) {
    return false;
  }
};

export const applyTheme = (isDark) => {
  if (typeof window === 'undefined') return;

  const dark = Boolean(isDark);
  const themeStr = dark ? 'dark' : 'light';

  try {
    localStorage.setItem('cashbook_dark_mode', String(dark));
    localStorage.setItem('app_dark_mode', String(dark));
  } catch (e) {}

  if (document.documentElement) {
    document.documentElement.setAttribute('data-theme', themeStr);
    document.documentElement.classList.toggle('cb-dark-bw', dark);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = themeStr;
  }

  if (document.body) {
    document.body.setAttribute('data-theme', themeStr);
    document.body.classList.toggle('cb-dark-bw', dark);
    document.body.classList.toggle('dark', dark);
    document.body.style.colorScheme = themeStr;
  }

  // Notify all mounted components and listeners
  window.dispatchEvent(new CustomEvent('app:theme-change', { detail: { isDarkMode: dark } }));
};

export const toggleTheme = () => {
  const current = getIsDarkMode();
  const next = !current;
  applyTheme(next);
  return next;
};

