import { fromHono } from "chanfana";
import { Hono } from "hono";
import {FileUpload} from "./endpoints/fileUpload";
import { Buffer } from "node:buffer";
import {FileDownload} from "./endpoints/fileDownload";
import {Content} from "./pages";

globalThis.Buffer = Buffer;

// Start a Hono app
const app = new Hono();

app.get('/', (c) => {
	return c.html(Content());
})

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/api",
	raiseUnknownParameters: true
});

// TODO: Delete Endpoint
// TODO: HEAD Endpoint
openapi.post("/api/file/upload", FileUpload);
openapi.post("/api/file/download", FileDownload);

// Export the Hono app
export default app;
