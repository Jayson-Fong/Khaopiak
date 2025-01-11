import { Context } from 'hono';
import { bufferToNumber } from '../../../util/buffer';
import { OpenAPIFormRoute } from '../../../util/OpenAPIFormRoute';
import { Environment } from '../../../types';
import FileExistsSchema from '../../../schema/FileExistsSchema';

/**
 * Checks if a file exists based on a BIP39
 * mnemonic. If the file should be expired,
 * it will be immediately deleted and a
 * response will be returned to the client
 * as if it did not exist.
 */
export class FileExists extends OpenAPIFormRoute {
	schema = FileExistsSchema;

	async handle(c: Context<Environment>): Promise<Response> {
		const { bip39 } = await this.extractMnemonicOrError(c);

		const theoreticalObject = await bip39.toTheoreticalObject(
			c.env.OBJECT_KEY_SECRET
		);
		bip39.clear();
		const object = await theoreticalObject.get(c.env.STORAGE);

		if (!object) {
			return this.secureRespond(c, { success: true, exists: false });
		}

		const expiry = bufferToNumber(
			new Uint8Array((await object.arrayBuffer()).slice(0, 6))
		);
		if (expiry <= Date.now()) {
			// Since the file is expired, it should be gone by now, so we pretend it's gone.
			// And that's not wrong since it is indeed about to be gone...
			await theoreticalObject.delete(c.env.STORAGE);

			return this.secureRespond(c, { success: true, exists: false });
		}

		return this.secureRespond(c, { success: true, exists: !!object });
	}
}
