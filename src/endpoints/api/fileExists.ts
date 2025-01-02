import { Bool, OpenAPIRoute, Str } from 'chanfana';
import { z } from 'zod';
import { Context } from 'hono';
import { validateMnemonic, mnemonicToEntropy } from 'bip39';
import { digestToKey } from '../../util/format';
import { bufferToNumber, hexToArrayBuffer } from '../../util/buffer';
import config from '../../../config.json';

/**
 * Checks if a file exists based on a BIP39
 * mnemonic. If the file should be expired,
 * it will be immediately deleted and a
 * response will be returned to the client
 * as if it did not exist.
 */
export class FileExists extends OpenAPIRoute {
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
							mnemonic: Str({
								description:
									'The BIP39 mnemonic used for file storage and server-side encryption',
								example:
									'vivid few stable brown wine update elevator angry document brain another success',
								required: true
							})
								.min(47)
								.max(215)
						})
					}
				}
			},
			...(config.requireAuth.exists
				? {
						headers: z.object({
							'cf-access-authenticated-user-email': z
								.string({
									description:
										'Cloudflare Access authenticated user email'
								})
								.email()
						})
					}
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
					}
				}
			},
			'401': {
				description: 'Missing or bad authentication',
				content: {
					'application/json': {
						schema: z.object({
							success: Bool({
								description:
									'Whether the existence check operation succeeded',
								required: true,
								default: false,
								example: false
							}),
							error: Str({
								default: 'Missing or bad authentication',
								description: 'Authentication error',
								example: 'Missing or bad authentication',
								required: true
							})
						})
					}
				}
			},
			'400': {
				description: 'Bad request',
				content: {
					'application/json': {
						schema: z.object({
							success: Bool({
								description:
									'Whether the existence check operation succeeded',
								required: true,
								default: false,
								example: false
							}),
							error: Str({
								default: 'Invalid mnemonic',
								description: 'Bad request error',
								example: 'Invalid mnemonic',
								required: true
							})
						})
					}
				}
			}
		}
	};

	async handle(c: Context) {
		// Get the validated, typed data from the context.
		// TODO: Chanfana has a bug causing it not to parse the body with `this.getValidatedData`. Eventually, simplify.
		// Really this only depends on the body anyways, but nonetheless...
		const data = {
			...(await this.getValidatedData<typeof this.schema>()),
			body: this.schema.request.body.content[
				'multipart/form-data'
			].schema.parse(await c.req.parseBody())
		};

		if (!validateMnemonic(data.body.mnemonic)) {
			return c.json(
				{
					success: false,
					error: 'Invalid mnemonic'
				},
				400
			);
		}

		const entropy = mnemonicToEntropy(data.body.mnemonic);

		const entropyBytes = hexToArrayBuffer(entropy);

		// Generate the file hash for generation of the R2 file path
		const objectKey = digestToKey(
			await crypto.subtle.digest({ name: 'SHA-256' }, entropyBytes)
		);

		const object = await c.env.STORAGE.get(objectKey);

		const expiry = bufferToNumber(
			new Uint8Array((await object.arrayBuffer()).slice(0, 6))
		);
		if (expiry <= Date.now()) {
			// Since the file is expired, it should be gone by now, so we pretend it's gone.
			// And that's not wrong since it is indeed about to be gone...
			await c.env.STORAGE.delete(objectKey);

			return c.json({
				success: true,
				exists: false
			});
		}

		return c.json({
			success: true,
			exists: !!object
		});
	}
}
