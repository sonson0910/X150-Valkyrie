import React from 'react';
import { View, StyleSheet, Modal } from 'react-native';
import { CYBERPUNK_COLORS } from '../constants';
import { Transaction } from '../types/wallet';
import { CardanoAPIService } from '../services/CardanoAPIService';
import { Card } from '../components/ui/Card';
import { AppText } from '../components/ui/AppText';
import { AppButton } from '../components/ui/AppButton';
import { tokens } from '../theme/tokens';

type Props = {
  visible: boolean;
  onClose: () => void;
  transaction: Transaction | null;
};

const TransactionPreviewModal: React.FC<Props> = ({ visible, onClose, transaction }) => {
  if (!transaction) return null;
  const ada = CardanoAPIService.lovelaceToAda(transaction.amount);
  const feeAda = CardanoAPIService.lovelaceToAda(transaction.fee || '0');
  const changeAda = transaction.metadata?.change ? CardanoAPIService.lovelaceToAda(transaction.metadata.change) : '0';
  const minAdaAda = transaction.metadata?.minAdaRequired ? CardanoAPIService.lovelaceToAda(transaction.metadata.minAdaRequired) : undefined;
  const ttl = transaction.metadata?.ttl;
  const inputs = transaction.inputs || [];
  const ttlWarning = typeof ttl === 'number' && ttl < Date.now() / 1000 + 15 * 60; // rough check

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Card style={styles.cardBox}>
          <AppText variant="h2" color={tokens.palette.primary} style={styles.title}>Transaction Preview</AppText>
          <AppText>From: {transaction.from}</AppText>
          <AppText>To: {transaction.to}</AppText>
          <AppText>Amount: {ada} ADA</AppText>
          <AppText>Fee: {feeAda} ADA</AppText>
          {typeof ttl === 'number' && (
            <AppText color={ttlWarning ? tokens.palette.warning : tokens.palette.text}>TTL: {ttl}{ttlWarning ? ' (expiring soon)' : ''}</AppText>
          )}
          {!!minAdaAda && (
            <AppText>Min-ADA Required: {minAdaAda} ADA</AppText>
          )}
          <AppText>Change (est.): {changeAda} ADA</AppText>
          {inputs.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <AppText variant="h3" color={tokens.palette.accent} style={styles.subtitle}>Inputs</AppText>
              {inputs.map((i, idx) => (
                <AppText key={`${i.tx_hash}:${i.tx_index}`}>#{idx + 1} {i.tx_hash.slice(0,8)}...:{i.tx_index}</AppText>
              ))}
            </View>
          )}
          {!!transaction.assets?.length && (
            <View style={{ marginTop: 10 }}>
              <AppText variant="h3" color={tokens.palette.accent} style={styles.subtitle}>Assets</AppText>
              {transaction.assets.map(a => (
                <AppText key={a.unit}>{a.unit.slice(0,56)}... {a.quantity}</AppText>
              ))}
            </View>
          )}
          <AppButton title="Close" variant="secondary" onPress={onClose} style={{ marginTop: 16 }} />
        </Card>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  cardBox: { width: '90%' },
  title: { marginBottom: 8 },
  subtitle: { marginTop: 4 },
});

export default TransactionPreviewModal;


