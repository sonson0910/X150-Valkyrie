import React from 'react';
import { TouchableOpacity, Text, TouchableOpacityProps, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { tokens } from '../../theme/tokens';

type Props = TouchableOpacityProps & {
  title: string;
  colors?: string[];
  full?: boolean;
};

export const GradientButton: React.FC<Props> = ({ title, colors = [tokens.palette.primary, tokens.palette.accent], full = true, style, ...rest }) => {
  const wrap: ViewStyle = {
    borderRadius: tokens.radii.md,
    overflow: 'hidden',
  };
  const btn: ViewStyle = {
    paddingVertical: tokens.spacing.md,
    alignItems: 'center',
    width: full ? '100%' : undefined,
  };
  return (
    <TouchableOpacity activeOpacity={0.85} {...rest} style={style}>
      <LinearGradient colors={colors} style={wrap} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Text style={{ color: tokens.palette.background, fontWeight: '700', textAlign: 'center', paddingVertical: tokens.spacing.md, letterSpacing: 0.5 }}>{title}</Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};


