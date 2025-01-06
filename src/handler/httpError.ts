import { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { generateResponse } from '../util/pki';
import { Environment } from '../types';
import { ClientError } from '../error/ClientError';
import { PKIError } from '../error/PKIError';

export const httpErrorHandler = (
	err: Error | HTTPException,
	c: Context<Environment>
): Response | Promise<Response> => {
	if (err instanceof PKIError) {
		return new Response(null);
	}

	if (err instanceof ClientError) {
		return generateResponse(
			c.get('extractedData')?.publicKey,
			c.json,
			err.getResponseObject(),
			err.getResponseInit()
		);
	}

	if (err instanceof HTTPException) {
		const httpResponse = err.getResponse();
		return generateResponse(
			c.get('extractedData')?.publicKey,
			c.json,
			httpResponse,
			{ status: err.status ?? err.getResponse() ?? 400 }
		);
	}

	return generateResponse(
		c.get('extractedData')?.publicKey,
		c.json,
		{ success: false, error: 'An unknown error occurred' },
		{ status: 500 }
	);
};
