import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  ViewStyle,
  Dimensions,
  DimensionValue,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '@constants/index';

interface SkeletonLoaderProps {
  width?: DimensionValue | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  variant?: 'pulse' | 'shimmer' | 'wave';
  speed?: number;
}

const { width: screenWidth } = Dimensions.get('window');

const SkeletonLoader: React.FC<SkeletonLoaderProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 4,
  style,
  variant = 'shimmer',
  speed = 1500,
}) => {
  const animatedValue = useRef(new Animated.Value(0)).current;
  const pulseValue = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    let animation: Animated.CompositeAnimation;

    if (variant === 'pulse') {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseValue, {
            toValue: 1,
            duration: speed / 2,
            useNativeDriver: true,
          }),
          Animated.timing(pulseValue, {
            toValue: 0.3,
            duration: speed / 2,
            useNativeDriver: true,
          }),
        ])
      );
    } else {
      animation = Animated.loop(
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: speed,
          useNativeDriver: true,
        })
      );
    }

    animation.start();

    return () => animation.stop();
  }, [variant, speed]);

  const getAnimatedStyle = () => {
    if (variant === 'pulse') {
      return {
        opacity: pulseValue,
      };
    }

    if (variant === 'wave') {
      const translateX = animatedValue.interpolate({
        inputRange: [0, 1],
        outputRange: [-screenWidth, screenWidth],
      });

      return {
        transform: [{ translateX }],
      };
    }

    // Shimmer effect
    const translateX = animatedValue.interpolate({
      inputRange: [0, 1],
      outputRange: [-300, 300],
    });

    return {
      transform: [{ translateX }],
    };
  };

  const renderShimmerGradient = () => {
    if (variant === 'pulse') {
      return (
        <Animated.View
          style={[
            styles.skeletonBase,
            {
              width: width as any,
              height,
              borderRadius,
              backgroundColor: CYBERPUNK_COLORS.surface,
            },
            getAnimatedStyle(),
            style,
          ]}
        />
      );
    }

    return (
      <View
        style={[
          styles.skeletonBase,
          {
            width: width as any,
            height,
            borderRadius,
            backgroundColor: CYBERPUNK_COLORS.surface,
            overflow: 'hidden',
          },
          style,
        ]}
      >
        <Animated.View
          style={[
            styles.shimmerContainer,
            getAnimatedStyle(),
          ]}
        >
          <LinearGradient
            colors={[
              CYBERPUNK_COLORS.surface,
              CYBERPUNK_COLORS.border,
              CYBERPUNK_COLORS.surface,
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.shimmerGradient}
          />
        </Animated.View>
      </View>
    );
  };

  return renderShimmerGradient();
};

// Pre-built skeleton components
export const TextSkeleton: React.FC<{
  lines?: number;
  width?: (number | string)[];
  height?: number;
  spacing?: number;
}> = ({ lines = 1, width = ['100%'], height = 16, spacing = 8 }) => (
  <View>
    {Array.from({ length: lines }).map((_, index) => (
      <SkeletonLoader
        key={index}
        width={width[index] || width[0] || '100%'}
        height={height}
        style={index > 0 ? { marginTop: spacing } : {}}
      />
    ))}
  </View>
);

export const CircleSkeleton: React.FC<{
  size: number;
  style?: ViewStyle;
}> = ({ size, style }) => (
  <SkeletonLoader
    width={size}
    height={size}
    borderRadius={size / 2}
    style={style}
  />
);

export const CardSkeleton: React.FC<{
  height?: number;
  children?: React.ReactNode;
}> = ({ height = 120, children }) => (
  <View style={[styles.cardSkeleton, { height }]}>
    {children || (
      <>
        <TextSkeleton lines={1} width={['60%']} height={20} />
        <TextSkeleton lines={2} width={['100%', '80%']} height={14} spacing={6} />
      </>
    )}
  </View>
);

export const TransactionSkeleton: React.FC = () => (
  <View style={styles.transactionSkeleton}>
    <CircleSkeleton size={40} style={styles.transactionIcon} />
    <View style={styles.transactionContent}>
      <TextSkeleton lines={1} width={['70%']} height={16} />
      <TextSkeleton lines={1} width={['50%']} height={12} />
    </View>
    <View style={styles.transactionAmount}>
      <TextSkeleton lines={1} width={[80]} height={16} />
      <TextSkeleton lines={1} width={[60]} height={10} />
    </View>
  </View>
);

export const BalanceSkeleton: React.FC = () => (
  <View style={styles.balanceSkeleton}>
    <TextSkeleton lines={1} width={['40%']} height={16} />
    <View style={styles.balanceAmount}>
      <SkeletonLoader width={200} height={36} borderRadius={8} />
    </View>
    <TextSkeleton lines={1} width={['50%']} height={14} />
  </View>
);

export const ButtonSkeleton: React.FC<{
  width?: number | string;
  height?: number;
}> = ({ width = '100%', height = 48 }) => (
  <SkeletonLoader
    width={width}
    height={height}
    borderRadius={12}
    variant="pulse"
  />
);

export const QuickActionsSkeleton: React.FC = () => (
  <View style={styles.quickActionsSkeleton}>
    {Array.from({ length: 4 }).map((_, index) => (
      <View key={index} style={styles.quickActionSkeleton}>
        <CircleSkeleton size={60} />
        <TextSkeleton lines={1} width={[60]} height={12} />
      </View>
    ))}
  </View>
);

const styles = StyleSheet.create({
  skeletonBase: {
    backgroundColor: CYBERPUNK_COLORS.surface,
  },
  shimmerContainer: {
    width: '200%',
    height: '100%',
    position: 'absolute',
  },
  shimmerGradient: {
    flex: 1,
    width: '50%',
  },
  cardSkeleton: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    justifyContent: 'space-between',
  },
  transactionSkeleton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  transactionIcon: {
    marginRight: 12,
  },
  transactionContent: {
    flex: 1,
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  balanceSkeleton: {
    alignItems: 'center',
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  balanceAmount: {
    marginVertical: 12,
  },
  quickActionsSkeleton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  quickActionSkeleton: {
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
});

export default SkeletonLoader;
