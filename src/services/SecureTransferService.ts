import { BLUETOOTH_CONSTANTS } from '../constants/index';
import CryptoJS from 'crypto-js';

/**
 * SecureTransferService
 * - Chunking, ACK/resume
 * - CRC32 integrity
 * - Symmetric encryption (AES-GCM placeholder via WebCrypto if available; fallback XOR)
 * - Deterministic envelope for BLE/QR
 */
export class SecureTransferService {
    private static instance: SecureTransferService;
    private ecCurve: 'P-256' = 'P-256';

    static getInstance(): SecureTransferService {
        if (!SecureTransferService.instance) {
            SecureTransferService.instance = new SecureTransferService();
        }
        return SecureTransferService.instance;
    }

    // Envelope format
    // {
    //   v: string,             // protocol version
    //   sid: string,           // session id
    //   idx: number,           // chunk index
    //   total: number,         // total chunks
    //   crc32: string,         // crc of plaintext
    //   nonce?: string,        // hex
    //   payload: string        // hex (ciphertext or plaintext)
    // }

    chunk(data: Uint8Array, chunkSize: number = BLUETOOTH_CONSTANTS.CHUNK_SIZE_BLE): Uint8Array[] {
        const parts: Uint8Array[] = [];
        for (let i = 0; i < data.length; i += chunkSize) {
            parts.push(data.slice(i, Math.min(i + chunkSize, data.length)));
        }
        return parts;
    }

    assemble(chunks: Uint8Array[]): Uint8Array {
        const total = chunks.reduce((sum, c) => sum + c.length, 0);
        const out = new Uint8Array(total);
        let offset = 0;
        for (const c of chunks) {
            out.set(c, offset);
            offset += c.length;
        }
        return out;
    }

    crc32(data: Uint8Array): string {
        let crc = 0xffffffff;
        for (let i = 0; i < data.length; i++) {
            let byte = data[i];
            crc = crc ^ byte;
            for (let j = 0; j < 8; j++) {
                const mask = -(crc & 1);
                crc = (crc >>> 1) ^ (0xedb88320 & mask);
            }
        }
        return ((crc ^ 0xffffffff) >>> 0).toString(16).padStart(8, '0');
    }

