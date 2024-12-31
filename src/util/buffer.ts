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
