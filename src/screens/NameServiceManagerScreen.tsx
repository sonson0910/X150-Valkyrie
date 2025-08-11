import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, FlatList, TextInput, Switch, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { CYBERPUNK_COLORS } from '../constants';
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
    <LinearGradient colors={[CYBERPUNK_COLORS.background, '#1a1f3a']} style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Text style={styles.title}>Name Service Manager</Text>

        <View style={styles.section}>
          <Text style={styles.subtitle}>Local Mapping</Text>
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
          <TouchableOpacity
            style={styles.btn}
            onPress={async () => {
              const key = (newHandle.startsWith('$') ? newHandle.slice(1) : newHandle).toLowerCase();
              if (!key || !newAddress.startsWith('addr1')) { Alert.alert('Invalid', 'Enter $handle and bech32 address'); return; }
              const next = { ...mapping, [key]: newAddress };
              await save({ mapping: next });
              setNewHandle(''); setNewAddress('');
            }}
          >
            <Text style={styles.btnText}>Add Mapping</Text>
          </TouchableOpacity>
          <FlatList
            data={Object.entries(mapping)}
            keyExtractor={([k]) => k}
            renderItem={({ item: [k, v] }) => (
              <View style={[styles.item, styles.rowBetween]}>
                <Text style={styles.text}>${k} → {v}</Text>
                <TouchableOpacity onPress={async () => {
                  const next = { ...mapping }; delete next[k]; await save({ mapping: next });
                }}><Text style={[styles.text, { color: CYBERPUNK_COLORS.warning }]}>Remove</Text></TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.text}>No entries</Text>}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.subtitle}>Remote Resolvers</Text>
          <View style={styles.row}>
            <TextInput
              placeholder="https://resolver.example.com/resolve"
              placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
              style={[styles.input, { flex: 1 }]}
              value={newResolver}
              onChangeText={setNewResolver}
            />
            <TouchableOpacity style={[styles.btn, { marginLeft: 8 }]} onPress={async () => {
              if (!newResolver.startsWith('http')) { Alert.alert('Invalid URL'); return; }
              const next = Array.from(new Set([...(resolvers || []), newResolver]));
              await save({ remoteResolvers: next }); setNewResolver('');
            }}><Text style={styles.btnText}>Add</Text></TouchableOpacity>
          </View>
          <FlatList
            data={resolvers}
            keyExtractor={(u) => u}
            renderItem={({ item }) => (
              <View style={[styles.item, styles.rowBetween]}>
                <Text style={styles.text}>{item}</Text>
                <TouchableOpacity onPress={async () => {
                  const next = resolvers.filter(r => r !== item); await save({ remoteResolvers: next });
                }}><Text style={[styles.text, { color: CYBERPUNK_COLORS.warning }]}>Remove</Text></TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.text}>No resolver endpoints</Text>}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.subtitle}>ADA Handle</Text>
          <View style={styles.rowBetween}>
            <Text style={styles.text}>Enabled</Text>
            <Switch
              value={enabled}
              onValueChange={async (val) => { setEnabled(val); await save({ adaHandle: { enabled: val, policyId } }); }}
              trackColor={{ false: CYBERPUNK_COLORS.border, true: CYBERPUNK_COLORS.primary }}
            />
          </View>
          <Text style={[styles.text, { marginTop: 8 }]}>Policy ID</Text>
          <TextInput
            placeholder="56-hex policy id"
            placeholderTextColor={CYBERPUNK_COLORS.textSecondary}
            style={styles.input}
            value={policyId}
            onChangeText={setPolicyId}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.btn} onPress={async () => {
            if (policyId && policyId.length !== 56) { Alert.alert('Invalid policyId'); return; }
            await save({ adaHandle: { enabled, policyId } });
            Alert.alert('Saved', 'ADA Handle settings updated');
          }}><Text style={styles.btnText}>Save ADA Handle</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.btn, { backgroundColor: CYBERPUNK_COLORS.accent }]} onPress={async () => {
            await AddressResolverService.getInstance().clearCache();
            Alert.alert('Cache cleared');
          }}><Text style={styles.btnText}>Clear Resolver Cache</Text></TouchableOpacity>
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


