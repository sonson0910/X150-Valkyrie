import ReactNativeBiometrics from 'react-native-biometrics';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_PUBKEY = 'guardian_device_pubkey_v1';

export class GuardianKeyService {
    private static instance: GuardianKeyService;
    private rnBiometrics: ReactNativeBiometrics;

    private constructor() {
        this.rnBiometrics = new ReactNativeBiometrics();
    }

    static getInstance(): GuardianKeyService {
        if (!GuardianKeyService.instance) {
            GuardianKeyService.instance = new GuardianKeyService();
        }
        return GuardianKeyService.instance;
    }

    async getOrCreatePublicKey(_promptMessage: string = 'Enroll guardian key'): Promise<string> {
        const keysExist = await this.rnBiometrics.biometricKeysExist();
        if (keysExist.keysExist) {
            const stored = await AsyncStorage.getItem(STORAGE_PUBKEY);
            if (stored) return stored;
            // No stored pubkey; re-create to retrieve pubkey
        }
        const { publicKey } = await this.rnBiometrics.createKeys();
        await AsyncStorage.setItem(STORAGE_PUBKEY, publicKey);
        return publicKey;
    }

    async signApproval(payload: string, promptMessage: string = 'Approve recovery'): Promise<string> {
        const { success, signature } = await this.rnBiometrics.createSignature({
            promptMessage,
            payload,
        });
        if (!success || !signature) throw new Error('Signature failed');
        return signature;
    }
}