    async encrypt(plaintext: Uint8Array, key: Uint8Array): Promise<{ nonce: Uint8Array; ciphertext: Uint8Array }> {
        if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
            const nonce = crypto.getRandomValues(new Uint8Array(12));
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                this.toArrayBuffer(key),
                { name: 'AES-GCM' },
                false,
                ['encrypt']
            );
            const ct = new Uint8Array(
                await crypto.subtle.encrypt({ name: 'AES-GCM', iv: this.toArrayBuffer(nonce) }, cryptoKey, this.toArrayBuffer(plaintext))
            );
            return { nonce, ciphertext: ct };
        }
        // Không cho phép fallback yếu ở production
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
            // Fallback XOR chỉ phục vụ dev để demo luồng, cảnh báo rõ ràng
            console.warn('Using insecure XOR fallback encryption in development mode');
            const nonce = crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(12)) : new Uint8Array(12);
            const out = new Uint8Array(plaintext.length);
            for (let i = 0; i < plaintext.length; i++) out[i] = plaintext[i] ^ key[i % key.length];
            return { nonce, ciphertext: out };
        }
        throw new Error('Secure encryption unavailable on this platform');
    }

    async decrypt(ciphertext: Uint8Array, key: Uint8Array, nonce: Uint8Array): Promise<Uint8Array> {
        if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
            const cryptoKey = await crypto.subtle.importKey(
                'raw',
                this.toArrayBuffer(key),
                { name: 'AES-GCM' },
                false,
                ['decrypt']
            );
            const pt = new Uint8Array(
                await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.toArrayBuffer(nonce) }, cryptoKey, this.toArrayBuffer(ciphertext))
            );
            return pt;
        }
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
            console.warn('Using insecure XOR fallback decryption in development mode');
            const out = new Uint8Array(ciphertext.length);
            for (let i = 0; i < ciphertext.length; i++) out[i] = ciphertext[i] ^ key[i % key.length];
            return out;
        }
        throw new Error('Secure decryption unavailable on this platform');
    }

    toHex(u8: Uint8Array): string {
        return Array.from(u8)
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }

    fromHex(hex: string): Uint8Array {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
    }

    private toArrayBuffer(u8: Uint8Array): ArrayBuffer {
        return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength) as ArrayBuffer;
    }

    private async sha256(data: Uint8Array): Promise<Uint8Array> {
        if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
            const digest = await crypto.subtle.digest('SHA-256', this.toArrayBuffer(data));
            return new Uint8Array(digest);
        }
        // Fallback to CryptoJS
        const wordArray = CryptoJS.lib.WordArray.create(data as any);
        const hash = CryptoJS.SHA256(wordArray);
        const hex = hash.toString(CryptoJS.enc.Hex);
        return this.fromHex(hex);
    }

    // ---- ECDH / Key derivation ----
    async generateEphemeralKeyPair(): Promise<{ publicKeyRaw: Uint8Array; publicKeyHex: string; privateKey: any }> {
        if (typeof crypto !== 'undefined' && (crypto as any).subtle) {
            const kp = await crypto.subtle.generateKey(
                { name: 'ECDH', namedCurve: this.ecCurve },
                true,
                ['deriveBits']
            );
            const pubRaw = new Uint8Array(await crypto.subtle.exportKey('raw', (kp as CryptoKeyPair).publicKey));
            return { publicKeyRaw: pubRaw, publicKeyHex: this.toHex(pubRaw), privateKey: (kp as CryptoKeyPair).privateKey };
        }
        // Fallback: random 32 bytes; publish SHA-256(priv) as 'public'
        const priv = crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(32)) : new Uint8Array(32);
        const pub = await this.sha256(priv);
        return { publicKeyRaw: pub, publicKeyHex: this.toHex(pub), privateKey: priv };
    }

    async deriveSharedKey(myPrivateKey: any, peerPublicKeyRaw: Uint8Array): Promise<Uint8Array> {
        if (typeof crypto !== 'undefined' && (crypto as any).subtle && myPrivateKey && (myPrivateKey.type || (myPrivateKey.algorithm && myPrivateKey.usages))) {
            const peerKey = await crypto.subtle.importKey(
                'raw',
                this.toArrayBuffer(peerPublicKeyRaw),
                { name: 'ECDH', namedCurve: this.ecCurve },
                false,
                []
            );
            const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: peerKey as CryptoKey }, myPrivateKey as CryptoKey, 256);
            const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bits));
            return hash;
        }
        const merged = new Uint8Array((myPrivateKey as Uint8Array).length + peerPublicKeyRaw.length);
        merged.set(myPrivateKey as Uint8Array, 0);
        merged.set(peerPublicKeyRaw, (myPrivateKey as Uint8Array).length);
        return await this.sha256(merged);
    }

    async buildFrames(
        sessionId: string,
        dataPlain: Uint8Array,
        key: Uint8Array,
        encrypt: boolean = true
    ): Promise<string[]> {
        const crc = this.crc32(dataPlain);
        const { nonce, ciphertext } = encrypt ? await this.encrypt(dataPlain, key) : { nonce: new Uint8Array(), ciphertext: dataPlain };
        const payload = this.chunk(ciphertext);
        const total = payload.length;
        const frames: string[] = [];
        for (let idx = 0; idx < total; idx++) {
            const body = {
                v: BLUETOOTH_CONSTANTS.PROTOCOL_VERSION,
                sid: sessionId,
                idx,
                total,
                crc32: crc,
                nonce: encrypt ? this.toHex(nonce) : undefined,
                payload: this.toHex(payload[idx])
            };
            frames.push(JSON.stringify(body));
        }
        return frames;
    }

    async parseFrames(frames: string[], key: Uint8Array, decrypt: boolean = true): Promise<Uint8Array> {
        const parsed = frames.map(f => JSON.parse(f));
        parsed.sort((a, b) => a.idx - b.idx);
        const payloads = parsed.map(p => this.fromHex(p.payload));
        const combined = this.assemble(payloads);
        const nonce = parsed[0].nonce ? this.fromHex(parsed[0].nonce) : new Uint8Array();
        // Ensure BufferSource compatibility for WebCrypto typings
        const combinedU8 = new Uint8Array(combined.buffer, combined.byteOffset, combined.byteLength);
        const plaintext = decrypt ? await this.decrypt(combinedU8, key, nonce) : combinedU8;
        const crcLocal = this.crc32(plaintext);
        if (crcLocal !== parsed[0].crc32) {
            throw new Error('CRC mismatch');
        }
        return plaintext;
    }

    // ---- QR helpers ----
    async buildQrPages(
        sessionId: string,
        dataPlain: Uint8Array,
        key: Uint8Array,
        encrypt: boolean = true
    ): Promise<string[]> {
        const frames = await this.buildFrames(sessionId, dataPlain, key, encrypt);
        return frames.map(f => `VQR:${f}`);
    }

    async parseQrPages(pages: string[], key: Uint8Array, decrypt: boolean = true): Promise<Uint8Array> {
        const frames = pages.map(p => (p.startsWith('VQR:') ? p.slice(4) : p));
        return this.parseFrames(frames, key, decrypt);
    }
}


