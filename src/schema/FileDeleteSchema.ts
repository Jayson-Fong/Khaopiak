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

const FileDeleteSchema = {
	tags: ['File'],
	summary: 'Delete a file',
	request: {
		body: SCHEMA_BODY_ONLY_MNEMONIC,
		...(config.requireAuth.delete
			? { headers: SCHEMA_HEADER_ONLY_CLOUDFLARE_ACCESS_EMAIL }
			: {})
	},
	responses: {
		'200': {
			description: 'File delete request successfully executed',
			content: {
				'application/json': {
					schema: z.object({
						success: SCHEMA_FIELD_SUCCESS(true)
					})
				},
				'application/octet-stream': SCHEMA_RESPONSE_PKI_JSON_SUCCESS
			}
		},
		'401': SCHEMA_RESPONSE_GENERIC_401,
		'400': SCHEMA_RESPONSE_GENERIC_400_MNEMONIC
	}
};

export default FileDeleteSchema;
