import { Str } from 'chanfana';
import { z } from 'zod';
import { Context } from 'hono';
import config from '../../../../config.json';
import {
	GENERIC_400,
	GENERIC_401,
	GENERIC_HEADER_CLOUDFLARE_ACCESS,
	MNEMONIC_STRING,
	RESPONSE_SUCCESS
} from '../../../util/schema';
import { OpenAPIFormRoute } from '../../../util/OpenAPIFormRoute';
import { Environment } from '../../../types';

/**
 * OpenAPI endpoint to delete a file based on a BIP39 mnemonic
 * without acknowledging whether a file existed with the mnemonic
 */
export class FileDelete extends OpenAPIFormRoute {
	schema = {
		tags: ['File'],
		summary: 'Delete a file',
		request: {
			body: {
				content: {
					'multipart/form-data': {
						schema: z.object({
							mnemonic: MNEMONIC_STRING
						})
					},
					'application/octet-stream': {
						schema: z.any()
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
							success: RESPONSE_SUCCESS(true)
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

	async handle(c: Context<Environment>): Promise<Response> {
		const { bip39 } = await this.extractMnemonicOrError(c);

		await (
			await bip39.toTheoreticalObject(c.env.OBJECT_KEY_SECRET)
		).delete(c.env.STORAGE);
		return this.secureRespond(c, { success: true });
	}
}
