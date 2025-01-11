import { Context } from 'hono';
import {
	bufferConcat,
	generateRandomBytes,
	msTimeToBuffer,
	numberToBuffer
} from '../../../util/buffer';
import { fileToContentPrefix } from '../../../util/format';
import config from '../../../../config.json';
import { OpenAPIFormRoute } from '../../../util/OpenAPIFormRoute';
import FileExtractor from '../../../extractor/FileExtractor';
import BIP39 from '../../../util/BIP39';
import { Environment } from '../../../types';
import FileUploadSchema from '../../../schema/FileUploadSchema';

/**
 * Uploads a file to Cloudflare R2 after
 * encrypting it with AES-GCM using a key
 * derived from a BIP39 mnemonic of a length
 * specified by the client.
 */
export class FileUpload extends OpenAPIFormRoute {
	schema = FileUploadSchema;

	async handle(c: Context<Environment>): Promise<Response> {
		let extractedData = await this.extractData<{
			padding: number;
			entropy: number;
			expiry: number;
			file: File;
		}>(c, FileExtractor);

		const {
			padding,
			entropy: entropyByteCount,
			expiry,
			file
		} = await extractedData.data;

		// We'll use a mnemonic to identify the file and act as an encryption key, shared with the client.
		// The client has their own mnemonic for client-side encryption. When requesting files, the client
		// will only send the Workers-generated mnemonic.
		const bip39 = BIP39.create(entropyByteCount);

		// For AES-GCM encryption, use the entropy bits as a key.
		const cryptoKey = bip39.toCryptoKey(['encrypt']);

		// The IV will be stored later as a prefix to the ciphertext
		const iv = crypto.getRandomValues(new Uint8Array(0xc));

		// Generate padding to falsify the file's size
		const paddingBytes = generateRandomBytes(padding);

		// Encrypt the file content prefixed with a null-separated name and type using AES-GCM
		const cipherText = await crypto.subtle.encrypt(
			{ name: 'AES-GCM', iv: iv },
			await cryptoKey,
			bufferConcat(
				[
					fileToContentPrefix(file),
					await file.arrayBuffer(),
					paddingBytes,
					numberToBuffer(6, padding)
				],
				true
			)
		);

		// Adding in 6 bytes to account for expiry time and 12 bytes to account for the IV
		const fileExpiryTime = Date.now() + expiry * 1000;
		const ivInjectedFileBuffer = bufferConcat(
			[msTimeToBuffer(fileExpiryTime), iv, cipherText],
			true
		);

		// Enqueue the file for deletion if it's configured to be delete-able
		const theoreticalObject = await bip39.toTheoreticalObject(
			c.env.OBJECT_KEY_SECRET
		);
		if (
			expiry >= 0 &&
			(!config.upload.expiry.excessiveExpiryAsInfinite ||
				expiry <= config.queue.maxRetries * config.queue.maxRetryDelay)
		) {
			await c.env.CLEANUP_QUEUE.send(
				{
					key: theoreticalObject.getObjectKey(),
					expiry: fileExpiryTime
				},
				{
					delaySeconds: Math.min(expiry, config.queue.maxRetryDelay),
					contentType: 'json'
				}
			);
		}

		// Upload the ciphertext to Cloudflare R2
		await theoreticalObject.put(c.env.STORAGE, ivInjectedFileBuffer);
		const mnemonic = bip39.mnemonic!;
		bip39.clear();
		return this.secureRespond(c, {
			success: true,
			mnemonic: mnemonic
		});
	}
}
