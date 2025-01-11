import { fromHono } from 'chanfana';
import { Hono } from 'hono';
import { FileUpload } from './endpoints/api/file/FileUpload';
import { FileDownload } from './endpoints/api/file/FileDownload';
import { FileExists } from './endpoints/api/file/FileExists';
import { FileDelete } from './endpoints/api/file/FileDelete';
import { Environment } from './types';
import { PortalIndex } from './endpoints';
import { HttpErrorHandler } from './handler/HttpErrorHandler';
import queue from './handler/CleanupQueueHandler';

// Start a Hono app
const app = new Hono<Environment>();

app.get('/', PortalIndex);
app.onError(HttpErrorHandler);

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
