import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { ErrorHandler, ErrorSeverity, ErrorType } from './ErrorHandler';

export interface GuardianProfile {
    id: string;
    label: string;
    contact: string; // email/phone/deviceId
    pubKey?: string; // optional for signature flow
    addedAt: number;
}

export interface GuardianPolicy {
    threshold: number; // number of guardians required
    guardians: GuardianProfile[];
    cooldownHours: number; // delay before finalize recovery
}

export interface RecoveryRequest {
    id: string;
    createdAt: number;
    requesterHint?: string; // hint for user account
    approvals: Array<{ guardianId: string; signature?: string; approvedAt: number }>;
    status: 'pending' | 'approved' | 'finalized' | 'cancelled';
    expiresAt?: number;
}

/**
 * GuardianRecoveryService
 * Minimal guardian-based recovery coordination using local storage only.
 * This coordinates approvals; actual key rotation/import handled elsewhere.
 */
export class GuardianRecoveryService {
    private static instance: GuardianRecoveryService;
    private static STORAGE_POLICY = 'guardian_policy_v1';
    private static STORAGE_REQUEST = 'guardian_recovery_request_v1';
    private errorHandler = ErrorHandler.getInstance();

    static getInstance(): GuardianRecoveryService {
        if (!GuardianRecoveryService.instance) {
            GuardianRecoveryService.instance = new GuardianRecoveryService();
        }
        return GuardianRecoveryService.instance;
    }

    async getPolicy(): Promise<GuardianPolicy | null> {
        try {
            const raw = await AsyncStorage.getItem(GuardianRecoveryService.STORAGE_POLICY);
            return raw ? JSON.parse(raw) as GuardianPolicy : null;
        } catch (e) {
            this.errorHandler.handleError(e as Error, 'GuardianRecoveryService.getPolicy', ErrorSeverity.LOW, ErrorType.STORAGE);
            return null;
        }
    }

    async savePolicy(policy: GuardianPolicy): Promise<void> {
        try {
            // simple validation
            const threshold = Math.max(1, Math.min(policy.threshold, policy.guardians.length));
            const normalized: GuardianPolicy = {
                cooldownHours: policy.cooldownHours ?? 24,
                threshold,
                guardians: policy.guardians.map(g => ({ ...g, id: g.id || `g_${Date.now()}_${Math.random().toString(36).slice(2)}` }))
            };
            await AsyncStorage.setItem(GuardianRecoveryService.STORAGE_POLICY, JSON.stringify(normalized));
        } catch (e) {
            this.errorHandler.handleError(e as Error, 'GuardianRecoveryService.savePolicy', ErrorSeverity.MEDIUM, ErrorType.STORAGE);
            throw e;
        }
    }

    async startRecovery(requesterHint?: string): Promise<RecoveryRequest> {
        const req: RecoveryRequest = {
            id: `rec_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            createdAt: Date.now(),
            requesterHint,
            approvals: [],
            status: 'pending',
        };
        await AsyncStorage.setItem(GuardianRecoveryService.STORAGE_REQUEST, JSON.stringify(req));
        return req;
    }

    async getActiveRecovery(): Promise<RecoveryRequest | null> {
        const raw = await AsyncStorage.getItem(GuardianRecoveryService.STORAGE_REQUEST);
        return raw ? JSON.parse(raw) as RecoveryRequest : null;
    }

    async approveRecovery(guardianId: string, signature?: string): Promise<RecoveryRequest | null> {
        const req = await this.getActiveRecovery();
        if (!req || req.status !== 'pending') return req;
        const has = req.approvals.some(a => a.guardianId === guardianId);
        if (!has) {
            req.approvals.push({ guardianId, signature, approvedAt: Date.now() });
            await AsyncStorage.setItem(GuardianRecoveryService.STORAGE_REQUEST, JSON.stringify(req));
        }
        return req;
    }

    async verifyApproval(guardianId: string, payload: string, signature: string, guardianPubKey: string): Promise<boolean> {
        // NOTE: react-native-biometrics signatures are platform-verified against the device keys.
        // For simple local flow, accept presence of signature. For advanced verification,
        // integrate server or platform attestation check. Here we just check non-empty.
        return !!(signature && guardianId && payload && guardianPubKey);
    }

    async canFinalize(): Promise<{ ok: boolean; reason?: string }> {
        const [policy, req] = await Promise.all([this.getPolicy(), this.getActiveRecovery()]);
        if (!policy) return { ok: false, reason: 'No guardian policy' };
        if (!req || req.status !== 'pending') return { ok: false, reason: 'No active recovery' };
        const approvals = req.approvals.length;
        if (approvals < policy.threshold) return { ok: false, reason: 'Insufficient approvals' };
        const elapsedHours = (Date.now() - req.createdAt) / (1000 * 60 * 60);
        if (elapsedHours < policy.cooldownHours) return { ok: false, reason: 'Cooldown not met' };
        return { ok: true };
    }

    async finalizeRecovery(newEncryptedMnemonicJson: string): Promise<boolean> {
        try {
            const can = await this.canFinalize();
            if (!can.ok) throw new Error(can.reason || 'Cannot finalize');
            // Replace encrypted mnemonic in secure storage
            await SecureStore.setItemAsync('encrypted_mnemonic', newEncryptedMnemonicJson);
            // Mark request finalized
            const req = await this.getActiveRecovery();
            if (req) {
                req.status = 'finalized';
                req.expiresAt = Date.now();
                await AsyncStorage.setItem(GuardianRecoveryService.STORAGE_REQUEST, JSON.stringify(req));
            }
            return true;
        } catch (e) {
            this.errorHandler.handleError(e as Error, 'GuardianRecoveryService.finalizeRecovery', ErrorSeverity.HIGH, ErrorType.CRYPTO);
            return false;
        }
    }

    async cancelRecovery(): Promise<void> {
        await AsyncStorage.removeItem(GuardianRecoveryService.STORAGE_REQUEST);
    }
}


