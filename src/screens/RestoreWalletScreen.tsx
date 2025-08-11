import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS, STORAGE_KEYS } from '../constants/index';
import { MnemonicEncryptionService } from '../services/MnemonicEncryptionService';
import { CardanoWalletService } from '../services/CardanoWalletService';
import { BiometricService } from '../services/BiometricService';
import { 
  CyberpunkButton, 
  CyberpunkInput, 
  CyberpunkCard, 
  FullScreenLoader 
} from '../components/index';
import MnemonicTransformService from '../services/MnemonicTransformService';

type RestoreWalletScreenNavigationProp = StackNavigationProp<RootStackParamList, 'RestoreWallet'>;

interface Props {
  navigation: RestoreWalletScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const RestoreWalletScreen: React.FC<Props> = ({ navigation }) => {
  const [step, setStep] = useState(1);
  const [encryptedMnemonic, setEncryptedMnemonic] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [walletName, setWalletName] = useState('Restored Wallet');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checksum, setChecksum] = useState('');
  const [password, setPassword] = useState('');
  const [isTransformed, setIsTransformed] = useState(true);

  const validateEncryptedMnemonic = () => {
    const words = encryptedMnemonic.trim().split(' ');

    if (isTransformed) {
      if (words.length !== 36) {
        Alert.alert('Invalid Mnemonic', 'Please enter exactly 36 words (transformed)');
        return false;
      }
      return true;
    }

    if (words.length !== 12 && words.length !== 24) {
      Alert.alert('Invalid Mnemonic', 'Please enter a 12 or 24-word phrase');
      return false;
    }

    return true;
  };

