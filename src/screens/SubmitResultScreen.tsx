import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { StackScreenProps } from '@react-navigation/stack';
import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '../constants/index';
import * as Clipboard from 'expo-clipboard';
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { AppText } from '../components/ui/AppText';
import { AppButton } from '../components/ui/AppButton';
import { tokens } from '../theme/tokens';

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
      <Container center padded full>
        <Card style={{ width: '100%', maxWidth: 600 }}>
          <AppText variant="h2" style={{ textAlign: 'center', marginBottom: 12 }}>Transaction Submitted</AppText>
          <AppText variant="body2" color={tokens.palette.textSecondary} style={{ textAlign: 'center' }}>Hash</AppText>
          <AppText variant="caption" style={styles.hash}>{txHash}</AppText>

          <View style={styles.actions}>
            <AppButton title="Copy Hash" onPress={copyHash} style={{ flex: 1 }} />
            <AppButton title="Open Explorer" variant="secondary" onPress={openExplorer} style={{ flex: 1, marginLeft: 12 }} />
          </View>

          <AppButton title="View History" onPress={() => navigation.navigate('TransactionHistory')} style={{ marginTop: 20 }} />
        </Card>
      </Container>
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
  },
});

export default SubmitResultScreen;


