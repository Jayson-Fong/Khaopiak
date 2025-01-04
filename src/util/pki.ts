import { bufferToNumber, hexToArrayBuffer } from './buffer';
import { Bindings } from '../types';
import BIP39 from './bip39';

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
	privateKey: Promise<CryptoKey>
): Promise<{
	publicKey: null | CryptoKey;
	mnemonic: BIP39;
}> => {
	if (input instanceof File) {
		const inputBytes = new Uint8Array(
			await decryptServerKeyed(input, await privateKey)
		);

		// It should be 2 bytes to specify key length, then key
		// of at least a byte, then content bytes of at least 1 byte
		if (inputBytes.byteLength < 3) {
			return {
				publicKey: null,
				mnemonic: new BIP39()
			};
		}

		const keyByteCount = bufferToNumber(inputBytes.slice(0, 2));
		if (inputBytes.length - keyByteCount - 2 < 0) {
			return {
				publicKey: null,
				mnemonic: new BIP39()
			};
		}

		const textDecoder = new TextDecoder();
		return {
			publicKey:
				keyByteCount > 0
					? await crypto.subtle.importKey(
							'spki',
							inputBytes.slice(2, keyByteCount + 2),
							{ name: 'RSA-OAEP', hash: 'SHA-512' },
							true,
							['decrypt']
						)
					: null,
			mnemonic: new BIP39(
				textDecoder.decode(inputBytes.slice(keyByteCount + 2))
			)
		};
	}

	return {
		publicKey: null,
		mnemonic: new BIP39(input)
	};
};

// TODO: Add support for headers
export const generateResponse = async (
	publicKey: CryptoKey | null,
	jsonWrapper: (payload: object, status: number | undefined) => Response,
	payload: object | Uint8Array | null,
	status: number | undefined = undefined,
	headers: HeadersInit | undefined = undefined
): Promise<Response> => {
	if (!payload) {
		return new Response(payload, { status, headers });
	}

	if (!publicKey) {
		return payload instanceof Uint8Array
			? new Response(payload, { status: status, headers })
			: jsonWrapper(payload, status);
	}

	const textEncoder = new TextEncoder();
	try {
		return new Response(
			await crypto.subtle.encrypt(
				{ name: 'RSA-OAEP' },
				publicKey,
				payload instanceof Uint8Array
					? payload
					: textEncoder.encode(JSON.stringify(payload))
			),
			{ status }
		);
	} catch (e) {
		// An encrypted response was requested, which we cannot provide.
		return new Response(null, { status: 400 });
	}
};

export const importServerPrivateKey = (env: Bindings) => {
	return crypto.subtle.importKey(
		'pkcs8',
		hexToArrayBuffer(env.PRIVATE_KEY_HEX),
		{ name: 'RSA-OAEP', hash: 'SHA-512' },
		true,
		['decrypt']
	);
};