  const handleNextStep = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (step === 1) {
      if (!validateEncryptedMnemonic()) return;
      setStep(2);
    } else if (step === 2) {
      const success = await attemptRestore(encryptedMnemonic, password);
      if (success) {
        await completeRestore();
      }
    }
  };

  const attemptRestore = async (encryptedMnemonic: string, password: string): Promise<boolean> => {
    try {
      // Validate password by attempting decryption when payload exists
      const encryptedJson = await SecureStore.getItemAsync(STORAGE_KEYS.ENCRYPTED_MNEMONIC);
      if (encryptedJson) {
        try {
          const encrypted = JSON.parse(encryptedJson);
          await MnemonicEncryptionService.decryptMnemonic(encrypted, password);
        } catch (e) {
          Alert.alert('Invalid Password', 'The provided password is incorrect');
          return false;
        }
      }

      // If transformed, restore to original
      let originalMnemonic = encryptedMnemonic;
      const words = encryptedMnemonic.trim().split(/\s+/);
      if (isTransformed || words.length === 36) {
        try {
          originalMnemonic = await MnemonicTransformService.restoreOriginalMnemonic(encryptedMnemonic, password);
        } catch (e) {
          Alert.alert('Restore Failed', 'Failed to restore from transformed mnemonic. Please check your password and phrase.');
          return false;
        }
      }

      // Simulate next steps or initialize wallet service with originalMnemonic
      await new Promise(resolve => setTimeout(resolve, 2000));
      return true;
    } catch (error) {
      console.error('Wallet restoration failed:', error);
      return false;
    }
  };

  const completeRestore = async () => {
    try {
      setIsProcessing(true);

      // Simulate successful restore
      await new Promise(resolve => setTimeout(resolve, 2000));

      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      Alert.alert(
        'Wallet Restored',
        'Your wallet has been successfully restored!',
        [
          {
            text: 'Continue',
            onPress: () => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'WalletHome' }],
              });
            }
          }
        ]
      );

    } catch (error) {
      console.error('Complete restore failed:', error);
      Alert.alert('Error', 'Failed to complete wallet restoration');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScanQR = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'QR Scanner',
      'Feature coming soon. This will allow you to scan a QR code containing your encrypted backup.',
      [{ text: 'OK' }]
    );
  };

  const renderStep1 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Enter Transformed Mnemonic</Text>
      <Text style={styles.stepDescription}>
        Enter the transformed mnemonic (36 words) from your Valkyrie backup. You will need your personal password to restore.
      </Text>

      <CyberpunkInput
        label="Wallet Name"
        value={walletName}
        onChangeText={setWalletName}
        placeholder="Enter wallet name"
        leftIcon="💼"
      />

      <CyberpunkInput
        label="Mnemonic Phrase"
        value={encryptedMnemonic}
        onChangeText={setEncryptedMnemonic}
        placeholder="Enter your transformed (36 words) or original (24 words) phrase"
        multiline
        numberOfLines={4}
        leftIcon="🔐"
        hint="Transformed phrases only work with Valkyrie and require your password to restore"
      />

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Transformed</Text>
        <TouchableOpacity onPress={() => setIsTransformed(!isTransformed)} style={[styles.toggle, isTransformed && styles.toggleOn]}>
          <View style={[styles.knob, isTransformed && styles.knobOn]} />
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.scanButton} onPress={handleScanQR}>
        <Text style={styles.scanButtonText}>📱 Scan QR Code</Text>
      </TouchableOpacity>

      <CyberpunkCard variant="outline" style={styles.infoCard}>
        <Text style={styles.infoTitle}>ℹ️ About Transformed Mnemonic</Text>
        <Text style={styles.infoText}>
          Your transformed mnemonic is derived from your original phrase and personal password. It’s only reversible with your password in Valkyrie.
        </Text>
      </CyberpunkCard>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContainer}>
      <Text style={styles.stepTitle}>Enter Personal Password</Text>
      <Text style={styles.stepDescription}>
        Enter your personal password to decrypt and restore your wallet.
      </Text>

      <CyberpunkCard style={styles.mnemonicPreview}>
        <Text style={styles.previewTitle}>Encrypted Mnemonic Preview</Text>
        <Text style={styles.previewText} numberOfLines={2}>
          {encryptedMnemonic}
        </Text>
      </CyberpunkCard>

      <CyberpunkInput
        label="Personal Password"
        value={userPassword}
        onChangeText={setUserPassword}
        placeholder="Enter your personal password"
        secureTextEntry
        showPasswordToggle
        leftIcon="🔑"
        hint="The password you used when creating this wallet"
      />

      <CyberpunkInput
        label="Verification Checksum (Optional)"
        value={checksum}
        onChangeText={setChecksum}
        placeholder="Enter checksum if available"
        leftIcon="✓"
        hint="Optional: Enter the checksum from your backup for verification"
      />

      <CyberpunkCard variant="outline" style={styles.securityCard}>
        <Text style={styles.securityTitle}>🔒 Security Note</Text>
        <Text style={styles.securityText}>
          Your password is used to decrypt your mnemonic locally. It is never sent to any server.
        </Text>
      </CyberpunkCard>
    </View>
  );

  return (
    <>
      <LinearGradient
        colors={[CYBERPUNK_COLORS.background, '#1a1f3a']}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Progress indicator */}
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${(step / 2) * 100}%` }]} />
            </View>
            <Text style={styles.progressText}>Step {step} of 2</Text>
          </View>

          {/* Step content */}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            {step > 1 && (
              <CyberpunkButton
                title="Back"
                onPress={() => setStep(step - 1)}
                variant="outline"
                style={styles.backButton}
              />
            )}
            
            <CyberpunkButton
              title={step === 2 ? 'RESTORE WALLET' : 'NEXT'}
              onPress={handleNextStep}
              disabled={
                step === 1 ? !encryptedMnemonic.trim() : 
                step === 2 ? !userPassword.trim() : false
              }
              style={styles.nextButton}
            />
          </View>

          {/* Help section */}
          <CyberpunkCard variant="outline" style={styles.helpCard}>
            <Text style={styles.helpTitle}>❓ Need Help?</Text>
            <Text style={styles.helpText}>
              • Make sure you have the correct encrypted mnemonic from Valkyrie{'\n'}
              • Remember your personal password - it's case sensitive{'\n'}
              • Contact support if you continue having issues
            </Text>
          </CyberpunkCard>
        </ScrollView>
      </LinearGradient>

      <FullScreenLoader
        visible={isProcessing}
        message="Restoring wallet..."
      />
    </>
  );
};

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
  scanButton: {
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginVertical: 16,
  },
  scanButtonText: {
    fontSize: 16,
    color: CYBERPUNK_COLORS.primary,
    fontWeight: '600',
  },
  infoCard: {
    borderColor: CYBERPUNK_COLORS.accent,
    marginTop: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.accent,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
  mnemonicPreview: {
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 8,
  },
  previewText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  securityCard: {
    borderColor: CYBERPUNK_COLORS.success,
    marginTop: 20,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.success,
    marginBottom: 8,
  },
  securityText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  backButton: {
    flex: 0.4,
    marginRight: 8,
  },
  nextButton: {
    flex: 0.6,
  },
  helpCard: {
    borderColor: CYBERPUNK_COLORS.warning,
    marginBottom: 32,
  },
  helpTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.warning,
    marginBottom: 8,
  },
  helpText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  toggleLabel: {
    color: CYBERPUNK_COLORS.text,
    marginRight: 8,
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#333',
    justifyContent: 'center',
  },
  toggleOn: {
    backgroundColor: CYBERPUNK_COLORS.primary,
  },
  knob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#111',
    marginLeft: 3,
  },
  knobOn: {
    marginLeft: 19,
    backgroundColor: CYBERPUNK_COLORS.background,
  },
});

export default RestoreWalletScreen;
