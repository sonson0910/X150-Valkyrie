import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity } from 'react-native';
import { CYBERPUNK_COLORS } from '../constants';
import { Transaction } from '../types/wallet';
import { CardanoAPIService } from '../services/CardanoAPIService';

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
        <View style={styles.card}>
          <Text style={styles.title}>Transaction Preview</Text>
          <Text style={styles.text}>From: {transaction.from}</Text>
          <Text style={styles.text}>To: {transaction.to}</Text>
          <Text style={styles.text}>Amount: {ada} ADA</Text>
          <Text style={styles.text}>Fee: {feeAda} ADA</Text>
          {typeof ttl === 'number' && (
            <Text style={[styles.text, ttlWarning && { color: CYBERPUNK_COLORS.warning }]}>TTL: {ttl}{ttlWarning ? ' (expiring soon)' : ''}</Text>
          )}
          {!!minAdaAda && (
            <Text style={styles.text}>Min-ADA Required: {minAdaAda} ADA</Text>
          )}
          <Text style={styles.text}>Change (est.): {changeAda} ADA</Text>
          {inputs.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.subtitle}>Inputs</Text>
              {inputs.map((i, idx) => (
                <Text key={`${i.tx_hash}:${i.tx_index}`} style={styles.text}>#{idx + 1} {i.tx_hash.slice(0,8)}...:{i.tx_index}</Text>
              ))}
            </View>
          )}
          {!!transaction.assets?.length && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.subtitle}>Assets</Text>
              {transaction.assets.map(a => (
                <Text key={a.unit} style={styles.text}>{a.unit.slice(0,56)}... {a.quantity}</Text>
              ))}
            </View>
          )}
          <TouchableOpacity style={styles.btn} onPress={onClose}><Text style={styles.btnText}>Close</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  card: { width: '90%', backgroundColor: CYBERPUNK_COLORS.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: CYBERPUNK_COLORS.border },
  title: { color: CYBERPUNK_COLORS.primary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: CYBERPUNK_COLORS.accent, fontSize: 16, fontWeight: '600', marginTop: 4 },
  text: { color: CYBERPUNK_COLORS.text, marginTop: 4 },
  btn: { backgroundColor: CYBERPUNK_COLORS.primary, padding: 10, borderRadius: 10, marginTop: 16 },
  btnText: { color: '#0a0e27', textAlign: 'center', fontWeight: '700' },
});

export default TransactionPreviewModal;


