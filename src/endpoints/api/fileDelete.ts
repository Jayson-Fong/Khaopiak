import { Bool, OpenAPIRoute, Str } from 'chanfana';
import { z } from 'zod';
import { Context } from 'hono';
import config from '../../../config.json';
import { extractData, generateResponse } from '../../util/pki';
import {
	GENERIC_400,
	GENERIC_401,
	GENERIC_HEADER_CLOUDFLARE_ACCESS,
	MNEMONIC_STRING
} from '../../util/schema';
import { mnemonicExtractor } from '../../extractor/mnemonic';
import BIP39 from '../../util/bip39';

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
		let extractedData;
		try {
			extractedData = await extractData<{ mnemonic: string }>(
				c.req.header('Content-Type'),
				c.req.raw.body,
				mnemonicExtractor,
				async () => {
					return this.schema.request.body.content[
						'multipart/form-data'
					].schema.parse(await c.req.parseBody());
				},
				c.env.PRIVATE_KEY_HEX
			);
		} catch (e) {
			return new Response(null, { status: 400 });
		}

		const { mnemonic } = await extractedData.data;
		const bip39 = new BIP39(mnemonic);

		if (!bip39.isValid()) {
			return generateResponse(
				extractedData.publicKey,
				c.json,
				{
					success: false,
					error: 'Invalid mnemonic'
				},
				400
			);
		}

		await (await bip39.toTheoreticalObject()).delete(c.env.STORAGE);
		return generateResponse(extractedData.publicKey, c.json, {
			success: true
		});
	}
}
