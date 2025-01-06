import { bufferToNumber } from '../util/buffer';
import { extractContentPrefix } from '../util/format';
import config from '../../config.json';

export const fileExtractor = (
	input: Uint8Array
): Promise<{
	padding: number;
	entropy: number;
	expiry: number;
	file: File;
}> => {
	return new Promise<{
		padding: number;
		entropy: number;
		expiry: number;
		file: File;
	}>(async () => {
		if (input.byteLength < 8) {
			throw new Error('Malformed payload');
		}

		const { contentStart, name, type } = extractContentPrefix(
			input.slice(6)
		);

		const extracted = {
			padding: bufferToNumber(input.slice(0, 2)),
			entropy: bufferToNumber(input.slice(2, 4)) ?? 128,
			expiry:
				bufferToNumber(input.slice(4, 6)) ??
				config.upload.expiry.default,
			file: new File([input.slice(6 + contentStart)], name, {
				type: type
			})
		};

		if (extracted.padding > Math.max(extracted.file.size * 0.5, 2048)) {
			throw new Error('Excessive padding request');
		}

		if (
			extracted.entropy % 32 !== 0 ||
			extracted.entropy < 128 ||
			extracted.entropy > 256
		) {
			throw new Error('Invalid entropy request');
		}

		if (
			extracted.expiry > config.upload.expiry.max ||
			extracted.expiry < config.upload.expiry.min
		) {
			throw new Error('Invalid expiry request');
		}

		return extracted;
	});
};
