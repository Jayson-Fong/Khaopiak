import { Context } from 'hono';
import { OpenAPIFormRoute } from '../../../util/OpenAPIFormRoute';
import { Environment } from '../../../types';
import FileDeleteSchema from '../../../schema/FileDeleteSchema';

/**
 * OpenAPI endpoint to delete a file based on a BIP39 mnemonic
 * without acknowledging whether a file existed with the mnemonic
 */
export class FileDelete extends OpenAPIFormRoute {
	schema = FileDeleteSchema;

	async handle(c: Context<Environment>): Promise<Response> {
		const { bip39 } = await this.extractMnemonicOrError(c);

		await (
			await bip39.toTheoreticalObject(c.env.OBJECT_KEY_SECRET)
		).delete(c.env.STORAGE);

		bip39.clear();
		return this.secureRespond(c, { success: true });
	}
}
