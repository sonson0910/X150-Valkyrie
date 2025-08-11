import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Share,
  Alert,
  Dimensions,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import QRCode from 'react-native-qrcode-svg';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '@constants/index';
import { CardanoWalletService } from '@services/CardanoWalletService';
import { 
  CyberpunkButton, 
  CyberpunkInput, 
  CyberpunkCard 
} from '@components/index';

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
    <LinearGradient
      colors={[CYBERPUNK_COLORS.background, '#1a1f3a']}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* QR Code Card */}
        <CyberpunkCard variant="glow" style={styles.qrCard}>
          <View style={styles.qrContainer}>
            <Text style={styles.qrTitle}>
              {requestAmount || requestMessage ? 'Payment Request' : 'Wallet Address'}
            </Text>
            
            <View style={styles.qrCodeWrapper}>
              <QRCode
                value={qrValue}
                size={qrSize}
                backgroundColor="white"
                color={CYBERPUNK_COLORS.background}
                logo={{
                  uri: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
                }}
                logoSize={qrSize * 0.15}
                logoBackgroundColor="transparent"
              />
            </View>

            {/* QR Info */}
            <View style={styles.qrInfo}>
              {requestAmount && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Amount:</Text>
                  <Text style={styles.infoValue}>{requestAmount} ADA</Text>
                </View>
              )}
              
              {requestMessage && (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Message:</Text>
                  <Text style={styles.infoValue}>{requestMessage}</Text>
                </View>
              )}
            </View>

            {/* Action Buttons */}
            <View style={styles.qrActions}>
              <CyberpunkButton
                title="Share"
                onPress={handleShare}
                icon="📤"
                size="medium"
                style={styles.actionButton}
              />
              <CyberpunkButton
                title="Copy Address"
                onPress={handleCopyAddress}
                variant="outline"
                icon="📋"
                size="medium"
                style={styles.actionButton}
              />
            </View>
          </View>
        </CyberpunkCard>

        {/* Address Display */}
        <CyberpunkCard style={styles.addressCard}>
          <Text style={styles.sectionTitle}>Wallet Address</Text>
          <Text style={styles.address}>{walletAddress}</Text>
        </CyberpunkCard>

        {/* Payment Request Form */}
        <CyberpunkCard style={styles.requestCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Payment Request</Text>
            <CyberpunkButton
              title={showAdvanced ? "Hide" : "Show"}
              onPress={() => setShowAdvanced(!showAdvanced)}
              variant="outline"
              size="small"
            />
          </View>

          {showAdvanced && (
            <View style={styles.requestForm}>
              <CyberpunkInput
                label="Amount (ADA)"
                value={requestAmount}
                onChangeText={setRequestAmount}
                placeholder="0.00"
                keyboardType="numeric"
                leftIcon="💰"
                hint="Optional: specify amount to request"
              />

              <CyberpunkInput
                label="Message"
                value={requestMessage}
                onChangeText={setRequestMessage}
                placeholder="Payment for..."
                leftIcon="💬"
                hint="Optional: add a note for the sender"
                multiline
                numberOfLines={3}
              />

              {(requestAmount || requestMessage) && (
                <CyberpunkButton
                  title="Clear Request"
                  onPress={handleClearRequest}
                  variant="outline"
                  size="small"
                  style={styles.clearButton}
                />
              )}
            </View>
          )}
        </CyberpunkCard>

        {/* Instructions */}
        <CyberpunkCard variant="outline" style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📖 How to Receive ADA</Text>
          
          <View style={styles.instructionsList}>
            <InstructionItem
              step="1"
              text="Share your wallet address or QR code with the sender"
            />
            <InstructionItem
              step="2"
              text="Or create a payment request with specific amount and message"
            />
            <InstructionItem
              step="3"
              text="Transactions will appear in your wallet once confirmed"
            />
            <InstructionItem
              step="4"
              text="Allow 2-5 minutes for network confirmation"
            />
          </View>
        </CyberpunkCard>

        {/* Security Notice */}
        <CyberpunkCard variant="outline" style={styles.securityCard}>
          <Text style={styles.securityTitle}>🛡️ Security Notice</Text>
          <Text style={styles.securityText}>
            Your address is safe to share publicly. However, be cautious when sharing payment requests with amounts, as they could be reused by others.
          </Text>
        </CyberpunkCard>
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
