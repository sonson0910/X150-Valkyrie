import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, TextInput, Switch, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '../constants';
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { AppButton } from '../components/ui/AppButton';
import { AppText } from '../components/ui/AppText';
import { tokens } from '../theme/tokens';
import { ConfigurationService } from '../services/ConfigurationService';
import { AddressResolverService } from '../services/AddressResolverService';

const NameServiceManagerScreen: React.FC = () => {
  const cfgSvc = ConfigurationService.getInstance();
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [resolvers, setResolvers] = useState<string[]>([]);
  const [policyId, setPolicyId] = useState<string>('');
  const [enabled, setEnabled] = useState<boolean>(false);
  const [newHandle, setNewHandle] = useState<string>('');
  const [newAddress, setNewAddress] = useState<string>('');
  const [newResolver, setNewResolver] = useState<string>('');

  const load = async () => {
    const cfg = cfgSvc.getConfiguration();
    setMapping(cfg.nameService?.mapping || {});
    setResolvers(cfg.nameService?.remoteResolvers || []);
    setEnabled(!!cfg.nameService?.adaHandle?.enabled);
    setPolicyId(cfg.nameService?.adaHandle?.policyId || '');
  };

  useEffect(() => { load(); }, []);

  const save = async (next: any) => {
    cfgSvc.setSetting('nameService', { ...cfgSvc.getConfiguration().nameService, ...next });
    await new Promise(r => setTimeout(r, 10));
    await load();
  };

  return (
    <LinearGradient colors={[tokens.palette.background, tokens.palette.surfaceAlt]} style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <AppText variant="h1" color={tokens.palette.primary} style={styles.title}>Name Service Manager</AppText>

        <View style={styles.section}>
          <AppText variant="h3" color={tokens.palette.accent} style={styles.subtitle}>Local Mapping</AppText>
          <View style={styles.row}>
            <TextInput
              placeholder="$handle"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              style={[styles.input, { flex: 0.5 }]}
              value={newHandle}
              onChangeText={setNewHandle}
            />
            <TextInput
              placeholder="addr1..."
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              style={[styles.input, { flex: 1, marginLeft: 8 }]}
              value={newAddress}
              onChangeText={setNewAddress}
            />
          </View>
          <AppButton title="Add Mapping" onPress={async () => {
            const key = (newHandle.startsWith('$') ? newHandle.slice(1) : newHandle).toLowerCase();
            if (!key || !newAddress.startsWith('addr1')) { Alert.alert('Invalid', 'Enter $handle and bech32 address'); return; }
            const next = { ...mapping, [key]: newAddress };
            await save({ mapping: next });
            setNewHandle(''); setNewAddress('');
          }} style={styles.btnLike} />
          <FlatList
            data={Object.entries(mapping)}
            keyExtractor={([k]) => k}
            renderItem={({ item: [k, v] }) => (
              <View style={[styles.item, styles.rowBetween]}>
                <AppText>${k} → {v}</AppText>
                <TouchableOpacity onPress={async () => {
                  const next = { ...mapping }; delete next[k]; await save({ mapping: next });
                }}><AppText color={tokens.palette.warning}>Remove</AppText></TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<AppText>No entries</AppText>}
          />
        </View>

        <View style={styles.section}>
          <AppText variant="h3" color={tokens.palette.accent} style={styles.subtitle}>Remote Resolvers</AppText>
          <View style={styles.row}>
            <TextInput
              placeholder="https://resolver.example.com/resolve"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              style={[styles.input, { flex: 1 }]}
              value={newResolver}
              onChangeText={setNewResolver}
            />
            <AppButton title="Add" onPress={async () => {
              if (!newResolver.startsWith('http')) { Alert.alert('Invalid URL'); return; }
              const next = Array.from(new Set([...(resolvers || []), newResolver]));
              await save({ remoteResolvers: next }); setNewResolver('');
            }} style={[styles.btnLike, { marginLeft: 8 }]} />
          </View>
          <FlatList
            data={resolvers}
            keyExtractor={(u) => u}
            renderItem={({ item }) => (
              <View style={[styles.item, styles.rowBetween]}>
                <AppText>{item}</AppText>
                <TouchableOpacity onPress={async () => {
                  const next = resolvers.filter(r => r !== item); await save({ remoteResolvers: next });
                }}><AppText color={tokens.palette.warning}>Remove</AppText></TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<AppText>No resolver endpoints</AppText>}
          />
        </View>

        <View style={styles.section}>
          <AppText variant="h3" color={tokens.palette.accent} style={styles.subtitle}>ADA Handle</AppText>
          <View style={styles.rowBetween}>
            <AppText>Enabled</AppText>
            <Switch
              value={enabled}
              onValueChange={async (val) => { setEnabled(val); await save({ adaHandle: { enabled: val, policyId } }); }}
              trackColor={{ false: CYBERPUNK_COLORS.border, true: CYBERPUNK_COLORS.primary }}
            />
          </View>
          <AppText style={{ marginTop: 8 }}>Policy ID</AppText>
          <TextInput
            placeholder="56-hex policy id"
            placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
            style={styles.input}
            value={policyId}
            onChangeText={setPolicyId}
            autoCapitalize="none"
          />
          <AppButton title="Save ADA Handle" onPress={async () => {
            if (policyId && policyId.length !== 56) { Alert.alert('Invalid policyId'); return; }
            await save({ adaHandle: { enabled, policyId } });
            Alert.alert('Saved', 'ADA Handle settings updated');
          }} style={styles.btnLike} />
          <AppButton title="Clear Resolver Cache" variant="secondary" onPress={async () => {
            await AddressResolverService.getInstance().clearCache();
            Alert.alert('Cache cleared');
          }} style={[styles.btnLike, { marginTop: 8 }]} />
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { color: CYBERPUNK_COLORS.primary, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  subtitle: { color: CYBERPUNK_COLORS.accent, fontSize: 16, fontWeight: '700', marginBottom: 8 },
  text: { color: CYBERPUNK_COLORS.text, marginBottom: 6 },
  section: { marginBottom: 24 },
  item: { padding: 10, backgroundColor: CYBERPUNK_COLORS.surface, borderWidth: 1, borderColor: CYBERPUNK_COLORS.border, borderRadius: 8, marginBottom: 8 },
  btn: { backgroundColor: CYBERPUNK_COLORS.primary, padding: 12, borderRadius: 10, marginTop: 8 },
  btnText: { color: '#0a0e27', textAlign: 'center', fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { backgroundColor: CYBERPUNK_COLORS.surface, color: CYBERPUNK_COLORS.text, borderWidth: 1, borderColor: CYBERPUNK_COLORS.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
});

export default NameServiceManagerScreen;


