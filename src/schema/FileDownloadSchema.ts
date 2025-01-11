import { z } from 'zod';
import { Bool, Str } from 'chanfana';
import {
	SCHEMA_BODY_ONLY_MNEMONIC,
	SCHEMA_HEADER_ONLY_CLOUDFLARE_ACCESS_EMAIL,
	SCHEMA_RESPONSE_GENERIC_400_MNEMONIC,
	SCHEMA_RESPONSE_GENERIC_401,
	SCHEMA_RESPONSE_GENERIC_404
} from './_components';
import config from '../../config.json';

const FileDownloadSchema = {
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
		body: SCHEMA_BODY_ONLY_MNEMONIC,
		...(config.requireAuth.delete
			? { headers: SCHEMA_HEADER_ONLY_CLOUDFLARE_ACCESS_EMAIL }
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
		'401': SCHEMA_RESPONSE_GENERIC_401,
		'400': SCHEMA_RESPONSE_GENERIC_400_MNEMONIC,
		'404': SCHEMA_RESPONSE_GENERIC_404
	}
};

export default FileDownloadSchema;
