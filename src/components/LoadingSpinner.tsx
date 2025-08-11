import React, { useEffect, useRef } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  ViewStyle,
  Text,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '@constants/index';

export interface LoadingSpinnerProps {
  visible?: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'spinner' | 'pulse' | 'dots' | 'bars';
  color?: string;
  text?: string;
  message?: string;
  style?: ViewStyle;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'medium',
  variant = 'spinner',
  color = CYBERPUNK_COLORS.primary,
  text,
  style,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.8)).current;
  const dotsValue = useRef([
    new Animated.Value(0),
    new Animated.Value(0),
    new Animated.Value(0),
  ]).current;

  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { width: 24, height: 24 };
      case 'medium':
        return { width: 40, height: 40 };
      case 'large':
        return { width: 60, height: 60 };
      default:
        return { width: 40, height: 40 };
    }
  };

  useEffect(() => {
    if (variant === 'spinner') {
      const spinAnimation = Animated.loop(
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        })
      );
      spinAnimation.start();
      return () => spinAnimation.stop();
    }

    if (variant === 'pulse') {
      const pulseAnimation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 0.8,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulseAnimation.start();
      return () => pulseAnimation.stop();
    }

    if (variant === 'dots') {
      const dotsAnimation = Animated.loop(
        Animated.stagger(
          200,
          dotsValue.map((dot) =>
            Animated.sequence([
              Animated.timing(dot, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
              }),
              Animated.timing(dot, {
                toValue: 0,
                duration: 400,
                useNativeDriver: true,
              }),
            ])
          )
        )
      );
      dotsAnimation.start();
      return () => dotsAnimation.stop();
    }
  }, [variant]);

  const sizeStyles = getSizeStyles();

  const renderSpinner = () => {
    const spin = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    return (
      <Animated.View
        style={[
          styles.spinner,
          sizeStyles,
          { transform: [{ rotate: spin }] },
        ]}
      >
        <LinearGradient
          colors={[color, color + '40', 'transparent']}
          style={[styles.spinnerGradient, sizeStyles]}
        />
      </Animated.View>
    );
  };

  const renderPulse = () => (
    <Animated.View
      style={[
        styles.pulse,
        sizeStyles,
        {
          backgroundColor: color,
          transform: [{ scale: pulseValue }],
        },
      ]}
    />
  );

  const renderDots = () => (
    <View style={styles.dotsContainer}>
      {dotsValue.map((dot, index) => (
        <Animated.View
          key={index}
          style={[
            styles.dot,
            {
              backgroundColor: color,
              opacity: dot,
              transform: [
                {
                  scale: dot.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.5, 1],
                  }),
                },
              ],
            },
          ]}
        />
      ))}
    </View>
  );

  const renderBars = () => (
    <View style={styles.barsContainer}>
      {[0, 1, 2, 3].map((index) => (
        <Animated.View
          key={index}
          style={[
            styles.bar,
            {
              backgroundColor: color,
              height: size === 'small' ? 16 : size === 'large' ? 32 : 24,
            },
          ]}
        />
      ))}
    </View>
  );

  const renderLoader = () => {
    switch (variant) {
      case 'spinner':
        return renderSpinner();
      case 'pulse':
        return renderPulse();
      case 'dots':
        return renderDots();
      case 'bars':
        return renderBars();
      default:
        return renderSpinner();
    }
  };

  return (
    <View style={[styles.container, style]}>
      {renderLoader()}
      {text && (
        <Text style={[styles.text, { color }]}>
          {text}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinner: {
    borderRadius: 50,
  },
  spinnerGradient: {
    borderRadius: 50,
  },
  pulse: {
    borderRadius: 50,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 2,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bar: {
    width: 4,
    marginHorizontal: 1,
    borderRadius: 2,
  },
  text: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default LoadingSpinner;
