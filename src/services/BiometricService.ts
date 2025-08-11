import ReactNativeBiometrics, { BiometryTypes } from 'react-native-biometrics';
import { EncryptedMnemonic } from '../types/wallet';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Haptics from 'expo-haptics';

export interface BiometricConfig {
    isEnabled: boolean;
    type: 'fingerprint' | 'face' | 'none';
    quickPayLimit: string;
    timeout: number;
}

export class BiometricService {
    private static instance: BiometricService;
    private config: BiometricConfig;
    private rnBiometrics: ReactNativeBiometrics;

    private constructor() {
        this.config = {
            isEnabled: false,
            type: 'none',
            quickPayLimit: '10000000', // 10 ADA
            timeout: 30000, // 30 seconds
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

            const { success } = await this.rnBiometrics.simplePrompt({
                promptMessage: reason,
                cancelButtonText: 'Cancel'
            });

            if (success) {
                await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
    async authenticateQuickPay(amount: string, quickPayLimit: string): Promise<{
        success: boolean;
        requireFullAuth: boolean;
        error?: string;
    }> {
        try {
            const amountNum = parseFloat(amount);
            const limitNum = parseFloat(quickPayLimit);

            if (amountNum <= limitNum) {
                // Quick authentication for small amounts
                const result = await this.authenticateWithBiometric(`Quick Pay ${amount} ADA`);
                return { ...result, requireFullAuth: false };
            } else {
                // Full authentication required for large amounts
                return { success: false, requireFullAuth: true, error: 'Amount exceeds quick pay limit' };
            }
        } catch (error) {
            console.error('Quick pay authentication error:', error);
            return { success: false, requireFullAuth: true, error: 'Quick pay failed' };
        }
    }

    /**
     * Lấy cấu hình sinh trắc học
     */
    async getBiometricConfig(): Promise<BiometricConfig> {
        try {
            const stored = await SecureStore.getItemAsync('biometric_config');
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
            await SecureStore.setItemAsync('biometric_config', JSON.stringify(this.config));
        } catch (error) {
            console.error('Failed to save biometric config:', error);
        }
    }
}
