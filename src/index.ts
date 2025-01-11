import { fromHono } from 'chanfana';
import { Hono } from 'hono';
import { FileUpload } from './endpoints/api/file/fileUpload';
import { FileDownload } from './endpoints/api/file/fileDownload';
import { FileExists } from './endpoints/api/file/fileExists';
import { FileDelete } from './endpoints/api/file/fileDelete';
import { queue } from './handler/cleanupQueue';
import { Environment } from './types';
import { PortalIndex } from './endpoints';
import { httpErrorHandler } from './handler/httpError';

// Start a Hono app
const app = new Hono<Environment>();

app.get('/', PortalIndex);
app.onError(httpErrorHandler);

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: '/api',
	raiseUnknownParameters: true
});

openapi.post('/api/file/upload', FileUpload);
openapi.post('/api/file/download', FileDownload);
openapi.post('/api/file/exists', FileExists);
openapi.post('/api/file/delete', FileDelete);

// Export the Hono app
export default { ...app, queue };
