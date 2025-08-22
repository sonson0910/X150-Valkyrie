import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as SecureStore from 'expo-secure-store';
import * as Clipboard from 'expo-clipboard';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS, STORAGE_KEYS } from '../constants/index';
import { BiometricService } from '../services/BiometricService';
import { MnemonicEncryptionService } from '../services/MnemonicEncryptionService';
import MnemonicTransformService from '../services/MnemonicTransformService';
import { FullScreenLoader } from '../components/index';
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { AppButton } from '../components/ui/AppButton';
import { AppText } from '../components/ui/AppText';
import { tokens } from '../theme/tokens';

type TransformedMnemonicScreenNavigationProp = StackNavigationProp<RootStackParamList, 'TransformedMnemonic'>;

interface Props {
  navigation: TransformedMnemonicScreenNavigationProp;
}

const { width } = Dimensions.get('window');

const TransformedMnemonicScreen: React.FC<Props> = ({ navigation }) => {
  const [transformedMnemonic, setTransformedMnemonic] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userPassword, setUserPassword] = useState('');
  const [checksum, setChecksum] = useState('');

  useEffect(() => {
    authenticateUser();
  }, []);

  const authenticateUser = async () => {
    try {
      setIsLoading(true);
      
      // Authenticate with biometric first
      const biometricService = BiometricService.getInstance();
      const result = await biometricService.authenticateWithBiometric(
        'Access 36-word transformed mnemonic'
      );
      
      if (result.success) {
        setIsAuthenticated(true);
        // Load the transformed mnemonic
        await loadTransformedMnemonic();
      } else {
        Alert.alert(
          'Authentication Failed',
          'You need to authenticate to view your transformed mnemonic.',
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

  const loadTransformedMnemonic = async () => {
    try {
      // Get encrypted mnemonic from secure storage
      const encryptedDataStr = await SecureStore.getItemAsync(STORAGE_KEYS.ENCRYPTED_MNEMONIC);
      
      if (!encryptedDataStr) {
        Alert.alert('Error', 'No encrypted mnemonic found. Please create a wallet first.');
        navigation.goBack();
        return;
      }

      // We need the user's password to decrypt and transform
      Alert.prompt(
        'Enter Password',
        'Enter your personal password to display the 36-word transformed mnemonic',
        [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => navigation.goBack()
          },
          {
            text: 'OK',
            onPress: async (password) => {
              if (!password) {
                navigation.goBack();
                return;
              }
              await generateTransformedMnemonic(password);
            }
          }
        ],
        'secure-text'
      );
    } catch (error) {
      console.error('Failed to load encrypted mnemonic:', error);
      Alert.alert('Error', 'Failed to load wallet data');
      navigation.goBack();
    }
  };

  const generateTransformedMnemonic = async (password: string) => {
    try {
      setIsLoading(true);
      setUserPassword(password);

      // Get encrypted mnemonic
      const encryptedDataStr = await SecureStore.getItemAsync(STORAGE_KEYS.ENCRYPTED_MNEMONIC);
      if (!encryptedDataStr) {
        throw new Error('No encrypted mnemonic found');
      }

      const encryptedData = JSON.parse(encryptedDataStr);
      
      // Decrypt the original mnemonic
      const originalMnemonic = await MnemonicEncryptionService.decryptMnemonic(
        encryptedData,
        password
      );
      
      // Transform the original mnemonic to 36 words
      const transformed = await MnemonicTransformService.transformMnemonic(
        originalMnemonic,
        password
      );
      
      setTransformedMnemonic(transformed);
      
      // Generate checksum for verification
      const checksumValue = MnemonicEncryptionService.hashMnemonic(transformed);
      setChecksum(checksumValue);
      
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
    } catch (error) {
      console.error('Failed to generate transformed mnemonic:', error);
      Alert.alert(
        'Invalid Password', 
        'The password you entered is incorrect. Please try again.',
        [
          { text: 'Try Again', onPress: loadTransformedMnemonic },
          { text: 'Cancel', onPress: () => navigation.goBack() }
        ]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyMnemonic = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await Clipboard.setStringAsync(transformedMnemonic);
      
      Alert.alert(
        'Copied to Clipboard',
        'Your 36-word transformed mnemonic has been copied. This only works with your password in Valkyrie wallet.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert('Copy Failed', 'Unable to copy to clipboard');
    }
  };

  const handleVerifyTransformation = async () => {
    try {
      if (!transformedMnemonic || !userPassword) {
        Alert.alert('Error', 'No transformed mnemonic available');
        return;
      }

      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Verify that we can restore the original from transformed
      const restored = await MnemonicTransformService.restoreOriginalMnemonic(
        transformedMnemonic,
        userPassword
      );
      
      Alert.alert(
        'Verification Successful ✅',
        'The transformation is valid and can be restored with your password.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      Alert.alert(
        'Verification Failed ❌',
        'There was an issue with the transformation. Please regenerate.',
        [{ text: 'OK' }]
      );
    }
  };

  if (!isAuthenticated || isLoading) {
    return (
      <FullScreenLoader
        visible={true}
        message={isLoading ? "Loading transformed mnemonic..." : "Authenticating..."}
      />
    );
  }

  if (!transformedMnemonic) {
    return (
      <LinearGradient colors={[tokens.palette.background, tokens.palette.surfaceAlt]} style={styles.container}>
        <Container>
          <Card style={styles.messageCard}>
            <AppText variant="h2" color={tokens.palette.warning} style={styles.messageTitle}>
              🔄 No Transformed Mnemonic
            </AppText>
            <AppText variant="body2" color={tokens.palette.textSecondary} style={styles.messageText}>
              No transformed mnemonic is available. Please ensure you have created a wallet and entered the correct password.
            </AppText>
            <AppButton 
              title="Go Back" 
              onPress={() => navigation.goBack()}
              style={styles.messageButton}
            />
          </Card>
        </Container>
      </LinearGradient>
    );
  }

  const words = transformedMnemonic.split(' ');

  return (
    <LinearGradient colors={[tokens.palette.background, tokens.palette.surfaceAlt]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Container>
          {/* Header */}
          <Card variant="outline" style={styles.headerCard}>
            <AppText variant="h2" color={tokens.palette.primary} style={styles.headerTitle}>
              🔄 36-Word Transformed Mnemonic
            </AppText>
            <AppText variant="body2" color={tokens.palette.textSecondary} style={styles.headerDescription}>
              This is your transformed mnemonic phrase (36 words). It can only be restored with your personal password in Valkyrie wallet.
            </AppText>
          </Card>

          {/* Mnemonic Display */}
          <Card glow style={styles.mnemonicCard}>
            <AppText variant="h3" color={tokens.palette.primary} style={styles.mnemonicTitle}>
              Transformed Phrase ({words.length} words)
            </AppText>
            
            <View style={styles.mnemonicGrid}>
              {words.map((word, index) => (
                <View key={index} style={styles.mnemonicWord}>
                  <AppText variant="caption" color={tokens.palette.textSecondary} style={styles.mnemonicIndex}>
                    {index + 1}
                  </AppText>
                  <AppText variant="body2" style={styles.mnemonicText}>
                    {word}
                  </AppText>
                </View>
              ))}
            </View>
            
            <View style={styles.checksumContainer}>
              <AppText variant="caption" color={tokens.palette.textSecondary} style={styles.checksumLabel}>
                Checksum:
              </AppText>
              <AppText variant="caption" color={tokens.palette.primary} style={styles.checksumText}>
                {checksum}
              </AppText>
            </View>
          </Card>

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <AppButton 
              title="Copy 36-Word Phrase" 
              onPress={handleCopyMnemonic} 
              style={styles.actionButton} 
            />
            <AppButton 
              title="Verify Transformation" 
              variant="secondary" 
              onPress={handleVerifyTransformation} 
              style={styles.actionButton} 
            />
          </View>

          {/* Transformation Info */}
          <Card style={styles.infoCard}>
            <AppText variant="h3" color={tokens.palette.primary} style={styles.infoTitle}>
              🔬 How Transformation Works
            </AppText>
            <View style={styles.infoList}>
              <InfoItem 
                step="1" 
                text="Original 24-word mnemonic is converted to 256-bit entropy" 
              />
              <InfoItem 
                step="2" 
                text="PBKDF2 generates keystream from your password + random salt" 
              />
              <InfoItem 
                step="3" 
                text="Entropy is XOR-masked with keystream" 
              />
              <InfoItem 
                step="4" 
                text="Masked entropy → 24 words + salt → 12 words = 36 total" 
              />
              <InfoItem 
                step="5" 
                text="Only reversible with your exact password" 
              />
            </View>
          </Card>

          {/* Security Warning */}
          <Card variant="outline" style={styles.warningCard}>
            <AppText variant="h3" color={tokens.palette.warning} style={styles.warningTitle}>
              ⚠️ Security Notice
            </AppText>
            <AppText variant="body2" color={tokens.palette.textSecondary} style={styles.warningText}>
              • This 36-word phrase is useless without your password{"\n"}
              • Only Valkyrie wallet can process this transformation{"\n"}
              • Store both the phrase AND password securely{"\n"}
              • If you lose your password, these 36 words cannot restore your wallet
            </AppText>
          </Card>
        </Container>
      </ScrollView>
    </LinearGradient>
  );
};

const InfoItem: React.FC<{
  step: string;
  text: string;
}> = ({ step, text }) => (
  <View style={styles.infoItem}>
    <View style={styles.stepCircle}>
      <Text style={styles.stepText}>{step}</Text>
    </View>
    <Text style={styles.infoText}>{text}</Text>
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
  headerCard: {
    borderColor: CYBERPUNK_COLORS.primary,
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerDescription: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  messageCard: {
    alignItems: 'center',
    padding: 32,
  },
  messageTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  messageText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  messageButton: {
    minWidth: 120,
  },
  mnemonicCard: {
    marginBottom: 20,
  },
  mnemonicTitle: {
    fontSize: 18,
    fontWeight: 'bold',
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
    marginBottom: 4,
  },
  mnemonicText: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'monospace',
    textAlign: 'center',
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
    marginRight: 8,
  },
  checksumText: {
    fontSize: 12,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  actionButtons: {
    marginBottom: 20,
  },
  actionButton: {
    marginBottom: 12,
  },
  infoCard: {
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoList: {
    marginLeft: 8,
  },
  infoItem: {
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
  infoText: {
    flex: 1,
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
  warningCard: {
    borderColor: CYBERPUNK_COLORS.warning,
    marginBottom: 32,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  warningText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default TransformedMnemonicScreen;
