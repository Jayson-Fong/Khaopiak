import { Str } from 'chanfana';
import { z } from 'zod';
import { Context } from 'hono';
import { generateMnemonic } from 'bip39';
import {
	bufferConcat,
	generateRandomBytes,
	msTimeToBuffer,
	numberToBuffer
} from '../../../util/buffer';
import { fileToContentPrefix } from '../../../util/format';
import config from '../../../../config.json';
import {
	GENERIC_401,
	GENERIC_HEADER_CLOUDFLARE_ACCESS,
	RESPONSE_SUCCESS
} from '../../../util/schema';
import { OpenAPIFormRoute } from '../../../util/OpenAPIFormRoute';
import FileExtractor from '../../../extractor/FileExtractor';
import BIP39 from '../../../util/BIP39';
import { Environment } from '../../../types';

/**
 * Uploads a file to Cloudflare R2 after
 * encrypting it with AES-GCM using a key
 * derived from a BIP39 mnemonic of a length
 * specified by the client.
 */
export class FileUpload extends OpenAPIFormRoute {
	schema = {
		tags: ['File'],
		summary: 'Upload a file',
		request: {
			body: {
				content: {
					'multipart/form-data': {
						schema: z.object({
							file: z
								.instanceof(File)
								.describe('An uploaded file')
								.refine((x) => x.size),
							entropy: z.coerce
								.number({
									description:
										'Bits of entropy for file identification. The highest level of entropy possible will be used for AES-GCM encryption.'
								})
								.gte(128)
								.lte(256)
								._addCheck({
									kind: 'multipleOf',
									value: 32
								}),
							expiry: z.coerce
								.number({
									description:
										'The number of seconds the file should be downloadable before the file is made unavailable or deleted.'
									// TODO: Make the maximum and default (and later, minimum) configurable
								})
								.min(
									config.upload.expiry.allowInfinite
										? -1
										: config.upload.expiry.min
								)
								// The max queue retry delay is 12 hours, with a max 100 retries
								// as a result, the absolute maximum expiry is 1200 hours.
								.max(config.upload.expiry.max)
								.int()
								// The max queue retry delay is 12 hours, so let's avoid
								// using an operation if the user doesn't need to.
								.default(config.upload.expiry.default),
							padding: z.coerce.number().nonnegative()
						})
					}
				}
			},
			...(config.requireAuth.delete
				? { headers: GENERIC_HEADER_CLOUDFLARE_ACCESS }
				: {})
		},
		responses: {
			'200': {
				description: 'File successfully uploaded',
				content: {
					'application/json': {
						schema: z.object({
							success: RESPONSE_SUCCESS(true),
							mnemonic: Str({
								description:
									'BIP39 mnemonic used for file retrieval and server-side decryption',
								required: true,
								example:
									'pass frog invite more question expose nose start swarm quality unhappy steak'
							})
						})
					}
				}
			},
			'401': GENERIC_401
		}
	};

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
		const mnemonic = generateMnemonic(entropyByteCount);
		const bip39 = new BIP39(mnemonic);

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
			bufferConcat([
				fileToContentPrefix(file),
				await file.arrayBuffer(),
				paddingBytes,
				numberToBuffer(6, padding)
			])
		);

		// Adding in 6 bytes to account for expiry time and 12 bytes to account for the IV
		const fileExpiryTime = Date.now() + expiry * 1000;
		const ivInjectedFileBuffer = bufferConcat([
			msTimeToBuffer(fileExpiryTime),
			iv,
			cipherText
		]);

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

		return this.secureRespond(c, { success: true, mnemonic: mnemonic });
	}
}
