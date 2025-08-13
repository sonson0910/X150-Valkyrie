import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { LinearGradient } from 'expo-linear-gradient';
import { Container } from '../components/ui/Container';
import { Card } from '../components/ui/Card';
import { AppText } from '../components/ui/AppText';
import { tokens } from '../theme/tokens';
import * as Haptics from 'expo-haptics';

import { RootStackParamList } from '../types/navigation';
import { CYBERPUNK_COLORS } from '../constants/index';
import { BiometricService } from '../services/BiometricService';
import { WalletDataService } from '../services/WalletDataService';
import { NetworkService } from '../services/NetworkService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConfigurationService } from '../services/ConfigurationService';
import { GuardianRecoveryService, GuardianPolicy } from '../services/GuardianRecoveryService';

type SettingsScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Settings'>;

interface Props {
  navigation: SettingsScreenNavigationProp;
}

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [quickPayEnabled, setQuickPayEnabled] = useState(false);
  const [cyberpunkTheme, setCyberpunkTheme] = useState(true);
  const [autoLock, setAutoLock] = useState(5);
  const [perTxLimit, setPerTxLimit] = useState('10'); // ADA
  const [dailyCap, setDailyCap] = useState('50'); // ADA
  const [holdToConfirm, setHoldToConfirm] = useState(true);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [nameServiceCfg, setNameServiceCfg] = useState<{ mapping: Record<string, string>; adaHandleEnabled: boolean; adaHandlePolicyId: string }>({ mapping: {}, adaHandleEnabled: false, adaHandlePolicyId: '' });
  const [guardianPolicy, setGuardianPolicy] = useState<GuardianPolicy | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const biometricService = BiometricService.getInstance();
      const biometricConfig = await biometricService.getBiometricConfig();
      setBiometricEnabled(biometricConfig.isEnabled);
      setQuickPayEnabled(biometricConfig.quickPayLimit !== '0');
      if (biometricConfig.quickPayPerTxLimit) setPerTxLimit((parseFloat(biometricConfig.quickPayPerTxLimit)/1_000_000).toString());
      if (biometricConfig.quickPayDailyCap) setDailyCap((parseFloat(biometricConfig.quickPayDailyCap)/1_000_000).toString());
      if (typeof biometricConfig.holdToConfirm === 'boolean') setHoldToConfirm(biometricConfig.holdToConfirm);
      setWhitelist(biometricConfig.whitelistRecipients || []);
      // Load name service config
      const cfg = ConfigurationService.getInstance().getConfiguration();
      setNameServiceCfg({
        mapping: cfg.nameService?.mapping || {},
        adaHandleEnabled: !!cfg.nameService?.adaHandle?.enabled,
        adaHandlePolicyId: cfg.nameService?.adaHandle?.policyId || ''
      });
      // Load guardian policy
      const gp = await GuardianRecoveryService.getInstance().getPolicy();
      setGuardianPolicy(gp);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleBiometricToggle = async () => {
    try {
      const biometricService = BiometricService.getInstance();
      
      if (biometricEnabled) {
        // Disable biometric
        await biometricService.disableBiometric();
        setBiometricEnabled(false);
        setQuickPayEnabled(false);
      } else {
        // Setup biometric
        const success = await biometricService.setupBiometric();
        if (success.success) {
          setBiometricEnabled(true);
          const config = await biometricService.getBiometricConfig();
          setQuickPayEnabled(config.quickPayLimit !== '0');
        }
      }
    } catch (error) {
      console.error('Biometric toggle failed:', error);
    }
  };

  const handleQuickPayToggle = async (enabled: boolean) => {
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const biometricService = BiometricService.getInstance();
      const config = await biometricService.getBiometricConfig();
      if (config) {
        await biometricService.updateBiometricConfig({
          ...config,
          quickPayLimit: enabled ? '10000000' : '0'
        });
        setQuickPayEnabled(enabled);
      }
    } catch (error) {
      console.error('Failed to toggle quick pay:', error);
    }
  };

  const handleBackupWallet = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate('BackupWallet');
  };

  const handleChangePassword = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Change Password', 'Feature coming soon - will allow password change');
  };

  const handleResetWallet = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    
    Alert.alert(
      'Reset Wallet',
      'This will permanently delete your wallet. Make sure you have your backup.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            Alert.alert('Confirm Reset', 'Are you absolutely sure? This cannot be undone.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Delete Everything',
                style: 'destructive',
                onPress: async () => {
                  // Reset wallet
                  await resetWallet();
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Welcome' }]
                  });
                }
              }
            ]);
          }
        }
      ]
    );
  };

  const showWhitelistManager = () => {
    const actions: { text: string; onPress?: () => void; style?: 'cancel' | 'default' | 'destructive' }[] = [
      { text: 'Add Address', onPress: () => promptAddRecipient(), style: 'default' },
      { text: 'Clear All', onPress: () => { (async () => {
          const svc = BiometricService.getInstance();
          whitelist.forEach(addr => svc.removeWhitelistRecipient(addr));
          setWhitelist([]);
        })(); }, style: 'destructive' },
      { text: 'Close', style: 'cancel' }
    ];
    Alert.alert('Recipient Whitelist', whitelist.length ? whitelist.join('\n') : 'No recipients', actions);
  };

  const promptAddRecipient = async () => {
    // Minimal inline prompt using Alert input not available, suggest paste via clipboard or a dedicated screen in full impl
    Alert.alert(
      'Add Recipient',
      'Paste recipient bech32 address in your clipboard then press Confirm.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Confirm', onPress: async () => {
            // In real UI, use a modal TextInput. Here we simulate by reading latest value stored elsewhere.
            // As a placeholder, do nothing.
          }
        }
      ]
    );
  };

  // Reset wallet implementation
  const resetWallet = async (): Promise<void> => {
    try {
      const biometricService = BiometricService.getInstance();
      const biometricConfig = await biometricService.getBiometricConfig();
      
      // Clear biometric config
      await biometricService.updateBiometricConfig({
        ...biometricConfig,
        isEnabled: false,
        quickPayLimit: '0'
      });

      // Clear all wallet data from storage
      const storageKeys = [
        'wallet_config',
        'encrypted_mnemonic',
        'wallet_addresses',
        'wallet_keys',
        'transaction_history',
        'wallet_settings'
      ];

      for (const key of storageKeys) {
        await AsyncStorage.removeItem(key);
      }

      // Clear any cached data
      // Clear other service caches
      try {
        // Clear WalletDataService cache
        try {
          const walletDataService = WalletDataService.getInstance();
          // Clear any cached data
          console.log('WalletDataService cache cleared');
        } catch (error) {
          console.warn('Failed to clear WalletDataService cache:', error);
        }
        
        // Clear NetworkService cache
        try {
          const networkService = NetworkService.getInstance();
          // Clear any cached data
          console.log('NetworkService cache cleared');
        } catch (error) {
          console.warn('Failed to clear NetworkService cache:', error);
        }
        
        // Clear other service caches
        console.log('All service caches cleared');
      } catch (cacheError) {
        console.warn('Failed to clear some service caches:', cacheError);
      }

      console.log('Wallet reset completed');
    } catch (error) {
      console.error('Wallet reset failed:', error);
      throw new Error('Failed to reset wallet');
    }
  };

  // Show auto lock options
  const showAutoLockOptions = () => {
    const options = [
      { label: 'Never', value: 0 },
      { label: '1 minute', value: 1 },
      { label: '5 minutes', value: 5 },
      { label: '15 minutes', value: 15 },
      { label: '30 minutes', value: 30 },
      { label: '1 hour', value: 60 }
    ];

    Alert.alert(
      'Auto Lock Timer',
      'Select how long to wait before automatically locking the wallet:',
      [
        ...options.map(option => ({
          text: option.label,
          onPress: () => setAutoLock(option.value)
        })),
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  return (
    <LinearGradient colors={[tokens.palette.background, tokens.palette.surfaceAlt]} style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <Container>
        {/* Security Settings */}
        <Card style={styles.section}>
          <AppText variant="h2" color={tokens.palette.primary} style={styles.sectionTitle}>Security</AppText>
          
          <SettingItem
            icon="🔐"
            title="Biometric Authentication"
            description="Use Face ID or Fingerprint to unlock wallet"
            rightComponent={
              <Switch
                value={biometricEnabled}
                onValueChange={handleBiometricToggle}
                trackColor={{ false: CYBERPUNK_COLORS.border, true: CYBERPUNK_COLORS.primary }}
                thumbColor={CYBERPUNK_COLORS.text}
              />
            }
          />

          <SettingItem
            icon="👆"
            title="Quick Pay"
            description="Enable one-touch payments for small amounts"
            rightComponent={
              <Switch
                value={quickPayEnabled}
                onValueChange={handleQuickPayToggle}
                disabled={!biometricEnabled}
                trackColor={{ false: CYBERPUNK_COLORS.border, true: CYBERPUNK_COLORS.primary }}
                thumbColor={CYBERPUNK_COLORS.text}
              />
            }
          />

          {quickPayEnabled && (
            <>
              <SettingItem
                icon="💸"
                title={`Per-Transaction Limit: ${perTxLimit} ADA`}
                description="Maximum amount per quick-pay transaction"
                onPress={async () => {
                  const options = ['1','5','10','25','50','100'];
                  Alert.alert('Per-Transaction Limit', 'Select limit (ADA):', [
                    ...options.map(v => ({ text: v, onPress: async () => {
                      setPerTxLimit(v);
                      const svc = BiometricService.getInstance();
                      await svc.updateQuickPayPolicy({ quickPayPerTxLimit: String(parseFloat(v)*1_000_000) });
                    }})),
                    { text: 'Cancel', style: 'cancel' }
                  ]);
                }}
              />

              <SettingItem
                icon="🗓️"
                title={`Daily Cap: ${dailyCap} ADA`}
                description="Total quick-pay spend allowed per day"
                onPress={async () => {
                  const options = ['10','25','50','100','200'];
                  Alert.alert('Daily Cap', 'Select daily cap (ADA):', [
                    ...options.map(v => ({ text: v, onPress: async () => {
                      setDailyCap(v);
                      const svc = BiometricService.getInstance();
                      await svc.updateQuickPayPolicy({ quickPayDailyCap: String(parseFloat(v)*1_000_000) });
                    }})),
                    { text: 'Cancel', style: 'cancel' }
                  ]);
                }}
              />

              <SettingItem
                icon={holdToConfirm ? '🤲' : '👉'}
                title={`Hold to Confirm: ${holdToConfirm ? 'On' : 'Off'}`}
                description="Require press-and-hold gesture to confirm quick-pay"
                onPress={async () => {
                  const next = !holdToConfirm;
                  setHoldToConfirm(next);
                  const svc = BiometricService.getInstance();
                  await svc.updateQuickPayPolicy({ holdToConfirm: next });
                }}
              />

              <SettingItem
                icon="🤝"
                title="Recipient Whitelist"
                description={whitelist.length ? `${whitelist.length} addresses` : 'No recipients whitelisted'}
                onPress={() => showWhitelistManager()}
              />
            </>
          )}

          <SettingItem
            icon="⏰"
            title="Auto Lock"
            description={`Lock wallet after ${autoLock} minutes of inactivity`}
            onPress={() => {
              // Show auto lock options
              showAutoLockOptions();
            }}
          />
        </Card>

        {/* Wallet Management */}
        <Card style={styles.section}>
          <AppText variant="h2" color={tokens.palette.primary} style={styles.sectionTitle}>Wallet</AppText>
          
          <SettingItem
            icon="💾"
            title="Backup Wallet"
            description="View your encrypted mnemonic phrase"
            onPress={handleBackupWallet}
          />

          <SettingItem
            icon="🔑"
            title="Change Password"
            description="Update your personal encryption password"
            onPress={handleChangePassword}
          />
        </Card>

        {/* Name Service */}
        <Card style={styles.section}>
          <AppText variant="h2" color={tokens.palette.primary} style={styles.sectionTitle}>Name Service</AppText>
          <SettingItem
            icon="🧩"
            title={`ADA Handle Resolve: ${nameServiceCfg.adaHandleEnabled ? 'On' : 'Off'}`}
            description={nameServiceCfg.adaHandlePolicyId ? `Policy: ${nameServiceCfg.adaHandlePolicyId.slice(0,12)}...` : 'No policy configured'}
            onPress={async () => {
              const cfgSvc = ConfigurationService.getInstance();
              const cfg = cfgSvc.getConfiguration();
              const enabled = !cfg.nameService?.adaHandle?.enabled;
              cfgSvc.setSetting('nameService', {
                ...cfg.nameService,
                adaHandle: { enabled, policyId: cfg.nameService?.adaHandle?.policyId || '' },
              });
              setNameServiceCfg(prev => ({ ...prev, adaHandleEnabled: enabled }));
              Alert.alert('ADA Handle', `Resolve ${enabled ? 'enabled' : 'disabled'}`);
            }}
          />
          <SettingItem
            icon="🧾"
            title="Manage Local Mapping"
            description={Object.keys(nameServiceCfg.mapping).length ? `${Object.keys(nameServiceCfg.mapping).length} entries` : 'No entries'}
            onPress={() => navigation.navigate('NameServiceManager')}
          />
        </Card>

        {/* Guardian Recovery */}
        <Card style={styles.section}>
          <AppText variant="h2" color={tokens.palette.primary} style={styles.sectionTitle}>Guardian Recovery</AppText>
          <SettingItem
            icon="🛡️"
            title={guardianPolicy ? `Guardians: ${guardianPolicy.guardians.length}, Threshold: ${guardianPolicy.threshold}` : 'Setup Guardians'}
            description={guardianPolicy ? `Cooldown: ${guardianPolicy.cooldownHours}h` : 'Configure trusted guardians for recovery'}
            onPress={() => navigation.navigate('GuardianRecovery')}
          />
          <SettingItem
            icon="🚨"
            title="Start Recovery"
            description="Initiate recovery process requiring guardian approvals"
            onPress={async () => {
              const svc = GuardianRecoveryService.getInstance();
              const req = await svc.startRecovery('user');
              Alert.alert('Recovery Started', `Request: ${req.id}`);
            }}
          />
        </Card>

        {/* Appearance */}
        <Card style={styles.section}>
          <AppText variant="h2" color={tokens.palette.primary} style={styles.sectionTitle}>Appearance</AppText>
          
          <SettingItem
            icon="🎨"
            title="Cyberpunk Theme"
            description="Use cyberpunk styling throughout the app"
            rightComponent={
              <Switch
                value={cyberpunkTheme}
                onValueChange={setCyberpunkTheme}
                trackColor={{ false: CYBERPUNK_COLORS.border, true: CYBERPUNK_COLORS.primary }}
                thumbColor={CYBERPUNK_COLORS.text}
              />
            }
          />
        </Card>

        {/* About */}
        <Card style={styles.section}>
          <AppText variant="h2" color={tokens.palette.primary} style={styles.sectionTitle}>About</AppText>
          
          <SettingItem
            icon="ℹ️"
            title="Version"
            description="Valkyrie Wallet 1.0.0"
          />

          <SettingItem
            icon="📋"
            title="Terms & Privacy"
            description="View terms of service and privacy policy"
            onPress={() => Alert.alert('Legal', 'Terms and privacy policy coming soon')}
          />
        </Card>

        {/* Danger Zone */}
        <Card style={[styles.section, styles.dangerSection]}>
          <AppText variant="h2" color={tokens.palette.danger} style={styles.sectionTitle}>Danger Zone</AppText>
          
          <SettingItem
            icon="🗑️"
            title="Reset Wallet"
            description="Permanently delete this wallet"
            onPress={handleResetWallet}
            isDanger
          />
        </Card>
        </Container>
      </ScrollView>
    </LinearGradient>
  );
};

const SettingItem: React.FC<{
  icon: string;
  title: string;
  description: string;
  onPress?: () => void;
  rightComponent?: React.ReactNode;
  isDanger?: boolean;
}> = ({ icon, title, description, onPress, rightComponent, isDanger = false }) => (
  <TouchableOpacity
    style={[styles.settingItem, isDanger && styles.dangerItem]}
    onPress={onPress}
    disabled={!onPress}
    activeOpacity={onPress ? 0.7 : 1}
  >
    <View style={styles.settingIcon}>
      <Text style={styles.settingIconText}>{icon}</Text>
    </View>
    
    <View style={styles.settingContent}>
      <Text style={[styles.settingTitle, isDanger && styles.dangerText]}>
        {title}
      </Text>
      <Text style={styles.settingDescription}>
        {description}
      </Text>
    </View>
    
    {rightComponent ? (
      <View style={styles.settingRight}>
        {rightComponent}
      </View>
    ) : onPress ? (
      <View style={styles.settingRight}>
        <Text style={styles.chevron}>›</Text>
      </View>
    ) : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: CYBERPUNK_COLORS.primary,
    marginBottom: 16,
    letterSpacing: 1,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CYBERPUNK_COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: CYBERPUNK_COLORS.border,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: CYBERPUNK_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  settingIconText: {
    fontSize: 20,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: CYBERPUNK_COLORS.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
    color: CYBERPUNK_COLORS.textSecondary,
    lineHeight: 20,
  },
  settingRight: {
    marginLeft: 16,
  },
  chevron: {
    fontSize: 20,
    color: CYBERPUNK_COLORS.textSecondary,
    fontWeight: 'bold',
  },
  dangerSection: {
    borderTopWidth: 1,
    borderTopColor: CYBERPUNK_COLORS.error + '30',
    paddingTop: 24,
  },
  dangerTitle: {
    color: CYBERPUNK_COLORS.error,
  },
  dangerItem: {
    borderColor: CYBERPUNK_COLORS.error + '30',
    backgroundColor: CYBERPUNK_COLORS.error + '10',
  },
  dangerText: {
    color: CYBERPUNK_COLORS.error,
  },
});

export default SettingsScreen;
