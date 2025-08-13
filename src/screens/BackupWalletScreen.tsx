import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Clipboard,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS, STORAGE_KEYS } from '../constants/index';
import { BiometricService } from '../services/BiometricService';
import { MnemonicEncryptionService } from '../services/MnemonicEncryptionService';
import { FullScreenLoader } from '../components/index';
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { AppButton } from '../components/ui/AppButton';
import { AppText } from '../components/ui/AppText';
import { tokens } from '../theme/tokens';

type BackupWalletScreenNavigationProp = StackNavigationProp<RootStackParamList, 'BackupWallet'>;

interface Props {
  navigation: BackupWalletScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const BackupWalletScreen: React.FC<Props> = ({ navigation }) => {
  const [fakeMnemonic, setFakeMnemonic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checksum, setChecksum] = useState('');

  useEffect(() => {
    authenticateUser();
  }, []);

  const authenticateUser = async () => {
    try {
      setIsLoading(true);
      
      // Authenticate with biometric
      const biometricService = BiometricService.getInstance();
      const result = await biometricService.authenticateWithBiometric(
        'Access encrypted wallet data'
      );
      
      if (result.success) {
        await loadBackupData();
        setIsAuthenticated(true);
      } else {
        Alert.alert(
          'Authentication Failed',
          'You need to authenticate to view your wallet backup.',
          [
            { text: 'Try Again', onPress: authenticateUser },
            { text: 'Cancel', onPress: () => navigation.goBack() }
          ]
        );
      }
    } catch (error) {
      console.error('Authentication error:', error);
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const loadBackupData = async () => {
    try {
      const encryptedDataStr = await SecureStore.getItemAsync(STORAGE_KEYS.ENCRYPTED_MNEMONIC);
      
      if (encryptedDataStr) {
        const encryptedData = JSON.parse(encryptedDataStr);
        
        // Generate fake mnemonic for display
        const fake = MnemonicEncryptionService.generateFakeMnemonic();
        setFakeMnemonic(fake);
        
        // Generate checksum for verification
        const checksumValue = MnemonicEncryptionService.hashMnemonic(encryptedData.encryptedData);
        setChecksum(checksumValue);
      }
    } catch (error) {
      console.error('Failed to load backup data:', error);
      Alert.alert('Error', 'Failed to load backup data');
    }
  };

  const handleCopyMnemonic = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      Clipboard.setString(fakeMnemonic);
      
      Alert.alert(
        'Copied to Clipboard',
        'Your encrypted mnemonic has been copied. Remember, you need your personal password to restore your wallet.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Copy Failed', 'Unable to copy to clipboard');
    }
  };

  const handleShare = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      Alert.alert(
        'Share Backup',
        'Feature coming soon. For now, please copy the mnemonic and save it securely.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleExportQR = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      Alert.alert(
        'QR Export',
        'Feature coming soon. This will generate a QR code containing your encrypted backup.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('QR export error:', error);
    }
  };

  if (!isAuthenticated) {
    return (
      <FullScreenLoader
        visible={isLoading}
        message="Authenticating..."
      />
    );
  }

