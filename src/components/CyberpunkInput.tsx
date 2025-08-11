import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextInputProps,
} from 'react-native';
import { CYBERPUNK_COLORS } from '@constants/index';

interface CyberpunkInputProps extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: string;
  rightIcon?: string;
  onRightIconPress?: () => void;
  variant?: 'default' | 'outline' | 'filled';
  size?: 'small' | 'medium' | 'large';
  containerStyle?: ViewStyle;
  showPasswordToggle?: boolean;
}

const CyberpunkInput: React.FC<CyberpunkInputProps> = ({
  label,
  error,
  hint,
  leftIcon,
  rightIcon,
  onRightIconPress,
  variant = 'default',
  size = 'medium',
  containerStyle,
  showPasswordToggle = false,
  secureTextEntry,
  ...textInputProps
}) => {
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          paddingVertical: 8,
          paddingHorizontal: 12,
          fontSize: 14,
          minHeight: 40,
        };
      case 'medium':
        return {
          paddingVertical: 12,
          paddingHorizontal: 16,
          fontSize: 16,
          minHeight: 48,
        };
      case 'large':
        return {
          paddingVertical: 16,
          paddingHorizontal: 20,
          fontSize: 18,
          minHeight: 56,
        };
      default:
        return {
          paddingVertical: 12,
          paddingHorizontal: 16,
          fontSize: 16,
          minHeight: 48,
        };
    }
  };

  const getVariantStyles = () => {
    const baseStyle = {
      borderRadius: 12,
      borderWidth: 1,
    };

    switch (variant) {
      case 'outline':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderColor: isFocused 
            ? CYBERPUNK_COLORS.primary 
            : error 
            ? CYBERPUNK_COLORS.error 
            : CYBERPUNK_COLORS.border,
          borderWidth: 2,
        };
      case 'filled':
        return {
          ...baseStyle,
          backgroundColor: CYBERPUNK_COLORS.background,
          borderColor: isFocused 
            ? CYBERPUNK_COLORS.primary 
            : error 
            ? CYBERPUNK_COLORS.error 
            : CYBERPUNK_COLORS.surface,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: CYBERPUNK_COLORS.surface,
          borderColor: isFocused 
            ? CYBERPUNK_COLORS.primary 
            : error 
            ? CYBERPUNK_COLORS.error 
            : CYBERPUNK_COLORS.border,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const variantStyles = getVariantStyles();

  const handlePasswordToggle = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const actualSecureTextEntry = showPasswordToggle 
    ? !isPasswordVisible 
    : secureTextEntry;

  const actualRightIcon = showPasswordToggle 
    ? (isPasswordVisible ? '👁️' : '👁️‍🗨️')
    : rightIcon;

  const actualOnRightIconPress = showPasswordToggle 
    ? handlePasswordToggle 
    : onRightIconPress;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={[styles.label, error ? styles.errorLabel : undefined]}>
          {label}
        </Text>
      )}
      
      <View style={[styles.inputContainer, variantStyles]}>
        {leftIcon && (
          <View style={styles.leftIconContainer}>
            <Text style={styles.icon}>{leftIcon}</Text>
          </View>
        )}
        
        <TextInput
          style={[
            styles.input,
            {
              fontSize: sizeStyles.fontSize,
              paddingVertical: sizeStyles.paddingVertical,
              paddingHorizontal: leftIcon ? 8 : sizeStyles.paddingHorizontal,
              paddingRight: actualRightIcon ? 8 : sizeStyles.paddingHorizontal,
            },
          ]}
          placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
          selectionColor={CYBERPUNK_COLORS.primary}
          secureTextEntry={actualSecureTextEntry}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...textInputProps}
        />
        
        {actualRightIcon && (
          <TouchableOpacity
            style={styles.rightIconContainer}
            onPress={actualOnRightIconPress}
            disabled={!actualOnRightIconPress}
          >
            <Text style={styles.icon}>{actualRightIcon}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {error && (
        <Text style={styles.errorText}>{error}</Text>
      )}
      
      {hint && !error && (
        <Text style={styles.hintText}>{hint}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  errorLabel: {
    color: CYBERPUNK_COLORS.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    color: CYBERPUNK_COLORS.text,
    fontFamily: 'System',
  },
  leftIconContainer: {
    paddingLeft: 16,
    paddingRight: 8,
    justifyContent: 'center',
  },
  rightIconContainer: {
    paddingRight: 16,
    paddingLeft: 8,
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.error,
    marginTop: 4,
    marginLeft: 4,
    lineHeight: 16,
  },
  hintText: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    marginTop: 4,
    marginLeft: 4,
    lineHeight: 16,
  },
});

export default CyberpunkInput;
