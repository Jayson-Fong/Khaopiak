/**
 * Accepts `entropy` and slices to the longest possible entropy-bit only AES-GCM key
 * @param entropy BIP39 entropy and checksum bits concatenated together as a hex digest
 * @see {@link https://github.com/bitcoinjs/bip39/blob/master/src/index.js} mnemonicToEntropy function
 */
export const bip39ReduceEntropyChecksumToAESGCMKeyBits = (entropy: ArrayBufferLike): ArrayBufferLike => {
    // The number of checksum bits is (entropyBits * 8) / 32, thus, 4 / 5 of the bits are entropy
    const entropyBitLength = entropy.byteLength * 4 / 5;

    // AES-GCM only supports 128, 192, and 256-bit keys. These are represented as byte counts here.
    return entropy.slice(0, Math.max(...[32, 24, 16].filter(x => x <= entropyBitLength)));
}