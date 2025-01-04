import { Bool, OpenAPIRoute, Str } from 'chanfana';
import { z } from 'zod';
import { Context } from 'hono';
import { validateMnemonic, mnemonicToEntropy } from 'bip39';
import { digestToKey } from '../../util/format';
import { hexToArrayBuffer } from '../../util/buffer';
import config from '../../../config.json';
import { extractMnemonic } from '../../util/pki';

/**
 * OpenAPI endpoint to delete a file based on a BIP39 mnemonic
 * without acknowledging whether a file existed with the mnemonic
 */
export class FileDelete extends OpenAPIRoute {
	schema = {
		tags: ['File'],
		summary: 'Delete a file',
		request: {
			body: {
				content: {
					'multipart/form-data': {
						schema: z.object({
							// The minimum mnemonic in *English* is 12 space-separated words of 3 characters
							// The maximum mnemonic in *English* is 24 space-separated words of 8 characters
							mnemonic: z.union([
								Str({
									description:
										'The BIP39 mnemonic used for file storage and server-side encryption',
									example:
										'vivid few stable brown wine update elevator angry document brain another success',
									required: true
								})
									.min(47)
									.max(215),
								z
									.instanceof(File)
									.describe(
										"A binary file encrypted using the server's public key. The plaintext should start with two bytes indicating the length of the following public key, which is itself followed by the mnemonic."
									)
							])
						})
					}
				}
			},
			...(config.requireAuth.delete
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
				description: 'File delete request successfully executed',
				content: {
					'application/json': {
						schema: z.object({
							success: Bool({
								description:
									'Whether the delete operation succeeded; however, does not indicate that the file existed',
								required: true,
								default: true,
								example: true
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
			'401': {
				description: 'Missing or bad authentication',
				content: {
					'application/json': {
						schema: z.object({
							success: Bool({
								description:
									'Whether the delete operation succeeded',
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
									'Whether the delete operation succeeded',
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

		let publicKey;
		let mnemonic;

		try {
			const privateKey = await crypto.subtle.importKey(
				'pkcs8',
				hexToArrayBuffer(c.env.PRIVATE_KEY_HEX),
				{ name: 'RSA-OAEP' },
				true,
				['decrypt']
			);

			({ publicKey, mnemonic } = await extractMnemonic(
				data.body.mnemonic,
				privateKey
			));
		} catch (e) {
			// This indicates a potentially encrypted request,
			// and the client might want an encrypted response.
			// We can't honor it without their public key, so
			// we error on the side of caution.
			return new Response(null);
		}

		if (!mnemonic) {
			// TODO: If a public key was provided,
			//  encrypt this. Or if it fails...null.
			return c.json(
				{
					success: false,
					error: 'Invalid mnemonic'
				},
				400
			);
		}

		if (!validateMnemonic(mnemonic)) {
			// TODO: If a public key was provided,
			//  encrypt this. Or if it fails...null.
			return c.json(
				{
					success: false,
					error: 'Invalid mnemonic'
				},
				400
			);
		}

		const entropy = mnemonicToEntropy(mnemonic);

		const entropyBytes = hexToArrayBuffer(entropy);

		// Generate the file hash for generation of the R2 file path
		const objectKey = digestToKey(
			await crypto.subtle.digest({ name: 'SHA-256' }, entropyBytes)
		);

		await c.env.STORAGE.delete(objectKey);

		const payload = {
			success: true
		};

		if (publicKey) {
			const textEncoder = new TextEncoder();

			try {
				return new Response(
					await crypto.subtle.encrypt(
						{ name: 'RSA-OAEP' },
						publicKey,
						textEncoder.encode(JSON.stringify(payload))
					)
				);
			} catch (e) {
				// An encrypted response was requested, which we cannot provide.
				return new Response(null);
			}
		}

		return c.json(payload);
	}
}
