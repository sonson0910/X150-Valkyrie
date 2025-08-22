import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle, TouchableOpacityProps } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '../../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

type Props = TouchableOpacityProps & {
  title: string;
  variant?: Variant;
  loading?: boolean;
  full?: boolean;
};

const variantColors: Record<Variant, string[]> = {
  primary: [tokens.palette.primary, tokens.palette.accent],
  secondary: [tokens.palette.accent, tokens.palette.accentAlt],
  ghost: [tokens.palette.surfaceAlt, tokens.palette.surfaceAlt],
  danger: [tokens.palette.danger, '#FF6B8A'],
};

export const AppButton: React.FC<Props> = ({ title, variant = 'primary', loading = false, full = false, style, disabled, ...rest }) => {
  const wrap: ViewStyle = {
    borderRadius: tokens.radii.xl,
    overflow: 'hidden',
    opacity: disabled ? 0.6 : 1,
  };
  const textColor = variant === 'ghost' ? tokens.palette.text : tokens.palette.background;
  return (
    <TouchableOpacity activeOpacity={0.85} disabled={disabled || loading} {...rest} style={style}>
      <LinearGradient colors={variantColors[variant]} style={wrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={{ color: textColor, fontWeight: '700', textAlign: 'center', paddingVertical: tokens.spacing.lg, letterSpacing: 0.5 }}>
          {loading ? '' : title}
        </Text>
        {loading && <ActivityIndicator color={textColor} style={{ position: 'absolute', alignSelf: 'center', top: '25%' }} />}
      </LinearGradient>
    </TouchableOpacity>
  );
};


