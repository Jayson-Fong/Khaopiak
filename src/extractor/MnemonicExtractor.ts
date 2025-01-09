const MnemonicExtractor = (
	input: Uint8Array
): Promise<{ mnemonic: string }> => {
	return new Promise<{ mnemonic: string }>(() => {
		let textDecoder = new TextDecoder();
		return {
			mnemonic: textDecoder.decode(input)
		};
	});
};

export default MnemonicExtractor;