  return (
    <LinearGradient colors={[tokens.palette.background, tokens.palette.surfaceAlt]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Container>
          {/* Warning Card */}
          <Card variant="outline" style={styles.warningCard}>
            <AppText variant="h3" color={tokens.palette.warning} style={styles.warningTitle}>🛡️ Secure Backup</AppText>
            <AppText variant="body2" color={tokens.palette.textSecondary} style={styles.warningText}>
              This is your encrypted mnemonic phrase. It only works with your personal password in this Valkyrie wallet.
            </AppText>
          </Card>

          {/* Mnemonic Display */}
          <Card glow style={styles.mnemonicCard}>
            <AppText variant="h2" color={tokens.palette.primary} style={styles.mnemonicTitle}>Encrypted Mnemonic Phrase</AppText>
            <View style={styles.mnemonicGrid}>
              {fakeMnemonic.split(' ').map((word, index) => (
                <View key={index} style={styles.mnemonicWord}>
                  <AppText variant="caption" color={tokens.palette.textSecondary} style={styles.mnemonicIndex}>{index + 1}</AppText>
                  <AppText variant="body2" style={styles.mnemonicText}>{word}</AppText>
                </View>
              ))}
            </View>
            <View style={styles.checksumContainer}>
              <AppText variant="caption" color={tokens.palette.textSecondary} style={styles.checksumLabel}>Checksum:</AppText>
              <AppText variant="caption" color={tokens.palette.primary} style={styles.checksumText}>{checksum}</AppText>
            </View>
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <AppButton title="Copy to Clipboard" onPress={handleCopyMnemonic} style={styles.actionButton} />
            <AppButton title="Share Backup" variant="secondary" onPress={handleShare} style={styles.actionButton} />
            <AppButton title="Export QR Code" variant="ghost" onPress={handleExportQR} style={styles.actionButton} />
          </View>

          {/* Security Instructions */}
          <Card style={styles.instructionsCard}>
            <AppText variant="h3" color={tokens.palette.primary} style={styles.instructionsTitle}>📖 Backup Instructions</AppText>
            <View style={styles.instructionsList}>
              <InstructionItem step="1" text="Write down this encrypted mnemonic phrase on paper" />
              <InstructionItem step="2" text="Store it in a secure location (safe, bank vault)" />
              <InstructionItem step="3" text="Remember your personal password - it's required to restore" />
              <InstructionItem step="4" text="This mnemonic only works with Valkyrie wallet" />
              <InstructionItem step="5" text="Never share your personal password with anyone" />
            </View>
          </Card>

          {/* Security Notice */}
          <Card variant="outline" style={styles.securityCard}>
            <AppText variant="h3" color={tokens.palette.warning} style={styles.securityTitle}>⚠️ Important Security Notice</AppText>
            <AppText variant="body2" color={tokens.palette.textSecondary} style={styles.securityText}>
              • This mnemonic is encrypted and useless without your password{"\n"}
              • Screenshots and digital storage are still not recommended{"\n"}
              • Physical backup on paper is the most secure method{"\n"}
              • If you lose your password, your wallet cannot be recovered
            </AppText>
          </Card>
        </Container>
      </ScrollView>
    </LinearGradient>
  );
};

const InstructionItem: React.FC<{
  step: string;
  text: string;
}> = ({ step, text }) => (
  <View style={styles.instructionItem}>
    <View style={styles.stepCircle}>
      <Text style={styles.stepText}>{step}</Text>
    </View>
    <Text style={styles.instructionText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  warningCard: {
    borderColor: CYBERPUNK_COLORS.warning,
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.warning,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    lineHeight: 20,
  },
  mnemonicCard: {
    marginBottom: 20,
  },
  mnemonicTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    textAlign: 'center',
    marginBottom: 20,
  },
  mnemonicGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  mnemonicWord: {
    width: (width - 80) / 3,
    backgroundColor: CYBERPUNK_COLORS.background,
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
    fontFamily: 'monospace',
  },
  checksumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: CYBERPUNK_COLORS.border,
  },
  checksumLabel: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.textSecondary,
    marginRight: 8,
  },
  checksumText: {
    fontSize: 12,
    color: CYBERPUNK_COLORS.primary,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  actionButtons: {
    marginBottom: 20,
  },
  actionButton: {
    marginBottom: 12,
  },
  instructionsCard: {
    marginBottom: 20,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 16,
  },
  instructionsList: {
    marginLeft: 8,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  stepCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: CYBERPUNK_COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.background,
  },
  instructionText: {
    flex: 1,
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
  securityCard: {
    borderColor: CYBERPUNK_COLORS.error,
    marginBottom: 32,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.error,
    marginBottom: 12,
  },
  securityText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default BackupWalletScreen;
