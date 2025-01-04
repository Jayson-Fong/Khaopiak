import { Bool, OpenAPIRoute, Str } from 'chanfana';
import { z } from 'zod';
import { Context } from 'hono';
import config from '../../../config.json';
import {
	extractMnemonic,
	generateResponse,
	importServerPrivateKey
} from '../../util/pki';
import {
	GENERIC_400,
	GENERIC_401,
	GENERIC_HEADER_CLOUDFLARE_ACCESS,
	MNEMONIC_STRING
} from '../../util/schema';

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
								MNEMONIC_STRING,
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
				? { headers: GENERIC_HEADER_CLOUDFLARE_ACCESS }
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
			'401': GENERIC_401,
			'400': GENERIC_400
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
			({ publicKey, mnemonic } = await extractMnemonic(
				data.body.mnemonic,
				importServerPrivateKey(c.env)
			));
		} catch (e) {
			// This indicates a potentially encrypted request,
			// and the client might want an encrypted response.
			// We can't honor it without their public key, so
			// we error on the side of caution.
			return new Response(null);
		}

		if (!mnemonic.isValid()) {
			return generateResponse(
				publicKey,
				c.json,
				{
					success: false,
					error: 'Invalid mnemonic'
				},
				400
			);
		}

		await (await mnemonic.toTheoreticalObject()).delete(c.env.STORAGE);

		return generateResponse(publicKey, c.json, {
			success: true
		});
	}
}
