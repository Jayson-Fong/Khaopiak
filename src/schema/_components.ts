import { z } from 'zod';
import { Bool, Str } from 'chanfana';
import config from '../../config.json';

export const SCHEMA_FIELD_MNEMONIC = Str({
	description:
		'The BIP39 mnemonic used for file storage and server-side encryption',
	example:
		'vivid few stable brown wine update elevator angry document brain another success',
	required: true
})
	// The minimum mnemonic in *English* is 12 space-separated words of 3 characters
	// The maximum mnemonic in *English* is 24 space-separated words of 8 characters
	.min(47)
	.max(215);

export const SCHEMA_FIELD_EXPIRY = z.coerce
	.number({
		description:
			'The number of seconds the file should be downloadable before the file is made unavailable or deleted.'
	})
	.min(config.upload.expiry.allowInfinite ? -1 : config.upload.expiry.min)
	// The max queue retry delay is 12 hours, with a max 100 retries
	// as a result, the absolute maximum expiry is 1200 hours.
	.max(config.upload.expiry.max)
	.int()
	// The max queue retry delay is 12 hours, so let's avoid
	// using an operation if the user doesn't need to.
	.default(config.upload.expiry.default);

export const SCHEMA_FIELD_PADDING = z.coerce.number().nonnegative();

export const SCHEMA_FIELD_FILE = z
	.instanceof(File)
	.describe('An uploaded file')
	.refine((x) => x.size);

export const SCHEMA_FIELD_ENTROPY = z.coerce
	.number({
		description:
			'Bits of entropy for file identification. The highest level of entropy possible will be used for AES-GCM encryption.'
	})
	.gte(128)
	.lte(256)
	.multipleOf(32);

export const SCHEMA_FIELD_SUCCESS = (exampleValue: boolean) => {
	return Bool({
		description: 'Whether the operation was executed successfully',
		required: true,
		default: exampleValue,
		example: exampleValue
	});
};

export const SCHEMA_FIELD_ROOT_PKI = z.any({
	description: 'PKI-encrypted payload'
});

export const SCHEMA_BODY_ONLY_MNEMONIC = {
	content: {
		'multipart/form-data': {
			schema: z.object({
				mnemonic: SCHEMA_FIELD_MNEMONIC
			})
		},
		'application/octet-stream': {
			schema: SCHEMA_FIELD_ROOT_PKI
		}
	}
};

export const SCHEMA_HEADER_ONLY_CLOUDFLARE_ACCESS_EMAIL = z.object({
	'cf-access-authenticated-user-email': z
		.string({
			description: 'Cloudflare Access authenticated user email'
		})
		.email()
});

export const SCHEMA_RESPONSE_PKI_JSON_SUCCESS = {
	schema: Str({
		description:
			'Returned when an encrypted mnemonic is sent to the server. The JSON response is encrypted using the provided public key and is identical to its application/json counterpart in structure.',
		required: true
	})
};

export const SCHEMA_RESPONSE_PKI_JSON_FAILURE = {
	schema: Str({
		description:
			'Returned when an encrypted mnemonic is sent to the server. The JSON response is encrypted using the provided public key and is identical to its application/json counterpart in structure. If an encrypted response is not possible, a null response is returned.',
		required: true
	})
};

export const SCHEMA_RESPONSE_200_FILE_UPLOAD_SUCCESS = {
	description: 'File successfully uploaded',
	content: {
		'application/json': {
			schema: z.object({
				success: SCHEMA_FIELD_SUCCESS(true),
				mnemonic: SCHEMA_FIELD_MNEMONIC
			})
		}
	}
};

export const SCHEMA_RESPONSE_GENERIC_400_MNEMONIC = {
	description: 'Bad request',
	content: {
		'application/json': {
			schema: z.object({
				success: SCHEMA_FIELD_SUCCESS(false),
				error: Str({
					default: 'Invalid mnemonic',
					description: 'Bad request error',
					example: 'Invalid mnemonic',
					required: true
				})
			})
		},
		'application/octet-stream': SCHEMA_RESPONSE_PKI_JSON_FAILURE
	}
};

export const SCHEMA_RESPONSE_GENERIC_400 = {
	description: 'Bad request',
	content: {
		'application/json': {
			schema: z.object({
				success: SCHEMA_FIELD_SUCCESS(false),
				error: Str({
					default: 'Bad request',
					description:
						'Provided when there is an error encrypting with the provided public key',
					required: true
				})
			})
		},
		'application/octet-stream': SCHEMA_RESPONSE_PKI_JSON_FAILURE
	}
};

export const SCHEMA_RESPONSE_GENERIC_401 = {
	description: 'Missing or bad authentication',
	content: {
		'application/json': {
			schema: z.object({
				success: SCHEMA_FIELD_SUCCESS(false),
				error: Str({
					default: 'Missing or bad authentication',
					description: 'Authentication error',
					example: 'Missing or bad authentication',
					required: true
				})
			})
		},
		'application/octet-stream': SCHEMA_RESPONSE_PKI_JSON_FAILURE
	}
};

export const SCHEMA_RESPONSE_GENERIC_404 = {
	description: 'File not found',
	content: {
		'application/json': {
			schema: z.object({
				success: SCHEMA_FIELD_SUCCESS(false),
				error: Str({
					default: 'Failed to find file by mnemonic',
					description: 'File not found error',
					example: 'Failed to find file by mnemonic',
					required: true
				})
			})
		}
	}
};
