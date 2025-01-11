export const clearBuffer = (buffer: ArrayBufferLike): void => {
	new Uint8Array(buffer).set(new Array(buffer.byteLength).fill(0));
};

/**
 * Takes an array of ArrayBufferLike and concatenates them sequentially to produce a single ArrayBuffer
 * @param buffers An array of ArrayBufferLike to concatenate
 * @param clear Whether to set the source buffer to 0 after concatenating
 */
export const bufferConcat = (
	buffers: ArrayBufferLike[],
	clear: boolean = false
): ArrayBuffer => {
	// Create a new Uint8Array the size of the sum of all the buffers combined
	const newBuffer = new Uint8Array(
		buffers.map((b) => b.byteLength).reduce((a, b) => a + b)
	);

	// Set the new buffer to the bytes of the buffers in a sequence
	let cumulativeByteLength = 0;
	buffers.forEach((buffer) => {
		newBuffer.set(new Uint8Array(buffer), cumulativeByteLength);
		if (clear) clearBuffer(buffer);

		cumulativeByteLength += buffer.byteLength;
	});

	// Slice to change this ArrayBufferLike into an ArrayBuffer!
	return newBuffer.buffer.slice(0);
};

/**
 * Pad the entropy with leading zeroes if necessary to meet the next
 * minimum key length for AES if needed (128, 192, 256), or truncate
 * to 256 bits if the entropy is excessive.
 * @param entropy Entropy bits as an ArrayBufferLike
 */
export const toAESKeyData = (entropy: ArrayBufferLike): ArrayBufferLike => {
	const keyByteLength =
		Math.min(Math.ceil((entropy.byteLength - 16) / 8), 2) * 8 + 16;

	if (keyByteLength === entropy.byteLength) {
		return entropy;
	}

	if (keyByteLength < entropy.byteLength) {
		return bufferConcat([
			new Uint8Array(keyByteLength - entropy.byteLength).buffer,
			entropy
		]);
	}

	return entropy.slice(0, keyByteLength);
};

/**
 * Takes an ArrayBufferLike for conversion into a hex string
 * @param buffer An ArrayBufferLike to convert into a hex string
 */
export const bufferToHex = (buffer: ArrayBufferLike): string => {
	return [...new Uint8Array(buffer)]
		.map((x) => Number(x).toString(16).padStart(2, '0'))
		.join('');
};

/**
 * Takes the number of milliseconds since epoch and converts it into a Uint8Array of 6 bytes
 * @param time The number of milliseconds since epoch
 */
export const msTimeToBuffer = (time: number): Uint8Array => {
	let buffer = new Uint8Array(6);

	for (let i = 0; i < buffer.byteLength; i++) {
		buffer[i] = time % 256;
		time = Math.floor(time / 256);
	}

	return buffer;
};

/**
 * Takes a Uint8Array and converts it into a number
 * @param buffer A Uint8Array
 */
export const bufferToNumber = (buffer: Uint8Array): number => {
	let num = 0;

	for (let i = buffer.length - 1; i >= 0; i--) {
		num = num * 256 + buffer[i];
	}

	return num;
};

export const numberToBuffer = (byteLength: number, num: number): Uint8Array => {
	let buffer = new Uint8Array(byteLength);

	for (let i = 0; i < buffer.byteLength; i++) {
		buffer[i] = num % 256;
		num = Math.floor(num / 256);
	}

	return buffer;
};

/**
 * Takes a hex string and converts it into an ArrayBuffer
 * @param hex A hexadecimal string
 */
export const hexToArrayBuffer = (hex: string): ArrayBuffer => {
	return Uint8Array.from(
		(hex.match(/.{1,2}/g) as RegExpMatchArray).map((b) => parseInt(b, 16))
	).buffer;
};

export const generateRandomBytes = (byteLength: number): Uint8Array => {
	// crypto.getRandomValues only supports 64K bytes at a time (65536 bytes),
	// so this generates it in chunks!
	const randomByteArrays = [];

	let remainingByteLength = byteLength;
	while (remainingByteLength > 0) {
		let iterationBytes = Math.min(65536, remainingByteLength);
		randomByteArrays.push(
			crypto.getRandomValues(new Uint8Array(iterationBytes))
		);
		remainingByteLength -= iterationBytes;
	}

	return new Uint8Array(bufferConcat(randomByteArrays));
};
