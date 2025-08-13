import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';

/**
 * SecureIdentityService
 * - Duy trì khóa danh tính dài hạn (P-256 ECDSA) để ký xác thực phiên
 * - Sử dụng WebCrypto nếu khả dụng, fallback HMAC dev-only
 */
export class SecureIdentityService {
    private static instance: SecureIdentityService;
    private static STORAGE_KEY = 'identity_keypair_jwk_v1';
    private jwkPrivate?: JsonWebKey;
    private jwkPublic?: JsonWebKey;
    private secretDev?: string; // dev-only fallback

    static getInstance(): SecureIdentityService {
        if (!SecureIdentityService.instance) {
            SecureIdentityService.instance = new SecureIdentityService();
        }
        return SecureIdentityService.instance;
    }

    async initialize(): Promise<void> {
        try {
            const raw = await AsyncStorage.getItem(SecureIdentityService.STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                this.jwkPrivate = parsed.private;
                this.jwkPublic = parsed.public;
                this.secretDev = parsed.secretDev;
                return;
            }
            await this.ensureIdentity();
        } catch {
            await this.ensureIdentity();
        }
    }

    private async ensureIdentity(): Promise<void> {
        if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
            const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
            this.jwkPrivate = await crypto.subtle.exportKey('jwk', (kp as CryptoKeyPair).privateKey);
            this.jwkPublic = await crypto.subtle.exportKey('jwk', (kp as CryptoKeyPair).publicKey);
            await AsyncStorage.setItem(SecureIdentityService.STORAGE_KEY, JSON.stringify({ private: this.jwkPrivate, public: this.jwkPublic }));
        } else {
            // Dev fallback: HMAC secret
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
                const secret = CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex);
                this.secretDev = secret;
                await AsyncStorage.setItem(SecureIdentityService.STORAGE_KEY, JSON.stringify({ secretDev: secret }));
            } else {
                throw new Error('Secure identity unavailable on this platform');
            }
        }
    }

    async getPublicKeyRaw(): Promise<Uint8Array> {
        if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
            await this.initializeIfNeeded();
            const key = await crypto.subtle.importKey('jwk', this.jwkPublic as JsonWebKey, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
            const raw = new Uint8Array(await crypto.subtle.exportKey('raw', key));
            return raw;
        }
        // Dev fallback: public = SHA256('identity') marker + secret hash
        const h = CryptoJS.SHA256('identity:' + this.secretDev).toString(CryptoJS.enc.Hex);
        return this.hexToBytes(h);
    }

    async getPublicKeyHex(): Promise<string> {
        const raw = await this.getPublicKeyRaw();
        return this.bytesToHex(raw);
    }

    async sign(data: Uint8Array): Promise<Uint8Array> {
        if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
            await this.initializeIfNeeded();
            const key = await crypto.subtle.importKey('jwk', this.jwkPrivate as JsonWebKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
            const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, data);
            return new Uint8Array(sig);
        }
        // Dev fallback: HMAC-SHA256
        const wa = CryptoJS.lib.WordArray.create(data as any);
        const mac = CryptoJS.HmacSHA256(wa, CryptoJS.enc.Hex.parse(this.secretDev || ''));
        return this.hexToBytes(mac.toString(CryptoJS.enc.Hex));
    }

    async verify(publicKeyRaw: Uint8Array, data: Uint8Array, signature: Uint8Array): Promise<boolean> {
        if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
            try {
                const pub = await crypto.subtle.importKey('raw', publicKeyRaw, { name: 'ECDSA', namedCurve: 'P-256' }, true, ['verify']);
                return await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, signature, data);
            } catch { return false; }
        }
        // Dev fallback: recompute HMAC
        const wa = CryptoJS.lib.WordArray.create(data as any);
        const mac = CryptoJS.HmacSHA256(wa, CryptoJS.enc.Hex.parse(this.secretDev || ''));
        return this.bytesToHex(signature) === mac.toString(CryptoJS.enc.Hex);
    }

    private async initializeIfNeeded(): Promise<void> {
        if (!this.jwkPrivate || !this.jwkPublic) {
            await this.initialize();
        }
    }

    private hexToBytes(hex: string): Uint8Array {
        const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
        const out = new Uint8Array(clean.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.substr(i * 2, 2), 16);
        return out;
    }

    private bytesToHex(bytes: Uint8Array): string {
        return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    }
}


