import { mnemonicToEntropy, validateMnemonic } from 'bip39';
import { digestToKey } from './format';
import { hexToArrayBuffer, toAESKeyData } from './buffer';
import { TheoreticalObject } from './TheoreticalObject';
import { ClientError } from '../error/ClientError';

export default class BIP39 {
	mnemonic?: string | null;
	entropy?: ArrayBuffer;

	constructor(mnemonic?: string | null) {
		this.mnemonic = mnemonic;
	}

	isValid() {
		return this.mnemonic && validateMnemonic(this.mnemonic);
	}

	toEntropy() {
		if (this.entropy) {
			return this.entropy;
		}

		if (!this.mnemonic) {
			throw new ClientError({
				success: false,
				error: 'Invalid mnemonic'
			});
		}

		this.entropy = hexToArrayBuffer(mnemonicToEntropy(this.mnemonic));

		return this.entropy;
	}

	toCryptoKey(keyUsages: ('encrypt' | 'decrypt')[]): Promise<CryptoKey> {
		return crypto.subtle.importKey(
			'raw',
			toAESKeyData(this.toEntropy()),
			{ name: 'AES-GCM' },
			true,
			keyUsages
		);
	}

	async toTheoreticalObject() {
		return new TheoreticalObject(
			digestToKey(
				await crypto.subtle.digest(
					{ name: 'SHA-256' },
					this.toEntropy()
				)
			)
		);
	}
}
