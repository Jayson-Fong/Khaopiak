import { ExtractionData } from './util/pki';

export interface Bindings {
	STORAGE: R2Bucket;
	CLEANUP_QUEUE: Queue;
	ASSETS: Fetcher;

	PUBLIC_KEY_HEX: string;
	PRIVATE_KEY_HEX: string;
	OBJECT_KEY_SECRET: string;
}

export interface Variables {
	extractedData?: ExtractionData;
}

export interface Environment {
	Bindings: Bindings;
	Variables: Variables;
}

export type CleanupMessage = { key: string; expiry: number };

export type ResponseInitStrictHeader = ResponseInit & { headers?: Headers };
