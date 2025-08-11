import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '@constants/index';

export interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  duration?: number;
  onPress?: () => void;
  onDismiss?: () => void;
}

const { width } = Dimensions.get('window');

const ToastNotification: React.FC<ToastProps> = ({
  message,
  type = 'info',
  duration = 3000,
  onPress,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Slide in and fade in
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss after duration
    const timer = setTimeout(() => {
      dismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: -100,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsVisible(false);
      onDismiss?.();
    });
  };

  const getToastColors = (): readonly [string, string] => {
    switch (type) {
      case 'success':
        return [CYBERPUNK_COLORS.success, '#00cc88'] as const;
      case 'error':
        return [CYBERPUNK_COLORS.error, '#ff6b6b'] as const;
      case 'warning':
        return [CYBERPUNK_COLORS.warning, '#ffa726'] as const;
      case 'info':
        return [CYBERPUNK_COLORS.primary, CYBERPUNK_COLORS.accent] as const;
      default:
        return [CYBERPUNK_COLORS.primary, CYBERPUNK_COLORS.accent] as const;
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  if (!isVisible) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <TouchableOpacity
        style={styles.touchable}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={getToastColors()}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <View style={styles.content}>
            <Text style={styles.icon}>{getIcon()}</Text>
            <Text style={styles.message} numberOfLines={3}>
              {message}
            </Text>
            <TouchableOpacity onPress={dismiss} style={styles.dismissButton}>
              <Text style={styles.dismissText}>✕</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    zIndex: 1000,
  },
  touchable: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: CYBERPUNK_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  gradient: {
    borderRadius: 12,
    padding: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  message: {
    flex: 1,
    color: CYBERPUNK_COLORS.background,
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 22,
  },
  dismissButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  dismissText: {
    color: CYBERPUNK_COLORS.background,
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default ToastNotification;
