import { Bool, Str } from 'chanfana';
import { z } from 'zod';
import { Context } from 'hono';
import { bufferToNumber } from '../../util/buffer';
import config from '../../../config.json';
import { generateResponse } from '../../util/pki';
import {
	GENERIC_400,
	GENERIC_401,
	GENERIC_HEADER_CLOUDFLARE_ACCESS,
	MNEMONIC_STRING
} from '../../util/schema';
import { OpenAPIFormRoute } from '../../util/OpenAPIFormRoute';

/**
 * Checks if a file exists based on a BIP39
 * mnemonic. If the file should be expired,
 * it will be immediately deleted and a
 * response will be returned to the client
 * as if it did not exist.
 */
export class FileExists extends OpenAPIFormRoute {
	schema = {
		tags: ['File'],
		summary: 'Check if a file exists',
		request: {
			body: {
				content: {
					'multipart/form-data': {
						schema: z.object({
							// The minimum mnemonic in *English* is 12 space-separated words of 3 characters
							// The maximum mnemonic in *English* is 24 space-separated words of 8 characters
							mnemonic: MNEMONIC_STRING
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
				description: 'File status successfully queried',
				content: {
					'application/json': {
						schema: z.object({
							success: Bool({
								description:
									'Whether the existence check operation succeeded',
								required: true,
								default: true,
								example: true
							}),
							exists: Bool({
								description:
									'Whether the file exists at the time of querying',
								required: true,
								default: false,
								example: false
							})
						})
					},
					'application/octet-stream': {
						schema: Str({
							description:
								'Returned when an encrypted mnemonic is sent to the server. The JSON response is encrypted using the provided public key and contains a single boolean-valued entry named "success" indicating whether the server successfully processed the request; however, does not acknowledge whether the file initially existed.',
							required: true
						})
					}
				}
			},
			'401': GENERIC_401,
			'400': GENERIC_400
		}
	};

	async handle(c: Context) {
		const { bip39, extractedData } = await this.extractMnemonicOrError(c);

		const theoreticalObject = await bip39.toTheoreticalObject();
		const object = await theoreticalObject.get(c.env.STORAGE);

		if (!object) {
			return generateResponse(extractedData.publicKey, c.json, {
				success: true,
				exists: false
			});
		}

		const expiry = bufferToNumber(
			new Uint8Array((await object.arrayBuffer()).slice(0, 6))
		);
		if (expiry <= Date.now()) {
			// Since the file is expired, it should be gone by now, so we pretend it's gone.
			// And that's not wrong since it is indeed about to be gone...
			await theoreticalObject.delete(c.env.STORAGE);

			return generateResponse(extractedData.publicKey, c.json, {
				success: true,
				exists: false
			});
		}

		return generateResponse(extractedData.publicKey, c.json, {
			success: true,
			exists: !!object
		});
	}
}
