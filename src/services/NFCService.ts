import NfcManager, {Ndef, NfcTech} from 'react-native-nfc-manager';
import { SecureIdentityService } from './SecureIdentityService';
import { MerchantIdentityService } from './MerchantIdentityService';

export interface PaymentRequestPayload {
	recipient: string; // bech32 address
	amount?: string; // ADA string (e.g., "12.5") or lovelace string
	note?: string;
    merchantId?: string; // optional merchant identifier
    signatureHex?: string; // ECDSA signature over canonical JSON
}

/**
 * NFCService
 * - Scan NFC NDEF payloads to autofill payment request (recipient, amount)
 * - Write NFC NDEF payloads (merchant prepares a tag with address/amount)
 */
export class NFCService {
	private static instance: NFCService;
	private initialized = false;

	static getInstance(): NFCService {
		if (!NFCService.instance) NFCService.instance = new NFCService();
		return NFCService.instance;
	}

	async initialize(): Promise<boolean> {
		try {
			if (this.initialized) return true;
			await NfcManager.start();
			this.initialized = true;
			return true;
		} catch {
			return false;
		}
	}

	async isSupported(): Promise<boolean> {
		try {
			await this.initialize();
			return true;
		} catch {
			return false;
		}
	}

	async isEnabled(): Promise<boolean> {
		try {
			await this.initialize();
			// Some platforms require separate API; fallback true after start
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Read a single NFC payment request from an NDEF tag. Resolves once a tag is read or on timeout.
	 */
	async readPaymentRequest(timeoutMs: number = 15000): Promise<PaymentRequestPayload | null> {
		await this.initialize();
		return new Promise(async (resolve) => {
			let done = false;
			const finish = async (result: PaymentRequestPayload | null) => {
				if (done) return;
				done = true;
				try { await NfcManager.unregisterTagEvent(); } catch {}
				resolve(result);
			};

			const onTagDiscovered = (tag: any) => {
				try {
					const payload = this.parseNdef(tag);
					finish(payload);
				} catch {
					finish(null);
				}
			};

			try {
				await NfcManager.registerTagEvent(onTagDiscovered, 'Hold device near NFC', {
					invalidateAfterFirstRead: true,
				});
			} catch {
				finish(null);
				return;
			}

			setTimeout(() => finish(null), timeoutMs);
		});
	}

	/**
	 * Write a payment request to a compatible tag using NDEF.
	 */
	async writePaymentRequest(data: PaymentRequestPayload): Promise<boolean> {
		try {
			await this.initialize();
			await NfcManager.requestTechnology(NfcTech.Ndef);
			const json = JSON.stringify(data);
			const bytes = Ndef.encodeMessage([
				Ndef.mimeMediaRecord('application/json', this.textToBytes(json)),
			]);
			// Try modern handler first, fallback to legacy method
			if ((NfcManager as any).ndefHandler?.writeNdefMessage) {
				await (NfcManager as any).ndefHandler.writeNdefMessage(bytes);
			} else if ((NfcManager as any).writeNdefMessage) {
				await (NfcManager as any).writeNdefMessage(bytes);
			}
			await NfcManager.cancelTechnologyRequest();
			return true;
		} catch (e) {
			try { await NfcManager.cancelTechnologyRequest(); } catch {}
			return false;
		}
	}

    private parseNdef(tag: any): PaymentRequestPayload | null {
		if (!tag?.ndefMessage || !Array.isArray(tag.ndefMessage)) return null;
		for (const record of tag.ndefMessage) {
			// Prefer JSON MIME record
			if (record?.tnf === Ndef.TNF_MIME_MEDIA || record?.type) {
				try {
					const type = this.bytesToText(record.type);
					if (type?.includes('application/json')) {
						const text = this.bytesToText(record.payload);
						const obj = JSON.parse(text);
                        if (obj?.recipient) return obj;
					}
				} catch {}
			}
			// Fallback: Text record
			try {
				const text = this.parseTextRecord(record);
                // Support cardano: URI
                if (text?.startsWith('cardano:')) {
                    const parsed = this.parseCardanoUri(text);
                    if (parsed) return parsed;
                }
                const maybe = JSON.parse(text);
                if (maybe?.recipient) return maybe;
			} catch {}
		}
		return null;
	}

    private parseCardanoUri(uri: string): PaymentRequestPayload | null {
        try {
            const u = new URL(uri);
            const address = u.pathname || u.host || '';
            if (!address) return null;
            const amount = u.searchParams.get('amount') || undefined;
            const note = u.searchParams.get('message') || undefined;
            return { recipient: address, amount, note };
        } catch {
            return null;
        }
    }

    async verifyMerchantSignature(payload: PaymentRequestPayload): Promise<boolean> {
        try {
            if (!payload.merchantId || !payload.signatureHex) return true; // nothing to verify
            const merchantKey = await MerchantIdentityService.getInstance().getMerchantPublicKeyHex(payload.merchantId);
            if (!merchantKey) return false;
            const msg = JSON.stringify({ recipient: payload.recipient, amount: payload.amount || '', note: payload.note || '', merchantId: payload.merchantId });
            return await SecureIdentityService.getInstance().verify(merchantKey, msg, payload.signatureHex);
        } catch {
            return false;
        }
    }

	private parseTextRecord(record: any): string {
		try {
			const payload: number[] = record.payload || [];
			if (payload.length <= 3) return '';
			// First byte indicates language code length for well-known Text record
			const langLen = payload[0] & 0x3f;
			const textBytes = payload.slice(1 + langLen);
			return this.bytesToText(textBytes);
		} catch {
			return '';
		}
	}

	private textToBytes(text: string): Uint8Array {
		const encoder = new TextEncoder();
		return encoder.encode(text);
	}

	private bytesToText(bytes: number[] | Uint8Array): string {
		const decoder = new TextDecoder();
		return decoder.decode(new Uint8Array(bytes as any));
	}
}

export default NFCService;


