import { OpenAPIRoute, OpenAPIRouteSchema } from 'chanfana';
import {
	extractData,
	ExtractionData,
	generateResponse,
	importServerPrivateKey
} from './pki';
import { Context } from 'hono';
import MnemonicExtractor from '../extractor/MnemonicExtractor';
import BIP39 from './BIP39';
import { ClientError } from '../error/ClientError';
import { Environment, ResponseInitStrictHeader } from '../types';

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
		c: Context<Environment>,
		extractor: (input: Uint8Array) => Promise<T>
	): Promise<ExtractionData<T>> {
		const data = await extractData<T>(
			c.req.header('Content-Type'),
			c.req.raw.body,
			extractor,
			async () => {
				return this.schema.request.body.content[
					'multipart/form-data'
				].schema.parse(await c.req.parseBody());
			},
			() => importServerPrivateKey(c.env.PRIVATE_KEY_HEX)
		);

		c.set('extractedData', data);
		return data;
	}

	async extractMnemonicOrError(c: Context) {
		let extractedData = await this.extractData<{ mnemonic: string }>(
			c,
			MnemonicExtractor
		);

		c.set('extracted', extractedData);
		const { mnemonic } = await extractedData.data;
		const bip39 = new BIP39(mnemonic);

		if (!bip39.isValid()) {
			throw new ClientError(
				{
					success: false,
					error: 'Invalid mnemonic'
				},
				{ status: 400 }
			);
		}

		return {
			bip39: bip39,
			extractedData: extractedData
		};
	}

	async secureRespond(
		c: Context<Environment>,
		payload?: object | Uint8Array | null,
		responseInit?: ResponseInitStrictHeader
	): Promise<Response> {
		return generateResponse(
			c.get('extractedData')?.publicKey,
			c.json,
			payload,
			responseInit
		);
	}
}
