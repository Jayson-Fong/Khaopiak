import { bufferToNumber } from './buffer';

export const decryptServerKeyed = async (
	input: File,
	privateKey: CryptoKey
) => {
	return crypto.subtle.decrypt(
		{ name: 'RSA-OAEP' },
		privateKey,
		await input.bytes()
	);
};

export const extractMnemonic = async (
	input: string | File,
	privateKey: CryptoKey
): Promise<{ publicKey: null | CryptoKey; mnemonic: null | string }> => {
	if (input instanceof File) {
		const inputBytes = new Uint8Array(
			await decryptServerKeyed(input, privateKey)
		);

		// It should be 2 bytes to specify key length, then key
		// of at least a byte, then content bytes of at least 1 byte
		if (inputBytes.byteLength < 3) {
			return {
				publicKey: null,
				mnemonic: null
			};
		}

		const keyByteCount = bufferToNumber(inputBytes.slice(0, 2));
		if (inputBytes.length - keyByteCount - 2 < 0) {
			return {
				publicKey: null,
				mnemonic: null
			};
		}

		const textDecoder = new TextDecoder();
		return {
			publicKey:
				keyByteCount > 0
					? await crypto.subtle.importKey(
							'spki',
							inputBytes.slice(2, keyByteCount + 2),
							{ name: 'RSA-OAEP' },
							true,
							['decrypt']
						)
					: null,
			mnemonic: textDecoder.decode(inputBytes.slice(keyByteCount + 2))
		};
	}

	return {
		publicKey: null,
		mnemonic: input
	};
};
