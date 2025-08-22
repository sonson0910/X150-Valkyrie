import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import * as LocalAuthentication from 'expo-local-authentication';
import { EncryptedMnemonic } from '../types/wallet';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../constants/index';
import * as Haptics from 'expo-haptics';
import { environment } from '../config/Environment';
import { MemoryUtils } from '../utils/MemoryUtils';
import logger from '../utils/Logger';

export interface BiometricConfig {
    isEnabled: boolean;
    type: 'fingerprint' | 'face' | 'none';
    // Legacy per-tx limit (lovelace) for backward compat
    quickPayLimit: string;
    timeout: number;
    // Extended quick-pay policy
    quickPayPerTxLimit?: string; // lovelace
    quickPayDailyCap?: string; // lovelace per calendar day
    quickPayDailySpent?: { date: string; amount: string }; // track spent per day
    whitelistRecipients?: string[]; // bech32 addresses
    holdToConfirm?: boolean;
    idleTimeoutMs?: number; // re-authenticate if idle longer
}

export class BiometricService {
    private static instance: BiometricService;
    private config: BiometricConfig;
    private rnBiometrics: ReactNativeBiometrics | null;
    private lastAuthAtMs: number = 0;

    private constructor() {
        this.config = {
            isEnabled: false,
            type: 'none',
            quickPayLimit: environment.get('DEFAULT_QUICK_PAY_LIMIT'), // legacy
            timeout: environment.get('BIOMETRIC_TIMEOUT'),
            quickPayPerTxLimit: environment.get('DEFAULT_QUICK_PAY_LIMIT'),
            quickPayDailyCap: environment.get('DEFAULT_DAILY_CAP'),
            quickPayDailySpent: { date: new Date().toISOString().slice(0, 10), amount: '0' },
            whitelistRecipients: [],
            holdToConfirm: true,
            idleTimeoutMs: environment.get('IDLE_TIMEOUT'),
        };
        // Instantiate native biometrics when available; fall back to Expo LocalAuthentication in Expo Go/BlueStacks
        // In Expo Go or emulators that lack the native module, `react-native-biometrics` may be undefined or non-constructible.
        // Guard hard to avoid any runtime TypeError.
        try {
            const maybeCtor: any = ReactNativeBiometrics as any;
            if (maybeCtor && typeof maybeCtor === 'function') {
                const instance = new maybeCtor();
                this.rnBiometrics = instance && typeof instance === 'object' ? instance : null;
            } else {
                this.rnBiometrics = null;
            }
        } catch {
            this.rnBiometrics = null;
        }
    }

    public static getInstance(): BiometricService {
        if (!BiometricService.instance) {
            BiometricService.instance = new BiometricService();
        }
        return BiometricService.instance;
    }

    /**
     * Clear sensitive biometric data from memory
     */
    private clearSensitiveData(): void {
        try {
            // Clear any cached biometric credentials
            if (this.config) {
                // Zero out quick pay spent data if it contains sensitive amounts
                if (this.config.quickPayDailySpent) {
                    MemoryUtils.secureCleanup(this.config.quickPayDailySpent);
                }
                
                // Clear whitelist recipients if needed
                if (this.config.whitelistRecipients) {
                    this.config.whitelistRecipients.forEach((recipient) => {
                        MemoryUtils.secureCleanup(recipient);
                    });
                }
            }

            // Reset auth timestamp
            this.lastAuthAtMs = 0;

            // Force garbage collection if available
            if (typeof global !== 'undefined' && global.gc) {
                global.gc();
            }

            logger.debug('Biometric sensitive data cleared from memory', 'BiometricService.clearSensitiveData');
        } catch (error) {
            logger.warn('Failed to clear biometric sensitive data', 'BiometricService.clearSensitiveData', error);
        }
    }

