import { Bool, OpenAPIRoute, Str } from 'chanfana';
import { z } from 'zod';
import { Context } from 'hono';
import { bufferToNumber, toAESKeyData } from '../../util/buffer';
import { extractContentPrefix, isPDF } from '../../util/format';
import config from '../../../config.json';
import {
	GENERIC_400,
	GENERIC_401,
	GENERIC_HEADER_CLOUDFLARE_ACCESS,
	MNEMONIC_STRING
} from '../../util/schema';
import {
	extractMnemonic,
	generateResponse,
	importServerPrivateKey
} from '../../util/pki';

/**
 * OpenAPI endpoint to download a file based on
 * a BIP39 mnemonic. If its file signature matches
 * that of a PDF and its original Content-Type was
 * consistent, and the client does not object,
 * headers will be presented such that the browser
 * should render it. If a file should be expired,
 * it will be immediately deleted and a response
 * will be returned to the client as if it did
 * not exist.
 */
export class FileDownload extends OpenAPIRoute {
	schema = {
		tags: ['File'],
		summary: 'Download a file',
		request: {
			query: z.object({
				noRender: Bool({
					description: 'Disable rendering PDF files in-browser',
					default: false,
					example: true,
					required: false
				})
			}),
			body: {
				content: {
					'multipart/form-data': {
						schema: z.object({
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
				description: 'File successfully retrieved',
				content: {
					'application/octet-stream': {
						schema: Str({
							description:
								'A binary file, provided when the file Content-Type is not application/pdf, ' +
								'the file signature is not indicative of a PDF, or when noRender is true',
							required: true
						})
					},
					'application/pdf': {
						schema: Str({
							description:
								'A binary PDF file, provided when the file Content-Type is application/pdf, ' +
								'the file signature is indicative of a PDF, and when noRender is not true',
							required: true
						})
					}
				}
			},
			'401': GENERIC_401,
			'400': GENERIC_400,
			'404': {
				description: 'File not found',
				content: {
					'application/json': {
						schema: z.object({
							success: Bool({
								description:
									'Whether the download operation succeeded',
								required: true,
								default: false,
								example: false
							}),
							error: Str({
								default: 'Failed to find file by mnemonic',
								description: 'File not found error',
								example: 'Failed to find file by mnemonic',
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

		const cryptoKey = await crypto.subtle.importKey(
			'raw',
			toAESKeyData(mnemonic.toEntropy()),
			{ name: 'AES-GCM' },
			true,
			['decrypt']
		);

		const theoreticalObject = await mnemonic.toTheoreticalObject();
		const object = await theoreticalObject.get(c.env.STORAGE);

		// If the object does not exist...
		if (!object) {
			return generateResponse(
				publicKey,
				c.json,
				{
					success: false,
					error: 'Failed to find file by mnemonic'
				},
				404
			);
		}

		// The object's body is composed of the expiry (6 bytes) + IV (12 bytes) + ciphertext
		const cipherTextExpiryIVBuffer = await object.arrayBuffer();

		// The first 6 bytes is the expiry
		const expiry = bufferToNumber(
			new Uint8Array(cipherTextExpiryIVBuffer.slice(0, 6))
		);
		if (expiry <= Date.now()) {
			// Since the file is expired, it should be gone by now, so we pretend it's gone.
			// And that's not wrong since it is indeed about to be gone...
			await theoreticalObject.delete(c.env.STORAGE);

			return generateResponse(
				publicKey,
				c.json,
				{
					success: false,
					error: 'Failed to find file by mnemonic'
				},
				404
			);
		}

		// Decrypt the file using AES-GCM given bytes 6 - 17 of the stored file is the IV
		const decryptedBuffer = new Uint8Array(
			await crypto.subtle.decrypt(
				{ name: 'AES-GCM', iv: cipherTextExpiryIVBuffer.slice(6, 18) },
				cryptoKey,
				cipherTextExpiryIVBuffer.slice(18)
			)
		);

		// The plaintext is prefixed by the file name and type, which needs to be extracted and removed.
		const { name, type, contentStart } =
			extractContentPrefix(decryptedBuffer);

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('etag', object.httpEtag);

		let contentDisposition = 'attachment';
		if (
			!data.query.noRender &&
			type == 'application/pdf' &&
			isPDF(decryptedBuffer.slice(contentStart, contentStart + 5))
		) {
			contentDisposition = 'inline';
		}

		// TODO: Set the filename properly per RFC 5987
		headers.set(
			'Content-Disposition',
			`${contentDisposition}; filename=${name.replaceAll(/[^\w. ]/g, '')}`
		);
		headers.set('Content-Type', type ?? 'application/octet-stream');

		// We've got the file and got this far...now to destroy it
		await theoreticalObject.delete(c.env.STORAGE);

		// TODO: Return this using generateResponse
		return generateResponse(
			publicKey,
			c.json,
			decryptedBuffer.slice(contentStart),
			200,
			headers
		);
	}
}
