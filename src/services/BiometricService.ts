import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { EncryptedMnemonic } from '../types/wallet';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../constants/index';
import * as Haptics from 'expo-haptics';

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
    private rnBiometrics: ReactNativeBiometrics;
    private lastAuthAtMs: number = 0;

    private constructor() {
        this.config = {
            isEnabled: false,
            type: 'none',
            quickPayLimit: '10000000', // legacy 10 ADA
            timeout: 30000, // 30 seconds
            quickPayPerTxLimit: '10000000', // 10 ADA default
            quickPayDailyCap: '50000000', // 50 ADA/day
            quickPayDailySpent: { date: new Date().toISOString().slice(0, 10), amount: '0' },
            whitelistRecipients: [],
            holdToConfirm: true,
            idleTimeoutMs: 120000, // 2 minutes
        };
        this.rnBiometrics = new ReactNativeBiometrics();
    }

    public static getInstance(): BiometricService {
        if (!BiometricService.instance) {
            BiometricService.instance = new BiometricService();
        }
        return BiometricService.instance;
    }

    /**
     * Kiểm tra hỗ trợ sinh trắc học
     */
    async checkBiometricSupport(): Promise<{
        isAvailable: boolean;
        type: 'fingerprint' | 'face' | 'none';
    }> {
        try {
            const { available, biometryType } = await this.rnBiometrics.isSensorAvailable();

            if (available) {
                let type: 'fingerprint' | 'face' | 'none' = 'none';

                if (biometryType === BiometryTypes.TouchID || biometryType === BiometryTypes.Biometrics) {
                    type = 'fingerprint';
                } else if (biometryType === BiometryTypes.FaceID) {
                    type = 'face';
                }

                return { isAvailable: true, type };
            }

            return { isAvailable: false, type: 'none' };
        } catch (error) {
            console.error('Biometric check failed:', error);
            return { isAvailable: false, type: 'none' };
        }
    }

    /**
     * Thiết lập sinh trắc học
     */
    async setupBiometric(): Promise<{ success: boolean; error?: string }> {
        try {
            const { available } = await this.rnBiometrics.isSensorAvailable();

            if (!available) {
                return { success: false, error: 'Biometric authentication not available' };
            }

            // Test authentication
            const { success } = await this.rnBiometrics.simplePrompt({
                promptMessage: 'Authenticate to enable biometric login',
                cancelButtonText: 'Cancel'
            });

            if (success) {
                this.config.isEnabled = true;
                await this.saveBiometricConfig();
                return { success: true };
            } else {
                return { success: false, error: 'Authentication failed' };
            }
        } catch (error) {
            console.error('Biometric setup failed:', error);
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

            const { success } = await this.rnBiometrics.simplePrompt({
                promptMessage: reason,
                cancelButtonText: 'Cancel'
            });

            if (success) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                this.lastAuthAtMs = Date.now();
                return { success: true };
            } else {
                return { success: false, error: 'Authentication cancelled' };
            }
        } catch (error) {
            console.error('Biometric authentication error:', error);
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
