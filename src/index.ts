import { fromHono } from 'chanfana';
import { Hono } from 'hono';
import { FileUpload } from './endpoints/api/fileUpload';
import { Buffer } from 'node:buffer';
import { FileDownload } from './endpoints/api/fileDownload';
import { FileExists } from './endpoints/api/fileExists';
import { FileDelete } from './endpoints/api/fileDelete';
import { queue } from './handler/cleanupQueue';
import { Bindings } from './types';
import { PortalIndex } from './endpoints';
import { Test } from './endpoints/api/fileTest';

globalThis.Buffer = Buffer;

// Start a Hono app
const app = new Hono<{ Bindings: Bindings }>();

app.get('/', PortalIndex);

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
