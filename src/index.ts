import { fromHono } from "chanfana";
import { Hono } from "hono";
import {FileUpload} from "./endpoints/fileUpload";
import { Buffer } from "node:buffer";
import {FileDownload} from "./endpoints/fileDownload";
import {Content} from "./pages";
import {FileExists} from "./endpoints/fileExists";
import {FileDelete} from "./endpoints/fileDelete";

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

openapi.post("/api/file/upload", FileUpload);
openapi.post("/api/file/download", FileDownload);
openapi.post("/api/file/exists", FileExists);
openapi.post("/api/file/delete", FileDelete);

// Export the Hono app
export default app;
