import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, TextInput, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '../constants';
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
    <LinearGradient colors={[CYBERPUNK_COLORS.background, '#1a1f3a']} style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.section}>
        <Text style={styles.title}>Guardian Policy</Text>
        {policy ? (
          <>
            <Text style={styles.text}>Threshold: {policy.threshold}</Text>
            <Text style={styles.text}>Cooldown: {policy.cooldownHours}h</Text>
            <FlatList
              data={policy.guardians}
              keyExtractor={g => g.id}
              renderItem={({ item }) => (
                <View style={[styles.guardianItem, { flexDirection: 'row', justifyContent: 'space-between' }]}>
                  <Text style={styles.text}>{item.label} • {item.contact}</Text>
                  <TouchableOpacity onPress={() => removeGuardian(item.id)}><Text style={[styles.text, { color: CYBERPUNK_COLORS.warning }]}>Remove</Text></TouchableOpacity>
                </View>
              )}
            />
          </>
        ) : (
          <Text style={styles.text}>No policy configured</Text>
        )}
        <View style={{ marginTop: 8 }}>
          <Text style={styles.text}>Threshold</Text>
          <TextInput value={threshold} onChangeText={setThreshold} style={styles.input} keyboardType="numeric" />
          <Text style={[styles.text, { marginTop: 8 }]}>Cooldown (hours)</Text>
          <TextInput value={cooldown} onChangeText={setCooldown} style={styles.input} keyboardType="numeric" />
          <TouchableOpacity style={styles.btn} onPress={savePolicyBasics}><Text style={styles.btnText}>Save Policy</Text></TouchableOpacity>
        </View>
        <View style={{ marginTop: 12 }}>
          <Text style={styles.text}>Add Guardian</Text>
          <TextInput placeholder="Label" placeholderTextColor={CYBERPUNK_COLORS.textSecondary} style={styles.input} value={newGuardianLabel} onChangeText={setNewGuardianLabel} />
          <TextInput placeholder="Contact (email/phone/deviceId)" placeholderTextColor={CYBERPUNK_COLORS.textSecondary} style={styles.input} value={newGuardianContact} onChangeText={setNewGuardianContact} />
          <TouchableOpacity style={styles.btn} onPress={addGuardian}><Text style={styles.btnText}>Add Guardian</Text></TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.title}>Recovery Request</Text>
        {request ? (
          <>
            <Text style={styles.text}>ID: {request.id}</Text>
            <Text style={styles.text}>Approvals: {request.approvals.length}</Text>
            <Text style={styles.text}>Status: {request.status}</Text>
            <Text style={styles.text}>{canFinalizeMsg}</Text>
            <TouchableOpacity style={styles.btn} onPress={handleApproveMock}><Text style={styles.btnText}>Mock Approve Next Guardian</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btn} onPress={handleFinalize}><Text style={styles.btnText}>Finalize Recovery</Text></TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.btn} onPress={handleStart}><Text style={styles.btnText}>Start Recovery</Text></TouchableOpacity>
        )}
      </View>
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
});

export default GuardianRecoveryScreen;


