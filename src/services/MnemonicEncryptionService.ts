import CryptoJS from 'crypto-js';
import { EncryptedMnemonic } from '../types/wallet';
import { CryptoUtils } from '../utils/CryptoUtils';
import { environment } from '../config/Environment';
import { MemoryUtils } from '../utils/MemoryUtils';
import logger from '../utils/Logger';

/**
 * Service mã hóa và giải mã mnemonic phrase
 * Sử dụng PBKDF2 và AES-256 để bảo mật
 */
export class MnemonicEncryptionService {
    private static readonly ITERATIONS = environment.get('PBKDF2_ITERATIONS');
    private static readonly KEY_SIZE = environment.get('AES_KEY_SIZE');
    private static readonly SALT_SIZE = environment.get('SALT_SIZE');

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
        let salt: Uint8Array | undefined;
        let derivedKey: Uint8Array | undefined;
        
        try {
            // Tạo salt ngẫu nhiên sử dụng CryptoUtils
            salt = CryptoUtils.generateSalt(this.SALT_SIZE / 8);
            const saltWordArray = CryptoJS.lib.WordArray.create(Array.from(salt));

            // Tạo key từ password sử dụng PBKDF2 với CryptoUtils  
            derivedKey = await CryptoUtils.deriveKey(
                userPassword, 
                salt, 
                this.ITERATIONS,
                this.KEY_SIZE / 8
            );
            const key = CryptoJS.lib.WordArray.create(Array.from(derivedKey));

            // Tạo IV ngẫu nhiên với CryptoUtils
            const ivBytes = CryptoUtils.generateSecureRandom(16);
            const iv = CryptoJS.lib.WordArray.create(Array.from(ivBytes));

            // Mã hóa mnemonic với AES-256
            const encrypted = CryptoJS.AES.encrypt(originalMnemonic, key, {
                iv: iv,
                mode: CryptoJS.mode.CBC,
                padding: CryptoJS.pad.Pkcs7
            });

            // Tạo fake mnemonic để hiển thị
            const fakeMnemonic = this.generateFakeMnemonic();

            const result = {
                encryptedData: encrypted.toString(),
                salt: saltWordArray.toString(),
                iv: iv.toString(),
                fakeMnemonic,
                algorithm: 'AES-256-CBC',
                iterations: this.ITERATIONS,
                keySize: this.KEY_SIZE,
                timestamp: new Date().toISOString()
            };

            logger.debug('Mnemonic encrypted successfully', 'MnemonicEncryptionService.encryptMnemonic');
            return result;

        } catch (error) {
            logger.error('Failed to encrypt mnemonic', 'MnemonicEncryptionService.encryptMnemonic', error);
            throw new Error('Encryption failed');
        } finally {
            // Clear sensitive data from memory
            if (salt) {
                MemoryUtils.zeroMemory(salt);
            }
            if (derivedKey) {
                MemoryUtils.zeroMemory(derivedKey);
            }
            MemoryUtils.zeroString(userPassword);
            MemoryUtils.zeroString(originalMnemonic);
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
        let derivedKey: Uint8Array | undefined;
        let salt: Uint8Array | undefined;
        
        try {
            // Parse salt từ hex string
            const saltWA = CryptoJS.enc.Hex.parse(encryptedData.salt);
            salt = new Uint8Array(saltWA.words.length * 4);
            for (let i = 0; i < saltWA.words.length; i++) {
                const word = saltWA.words[i];
                salt[i * 4] = (word >>> 24) & 0xff;
                salt[i * 4 + 1] = (word >>> 16) & 0xff;
                salt[i * 4 + 2] = (word >>> 8) & 0xff;
                salt[i * 4 + 3] = word & 0xff;
            }

            // Derive key using CryptoUtils with same parameters
            derivedKey = await CryptoUtils.deriveKey(
                userPassword,
                salt,
                encryptedData.iterations,
                encryptedData.keySize / 8
            );
            
            const key = CryptoJS.lib.WordArray.create(Array.from(derivedKey));

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

            logger.debug('Mnemonic decrypted successfully', 'MnemonicEncryptionService.decryptMnemonic');
            return originalMnemonic;

        } catch (error) {
            logger.error('Failed to decrypt mnemonic', 'MnemonicEncryptionService.decryptMnemonic', error);
            throw new Error('Decryption failed - check your password');
        } finally {
            // Clear sensitive data from memory
            if (salt) {
                MemoryUtils.zeroMemory(salt);
            }
            if (derivedKey) {
                MemoryUtils.zeroMemory(derivedKey);
            }
            MemoryUtils.zeroString(userPassword);
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
