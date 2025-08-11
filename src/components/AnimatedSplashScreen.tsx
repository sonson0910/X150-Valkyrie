import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '../constants/index';
import LoadingSpinner from './LoadingSpinner';

interface AnimatedSplashScreenProps {
  onAnimationComplete?: () => void;
}

const { width, height } = Dimensions.get('window');

const AnimatedSplashScreen: React.FC<AnimatedSplashScreenProps> = ({
  onAnimationComplete,
}) => {
  const logoScale = useRef(new Animated.Value(0.5)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const titleOpacity = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(50)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const glowOpacity = useRef(new Animated.Value(0)).current;
  const scanLinePosition = useRef(new Animated.Value(-height)).current;
  const progressOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    startSplashAnimation();
  }, []);

  const startSplashAnimation = () => {
    // Start scan line animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLinePosition, {
          toValue: height,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(scanLinePosition, {
          toValue: -height,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Main animation sequence
    Animated.sequence([
      // Logo appears
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ]),

      // Glow effect
      Animated.timing(glowOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),

      // Title slides up
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.spring(titleTranslateY, {
          toValue: 0,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),

      // Subtitle fades in
      Animated.timing(subtitleOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),

      // Progress indicator appears
      Animated.timing(progressOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),

      // Hold for a moment
      Animated.delay(1000),
    ]).start(() => {
      if (onAnimationComplete) {
        onAnimationComplete();
      }
    });
  };

  return (
    <LinearGradient
      colors={[CYBERPUNK_COLORS.background, '#1a1f3a', '#0a0e27']}
      style={styles.container}
    >
      {/* Animated scan line */}
      <Animated.View
        style={[
          styles.scanLine,
          {
            transform: [{ translateY: scanLinePosition }],
          },
        ]}
      />

      {/* Grid pattern overlay */}
      <View style={styles.gridOverlay}>
        {Array.from({ length: 10 }).map((_, index) => (
          <View key={`h-${index}`} style={[styles.gridLine, styles.horizontalLine, { top: (index * height) / 10 }]} />
        ))}
        {Array.from({ length: 8 }).map((_, index) => (
          <View key={`v-${index}`} style={[styles.gridLine, styles.verticalLine, { left: (index * width) / 8 }]} />
        ))}
      </View>

      {/* Logo container */}
      <View style={styles.logoContainer}>
        {/* Glow effect */}
        <Animated.View
          style={[
            styles.logoGlow,
            {
              opacity: glowOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        />

        {/* Main logo */}
        <Animated.View
          style={[
            styles.logo,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
            },
          ]}
        >
          <LinearGradient
            colors={[CYBERPUNK_COLORS.primary, CYBERPUNK_COLORS.accent]}
            style={styles.logoBackground}
          >
            <Text style={styles.logoText}>⚡</Text>
          </LinearGradient>
        </Animated.View>

        {/* Title */}
        <Animated.View
          style={[
            styles.titleContainer,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
            },
          ]}
        >
          <Text style={styles.title}>VALKYRIE</Text>
          <View style={styles.titleUnderline} />
        </Animated.View>

        {/* Subtitle */}
        <Animated.View
          style={[
            styles.subtitleContainer,
            {
              opacity: subtitleOpacity,
            },
          ]}
        >
          <Text style={styles.subtitle}>CARDANO WALLET</Text>
          <Text style={styles.tagline}>Advanced • Secure • Offline-Capable</Text>
        </Animated.View>
      </View>

      {/* Progress section */}
      <Animated.View
        style={[
          styles.progressContainer,
          {
            opacity: progressOpacity,
          },
        ]}
      >
        <LoadingSpinner
          variant="spinner"
          size="medium"
          color={CYBERPUNK_COLORS.primary}
        />
        
        <Text style={styles.loadingText}>Initializing Quantum Systems...</Text>
        
        <View style={styles.statusContainer}>
          <StatusLine text="🔐 Encryption Modules" delay={0} />
          <StatusLine text="📡 Network Protocols" delay={300} />
          <StatusLine text="⚡ Quantum Processors" delay={600} />
          <StatusLine text="🛡️ Security Barriers" delay={900} />
        </View>
      </Animated.View>

      {/* Corner decorations */}
      <View style={styles.cornerDecorations}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </View>
    </LinearGradient>
  );
};

const StatusLine: React.FC<{ text: string; delay: number }> = ({ text, delay }) => {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <Animated.Text style={[styles.statusLine, { opacity }]}>
      {text}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scanLine: {
    position: 'absolute',
    width: '100%',
    height: 2,
    backgroundColor: CYBERPUNK_COLORS.primary,
    opacity: 0.6,
    shadowColor: CYBERPUNK_COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: CYBERPUNK_COLORS.primary,
  },
  horizontalLine: {
    width: '100%',
    height: 1,
  },
  verticalLine: {
    height: '100%',
    width: 1,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoGlow: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: CYBERPUNK_COLORS.primary,
    opacity: 0.3,
    shadowColor: CYBERPUNK_COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 30,
  },
  logo: {
    marginBottom: 32,
  },
  logoBackground: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: CYBERPUNK_COLORS.primary,
  },
  logoText: {
    fontSize: 60,
    textShadowColor: CYBERPUNK_COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 10,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    letterSpacing: 6,
    textShadowColor: CYBERPUNK_COLORS.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  titleUnderline: {
    width: 200,
    height: 2,
    backgroundColor: CYBERPUNK_COLORS.accent,
    marginTop: 8,
    shadowColor: CYBERPUNK_COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  subtitleContainer: {
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: CYBERPUNK_COLORS.textSecondary,
    letterSpacing: 3,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    opacity: 0.8,
    letterSpacing: 1,
  },
  progressContainer: {
    alignItems: 'center',
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
  },
  loadingText: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.primary,
    marginTop: 20,
    marginBottom: 24,
    fontWeight: '600',
    letterSpacing: 1,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusLine: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  cornerDecorations: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: CYBERPUNK_COLORS.primary,
    borderWidth: 2,
  },
  topLeft: {
    top: 20,
    left: 20,
    borderRightWidth: 0,
    borderBottomWidth: 0,
  },
  topRight: {
    top: 20,
    right: 20,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
  },
  bottomLeft: {
    bottom: 20,
    left: 20,
    borderRightWidth: 0,
    borderTopWidth: 0,
  },
  bottomRight: {
    bottom: 20,
    right: 20,
    borderLeftWidth: 0,
    borderTopWidth: 0,
  },
});

export default AnimatedSplashScreen;
