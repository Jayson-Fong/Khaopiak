import { Bool, Str } from 'chanfana';
import { z } from 'zod';

export const GENERIC_NULL_RESPONSE_SCHEMA = {
	schema: Str({
		description:
			'Returned when an encrypted mnemonic is sent to the server. The equivalent of the application/json response is stored as a payload when encrypted. If encrypting the response is not possible, a null response is returned'
	})
};

export const GENERIC_400 = {
	description: 'Bad request',
	content: {
		'application/json': {
			schema: z.object({
				success: Bool({
					description: 'Whether the operation succeeded',
					required: true,
					default: false,
					example: false
				}),
				error: Str({
					default: 'Invalid mnemonic',
					description: 'Bad request error',
					example: 'Invalid mnemonic',
					required: true
				})
			})
		},
		'application/octet-stream': GENERIC_NULL_RESPONSE_SCHEMA
	}
};

export const GENERIC_401 = {
	description: 'Missing or bad authentication',
	content: {
		'application/json': {
			schema: z.object({
				success: Bool({
					description: 'Whether the operation succeeded',
					required: true,
					default: false,
					example: false
				}),
				error: Str({
					default: 'Missing or bad authentication',
					description: 'Authentication error',
					example: 'Missing or bad authentication',
					required: true
				})
			})
		},
		'application/octet-stream': GENERIC_NULL_RESPONSE_SCHEMA
	}
};

export const GENERIC_HEADER_CLOUDFLARE_ACCESS = z.object({
	'cf-access-authenticated-user-email': z
		.string({
			description: 'Cloudflare Access authenticated user email'
		})
		.email()
});

export const MNEMONIC_STRING = Str({
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
