import React from 'react';
import { View, ViewProps } from 'react-native';
import { tokens } from '../../theme/tokens';

type Props = ViewProps & {
  variant?: 'solid' | 'outline';
  glow?: boolean;
};

export const Card: React.FC<Props> = ({ variant = 'solid', glow = false, style, children, ...rest }) => {
  const base = {
    backgroundColor: tokens.palette.surface,
    borderRadius: tokens.radii.lg,
    borderWidth: variant === 'outline' ? 1 : 0,
    borderColor: tokens.palette.border,
    padding: tokens.spacing.lg,
  } as const;

  return (
    <View style={[base, glow ? tokens.shadows.glowPrimary : tokens.shadows.card, style]} {...rest}>
      {children}
    </View>
  );
};


