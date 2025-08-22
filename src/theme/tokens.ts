export const palette = {
  background: '#050812',
  surface: '#0b0f2a',
  surfaceAlt: '#0a1030',
  primary: '#7B5CFF',
  primaryAlt: '#5A3BFF',
  accent: '#00E5FF',
  accentAlt: '#00BCD4',
  neonPink: '#FF2AAD',
  neonCyan: '#00FFF0',
  neonGreen: '#00FF88',
  danger: '#FF5C7A',
  warning: '#FFB020',
  success: '#00E676',
  text: '#E6E9FF',
  textSecondary: '#A1A6D3',
  border: '#1B2250',
  glow: '#7B5CFF',
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
};

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  glowPrimary: {
    shadowColor: palette.primary,
    shadowOpacity: 0.55,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
};

export const typography = {
  fontFamily: 'Inter_500',
  h1: { fontSize: 28, fontWeight: '700', letterSpacing: 0.2 },
  h2: { fontSize: 22, fontWeight: '700', letterSpacing: 0.2 },
  h3: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '500' },
  body2: { fontSize: 14, fontWeight: '500' },
  caption: { fontSize: 12, fontWeight: '500' },
};

export const tokens = {
  palette,
  spacing,
  radii,
  shadows,
  typography,
};


