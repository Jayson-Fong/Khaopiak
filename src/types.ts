export interface Bindings {
	STORAGE: R2Bucket;
	CLEANUP_QUEUE: Queue;
	ASSETS: Fetcher;

	PUBLIC_KEY_HEX: string;
	PRIVATE_KEY_HEX: string;
}

export type CleanupMessage = { key: string; expiry: number };
