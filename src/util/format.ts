import { bufferToHex } from './buffer';
import { ClientError } from '../error/ClientError';

/**
 * Remove all null characters from a string
 * @param str A string
 */
export const stripNulls = (str: string): string => {
	return str.replace('\0', '');
};

/**
 * Returns a Uint8Array of a string containing the file and content type of the file, each suffixed by a null byte
 * @param file A File object
 */
export const fileToContentPrefix = (file: File): Uint8Array => {
	return new TextEncoder().encode(
		`${stripNulls(file.name)}\0${stripNulls(file.type)}\0`
	);
};

/**
 * Extracts the file name, type, and expiry as encoded by filesToContentPrefix() and returns the content start index
 * @param buffer A buffer such that a file name and content type can be found prefixed, each suffixed with a null byte
 * @see fileToContentPrefix
 */
export const extractContentPrefix = (
	buffer: Uint8Array
): { contentStart: number; name: string; type: string } => {
	let separatorIndices: number[] = [];

	for (
		let byteIndex = 0;
		byteIndex < buffer.byteLength && separatorIndices.length < 2;
		byteIndex++
	) {
		if (buffer[byteIndex] == 0) {
			separatorIndices.push(byteIndex);
		}
	}

	if (separatorIndices.length < 2) {
		throw new ClientError({
			success: false,
			error: 'Failed to locate file name/type/expiry separators'
		});
	}

	const decoder = new TextDecoder();

	return {
		name: decoder.decode(buffer.slice(0, separatorIndices[0])),
		type: decoder.decode(
			buffer.slice(separatorIndices[0] + 1, separatorIndices[1])
		),
		contentStart: separatorIndices[1] + 1
	};
};

/**
 * Checks the start of the view for the application/pdf magic
 * @param view A view, optimally one of exactly 5 bytes
 */
export const isPDF = (view: Uint8Array): boolean => {
	return (
		view[0] == 0x25 &&
		view[1] == 0x50 &&
		view[2] == 0x44 &&
		view[3] == 0x46 &&
		view[4] == 0x2d
	);
};

/**
 * Returns a Cloudflare R2 key based on a SHA256 hex digest where the first 12 characters are
 * chunked into groups of 4 characters to form folders, with the object name as the full hex digest.
 * @param digest A SHA256 digest as an ArrayBuffer
 */
export const digestToKey = (digest: ArrayBuffer): string => {
	const hexDigest = bufferToHex(digest);

	return [
		...(hexDigest.substring(0, 4).match(/.{1,2}/g) as RegExpMatchArray),
		hexDigest
	].join('/');
};
