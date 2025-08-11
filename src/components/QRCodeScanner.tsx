import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { CYBERPUNK_COLORS } from '@constants/index';
import { CyberpunkButton } from '@components/index';

// Fallback QR scanner component
const QRCodeScanner: React.FC<{
  onScan: (data: string) => void;
  onClose: () => void;
}> = ({ onScan, onClose }) => {
  const [isScanning, setIsScanning] = useState(false);

  const handleScan = () => {
    Alert.alert(
      'QR Scanner',
      'Feature coming soon. This will allow you to scan QR codes.',
      [
        { text: 'OK' },
        { text: 'Simulate Scan', onPress: () => onScan('addr1qx2fxv2umyhttkxyxp8x0dlpdt3k6cwng5pxj3jhsydzer') }
      ]
    );
  };

  return (
    <LinearGradient
      colors={[CYBERPUNK_COLORS.background, '#1a1f3a']}
      style={styles.container}
    >
      <View style={styles.content}>
        <Text style={styles.title}>QR Code Scanner</Text>
        <Text style={styles.description}>
          Point your camera at a QR code to scan it
        </Text>
        
        <View style={styles.scannerPlaceholder}>
          <Text style={styles.placeholderText}>📱</Text>
          <Text style={styles.placeholderText}>Camera View</Text>
        </View>
        
        <View style={styles.actions}>
          <CyberpunkButton
            title="Start Scanning"
            onPress={handleScan}
            icon="🔍"
            size="large"
          />
          
          <CyberpunkButton
            title="Close"
            onPress={onClose}
            variant="outline"
            icon="✕"
            size="medium"
          />
        </View>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 18,
    color: CYBERPUNK_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  scannerPlaceholder: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
  },
  placeholderText: {
    fontSize: 40,
    color: CYBERPUNK_COLORS.textSecondary,
  },
  actions: {
    width: '100%',
    gap: 15,
  },
});

export default QRCodeScanner;
