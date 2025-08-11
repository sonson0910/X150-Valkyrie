import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Animated,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS, STORAGE_KEYS } from '@constants/index';
import { CardanoWalletService } from '@services/CardanoWalletService';
import { MnemonicEncryptionService } from '@services/MnemonicEncryptionService';
import { BiometricService } from '@services/BiometricService';

type SetupWalletScreenNavigationProp = StackNavigationProp<RootStackParamList, 'SetupWallet'>;

interface Props {
  navigation: SetupWalletScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const SetupWalletScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [walletName, setWalletName] = useState('My Valkyrie Wallet');
  const [userPassword, setUserPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [originalMnemonic, setOriginalMnemonic] = useState('');
  const [fakeMnemonic, setFakeMnemonic] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (step === 2) {
      generateNewMnemonic();
    }
  }, [step]);

  const generateNewMnemonic = () => {
    const mnemonic = CardanoWalletService.generateMnemonic(128); // 12 words
    setOriginalMnemonic(mnemonic);
  };

  const validatePassword = () => {
    if (userPassword.length < 8) {
      Alert.alert('Password Error', 'Password must be at least 8 characters long');
      return false;
    }
    
    if (userPassword !== confirmPassword) {
      Alert.alert('Password Error', 'Passwords do not match');
      return false;
    }
    
    return true;
  };

  const handleNextStep = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (step === 1) {
      if (!validatePassword()) return;
      setStep(2);
    } else if (step === 2) {
      await createEncryptedWallet();
    } else if (step === 3) {
      await setupBiometric();
    }
  };

  const createEncryptedWallet = async () => {
    try {
      setIsCreating(true);
      
      // Encrypt mnemonic with password
      const { fakeMnemonic: fake } = await MnemonicEncryptionService.encryptMnemonic(
        originalMnemonic,
        userPassword
      );
      
      setFakeMnemonic(fake);
      
      // Save encrypted mnemonic to secure storage
      await SecureStore.setItemAsync(
        STORAGE_KEYS.ENCRYPTED_MNEMONIC,
        JSON.stringify(fake) // Changed to fake
      );
      
      // Initialize wallet service
      const walletService = CardanoWalletService.getInstance();
      await walletService.initializeFromMnemonic(originalMnemonic);
      
      // Create main account
      const account = await walletService.createAccount(0, walletName);
      
      // Save account info
      await SecureStore.setItemAsync(
        STORAGE_KEYS.ACCOUNTS,
        JSON.stringify([account])
      );
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setStep(3);
      
    } catch (error) {
      console.error('Failed to create wallet:', error);
      Alert.alert('Wallet Creation Failed', 'Please try again');
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setIsCreating(false);
    }
  };

  const setupBiometric = async () => {
    try {
      // Check biometric support
      const biometricService = BiometricService.getInstance();
      const biometricSupport = await biometricService.checkBiometricSupport();
      
      if (biometricSupport.isAvailable) {
        // Setup biometric authentication
        const success = await biometricService.setupBiometric();
        
        if (success) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      }
      
      // Navigate to wallet home
      navigation.reset({
        index: 0,
        routes: [{ name: 'WalletHome' }],
      });
      
    } catch (error) {
      console.error('Failed to setup biometric:', error);
      // Continue anyway
      navigation.reset({
        index: 0,
        routes: [{ name: 'WalletHome' }],
      });
    }
  };

  const animateStepTransition = () => {
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const renderStep1 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <Text style={styles.stepTitle}>Secure Your Wallet</Text>
      <Text style={styles.stepDescription}>
        Create a personal password to encrypt your wallet. This password will be used to generate a unique mnemonic phrase that only works with your Valkyrie wallet.
      </Text>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Wallet Name</Text>
        <TextInput
          style={styles.input}
          value={walletName}
          onChangeText={setWalletName}
          placeholder="Enter wallet name"
          placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Personal Password</Text>
        <TextInput
          style={styles.input}
          value={userPassword}
          onChangeText={setUserPassword}
          placeholder="Enter your personal password"
          placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
          secureTextEntry
        />
      </View>

      <View style={styles.inputContainer}>
        <Text style={styles.inputLabel}>Confirm Password</Text>
        <TextInput
          style={styles.input}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Confirm your password"
          placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
          secureTextEntry
        />
      </View>

      <View style={styles.securityNotice}>
        <Text style={styles.noticeTitle}>🔐 Security Features:</Text>
        <Text style={styles.noticeText}>• Your real mnemonic is never displayed</Text>
        <Text style={styles.noticeText}>• Only encrypted mnemonic is shown to you</Text>
        <Text style={styles.noticeText}>• Your password is required to access funds</Text>
        <Text style={styles.noticeText}>• Works only with Valkyrie wallet</Text>
      </View>
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <Text style={styles.stepTitle}>Your Encrypted Mnemonic</Text>
      <Text style={styles.stepDescription}>
        This is your encrypted backup phrase. Save it securely. You'll need your personal password to use it.
      </Text>

      <View style={styles.mnemonicContainer}>
        <View style={styles.mnemonicGrid}>
          {fakeMnemonic.split(' ').map((word, index) => (
            <View key={index} style={styles.mnemonicWord}>
              <Text style={styles.mnemonicIndex}>{index + 1}</Text>
              <Text style={styles.mnemonicText}>{word}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.warningContainer}>
        <Text style={styles.warningTitle}>⚠️ Important Security Notice</Text>
        <Text style={styles.warningText}>
          This mnemonic phrase is encrypted and ONLY works with your personal password in this Valkyrie wallet.
        </Text>
        <Text style={styles.warningText}>
          • Screenshots are unsafe - write it down physically
        </Text>
        <Text style={styles.warningText}>
          • Cannot be used in other wallets
        </Text>
        <Text style={styles.warningText}>
          • Requires your personal password to restore
        </Text>
      </View>
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View style={[styles.stepContainer, { opacity: fadeAnim }]}>
      <Text style={styles.stepTitle}>Setup Complete!</Text>
      <Text style={styles.stepDescription}>
        Your Valkyrie wallet has been created successfully with enhanced security features.
      </Text>

      <View style={styles.successContainer}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Wallet Created</Text>
        <Text style={styles.successDescription}>
          Your wallet is now protected with encrypted mnemonic and biometric authentication.
        </Text>
      </View>

      <View style={styles.featuresContainer}>
        <FeatureItem icon="🔒" title="Encrypted Backup" description="Your mnemonic is encrypted with your password" />
        <FeatureItem icon="👆" title="Biometric Access" description="Quick access with Face ID or Fingerprint" />
        <FeatureItem icon="📱" title="One-Touch Pay" description="Fast payments with biometric confirmation" />
        <FeatureItem icon="🔄" title="Offline Capable" description="Sign transactions without internet" />
      </View>
    </Animated.View>
  );

  return (
    <LinearGradient
      colors={[CYBERPUNK_COLORS.background, '#1a1f3a']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>Step {step} of 3</Text>
        </View>

        {/* Step content */}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}

        {/* Action button */}
        <TouchableOpacity
          style={styles.nextButton}
          onPress={handleNextStep}
          disabled={isCreating}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[CYBERPUNK_COLORS.primary, CYBERPUNK_COLORS.accent]}
            style={styles.nextButtonGradient}
          >
            <Text style={styles.nextButtonText}>
              {isCreating ? 'Creating...' : step === 3 ? 'START USING WALLET' : 'NEXT'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </LinearGradient>
  );
};

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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  progressContainer: {
    marginBottom: 40,
  },
  progressBar: {
    height: 4,
    backgroundColor: CYBERPUNK_COLORS.border,
    borderRadius: 2,
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: CYBERPUNK_COLORS.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
  },
  stepContainer: {
    flex: 1,
    marginBottom: 40,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    textAlign: 'center',
    marginBottom: 16,
  },
  stepDescription: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    marginBottom: 8,
    fontWeight: '600',
  },
  input: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: CYBERPUNK_COLORS.text,
  },
  securityNotice: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: CYBERPUNK_COLORS.success,
  },
  noticeTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.success,
    marginBottom: 8,
  },
  noticeText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  mnemonicContainer: {
    marginBottom: 32,
  },
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  mnemonicWord: {
    width: (width - 48 - 16) / 3,
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  mnemonicIndex: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    marginBottom: 4,
  },
  mnemonicText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
  warningContainer: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    borderLeftColor: CYBERPUNK_COLORS.warning,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.warning,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
    lineHeight: 20,
  },
  successContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  successIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.success,
    marginBottom: 8,
  },
  successDescription: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 8,
    padding: 12,
  },
  featureIcon: {
    fontSize: 20,
    marginRight: 12,
    width: 30,
    textAlign: 'center',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 2,
  },
  featureDescription: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  nextButton: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: CYBERPUNK_COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  nextButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.background,
    letterSpacing: 1,
  },
});

export default SetupWalletScreen;
