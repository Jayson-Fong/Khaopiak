/**
 * Accepts `entropy` and slices to the longest possible entropy-bit only AES-GCM key
 * @param entropy Entropy bits as an ArrayBufferLike with a minimum byteLength of 16
 */
export const trimToCryptoKey = (entropy: ArrayBufferLike): ArrayBufferLike => {
    // AES-GCM only supports 128, 192, and 256-bit keys. These are represented as byte counts here.
    return entropy.slice(0, Math.max(...[32, 24, 16].filter(x => x <= entropy.byteLength)));
}

/**
 * Takes an array of ArrayBufferLike and concatenates them sequentially to produce a single ArrayBuffer
 * @param buffers An array of ArrayBufferLike to concatenate
 */
export const bufferConcat = (buffers: (ArrayBufferLike)[]): ArrayBuffer => {
    // Create a new Uint8Array the size of the sum of all the buffers combined
    const newBuffer = new Uint8Array(buffers.map(b => b.byteLength)
        .reduce((a, b) => a + b));

    // Set the new buffer to the bytes of the buffers in a sequence
    let cumulativeByteLength = 0;
    buffers.forEach(buffer => {
        newBuffer.set(new Uint8Array(buffer), cumulativeByteLength);
        cumulativeByteLength += buffer.byteLength;
    });

    // Slice to change this ArrayBufferLike into an ArrayBuffer!
    return newBuffer.buffer.slice(0);
}

/**
 * Takes an ArrayBufferLike for conversion into a hex string
 * @param buffer An ArrayBufferLike to convert into a hex string
 */
export const bufferToHex = (buffer: ArrayBufferLike) => {
    return [...new Uint8Array(buffer)]
        .map(x => x.toString(16).padStart(2, '0'))
        .join('');
}

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
}

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
}

/**
 * Takes a hex string and converts it into an ArrayBuffer
 * @param hex A hexadecimal string
 */
export const hexToArrayBuffer = (hex: string): ArrayBuffer => {
    return Uint8Array.from(hex.match(/.{1,2}/g).map(b => parseInt(b, 16))).buffer;
}