    /**
     * Kiểm tra hỗ trợ sinh trắc học
     */
    async checkBiometricSupport(): Promise<{
        isAvailable: boolean;
        type: 'fingerprint' | 'face' | 'none';
    }> {
        try {
            // Prefer native module when available
            if (this.rnBiometrics && typeof (this.rnBiometrics as any).isSensorAvailable === 'function') {
                const { available, biometryType } = await (this.rnBiometrics as any).isSensorAvailable();

                if (available) {
                    let type: 'fingerprint' | 'face' | 'none' = 'none';

                    if (biometryType === BiometryTypes.TouchID || biometryType === BiometryTypes.Biometrics) {
                        type = 'fingerprint';
                    } else if (biometryType === BiometryTypes.FaceID) {
                        type = 'face';
                    }

                    return { isAvailable: true, type };
                }
            }

            // Fallback to Expo LocalAuthentication (works in Expo Go)
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (!hasHardware || !enrolled) return { isAvailable: false, type: 'none' };
            const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
            const type = types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
                ? 'fingerprint'
                : types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
                    ? 'face'
                    : 'none';
            return { isAvailable: true, type };

            return { isAvailable: false, type: 'none' };
        } catch {
            return { isAvailable: false, type: 'none' };
        }
    }

    /**
     * Thiết lập sinh trắc học
     */
    async setupBiometric(): Promise<{ success: boolean; error?: string }> {
        try {
            if (this.rnBiometrics && typeof (this.rnBiometrics as any).isSensorAvailable === 'function') {
                const { available } = await (this.rnBiometrics as any).isSensorAvailable();
                if (!available) {
                    return { success: false, error: 'Biometric authentication not available' };
                }
                const { success } = await (this.rnBiometrics as any).simplePrompt({
                    promptMessage: 'Authenticate to enable biometric login',
                    cancelButtonText: 'Cancel'
                });
                if (success) {
                    this.config.isEnabled = true;
                    await this.saveBiometricConfig();
                    return { success: true };
                }
                return { success: false, error: 'Authentication failed' };
            }

            // Fallback to Expo LocalAuthentication
            let canUse = false;
            let enrolled = false;
            try { canUse = await LocalAuthentication.hasHardwareAsync(); } catch {}
            try { enrolled = await LocalAuthentication.isEnrolledAsync(); } catch {}
            if (!canUse || !enrolled) return { success: false, error: 'Biometric authentication not available' };
            const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Authenticate to enable biometric login', cancelLabel: 'Cancel', disableDeviceFallback: false });
            if (res.success) {
                this.config.isEnabled = true;
                await this.saveBiometricConfig();
                return { success: true };
            }
            return { success: false, error: 'Authentication failed' };
        } catch {
            return { success: false, error: 'Setup failed' };
        }
    }

