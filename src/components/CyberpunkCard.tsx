import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '@constants/index';

interface CyberpunkCardProps {
  children: React.ReactNode;
  variant?: 'default' | 'gradient' | 'glow' | 'outline';
  padding?: 'none' | 'small' | 'medium' | 'large';
  style?: ViewStyle;
  glowColor?: string;
  gradientColors?: string[];
}

const CyberpunkCard: React.FC<CyberpunkCardProps> = ({
  children,
  variant = 'default',
  padding = 'medium',
  style,
  glowColor = CYBERPUNK_COLORS.primary,
  gradientColors = [
    CYBERPUNK_COLORS.primary + '20',
    CYBERPUNK_COLORS.accent + '20'
  ],
}) => {
  const getPaddingStyles = () => {
    switch (padding) {
      case 'none':
        return { padding: 0 };
      case 'small':
        return { padding: 12 };
      case 'medium':
        return { padding: 16 };
      case 'large':
        return { padding: 24 };
      default:
        return { padding: 16 };
    }
  };

  const getVariantStyles = () => {
    const baseStyle = {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: CYBERPUNK_COLORS.border,
    };

    switch (variant) {
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 2,
          borderColor: CYBERPUNK_COLORS.primary,
        };
      case 'glow':
        return {
          ...baseStyle,
          backgroundColor: CYBERPUNK_COLORS.surface,
          shadowColor: glowColor,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 10,
          elevation: 10,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: CYBERPUNK_COLORS.surface,
        };
    }
  };

  const getGradientColors = (): readonly [string, string] => {
    if (variant === 'glow') {
      return [CYBERPUNK_COLORS.primary + '20', CYBERPUNK_COLORS.accent + '20'] as const;
    }
    return [CYBERPUNK_COLORS.surface, CYBERPUNK_COLORS.surface] as const;
  };

  const paddingStyles = getPaddingStyles();
  const variantStyles = getVariantStyles();

  if (variant === 'gradient') {
    return (
      <LinearGradient
        colors={getGradientColors()}
        style={[
          styles.card,
          variantStyles,
          paddingStyles,
          style,
        ]}
      >
        {children}
      </LinearGradient>
    );
  }

  return (
    <View
      style={[
        styles.card,
        variantStyles,
        paddingStyles,
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
  },
});

export default CyberpunkCard;
