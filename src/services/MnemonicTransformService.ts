import * as bip39 from 'bip39';
import CryptoJS from 'crypto-js';

/**
 * Valkyrie Mnemonic Transform
 *
 * Biến mnemonic gốc (BIP39 24 từ) thành một chuỗi mnemonic khác (36 từ: 24 + 12)
 * chỉ có thể khôi phục về mnemonic gốc khi có mật khẩu.
 *
 * Thiết kế:
 * - Lấy entropy 32 bytes của mnemonic gốc (24 từ => 256-bit entropy)
 * - Tạo salt 16 bytes và dẫn xuất keystream 32 bytes bằng PBKDF2(password, salt)
 * - maskedEntropy = entropy XOR keystream
 * - transformedMnemonic = BIP39(masmaskedEntropy) [24 từ] + BIP39(salt) [12 từ]
 * - Khôi phục: tách 24/12, tạo lại keystream, XOR để lấy entropy gốc, rồi BIP39(entropy)
 */

export class MnemonicTransformService {
    private static readonly PBKDF2_ITERATIONS = 100000;
    private static readonly KEY_BYTES = 32; // 256-bit keystream
    private static readonly SALT_BYTES = 16; // 128-bit salt

    /**
     * Tạo transformed mnemonic (36 từ) từ mnemonic gốc và mật khẩu
     */
    static async transformMnemonic(originalMnemonic: string, password: string): Promise<string> {
        if (!originalMnemonic || !bip39.validateMnemonic(originalMnemonic)) {
            throw new Error('Invalid original mnemonic');
        }
        if (!password || password.length === 0) {
            throw new Error('Password is required');
        }

        // 1) Lấy entropy 32 bytes của mnemonic gốc
        const originalEntropyHex = bip39.mnemonicToEntropy(originalMnemonic); // 64 hex chars
        const originalEntropy = this.hexToBytes(originalEntropyHex); // 32 bytes

        // 2) Tạo salt 16 bytes
        const saltWA = CryptoJS.lib.WordArray.random(this.SALT_BYTES);
        const salt = this.wordArrayToBytes(saltWA);

        // 3) Dẫn xuất keystream 32 bytes bằng PBKDF2
        const keyWA = CryptoJS.PBKDF2(password, saltWA, {
            keySize: this.KEY_BYTES / 4, // CryptoJS expects 32-bit words
            iterations: this.PBKDF2_ITERATIONS,
        });
        const keystream = this.wordArrayToBytes(keyWA); // 32 bytes

        // 4) XOR entropy với keystream
        const maskedEntropy = this.xorBytes(originalEntropy, keystream);
        const maskedEntropyHex = this.bytesToHex(maskedEntropy);

        // 5) Chuyển maskedEntropy -> 24 từ, salt -> 12 từ
        const maskedMnemonic = bip39.entropyToMnemonic(maskedEntropyHex);
        const saltHex = this.bytesToHex(salt);
        const saltMnemonic = bip39.entropyToMnemonic(saltHex);

        // 6) Gộp 36 từ: 24 (masked) + 12 (salt)
        return `${maskedMnemonic} ${saltMnemonic}`;
    }

    /**
     * Giải mã transformed mnemonic (36 từ) về mnemonic gốc (24 từ) bằng mật khẩu
     */
    static async restoreOriginalMnemonic(transformedMnemonic: string, password: string): Promise<string> {
        const words = transformedMnemonic.trim().split(/\s+/);
        if (words.length !== 36) {
            throw new Error('Transformed mnemonic must be 36 words');
        }
        if (!password || password.length === 0) {
            throw new Error('Password is required');
        }

        const maskedWords = words.slice(0, 24).join(' ');
        const saltWords = words.slice(24).join(' ');

        // 1) Lấy masked entropy (32 bytes) và salt (16 bytes)
        const maskedEntropyHex = bip39.mnemonicToEntropy(maskedWords);
        const saltHex = bip39.mnemonicToEntropy(saltWords);
        const maskedEntropy = this.hexToBytes(maskedEntropyHex);
        const salt = this.hexToBytes(saltHex);

        // 2) Dẫn xuất keystream 32 bytes bằng PBKDF2
        const saltWA = this.bytesToWordArray(salt);
        const keyWA = CryptoJS.PBKDF2(password, saltWA, {
            keySize: this.KEY_BYTES / 4,
            iterations: this.PBKDF2_ITERATIONS,
        });
        const keystream = this.wordArrayToBytes(keyWA);

        // 3) XOR để lấy entropy gốc
        const originalEntropy = this.xorBytes(maskedEntropy, keystream);
        const originalEntropyHex = this.bytesToHex(originalEntropy);

        // 4) Convert về mnemonic gốc (24 từ)
        const originalMnemonic = bip39.entropyToMnemonic(originalEntropyHex);
        return originalMnemonic;
    }

    // Helpers
    private static xorBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
        if (a.length !== b.length) {
            throw new Error('Byte arrays must have the same length');
        }
        const out = new Uint8Array(a.length);
        for (let i = 0; i < a.length; i++) {
            out[i] = a[i] ^ b[i];
        }
        return out;
    }

    private static hexToBytes(hex: string): Uint8Array {
        const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
        const bytes = new Uint8Array(clean.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(clean.substr(i * 2, 2), 16);
        }
        return bytes;
    }

    private static bytesToHex(bytes: Uint8Array): string {
        const hex: string[] = [];
        for (let i = 0; i < bytes.length; i++) {
            const h = bytes[i].toString(16).padStart(2, '0');
            hex.push(h);
        }
        return hex.join('');
    }

    private static wordArrayToBytes(wordArray: CryptoJS.lib.WordArray): Uint8Array {
        const words = wordArray.words;
        const sigBytes = wordArray.sigBytes;
        const bytes = new Uint8Array(sigBytes);
        for (let i = 0; i < sigBytes; i++) {
            bytes[i] = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
        }
        return bytes;
    }

    private static bytesToWordArray(bytes: Uint8Array): CryptoJS.lib.WordArray {
        const words: number[] = [];
        for (let i = 0; i < bytes.length; i++) {
            words[i >>> 2] |= bytes[i] << (24 - (i % 4) * 8);
        }
        return CryptoJS.lib.WordArray.create(words, bytes.length);
    }
}

export default MnemonicTransformService;


