import { digestToKey } from './format';
import { clearBuffer, hexToArrayBuffer, toAESKeyData } from './buffer';
import TheoreticalObject from './TheoreticalObject';
import { ClientError } from '../error/ClientError';
import {
	generateMnemonic,
	mnemonicToEntropy,
	validateMnemonic
} from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english';

export default class BIP39 {
	mnemonic?: string | null;
	entropy?: ArrayBuffer;

	constructor(mnemonic?: string | null, entropy?: ArrayBuffer) {
		this.mnemonic = mnemonic;
		this.entropy = entropy;
	}

	isValid(): boolean {
		return !!this.mnemonic && validateMnemonic(this.mnemonic, english);
	}

	toEntropy(): ArrayBuffer {
		if (this.entropy) {
			return this.entropy;
		}

		if (!this.mnemonic) {
			throw new ClientError({
				success: false,
				error: 'Invalid mnemonic'
			});
		}

		this.entropy = mnemonicToEntropy(this.mnemonic, english);

		return this.entropy!;
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

	async toTheoreticalObject(
		serverSecret: string
	): Promise<TheoreticalObject> {
		return new TheoreticalObject(
			digestToKey(
				await crypto.subtle.sign(
					'HMAC',
					await crypto.subtle.importKey(
						'raw',
						hexToArrayBuffer(serverSecret),
						{
							name: 'HMAC',
							hash: 'SHA-256'
						},
						false,
						['sign']
					),
					this.toEntropy()
				)
			)
		);
	}

	clear(): void {
		if (this.entropy instanceof ArrayBuffer) {
			clearBuffer(this.entropy);
		}
	}

	static create(entropyBits: number): BIP39 {
		return new BIP39(generateMnemonic(english, entropyBits));
	}
}