    /**
     * Xác thực sinh trắc học
     */
    async authenticateWithBiometric(reason: string): Promise<{ success: boolean; error?: string }> {
        try {
            if (!this.config.isEnabled) {
                return { success: false, error: 'Biometric authentication not enabled' };
            }

            // Idle timeout enforcement
            if (this.lastAuthAtMs > 0 && this.config.idleTimeoutMs && this.config.idleTimeoutMs > 0) {
                const since = Date.now() - this.lastAuthAtMs;
                if (since < this.config.idleTimeoutMs) {
                    return { success: true };
                }
            }

            if (this.rnBiometrics && typeof (this.rnBiometrics as any).simplePrompt === 'function') {
                const { success } = await (this.rnBiometrics as any).simplePrompt({
                    promptMessage: reason,
                    cancelButtonText: 'Cancel'
                });

                if (success) {
                    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    this.lastAuthAtMs = Date.now();
                    
                    // Clear sensitive data after successful auth  
                    this.clearSensitiveData();
                    
                    return { success: true };
                } else {
                    return { success: false, error: 'Authentication cancelled' };
                }
            }

            // Fallback to Expo LocalAuthentication
            const res = await LocalAuthentication.authenticateAsync({ promptMessage: reason, cancelLabel: 'Cancel', disableDeviceFallback: false });
            if (res.success) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                this.lastAuthAtMs = Date.now();
                
                // Clear sensitive data after successful auth
                this.clearSensitiveData();
                
                return { success: true };
            } else {
                return { success: false, error: 'Authentication cancelled' };
            }
        } catch {
            return { success: false, error: 'Authentication failed' };
        }
    }

    /**
     * Quick Pay với sinh trắc học
     */
    async authenticateQuickPay(amountLovelace: string, recipientBech32?: string): Promise<{
        success: boolean;
        requireFullAuth: boolean;
        error?: string;
    }> {
        try {
            // Reset daily spent if day changed
            this.resetDailySpentIfNewDay();

            const amount = BigInt(amountLovelace);
            const perTxLimit = BigInt(this.config.quickPayPerTxLimit || this.config.quickPayLimit || '0');
            const dailyCap = BigInt(this.config.quickPayDailyCap || '0');
            const dailySpent = BigInt(this.config.quickPayDailySpent?.amount || '0');

            // If whitelist is configured and recipient provided, enforce it
            if (recipientBech32 && (this.config.whitelistRecipients && this.config.whitelistRecipients.length > 0)) {
                const isWhitelisted = this.config.whitelistRecipients.includes(recipientBech32);
                if (!isWhitelisted) {
                    return { success: false, requireFullAuth: true, error: 'Recipient not in quick-pay whitelist' };
                }
            }

            if (perTxLimit > 0n && amount > perTxLimit) {
                return { success: false, requireFullAuth: true, error: 'Amount exceeds per-transaction limit' };
            }
            if (dailyCap > 0n && (dailySpent + amount) > dailyCap) {
                return { success: false, requireFullAuth: true, error: 'Daily quick pay cap reached' };
            }

            // Quick biometric prompt
            const result = await this.authenticateWithBiometric(`Quick Pay`);
            if (result.success) {
                // Accumulate daily spent (lovelace)
                this.incrementDailySpent(amount);
            }
            return { ...result, requireFullAuth: false };
        } catch (error) {
            console.error('Quick pay authentication error:', error);
            return { success: false, requireFullAuth: true, error: 'Quick pay failed' };
        }
    }

    /**
     * Update quick pay policy
     */
    async updateQuickPayPolicy(updates: Partial<Pick<BiometricConfig,
        'quickPayPerTxLimit' | 'quickPayDailyCap' | 'whitelistRecipients' | 'holdToConfirm' | 'idleTimeoutMs'>>): Promise<void> {
        this.config = { ...this.config, ...updates };
        await this.saveBiometricConfig();
    }

    addWhitelistRecipient(address: string): void {
        const set = new Set(this.config.whitelistRecipients || []);
        set.add(address);
        this.config.whitelistRecipients = Array.from(set);
        this.saveBiometricConfig();
    }

    removeWhitelistRecipient(address: string): void {
        const list = (this.config.whitelistRecipients || []).filter(a => a !== address);
        this.config.whitelistRecipients = list;
        this.saveBiometricConfig();
    }

    getWhitelistRecipients(): string[] {
        return [...(this.config.whitelistRecipients || [])];
    }

    private resetDailySpentIfNewDay(): void {
        const today = new Date().toISOString().slice(0, 10);
        if (!this.config.quickPayDailySpent || this.config.quickPayDailySpent.date !== today) {
            this.config.quickPayDailySpent = { date: today, amount: '0' };
            // async but fire-and-forget
            this.saveBiometricConfig();
        }
    }

    private incrementDailySpent(amountLovelace: bigint): void {
        this.resetDailySpentIfNewDay();
        const current = BigInt(this.config.quickPayDailySpent?.amount || '0');
        const next = current + amountLovelace;
        this.config.quickPayDailySpent = { date: new Date().toISOString().slice(0, 10), amount: next.toString() };
        this.saveBiometricConfig();
    }

    /**
     * Lấy cấu hình sinh trắc học
     */
    async getBiometricConfig(): Promise<BiometricConfig> {
        try {
            const stored = await SecureStore.getItemAsync(STORAGE_KEYS.BIOMETRIC_CONFIG);
            if (stored) {
                this.config = { ...this.config, ...JSON.parse(stored) };
            }
            return this.config;
        } catch (error) {
            console.error('Failed to get biometric config:', error);
            return this.config;
        }
    }

    /**
     * Cập nhật cấu hình sinh trắc học
     */
    async updateBiometricConfig(updates: Partial<BiometricConfig>): Promise<void> {
        try {
            this.config = { ...this.config, ...updates };
            await this.saveBiometricConfig();
        } catch (error) {
            console.error('Failed to update biometric config:', error);
        }
    }

    /**
     * Vô hiệu hóa sinh trắc học
     */
    async disableBiometric(): Promise<void> {
        try {
            this.config.isEnabled = false;
            await this.saveBiometricConfig();
        } catch (error) {
            console.error('Failed to disable biometric:', error);
        }
    }

    /**
     * Lưu cấu hình vào secure storage
     */
    private async saveBiometricConfig(): Promise<void> {
        try {
            await SecureStore.setItemAsync(STORAGE_KEYS.BIOMETRIC_CONFIG, JSON.stringify(this.config));
        } catch (error) {
            console.error('Failed to save biometric config:', error);
        }
    }
}
