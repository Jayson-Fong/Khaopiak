import { z } from 'zod';
import {
	SCHEMA_FIELD_ENTROPY,
	SCHEMA_FIELD_EXPIRY,
	SCHEMA_FIELD_FILE,
	SCHEMA_FIELD_PADDING,
	SCHEMA_FIELD_ROOT_PKI,
	SCHEMA_HEADER_ONLY_CLOUDFLARE_ACCESS_EMAIL,
	SCHEMA_RESPONSE_200_FILE_UPLOAD_SUCCESS,
	SCHEMA_RESPONSE_GENERIC_400,
	SCHEMA_RESPONSE_GENERIC_401
} from './_components';
import config from '../../config.json';

const FileUploadSchema = {
	tags: ['File'],
	summary: 'Upload a file',
	request: {
		body: {
			content: {
				'multipart/form-data': {
					schema: z.object({
						file: SCHEMA_FIELD_FILE,
						entropy: SCHEMA_FIELD_ENTROPY,
						expiry: SCHEMA_FIELD_EXPIRY,
						padding: SCHEMA_FIELD_PADDING
					})
				},
				'application/octet-stream': {
					schema: SCHEMA_FIELD_ROOT_PKI
				}
			}
		},
		...(config.requireAuth.delete
			? { headers: SCHEMA_HEADER_ONLY_CLOUDFLARE_ACCESS_EMAIL }
			: {})
	},
	responses: {
		'200': SCHEMA_RESPONSE_200_FILE_UPLOAD_SUCCESS,
		'400': SCHEMA_RESPONSE_GENERIC_400,
		'401': SCHEMA_RESPONSE_GENERIC_401
	}
};

export default FileUploadSchema;
