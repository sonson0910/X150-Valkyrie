import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Share, Alert, Dimensions } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '../constants/index';
import { CardanoWalletService } from '../services/CardanoWalletService';
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { AppButton } from '../components/ui/AppButton';
import { AppText } from '../components/ui/AppText';
import { tokens } from '../theme/tokens';

type ReceiveScreenNavigationProp = StackNavigationProp<RootStackParamList, 'ReceiveScreen'>;

interface Props {
  navigation: ReceiveScreenNavigationProp;
}

const { width } = Dimensions.get('window');
const qrSize = Math.min(width * 0.6, 250);

const ReceiveScreen: React.FC<Props> = ({ navigation }) => {
  const [walletAddress] = useState('addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer3n0d3vllmyqwsx5wktcd8cc3sq835lu7drv2xwl2wywfgs');
  const [requestAmount, setRequestAmount] = useState('');
  const [requestMessage, setRequestMessage] = useState('');
  const [qrValue, setQrValue] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    updateQRCode();
  }, [requestAmount, requestMessage]);

  const updateQRCode = () => {
    if (requestAmount || requestMessage) {
      // Generate payment request QR
      const qrData = CardanoWalletService.generatePaymentQR(
        walletAddress,
        requestAmount,
        requestMessage
      );
      setQrValue(qrData);
    } else {
      // Simple address QR
      setQrValue(walletAddress);
    }
  };

  const handleShare = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      let shareMessage = `Send ADA to: ${walletAddress}`;
      
      if (requestAmount) {
        shareMessage += `\nAmount: ${requestAmount} ADA`;
      }
      
      if (requestMessage) {
        shareMessage += `\nMessage: ${requestMessage}`;
      }

      await Share.share({
        message: shareMessage,
        url: qrValue,
      });

    } catch (error) {
      console.error('Share error:', error);
      Alert.alert('Share Failed', 'Could not share address');
    }
  };

  const handleCopyAddress = async () => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      // Copy to clipboard
      try {
        const Clipboard = require('expo-clipboard');
        await Clipboard.setStringAsync(walletAddress);
        
        // Show success feedback
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert('Copied!', 'Wallet address copied to clipboard');
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        Alert.alert('Error', 'Failed to copy address to clipboard');
      }
    } catch (error) {
      console.error('Copy error:', error);
      Alert.alert('Copy Failed', 'Could not copy address');
    }
  };

  const handleClearRequest = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRequestAmount('');
    setRequestMessage('');
  };

  return (
    <LinearGradient colors={[tokens.palette.background, tokens.palette.surfaceAlt]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Container padded>
          {/* QR Code Card */}
          <Card glow style={styles.qrCard}>
            <View style={styles.qrContainer}>
              <AppText variant="h2" color={tokens.palette.primary} style={{ marginBottom: 20, textAlign: 'center' }}>
                {requestAmount || requestMessage ? 'Payment Request' : 'Wallet Address'}
              </AppText>
              <View style={styles.qrCodeWrapper}>
                <QRCode
                  value={qrValue}
                  size={qrSize}
                  backgroundColor="white"
                  color={tokens.palette.background}
                />
              </View>
              {/* QR Info */}
              <View style={styles.qrInfo}>
                {requestAmount && (
                  <View style={styles.infoRow}>
                    <AppText variant="body2" color={tokens.palette.textSecondary}>Amount:</AppText>
                    <AppText variant="body2">{requestAmount} ADA</AppText>
                  </View>
                )}
                {requestMessage && (
                  <View style={styles.infoRow}>
                    <AppText variant="body2" color={tokens.palette.textSecondary}>Message:</AppText>
                    <AppText variant="body2">{requestMessage}</AppText>
                  </View>
                )}
              </View>
              {/* Actions */}
              <View style={styles.qrActions}>
                <AppButton title="Share" onPress={handleShare} style={styles.actionButton} />
                <AppButton title="Copy Address" variant="secondary" onPress={handleCopyAddress} style={styles.actionButton} />
              </View>
            </View>
          </Card>

          {/* Address Display */}
          <Card style={styles.addressCard}>
            <AppText variant="h3" style={{ marginBottom: 8 }}>Wallet Address</AppText>
            <AppText variant="body2" color={tokens.palette.textSecondary} style={styles.address}>{walletAddress}</AppText>
          </Card>

          {/* Payment Request Form */}
          <Card style={styles.requestCard}>
            <View style={styles.sectionHeader}>
              <AppText variant="h3">Payment Request</AppText>
              <AppButton title={showAdvanced ? 'Hide' : 'Show'} variant="ghost" onPress={() => setShowAdvanced(!showAdvanced)} style={{ width: 120 }} />
            </View>
            {showAdvanced && (
              <View style={styles.requestForm}>
                <View style={{ marginBottom: 12 }}>
                  <AppText variant="body2" color={tokens.palette.textSecondary} style={{ marginBottom: 6 }}>Amount (ADA)</AppText>
                  <View style={{ backgroundColor: tokens.palette.surface, borderWidth: 1, borderColor: tokens.palette.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text style={{ color: tokens.palette.text, fontSize: 16 }}>{requestAmount}</Text>
                  </View>
                </View>
                <View style={{ marginBottom: 12 }}>
                  <AppText variant="body2" color={tokens.palette.textSecondary} style={{ marginBottom: 6 }}>Message</AppText>
                  <View style={{ backgroundColor: tokens.palette.surface, borderWidth: 1, borderColor: tokens.palette.border, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
                    <Text style={{ color: tokens.palette.text, fontSize: 16 }}>{requestMessage}</Text>
                  </View>
                </View>
                {(requestAmount || requestMessage) && (
                  <AppButton title="Clear Request" variant="ghost" onPress={handleClearRequest} style={styles.clearButton} />
                )}
              </View>
            )}
          </Card>

          {/* Instructions */}
          <Card variant="outline" style={styles.instructionsCard}>
            <AppText variant="h3" color={tokens.palette.primary} style={{ marginBottom: 16 }}>📖 How to Receive ADA</AppText>
            <View style={styles.instructionsList}>
              <InstructionItem step="1" text="Share your wallet address or QR code with the sender" />
              <InstructionItem step="2" text="Or create a payment request with specific amount and message" />
              <InstructionItem step="3" text="Transactions will appear in your wallet once confirmed" />
              <InstructionItem step="4" text="Allow 2-5 minutes for network confirmation" />
            </View>
          </Card>

          {/* Security Notice */}
          <Card variant="outline" style={styles.securityCard}>
            <AppText variant="h3" color={tokens.palette.warning} style={{ marginBottom: 12 }}>🛡️ Security Notice</AppText>
            <AppText variant="body2" color={tokens.palette.textSecondary} style={styles.securityText}>
              Your address is safe to share publicly. However, be cautious when sharing payment requests with amounts, as they could be reused by others.
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
  qrCard: {
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
    width: '100%',
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 20,
    textAlign: 'center',
  },
  qrCodeWrapper: {
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  qrInfo: {
    width: '100%',
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.text,
    fontWeight: '600',
  },
  qrActions: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  addressCard: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 12,
  },
  address: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  requestCard: {
    marginTop: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  requestForm: {
    marginTop: 16,
  },
  clearButton: {
    alignSelf: 'flex-start',
  },
  instructionsCard: {
    marginTop: 16,
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
    marginTop: 16,
    marginBottom: 32,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.warning,
    marginBottom: 12,
  },
  securityText: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
});

export default ReceiveScreen;
