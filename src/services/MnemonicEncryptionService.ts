import CryptoJS from 'crypto-js';
import { EncryptedMnemonic } from '../types/wallet';

/**
 * Service mã hóa và giải mã mnemonic phrase
 * Sử dụng PBKDF2 và AES-256 để bảo mật
 */
export class MnemonicEncryptionService {
    private static readonly ITERATIONS = 100000;
    private static readonly KEY_SIZE = 256;
    private static readonly SALT_SIZE = 128;

    /**
     * Mã hóa mnemonic gốc thành chuỗi mã hóa
     * @param originalMnemonic - Mnemonic gốc
     * @param userPassword - Mật khẩu người dùng
     * @returns EncryptedMnemonic object
     */
    static async encryptMnemonic(
        originalMnemonic: string,
        userPassword: string
    ): Promise<EncryptedMnemonic> {
        try {
            // Tạo salt ngẫu nhiên
            const salt = CryptoJS.lib.WordArray.random(this.SALT_SIZE / 8);

            // Tạo key từ password sử dụng PBKDF2
            const key = CryptoJS.PBKDF2(userPassword, salt, {
                keySize: this.KEY_SIZE / 32,
                iterations: this.ITERATIONS
            });

            // Tạo IV ngẫu nhiên
            const iv = CryptoJS.lib.WordArray.random(16);

            // Mã hóa mnemonic với AES-256
            const encrypted = CryptoJS.AES.encrypt(originalMnemonic, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });

            // Tạo fake mnemonic để hiển thị
            const fakeMnemonic = this.generateFakeMnemonic();

            return {
                encryptedData: encrypted.toString(),
                salt: salt.toString(),
                iv: iv.toString(),
                fakeMnemonic,
                algorithm: 'AES-256-CBC',
                iterations: this.ITERATIONS,
                keySize: this.KEY_SIZE,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Failed to encrypt mnemonic:', error);
            throw new Error('Encryption failed');
        }
    }

    /**
     * Giải mã chuỗi mã hóa về mnemonic gốc
     * @param encryptedData - Dữ liệu đã mã hóa
     * @param userPassword - Mật khẩu người dùng
     * @returns Mnemonic gốc
     */
    static async decryptMnemonic(
        encryptedData: EncryptedMnemonic,
        userPassword: string
    ): Promise<string> {
        try {
            // Parse salt/iv từ hex và tạo key từ password và salt
            const saltWA = CryptoJS.enc.Hex.parse(encryptedData.salt);
            const key = CryptoJS.PBKDF2(userPassword, saltWA, {
                keySize: encryptedData.keySize / 32,
                iterations: encryptedData.iterations
            });

            // Giải mã với AES-256
            const decrypted = CryptoJS.AES.decrypt(encryptedData.encryptedData, key, {
                iv: CryptoJS.enc.Hex.parse(encryptedData.iv),
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });

            const originalMnemonic = decrypted.toString(CryptoJS.enc.Utf8);

            if (!originalMnemonic) {
                throw new Error('Invalid password or corrupted data');
            }

            return originalMnemonic;

        } catch (error) {
            console.error('Failed to decrypt mnemonic:', error);
            throw new Error('Decryption failed - check your password');
        }
    }

    /**
     * Tạo fake mnemonic để hiển thị (không phải mnemonic thật)
     * @returns Fake mnemonic string
     */
    static generateFakeMnemonic(): string {
        const fakeWords = [
            'abandon', 'ability', 'able', 'about', 'above', 'absent', 'absorb', 'abstract',
            'absurd', 'abuse', 'access', 'accident', 'account', 'accuse', 'achieve', 'acid',
            'acoustic', 'acquire', 'across', 'act', 'action', 'actor', 'actual', 'adapt',
            'add', 'addict', 'address', 'adjust', 'admit', 'adult', 'advance', 'advice'
        ];

        const fakeMnemonic = [];
        for (let i = 0; i < 24; i++) {
            const randomIndex = Math.floor(Math.random() * fakeWords.length);
            fakeMnemonic.push(fakeWords[randomIndex]);
        }

        return fakeMnemonic.join(' ');
    }

    /**
     * Kiểm tra xem mnemonic có hợp lệ không
     * @param mnemonic - Mnemonic cần kiểm tra
     * @returns true nếu hợp lệ
     */
    static isValidMnemonic(mnemonic: string): boolean {
        if (!mnemonic || typeof mnemonic !== 'string') {
            return false;
        }

        const words = mnemonic.trim().split(/\s+/);

        // Kiểm tra độ dài (12, 15, 18, 21, 24 words)
        if (![12, 15, 18, 21, 24].includes(words.length)) {
            return false;
        }

        // Kiểm tra mỗi word có phải là string hợp lệ không
        return words.every(word =>
            word &&
            word.length > 0 &&
            /^[a-z]+$/.test(word)
        );
    }

    /**
     * Tạo hash của mnemonic để so sánh
     * @param mnemonic - Mnemonic cần hash
     * @returns Hash string
     */
    static hashMnemonic(mnemonic: string): string {
        return CryptoJS.SHA256(mnemonic).toString();
    }

    /**
     * So sánh hai mnemonic có giống nhau không
     * @param mnemonic1 - Mnemonic thứ nhất
     * @param mnemonic2 - Mnemonic thứ hai
     * @returns true nếu giống nhau
     */
    static compareMnemonics(mnemonic1: string, mnemonic2: string): boolean {
        const hash1 = this.hashMnemonic(mnemonic1);
        const hash2 = this.hashMnemonic(mnemonic2);
        return hash1 === hash2;
    }
}
