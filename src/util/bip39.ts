import { mnemonicToEntropy, validateMnemonic } from 'bip39';
import { digestToKey } from './format';
import { hexToArrayBuffer } from './buffer';
import { TheoreticalObject } from './TheoreticalObject';

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
			throw Error('Mnemonic is invalid.');
		}

		this.entropy = hexToArrayBuffer(mnemonicToEntropy(this.mnemonic));

		return this.entropy;
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
