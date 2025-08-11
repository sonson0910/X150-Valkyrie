import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '@constants/index';
import { BiometricService } from '@services/BiometricService';
import { MnemonicEncryptionService } from '@services/MnemonicEncryptionService';

type WelcomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Welcome'>;

interface Props {
  navigation: WelcomeScreenNavigationProp;
}

const { width, height } = Dimensions.get('window');

const WelcomeScreen: React.FC<Props> = ({ navigation }) => {
  const [fadeAnim] = useState(new Animated.Value(0));
  const [slideAnim] = useState(new Animated.Value(50));
  const [glowAnim] = useState(new Animated.Value(0));
  const [hasExistingWallet, setHasExistingWallet] = useState(false);

  useEffect(() => {
    // Animated intro
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        useNativeDriver: true,
      }),
    ]).start();

    // Glow animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    checkExistingWallet();
  }, []);

  const checkExistingWallet = async () => {
    try {
      // Check if wallet already exists in secure storage
      const walletExists = await checkWalletInStorage();
      setHasExistingWallet(walletExists);
    } catch (error) {
      console.error('Failed to check existing wallet:', error);
      setHasExistingWallet(false);
    }
  };

  // Check wallet existence in secure storage
  const checkWalletInStorage = async (): Promise<boolean> => {
    try {
      const keys = [
        'wallet_encrypted_mnemonic',
        'wallet_public_key',
        'wallet_private_key',
        'current_wallet_address'
      ];
      
      for (const key of keys) {
        const data = await AsyncStorage.getItem(key);
        if (data) {
          return true;
        }
      }
      
      // Check biometric config
      const biometricService = BiometricService.getInstance();
      const biometricConfig = await biometricService.getBiometricConfig();
      if (biometricConfig.isEnabled) {
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to check wallet storage:', error);
      return false;
    }
  };

  const handleCreateWallet = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('SetupWallet');
  };

  const handleRestoreWallet = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('RestoreWallet');
  };

  const handleUnlockWallet = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Authenticate with biometric
      const biometricService = BiometricService.getInstance();
      const result = await biometricService.authenticateWithBiometric(
        'Access your wallet'
      );

      if (result.success) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        navigation.navigate('WalletHome');
      } else {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        Alert.alert('Authentication Failed', result.error || 'Please try again');
      }
    } catch (error) {
      console.error('Unlock failed:', error);
      Alert.alert('Error', 'Failed to unlock wallet');
    }
  };

  return (
    <LinearGradient
      colors={[CYBERPUNK_COLORS.background, '#1a1f3a', '#0a0e27']}
      style={styles.container}
    >
      {/* Animated background elements */}
      <Animated.View
        style={[
          styles.glowCircle,
          {
            opacity: glowAnim,
            transform: [
              {
                scale: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1.2],
                }),
              },
            ],
          },
        ]}
      />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Logo and title */}
        <View style={styles.header}>
          <Text style={styles.logo}>⚡</Text>
          <Text style={styles.title}>VALKYRIE</Text>
          <Text style={styles.subtitle}>Advanced Cardano Wallet</Text>
        </View>

        {/* Features list */}
        <View style={styles.features}>
          <FeatureItem
            icon="🔒"
            title="Encrypted Mnemonic"
            description="Your seed phrase is encrypted with your personal password"
          />
          <FeatureItem
            icon="👆"
            title="One-Touch Payments"
            description="Biometric authentication for quick transactions"
          />
          <FeatureItem
            icon="📡"
            title="Offline Transactions"
            description="Sign transactions offline and transfer via Bluetooth"
          />
        </View>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          {hasExistingWallet ? (
            <CyberpunkButton
              title="UNLOCK WALLET"
              onPress={handleUnlockWallet}
              primary
              icon="🔓"
            />
          ) : (
            <>
              <CyberpunkButton
                title="CREATE WALLET"
                onPress={handleCreateWallet}
                primary
                icon="⚡"
              />
              <CyberpunkButton
                title="RESTORE WALLET"
                onPress={handleRestoreWallet}
                icon="🔄"
              />
            </>
          )}
        </View>

        {/* Security notice */}
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            🛡️ Your wallet uses military-grade encryption
          </Text>
          <Text style={styles.noticeSubtext}>
            Only you can access your funds with your personal password
          </Text>
        </View>
      </Animated.View>
    </LinearGradient>
  );
};

// Feature item component
const FeatureItem: React.FC<{
  icon: string;
  title: string;
  description: string;
}> = ({ icon, title, description }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <View style={styles.featureText}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDescription}>{description}</Text>
    </View>
  </View>
);

// Cyberpunk styled button
const CyberpunkButton: React.FC<{
  title: string;
  onPress: () => void;
  primary?: boolean;
  icon?: string;
}> = ({ title, onPress, primary = false, icon }) => (
  <TouchableOpacity
    style={[styles.button, primary && styles.buttonPrimary]}
    onPress={onPress}
    activeOpacity={0.8}
  >
    <LinearGradient
      colors={
        primary
          ? [CYBERPUNK_COLORS.primary, CYBERPUNK_COLORS.accent]
          : [CYBERPUNK_COLORS.surface, CYBERPUNK_COLORS.border]
      }
      style={styles.buttonGradient}
    >
      {icon && <Text style={styles.buttonIcon}>{icon}</Text>}
      <Text style={[styles.buttonText, primary && styles.buttonTextPrimary]}>
        {title}
      </Text>
    </LinearGradient>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  glowCircle: {
    position: 'absolute',
    top: height * 0.2,
    left: width * 0.3,
    width: width * 0.4,
    height: width * 0.4,
    borderRadius: width * 0.2,
    backgroundColor: CYBERPUNK_COLORS.primary + '20',
    shadowColor: CYBERPUNK_COLORS.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logo: {
    fontSize: 60,
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    letterSpacing: 4,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
    letterSpacing: 1,
  },
  features: {
    marginBottom: 50,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
    width: 40,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  featureDescription: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
  buttonContainer: {
    marginBottom: 40,
  },
  button: {
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  buttonPrimary: {
    shadowColor: CYBERPUNK_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  buttonIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    letterSpacing: 1,
  },
  buttonTextPrimary: {
    color: CYBERPUNK_COLORS.background,
  },
  notice: {
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  noticeText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.success,
    fontWeight: '600',
    marginBottom: 4,
    textAlign: 'center',
  },
  noticeSubtext: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default WelcomeScreen;
