import { Context } from 'hono';
import { bufferToNumber } from '../../../util/buffer';
import {
	extractContentPrefix,
	extractPaddingData,
	isPDF
} from '../../../util/format';
import { OpenAPIFormRoute } from '../../../util/OpenAPIFormRoute';
import { Environment } from '../../../types';
import FileDownloadSchema from '../../../schema/FileDownloadSchema';

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
export class FileDownload extends OpenAPIFormRoute {
	schema = FileDownloadSchema;

	async handle(c: Context<Environment>): Promise<Response> {
		const data = await this.getValidatedData<typeof this.schema>();
		const { bip39 } = await this.extractMnemonicOrError(c);

		const cryptoKey = await bip39.toCryptoKey(['decrypt']);
		const theoreticalObject = await bip39.toTheoreticalObject(
			c.env.OBJECT_KEY_SECRET
		);
		bip39.clear();
		const object = await theoreticalObject.get(c.env.STORAGE);

		// If the object does not exist...
		if (!object) {
			throw this.error('Failed to find file by mnemonic', 404);
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

			throw this.error('Failed to find file by mnemonic', 404);
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

		let contentBuffer = decryptedBuffer.slice(contentStart);
		return this.secureRespond(
			c,
			contentBuffer.slice(
				0,
				this.isPKIDownload(c)
					? undefined
					: -extractPaddingData(contentBuffer)
			),
			{
				headers
			}
		);
	}
}
