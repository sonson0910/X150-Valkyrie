import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

import { CYBERPUNK_COLORS } from '@constants/index';
import { CyberpunkButton } from '@components/index';

// Lightweight placeholder scanner (no native camera) to keep build green on CI.
const QRCodeScanner: React.FC<{
  onScan: (data: string) => void;
  onClose: () => void;
}> = ({ onScan, onClose }) => {
  const [scanned, setScanned] = useState(false);

  const handleBarCodeScanned = useCallback(async (data: string) => {
    if (scanned) return;
    setScanned(true);
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
    try {
      onScan(data);
    } catch (e) {
      Alert.alert('Scan Error', 'Failed to process QR data');
    }
  }, [scanned, onScan]);

  return (
    <LinearGradient colors={[CYBERPUNK_COLORS.background, '#1a1f3a']} style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>QR Code Scanner</Text>
        <View style={styles.scannerBox}>
          {!scanned ? (
            <Text style={styles.hint}>Placeholder scanner (no camera). Use NFC or Simulate.</Text>
          ) : (
            <TouchableOpacity style={styles.rescanBtn} onPress={() => setScanned(false)}>
              <Text style={styles.rescanText}>Scan Again</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.actions}>
          {!scanned && (
            <CyberpunkButton title="Simulate Scan" onPress={() => handleBarCodeScanned('addr1qexampleqrcodepayload')} icon="🔍" size="large" />
          )}
          <CyberpunkButton title="Close" onPress={onClose} variant="outline" icon="✕" size="medium" />
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
  scannerBox: {
    width: 260,
    height: 260,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    marginBottom: 20,
  },
  hint: {
    position: 'absolute',
    bottom: 10,
    width: '100%',
    textAlign: 'center',
    color: CYBERPUNK_COLORS.textSecondary,
  },
  rescanBtn: {
    position: 'absolute',
    bottom: 8,
    alignSelf: 'center',
    backgroundColor: CYBERPUNK_COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  rescanText: {
    color: CYBERPUNK_COLORS.background,
    fontWeight: '600',
  },
  actions: {
    width: '100%',
    gap: 15,
  },
});

export default QRCodeScanner;
