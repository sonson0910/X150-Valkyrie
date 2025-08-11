import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { CYBERPUNK_COLORS } from '@constants/index';

interface CyberpunkButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const CyberpunkButton: React.FC<CyberpunkButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  icon,
  disabled = false,
  loading = false,
  style,
  textStyle,
}) => {
  const handlePress = async () => {
    if (disabled || loading) return;
    
    await Haptics.impactAsync(
      size === 'large' 
        ? Haptics.ImpactFeedbackStyle.Medium 
        : Haptics.ImpactFeedbackStyle.Light
    );
    
    onPress();
  };

  const getGradientColors = (): readonly [string, string] => {
    if (disabled) {
      return [CYBERPUNK_COLORS.border, CYBERPUNK_COLORS.border] as const;
    }
    
    switch (variant) {
      case 'primary':
        return [CYBERPUNK_COLORS.primary, CYBERPUNK_COLORS.accent] as const;
      case 'secondary':
        return [CYBERPUNK_COLORS.surface, CYBERPUNK_COLORS.border] as const;
      case 'outline':
        return [CYBERPUNK_COLORS.background, CYBERPUNK_COLORS.background] as const;
      case 'danger':
        return [CYBERPUNK_COLORS.error, '#ff6b6b'] as const;
      default:
        return [CYBERPUNK_COLORS.primary, CYBERPUNK_COLORS.accent] as const;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case 'primary':
      case 'danger':
        return CYBERPUNK_COLORS.background;
      case 'secondary':
      case 'outline':
        return CYBERPUNK_COLORS.text;
      default:
        return CYBERPUNK_COLORS.background;
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 8,
          paddingHorizontal: 16,
          fontSize: 14,
        };
      case 'medium':
        return {
          paddingVertical: 12,
          paddingHorizontal: 24,
          fontSize: 16,
        };
      case 'large':
        return {
          paddingVertical: 16,
          paddingHorizontal: 32,
          fontSize: 18,
        };
      default:
        return {
          paddingVertical: 12,
          paddingHorizontal: 24,
          fontSize: 16,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const isOutline = variant === 'outline';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isOutline && styles.outlineButton,
        variant === 'primary' && styles.primaryButton,
        disabled && styles.disabledButton,
        style,
      ]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={getGradientColors()}
        style={[
          styles.gradient,
          {
            paddingVertical: sizeStyles.paddingVertical,
            paddingHorizontal: sizeStyles.paddingHorizontal,
          },
          isOutline && styles.outlineGradient,
        ]}
      >
        {icon && (
          <Text style={[styles.icon, { fontSize: sizeStyles.fontSize + 2 }]}>
            {icon}
          </Text>
        )}
        <Text
          style={[
            styles.text,
            {
              fontSize: sizeStyles.fontSize,
              color: getTextColor(),
            },
            disabled && styles.disabledText,
            textStyle,
          ]}
        >
          {loading ? 'Loading...' : title}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 12,
    overflow: 'hidden',
  },
  primaryButton: {
    shadowColor: CYBERPUNK_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  outlineButton: {
    borderWidth: 2,
    borderColor: CYBERPUNK_COLORS.border,
  },
  disabledButton: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  gradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  outlineGradient: {
    backgroundColor: 'transparent',
  },
  icon: {
    marginRight: 8,
  },
  text: {
    fontWeight: 'bold',
    letterSpacing: 1,
    textAlign: 'center',
  },
  disabledText: {
    opacity: 0.7,
  },
});

export default CyberpunkButton;
