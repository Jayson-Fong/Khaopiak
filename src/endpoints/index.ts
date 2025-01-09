import { Context } from 'hono';
import { Environment } from '../types';

/**
 * Displays the Khaopiak portal page to regular users,
 * and returns the Khaopiak shell script for curl/wget.
 * @param c Hono context
 */
export const PortalIndex = (c: Context<Environment>): Promise<Response> => {
	const userAgent = (c.req.header('User-Agent') ?? '')
		.split('/')[0]
		.toLowerCase();
	if (['curl', 'wget'].find((u) => u === userAgent)) {
		return c.env.ASSETS.fetch(new Request(new URL('sh', c.req.url)));
	}

	return c.env.ASSETS.fetch(new Request(new URL('portal', c.req.url)));
};
