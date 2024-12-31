import { fromHono } from "chanfana";
import { Hono } from "hono";
import {FileUpload} from "./endpoints/fileUpload";
import { Buffer } from "node:buffer";

globalThis.Buffer = Buffer;

// Start a Hono app
const app = new Hono();

// Setup OpenAPI registry
const openapi = fromHono(app, {
	docs_url: "/api",
	raiseUnknownParameters: true
});

// TODO: Download Endpoint
// TODO: Delete Endpoint
// TODO: HEAD Endpoint
openapi.post("/api/file/upload", FileUpload);

// Export the Hono app
export default app;
