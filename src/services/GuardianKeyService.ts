import ReactNativeBiometrics from 'react-native-biometrics';
import * as LocalAuthentication from 'expo-local-authentication';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PUBKEY = 'guardian_device_pubkey_v1';

export class GuardianKeyService {
    private static instance: GuardianKeyService;
    private rnBiometrics: ReactNativeBiometrics | null;

    private constructor() {
        try {
            const ctor: any = ReactNativeBiometrics as any;
            this.rnBiometrics = typeof ctor === 'function' ? new ctor() : null;
        } catch {
            this.rnBiometrics = null;
        }
    }

    static getInstance(): GuardianKeyService {
        if (!GuardianKeyService.instance) {
            GuardianKeyService.instance = new GuardianKeyService();
        }
        return GuardianKeyService.instance;
    }

    async getOrCreatePublicKey(_promptMessage: string = 'Enroll guardian key'): Promise<string> {
        if (!this.rnBiometrics || typeof (this.rnBiometrics as any).biometricKeysExist !== 'function') {
            // Fallback: ensure user has biometrics and return a pseudo pubkey stored locally
            const can = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if (!can || !enrolled) throw new Error('Biometrics not available');
            const stored = await AsyncStorage.getItem(STORAGE_PUBKEY);
            if (stored) return stored;
            const pseudo = 'EXPO_LOCAL_PUBKEY_' + Math.random().toString(36).slice(2);
            await AsyncStorage.setItem(STORAGE_PUBKEY, pseudo);
            return pseudo;
        }
        const keysExist = await (this.rnBiometrics as any).biometricKeysExist();
        if (keysExist.keysExist) {
            const stored = await AsyncStorage.getItem(STORAGE_PUBKEY);
            if (stored) return stored;
            // No stored pubkey; re-create to retrieve pubkey
        }
        const { publicKey } = await (this.rnBiometrics as any).createKeys();
        await AsyncStorage.setItem(STORAGE_PUBKEY, publicKey);
        return publicKey;
    }

    async signApproval(payload: string, promptMessage: string = 'Approve recovery'): Promise<string> {
        if (!this.rnBiometrics || typeof (this.rnBiometrics as any).createSignature !== 'function') {
            // Fallback: prompt with LocalAuthentication and return a local HMAC-like placeholder
            const res = await LocalAuthentication.authenticateAsync({ promptMessage });
            if (!res.success) throw new Error('Authentication failed');
            // Lightweight placeholder signature for dev in Expo Go
            const B: any = (global as any).Buffer || require('buffer').Buffer;
            const signature = B.from(`${payload}|LOCAL_SIGNED`).toString('base64');
            return signature;
        }
        const { success, signature } = await (this.rnBiometrics as any).createSignature({
            promptMessage,
            payload,
        });
        if (!success || !signature) throw new Error('Signature failed');
        return signature;
    }
}


