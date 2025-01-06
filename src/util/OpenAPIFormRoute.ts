import { OpenAPIRoute, OpenAPIRouteSchema } from 'chanfana';
import { extractData, ExtractionData, generateResponse } from './pki';
import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { mnemonicExtractor } from '../extractor/mnemonic';
import BIP39 from './bip39';

type FormSchema = {
	request: {
		body: {
			content: {
				'multipart/form-data': any;
			};
		};
	};
};

export class OpenAPIFormRoute extends OpenAPIRoute {
	declare schema: OpenAPIRouteSchema & FormSchema;

	constructor(...p: ConstructorParameters<typeof OpenAPIRoute>) {
		super(...p);
	}

	async extractData<T extends object>(
		c: Context,
		extractor: (input: Uint8Array) => Promise<T>
	): Promise<ExtractionData<T>> {
		try {
			return await extractData<T>(
				c.req.header('Content-Type'),
				c.req.raw.body,
				extractor,
				async () => {
					return this.schema.request.body.content[
						'multipart/form-data'
					].schema.parse(await c.req.parseBody());
				},
				c.env.PRIVATE_KEY_HEX
			);
		} catch (e) {
			throw new HTTPException(400, { res: new Response(null) });
		}
	}

	async extractMnemonicOrError(c: Context) {
		let extractedData = await this.extractData<{ mnemonic: string }>(
			c,
			mnemonicExtractor
		);

		const { mnemonic } = await extractedData.data;
		const bip39 = new BIP39(mnemonic);

		if (!bip39.isValid()) {
			throw new HTTPException(400, {
				res: await generateResponse(
					extractedData.publicKey,
					c.json,
					{
						success: false,
						error: 'Invalid mnemonic'
					},
					{ status: 400 }
				)
			});
		}

		return {
			bip39: bip39,
			extractedData: extractedData
		};
	}
}
