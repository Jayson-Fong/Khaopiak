import { bufferToNumber } from '../util/buffer';
import { extractContentPrefix } from '../util/format';
import config from '../../config.json';
import { ClientError } from '../error/ClientError';

const FileExtractor = (
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
			throw new ClientError({
				success: false,
				error: 'Malformed payload'
			});
		}

		const { contentStart, name, type } = extractContentPrefix(
			input.slice(10)
		);

		return {
			padding: bufferToNumber(input.slice(0, 4)),
			entropy: bufferToNumber(input.slice(4, 6)) ?? 128,
			expiry:
				bufferToNumber(input.slice(6, 10)) ??
				config.upload.expiry.default,
			file: new File([input.slice(10 + contentStart)], name, {
				type: type
			})
		};
	});
};

export default FileExtractor;
