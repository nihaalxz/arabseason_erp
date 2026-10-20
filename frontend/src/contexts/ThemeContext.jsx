import React, { createContext, useContext, useState, useEffect } from 'react';

export const THEME_PRESETS = [
  {
    id: 'zoho-books',
    name: 'Zoho Books Signature',
    tag: 'Accounting Standard',
    description: 'Authentic Zoho Books navy-blue palette — deep slate sidebar, cobalt blue accents, crisp accounting canvas.',
    palette: {
      primary: '#1366d9',
      primaryLight: '#ebf3fc',
      primaryHover: '#0f52b0',
      accent: '#1366d9',
      accentHover: '#0f52b0',
      bgMain: '#f3f4f7',
      bgSidebar: '#ffffff',
      bgHeader: '#0d1117',
      cardBg: '#ffffff',
      textMain: '#1e293b',
      textMuted: '#64748b',
      textLight: '#94a3b8',
      borderColor: '#e2e8f0',
      borderLight: '#f1f5f9',
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
    },
    defaultFontSize: 'standard',
    defaultCardArrangement: 'modern',
    swatches: ['#0d1117', '#ffffff', '#1366d9', '#f3f4f7'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise Midnight',
    tag: 'Corporate Standard',
    description: 'Clean, authoritative slate navy with high-trust royal blue accents.',
    palette: {
      primary: '#0f172a',
      primaryLight: '#1e293b',
      primaryHover: '#334155',
      accent: '#3b82f6',
      accentHover: '#2563eb',
      bgMain: '#f8fafc',
      bgSidebar: '#0f172a',
      bgHeader: '#ffffff',
      cardBg: '#ffffff',
      textMain: '#0f172a',
      textMuted: '#64748b',
      textLight: '#94a3b8',
      borderColor: '#e2e8f0',
      borderLight: '#f1f5f9',
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
    },
    defaultFontSize: 'standard', // 14px
    defaultCardArrangement: 'modern', // 8px radius
    swatches: ['#0f172a', '#3b82f6', '#f8fafc', '#ffffff'],
  },
  {
    id: 'emerald',
    name: 'Emerald Oasis',
    tag: 'Arabian Prestige',
    description: 'Rich deep emerald and warm gold accents reflecting regional elegance.',
    palette: {
      primary: '#064e3b',
      primaryLight: '#065f46',
      primaryHover: '#047857',
      accent: '#10b981',
      accentHover: '#059669',
      bgMain: '#f0fdf4',
      bgSidebar: '#064e3b',
      bgHeader: '#ffffff',
      cardBg: '#ffffff',
      textMain: '#064e3b',
      textMuted: '#374151',
      textLight: '#6b7280',
      borderColor: '#d1fae5',
      success: '#059669',
      danger: '#e11d48',
      warning: '#d97706',
    },
    defaultFontSize: 'relaxed', // 15px
    defaultCardArrangement: 'curved', // 14px radius
    swatches: ['#064e3b', '#10b981', '#f0fdf4', '#d97706'],
  },
  {
    id: 'obsidian',
    name: 'Obsidian Cyber',
    tag: 'Sleek Dark Mode',
    description: 'Deep onyx night palette with electric indigo highlights for low-light focus.',
    palette: {
      primary: '#030712',
      primaryLight: '#111827',
      primaryHover: '#1f2937',
      accent: '#6366f1',
      accentHover: '#4f46e5',
      bgMain: '#0b0f19',
      bgSidebar: '#070a12',
      bgHeader: '#111827',
      cardBg: '#151c2e',
      textMain: '#f3f4f6',
      textMuted: '#9ca3af',
      textLight: '#6b7280',
      borderColor: '#232f48',
      success: '#34d399',
      danger: '#f87171',
      warning: '#fbbf24',
    },
    defaultFontSize: 'compact', // 13px
    defaultCardArrangement: 'sharp', // 6px radius
    swatches: ['#030712', '#6366f1', '#0b0f19', '#151c2e'],
  },
  {
    id: 'amethyst',
    name: 'Royal Amethyst',
    tag: 'Executive Purple',
    description: 'Sophisticated imperial plum with luminous violet and soft lilac aura.',
    palette: {
      primary: '#3b0764',
      primaryLight: '#581c87',
      primaryHover: '#6b21a8',
      accent: '#8b5cf6',
      accentHover: '#7c3aed',
      bgMain: '#faf5ff',
      bgSidebar: '#3b0764',
      bgHeader: '#ffffff',
      cardBg: '#ffffff',
      textMain: '#2e1065',
      textMuted: '#6b7280',
      textLight: '#9ca3af',
      borderColor: '#f3e8ff',
      success: '#10b981',
      danger: '#ef4444',
      warning: '#f59e0b',
    },
    defaultFontSize: 'standard', // 14px
    defaultCardArrangement: 'floating', // 12px radius, floating shadow
    swatches: ['#3b0764', '#8b5cf6', '#faf5ff', '#ffffff'],
  },
  {
    id: 'amber',
    name: 'Warm Amber Sand',
    tag: 'Desert Bronze',
    description: 'Warm earthen bronze, golden amber highlights and generous readability.',
    palette: {
      primary: '#78350f',
      primaryLight: '#92400e',
      primaryHover: '#b45309',
      accent: '#f59e0b',
      accentHover: '#d97706',
      bgMain: '#fefce8',
      bgSidebar: '#451a03',
      bgHeader: '#ffffff',
      cardBg: '#ffffff',
      textMain: '#451a03',
      textMuted: '#78716c',
      textLight: '#a8a29e',
      borderColor: '#fef08a',
      success: '#16a34a',
      danger: '#dc2626',
      warning: '#d97706',
    },
    defaultFontSize: 'large', // 16px
    defaultCardArrangement: 'pill', // 16px radius
    swatches: ['#78350f', '#f59e0b', '#fefce8', '#ffffff'],
  },
  {
    id: 'nordic',
    name: 'Nordic Minimalist',
    tag: 'Ultra-Dense Frost',
    description: 'High-density architectural layout with charcoal, steel teal, and razor borders.',
    palette: {
      primary: '#18181b',
      primaryLight: '#27272a',
      primaryHover: '#3f3f46',
      accent: '#0d9488',
      accentHover: '#0f766e',
      bgMain: '#f4f4f5',
      bgSidebar: '#18181b',
      bgHeader: '#ffffff',
      cardBg: '#ffffff',
      textMain: '#18181b',
      textMuted: '#71717a',
      textLight: '#a1a1aa',
      borderColor: '#e4e4e7',
      success: '#059669',
      danger: '#e11d48',
      warning: '#d97706',
    },
    defaultFontSize: 'compact', // 12.5px
    defaultCardArrangement: 'sharp', // 4px radius
    swatches: ['#18181b', '#0d9488', '#f4f4f5', '#ffffff'],
  },
];

export const FONT_SIZE_OPTIONS = [
  { id: 'compact', label: 'Compact', size: '12.5px', scale: '0.89' },
  { id: 'standard', label: 'Standard', size: '14px', scale: '1.0' },
  { id: 'relaxed', label: 'Relaxed', size: '15px', scale: '1.07' },
  { id: 'large', label: 'Large', size: '16.5px', scale: '1.18' },
];

export const CARD_ARRANGEMENT_OPTIONS = [
  { id: 'sharp', label: 'Sharp Tech', radius: '4px', shadow: '0 1px 3px rgba(0,0,0,0.06)' },
  { id: 'modern', label: 'Modern Rounded', radius: '8px', shadow: '0 4px 6px -1px rgba(0,0,0,0.08)' },
  { id: 'curved', label: 'Curved Luxury', radius: '14px', shadow: '0 10px 15px -3px rgba(0,0,0,0.08)' },
  { id: 'floating', label: 'Floating 3D', radius: '12px', shadow: '0 12px 24px -4px rgba(0,0,0,0.12)' },
  { id: 'pill', label: 'Soft Pill', radius: '18px', shadow: '0 8px 16px -2px rgba(0,0,0,0.07)' },
];

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [activeThemeId, setActiveThemeId] = useState(() => {
    return localStorage.getItem('arabseason_theme_id') || 'zoho-books';
  });

  const [fontSize, setFontSize] = useState(() => {
    return localStorage.getItem('arabseason_theme_font_size') || 'standard';
  });

  const [cardArrangement, setCardArrangement] = useState(() => {
    return localStorage.getItem('arabseason_theme_card_arrangement') || 'modern';
  });

  const activeTheme = THEME_PRESETS.find(t => t.id === activeThemeId) || THEME_PRESETS[0];

  const applyThemeToDOM = (theme, font, cardStyle) => {
    const root = document.documentElement;
    const { palette } = theme;

    // Apply color CSS variables
    root.style.setProperty('--primary', palette.primary);
    root.style.setProperty('--primary-light', palette.primaryLight);
    root.style.setProperty('--primary-hover', palette.primaryHover);
    root.style.setProperty('--accent', palette.accent);
    root.style.setProperty('--accent-hover', palette.accentHover);
    root.style.setProperty('--bg-main', palette.bgMain);
    root.style.setProperty('--bg-sidebar', palette.bgSidebar);
    root.style.setProperty('--bg-header', palette.bgHeader);
    root.style.setProperty('--header-bg', palette.bgHeader);
    root.style.setProperty('--card-bg', palette.cardBg);
    root.style.setProperty('--text-main', palette.textMain);
    root.style.setProperty('--text-muted', palette.textMuted);
    root.style.setProperty('--text-light', palette.textLight);
    root.style.setProperty('--border-color', palette.borderColor);
    if (palette.borderLight) root.style.setProperty('--border-light', palette.borderLight);
    if (palette.success) root.style.setProperty('--success', palette.success);
    if (palette.danger) root.style.setProperty('--danger', palette.danger);
    if (palette.warning) root.style.setProperty('--warning', palette.warning);

    // Derive primary-shadow and primary-rgb from the primary hex
    const hex = palette.primary.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    root.style.setProperty('--primary-shadow', `rgba(${r},${g},${b},0.18)`);
    root.style.setProperty('--primary-rgb', `${r}, ${g}, ${b}`);
    root.style.setProperty('--primary-dark', palette.primaryHover);
    root.style.setProperty('--text-secondary', palette.textMuted);

    // Apply font size scale
    const fontObj = FONT_SIZE_OPTIONS.find(f => f.id === font) || FONT_SIZE_OPTIONS[1];
    root.style.fontSize = fontObj.size;
    root.setAttribute('data-font-size', font);

    // Apply card arrangement
    const cardObj = CARD_ARRANGEMENT_OPTIONS.find(c => c.id === cardStyle) || CARD_ARRANGEMENT_OPTIONS[1];
    root.style.setProperty('--radius-md', cardObj.radius);
    root.style.setProperty('--shadow-md', cardObj.shadow);
    root.setAttribute('data-theme-id', theme.id);
    root.setAttribute('data-card-arrangement', cardStyle);
  };

  useEffect(() => {
    applyThemeToDOM(activeTheme, fontSize, cardArrangement);
  }, [activeThemeId, fontSize, cardArrangement]);

  const selectTheme = (themeId) => {
    const target = THEME_PRESETS.find(t => t.id === themeId);
    if (!target) return;
    setActiveThemeId(themeId);
    setFontSize(target.defaultFontSize);
    setCardArrangement(target.defaultCardArrangement);

    localStorage.setItem('arabseason_theme_id', themeId);
    localStorage.setItem('arabseason_theme_font_size', target.defaultFontSize);
    localStorage.setItem('arabseason_theme_card_arrangement', target.defaultCardArrangement);
  };

  const updateFontSize = (newSize) => {
    setFontSize(newSize);
    localStorage.setItem('arabseason_theme_font_size', newSize);
  };

  const updateCardArrangement = (newArrangement) => {
    setCardArrangement(newArrangement);
    localStorage.setItem('arabseason_theme_card_arrangement', newArrangement);
  };

  const resetToDefault = () => {
    selectTheme('zoho-books');
  };

  const value = {
    themes: THEME_PRESETS,
    activeTheme,
    activeThemeId,
    fontSize,
    cardArrangement,
    fontOptions: FONT_SIZE_OPTIONS,
    cardOptions: CARD_ARRANGEMENT_OPTIONS,
    selectTheme,
    updateFontSize,
    updateCardArrangement,
    resetToDefault,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
