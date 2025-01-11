import {
	SCHEMA_BODY_ONLY_MNEMONIC,
	SCHEMA_FIELD_SUCCESS,
	SCHEMA_HEADER_ONLY_CLOUDFLARE_ACCESS_EMAIL,
	SCHEMA_RESPONSE_GENERIC_400_MNEMONIC,
	SCHEMA_RESPONSE_GENERIC_401,
	SCHEMA_RESPONSE_PKI_JSON_SUCCESS
} from './_components';
import config from '../../config.json';
import { z } from 'zod';
import { Bool } from 'chanfana';

const FileExistsSchema = {
	tags: ['File'],
	summary: 'Check if a file exists',
	request: {
		body: SCHEMA_BODY_ONLY_MNEMONIC,
		...(config.requireAuth.delete
			? { headers: SCHEMA_HEADER_ONLY_CLOUDFLARE_ACCESS_EMAIL }
			: {})
	},
	responses: {
		'200': {
			description: 'File status successfully queried',
			content: {
				'application/json': {
					schema: z.object({
						success: SCHEMA_FIELD_SUCCESS(true),
						exists: Bool({
							description:
								'Whether the file exists at the time of querying',
							required: true,
							default: false,
							example: false
						})
					})
				},
				'application/octet-stream': SCHEMA_RESPONSE_PKI_JSON_SUCCESS
			}
		},
		'400': SCHEMA_RESPONSE_GENERIC_400_MNEMONIC,
		'401': SCHEMA_RESPONSE_GENERIC_401
	}
};

export default FileExistsSchema;
