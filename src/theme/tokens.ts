export const palette = {
  background: '#0a0e27',
  surface: '#121737',
  surfaceAlt: '#1a1f3a',
  primary: '#00E5A8',
  primaryAlt: '#00BFA5',
  accent: '#6C63FF',
  accentAlt: '#7B5CFF',
  danger: '#FF5C7A',
  warning: '#FFB020',
  success: '#00E676',
  text: '#FFFFFF',
  textSecondary: '#B6B8D6',
  border: '#2B315B',
  glow: '#00E5A8',
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
    shadowOpacity: 0.35,
    shadowRadius: 18,
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


