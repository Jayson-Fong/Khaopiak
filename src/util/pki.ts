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

export const decryptServerKeyedV2 = async (
	input: Uint8Array,
	privateKey: CryptoKey
) => {
	return crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, input);
};

type ExtractionData<T> = {
	version?: number;
	publicKey?: CryptoKey;
	data: Promise<T>;
};

export const extractData = async <T extends object>(
	contentType: string | undefined,
	primaryInputStream: ReadableStream | null,
	extractor: (input: Uint8Array) => Promise<T>,
	fallback: () => Promise<T>,
	privateKey: () => Promise<CryptoKey>
): Promise<ExtractionData<T>> => {
	if (
		!contentType ||
		contentType !== 'application/octet-stream' ||
		!primaryInputStream ||
		primaryInputStream.locked
	) {
		return { data: fallback() };
	}

	let bytes;
	try {
		bytes = (await primaryInputStream.getReader().read()).value;
	} catch (e) {
		return Promise.reject(e);
	}

	if (!(bytes instanceof Uint8Array)) {
		return Promise.reject('Failed to parse payload');
	}

	const payload = new Uint8Array(
		await decryptServerKeyedV2(bytes, await privateKey())
	);

	// Minimally, the response must include at least 2 bytes
	// for the version, then 2 bytes for the key length
	if (payload.byteLength < 4) {
		return Promise.reject('Malformed payload');
	}

	const version = bufferToNumber(payload.slice(0, 2));
	if (!version) {
		return Promise.reject('Malformed payload');
	}

	if (version !== 1) {
		return Promise.reject('Unsupported version');
	}

	const keyByteCount = bufferToNumber(payload.slice(2, 4));
	if (payload.byteLength - keyByteCount - 4 < 0) {
		return Promise.reject('Malformed payload');
	}

	let publicKey;
	if (keyByteCount > 0) {
		try {
			publicKey = await crypto.subtle.importKey(
				'spki',
				payload.slice(4, keyByteCount + 4),
				{ name: 'RSA-OAEP', hash: 'SHA-512' },
				true,
				['decrypt']
			);
		} catch (e) {
			return Promise.reject(e);
		}
	}

	return {
		version: version,
		data: extractor(payload),
		publicKey: publicKey
	};
};

export const extractMnemonic = async (
	input: string | File,
	privateKey: Promise<CryptoKey>
): Promise<{
	publicKey: null | CryptoKey;
	mnemonic: BIP39;
}> => {
	if (input instanceof File) {
		// Across all versions, the first 2 bytes
		// specify the protocol version in plaintext

		const inputBytes = new Uint8Array(
			await decryptServerKeyed(input, await privateKey)
		);

		// For version 1, it should be 2 bytes to specify
		// public key length, followed by content.
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
	publicKey: CryptoKey | null | undefined,
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
				// TODO: Add secure headers to payload
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
