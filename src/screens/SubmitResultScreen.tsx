import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '../constants/index';
import * as Clipboard from 'expo-clipboard';

type Props = StackScreenProps<RootStackParamList, 'SubmitResult'>;

const SubmitResultScreen: React.FC<Props> = ({ route, navigation }) => {
  const { txHash, network } = route.params;

  const explorerBase = network === 'mainnet'
    ? 'https://cardanoscan.io/transaction/'
    : 'https://testnet.cardanoscan.io/transaction/';

  const copyHash = async () => {
    await Clipboard.setStringAsync(txHash);
    if (Platform.OS !== 'web') {
      // simple feedback; toast can be used too
    }
  };

  const openExplorer = () => {
    if (Platform.OS === 'web') {
      (window as any).open(explorerBase + txHash, '_blank');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Transaction Submitted</Text>
      <Text style={styles.label}>Hash</Text>
      <Text style={styles.hash}>{txHash}</Text>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.button} onPress={copyHash}>
          <Text style={styles.buttonText}>Copy Hash</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.button, { backgroundColor: CYBERPUNK_COLORS.accent }]} onPress={openExplorer}>
          <Text style={styles.buttonText}>Open Explorer</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={[styles.button, { marginTop: 20 }]} onPress={() => navigation.navigate('TransactionHistory')}>
        <Text style={styles.buttonText}>View History</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: CYBERPUNK_COLORS.background,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: CYBERPUNK_COLORS.text,
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 16,
  },
  label: {
    color: CYBERPUNK_COLORS.textSecondary,
    marginTop: 8,
  },
  hash: {
    color: CYBERPUNK_COLORS.text,
    fontFamily: Platform.select({ ios: 'Courier', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 12,
  },
  button: {
    backgroundColor: CYBERPUNK_COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: CYBERPUNK_COLORS.background,
    fontWeight: '600',
  },
});

export default SubmitResultScreen;


