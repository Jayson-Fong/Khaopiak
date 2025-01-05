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
export class Test extends OpenAPIRoute {
	schema = {
		tags: ['File'],
		summary: 'Delete a file',
		request: {
			body: {
				content: {
					'application/octet-stream': {
						schema: z.custom<Uint8Array>()
					}
				}
			}
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
		console.log(await c.req.parseBody());
		console.log(c.req.raw.body?.getReader());

		const stuff = (await c.req.raw.body?.getReader().read())?.value;
		return c.json({ message: 'hi' });
	}
}
