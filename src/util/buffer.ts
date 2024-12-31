/**
 * Accepts `entropy` and slices to the longest possible entropy-bit only AES-GCM key
 * @param entropy Entropy bits as an ArrayBufferLike with a minimum byteLength of 16
 */
export const trimToCryptoKey = (entropy: ArrayBufferLike): ArrayBufferLike => {
    // AES-GCM only supports 128, 192, and 256-bit keys. These are represented as byte counts here.
    return entropy.slice(0, Math.max(...[32, 24, 16].filter(x => x <= entropy.byteLength)));
}