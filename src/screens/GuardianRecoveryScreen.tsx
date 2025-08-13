import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, TextInput, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '../constants';
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { AppText } from '../components/ui/AppText';
import { AppButton } from '../components/ui/AppButton';
import { tokens } from '../theme/tokens';
import { GuardianRecoveryService, GuardianPolicy, RecoveryRequest } from '../services/GuardianRecoveryService';
import { GuardianKeyService } from '../services/GuardianKeyService';

const GuardianRecoveryScreen: React.FC = () => {
  const svc = GuardianRecoveryService.getInstance();
  const [policy, setPolicy] = useState<GuardianPolicy | null>(null);
  const [request, setRequest] = useState<RecoveryRequest | null>(null);
  const [canFinalizeMsg, setCanFinalizeMsg] = useState<string>('');
  const [threshold, setThreshold] = useState<string>('1');
  const [cooldown, setCooldown] = useState<string>('24');
  const [newGuardianLabel, setNewGuardianLabel] = useState<string>('');
  const [newGuardianContact, setNewGuardianContact] = useState<string>('');

  const load = async () => {
    const p = await svc.getPolicy();
    const r = await svc.getActiveRecovery();
    setPolicy(p);
    setRequest(r);
    const can = await svc.canFinalize();
    setCanFinalizeMsg(can.ok ? 'Ready to finalize' : (can.reason || 'Not ready'));
    if (p) {
      setThreshold(String(p.threshold));
      setCooldown(String(p.cooldownHours));
    }
  };

  useEffect(() => { load(); }, []);

  const handleStart = async () => {
    const r = await svc.startRecovery('user');
    setRequest(r);
    Alert.alert('Recovery started', r.id);
  };

  const handleApproveMock = async () => {
    if (!policy) return;
    if (!request) return;
    const nextGuardian = policy.guardians.find(g => !request.approvals.some(a => a.guardianId === g.id));
    if (!nextGuardian) { Alert.alert('All guardians approved'); return; }
    // Real signature using device biometrics
    const keySvc = GuardianKeyService.getInstance();
    const pubkey = await keySvc.getOrCreatePublicKey('Enroll guardian key');
    const payload = JSON.stringify({ requestId: request.id, guardianId: nextGuardian.id });
    const signature = await keySvc.signApproval(payload, 'Approve recovery');
    const verified = await svc.verifyApproval(nextGuardian.id, payload, signature, pubkey);
    if (!verified) { Alert.alert('Verification failed'); return; }
    await svc.approveRecovery(nextGuardian.id, signature);
    await load();
  };

  const handleFinalize = async () => {
    const ok = await svc.canFinalize();
    if (!ok.ok) { Alert.alert('Cannot finalize', ok.reason || ''); return; }
    // In real flow, prompt for new encrypted mnemonic JSON produced after password reset
    const success = await svc.finalizeRecovery('{"encryptedData":"..."}');
    Alert.alert(success ? 'Recovery finalized' : 'Finalize failed');
    await load();
  };

  const addGuardian = async () => {
    const current = policy || { threshold: 1, cooldownHours: 24, guardians: [] };
    const newG = { id: `g_${Date.now()}`, label: newGuardianLabel || 'Guardian', contact: newGuardianContact, addedAt: Date.now() } as any;
    const updated: GuardianPolicy = {
      threshold: Math.max(1, Math.min(parseInt(threshold || '1', 10), (current.guardians.length + 1))),
      cooldownHours: Math.max(0, parseInt(cooldown || '0', 10)),
      guardians: [...current.guardians, newG],
    };
    await svc.savePolicy(updated);
    setNewGuardianLabel(''); setNewGuardianContact('');
    await load();
  };

  const removeGuardian = async (gid: string) => {
    if (!policy) return;
    const updated: GuardianPolicy = {
      threshold: Math.max(1, Math.min(parseInt(threshold || '1', 10), Math.max(1, policy.guardians.length - 1))),
      cooldownHours: Math.max(0, parseInt(cooldown || '0', 10)),
      guardians: policy.guardians.filter(g => g.id !== gid),
    };
    await svc.savePolicy(updated);
    await load();
  };

  const savePolicyBasics = async () => {
    const base = policy || { guardians: [], threshold: 1, cooldownHours: 24 } as GuardianPolicy;
    const updated: GuardianPolicy = {
      guardians: base.guardians,
      threshold: Math.max(1, Math.min(parseInt(threshold || '1', 10), Math.max(1, base.guardians.length))),
      cooldownHours: Math.max(0, parseInt(cooldown || '0', 10)),
    };
    await svc.savePolicy(updated);
    await load();
  };

  return (
    <LinearGradient colors={[tokens.palette.background, tokens.palette.surfaceAlt]} style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Container>
          <Card style={styles.section}>
            <AppText variant="h2" color={tokens.palette.primary} style={styles.title}>Guardian Policy</AppText>
            {policy ? (
              <>
                <AppText style={styles.text}>Threshold: {policy.threshold}</AppText>
                <AppText style={styles.text}>Cooldown: {policy.cooldownHours}h</AppText>
                <FlatList
                  data={policy.guardians}
                  keyExtractor={g => g.id}
                  renderItem={({ item }) => (
                    <View style={[styles.guardianItem, { flexDirection: 'row', justifyContent: 'space-between' }]}>
                      <AppText>{item.label} • {item.contact}</AppText>
                      <TouchableOpacity onPress={() => removeGuardian(item.id)}><AppText color={tokens.palette.warning}>Remove</AppText></TouchableOpacity>
                    </View>
                  )}
                />
              </>
            ) : (
              <AppText style={styles.text}>No policy configured</AppText>
            )}
            <View style={{ marginTop: 8 }}>
              <AppText style={styles.text}>Threshold</AppText>
              <TextInput value={threshold} onChangeText={setThreshold} style={styles.input} keyboardType="numeric" />
              <AppText style={[styles.text, { marginTop: 8 }]}>Cooldown (hours)</AppText>
              <TextInput value={cooldown} onChangeText={setCooldown} style={styles.input} keyboardType="numeric" />
              <AppButton title="Save Policy" onPress={savePolicyBasics} style={styles.btnLike} />
            </View>
            <View style={{ marginTop: 12 }}>
              <AppText style={styles.text}>Add Guardian</AppText>
              <TextInput placeholder="Label" placeholderTextColor={CYBERPUNK_COLORS.textSecondary} style={styles.input} value={newGuardianLabel} onChangeText={setNewGuardianLabel} />
              <TextInput placeholder="Contact (email/phone/deviceId)" placeholderTextColor={CYBERPUNK_COLORS.textSecondary} style={styles.input} value={newGuardianContact} onChangeText={setNewGuardianContact} />
              <AppButton title="Add Guardian" onPress={addGuardian} style={styles.btnLike} />
            </View>
          </Card>

          <Card style={styles.section}>
            <AppText variant="h2" color={tokens.palette.primary} style={styles.title}>Recovery Request</AppText>
            {request ? (
              <>
                <AppText style={styles.text}>ID: {request.id}</AppText>
                <AppText style={styles.text}>Approvals: {request.approvals.length}</AppText>
                <AppText style={styles.text}>Status: {request.status}</AppText>
                <AppText style={styles.text}>{canFinalizeMsg}</AppText>
                <AppButton title="Mock Approve Next Guardian" onPress={handleApproveMock} style={styles.btnLike} />
                <AppButton title="Finalize Recovery" onPress={handleFinalize} style={styles.btnLike} />
              </>
            ) : (
              <AppButton title="Start Recovery" onPress={handleStart} style={styles.btnLike} />
            )}
          </Card>
        </Container>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  section: { marginBottom: 24 },
  title: { color: CYBERPUNK_COLORS.primary, fontSize: 18, fontWeight: '700', marginBottom: 8 },
  text: { color: CYBERPUNK_COLORS.text, marginBottom: 6 },
  guardianItem: { padding: 10, backgroundColor: CYBERPUNK_COLORS.surface, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: CYBERPUNK_COLORS.border },
  btn: { backgroundColor: CYBERPUNK_COLORS.primary, padding: 12, borderRadius: 10, marginTop: 8 },
  btnText: { color: '#0a0e27', textAlign: 'center', fontWeight: '700' },
  input: { backgroundColor: CYBERPUNK_COLORS.surface, color: CYBERPUNK_COLORS.text, borderWidth: 1, borderColor: CYBERPUNK_COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6 },
  btnLike: { marginTop: 8 },
});

export default GuardianRecoveryScreen;


