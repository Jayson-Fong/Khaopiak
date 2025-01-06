import { bufferConcat, bufferToNumber, hexToArrayBuffer } from './buffer';
import { ResponseInitStrictHeader } from '../types';

export const decryptServerKeyed = async (
	input: Uint8Array,
	privateKey: CryptoKey
) => {
	return crypto.subtle.decrypt({ name: 'RSA-OAEP' }, privateKey, input);
};

export type ExtractionData<T = object> = {
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
		await decryptServerKeyed(bytes, await privateKey())
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

export const responseInitToBytes = (responseInit: ResponseInitStrictHeader) => {
	if (!responseInit.headers) {
		const statusNoHeaderBuffer = new ArrayBuffer(3);
		const statusNoHeaderView = new DataView(statusNoHeaderBuffer);
		statusNoHeaderView.setUint16(0, responseInit.status ?? 200);

		return new Uint8Array(statusNoHeaderBuffer);
	}

	const headerCount = Array.from(responseInit.headers.entries()).length;
	if (headerCount > 255) {
		throw Error('Excessive number of response headers.');
	}

	const textEncoder = new TextEncoder();

	let reformattedHeaders = [] as {
		key: Uint8Array;
		values: Uint8Array[];
	}[];

	Array.from(responseInit.headers.keys()).forEach((key) => {
		reformattedHeaders.push({
			key: textEncoder.encode(key),
			// TODO: Get rid of this condition? TypeScript is
			//  complaining for some reason.
			values: responseInit.headers
				? responseInit.headers
						.getAll(key)
						.map((v) => textEncoder.encode(v))
				: []
		});
	});

	// 2 bytes for HTTP status, 1 byte for the number of headers, then
	// allocate space for all header names and values, where repeated header
	// names are fully repeated rather than an array-like structure. Each
	// name-value pair uses 2 nulls in the format of:
	// (INT)NAME(NULL)VALUE(NULL). If a header is repeated, they should
	// appear right after another; however, client developers should not
	// depend on this relationship.
	const buffer = new Uint8Array(
		reformattedHeaders
			.map(
				(h) =>
					h.values.map((v) => v.byteLength).reduce((a, b) => a + b) +
					h.key.byteLength * h.values.length +
					h.values.length * 2
			)
			.reduce((a, b) => a + b) + 2
	);

	let allocatedBytes = 3;
	// Convert the status code to 2 bytes
	const statusBuffer = new ArrayBuffer(2);
	const statusBufferView = new DataView(statusBuffer);
	statusBufferView.setUint16(0, responseInit.status ?? 200);
	const statusBufferUint8 = new Uint8Array(statusBuffer);

	buffer.set([statusBufferUint8[0], statusBufferUint8[1], headerCount]);
	reformattedHeaders.forEach((header) => {
		header.values.forEach((v) => {
			buffer.set(header.key, allocatedBytes);
			allocatedBytes += header.key.byteLength;

			buffer.set([0], allocatedBytes++);

			buffer.set(v, allocatedBytes);
			allocatedBytes += v.byteLength;

			buffer.set([0], allocatedBytes++);
		});
	});

	return buffer;
};

export const sanitizeResponseInit = (
	responseInit: ResponseInit
): ResponseInit & {
	status?: number | undefined;
	headers: HeadersInit;
} => {
	return {
		status: responseInit.status
			? responseInit.status >= 200 && responseInit.status < 300
				? 200
				: responseInit.status >= 400 && responseInit.status < 500
					? 400
					: responseInit.status
			: undefined,
		headers: {
			'Content-Type': 'application/octet-stream'
		}
	};
};

/**
 * When not using PKI, this function returns a response as traditionally
 * expected; however, when using PKI, it can only ever return an HTTP 200
 * or 400 status code from within the 2xx and 4xx ranges. Otherwise, we
 * would risk data leakage, such as the case of a 201 or 404. The true
 * HTTP status code and headers are sent as part of ciphertext encrypted
 * using asymmetric encryption.
 * @param publicKey
 * @param jsonWrapper
 * @param payload
 * @param responseInit
 */
export const generateResponse = async (
	publicKey: CryptoKey | null | undefined,
	jsonWrapper: (payload: object, responseInit: ResponseInit) => Response,
	payload: object | Uint8Array | null = null,
	responseInit: ResponseInitStrictHeader = {}
): Promise<Response> => {
	if (!payload) {
		return new Response(payload, responseInit);
	}

	if (!publicKey) {
		return payload instanceof Uint8Array
			? new Response(payload, responseInit)
			: jsonWrapper(payload, responseInit);
	}

	const textEncoder = new TextEncoder();
	try {
		const anticipatedHeaders =
			payload instanceof Uint8Array
				? { 'Content-Type': 'application/octet-stream' }
				: jsonWrapper(payload, responseInit).headers;

		return new Response(
			await crypto.subtle.encrypt(
				{ name: 'RSA-OAEP' },
				publicKey,
				bufferConcat([
					responseInitToBytes(responseInit),
					payload instanceof Uint8Array
						? payload
						: textEncoder.encode(JSON.stringify(payload))
				])
			),
			sanitizeResponseInit({
				status: responseInit.status,
				headers: anticipatedHeaders
			})
		);
	} catch (e) {
		// An encrypted response was requested, which we cannot provide.
		return new Response(null, { status: 400 });
	}
};

export const importServerPrivateKey = (key: string) => {
	return crypto.subtle.importKey(
		'pkcs8',
		hexToArrayBuffer(key),
		{ name: 'RSA-OAEP', hash: 'SHA-512' },
		true,
		['decrypt']
	);
};
