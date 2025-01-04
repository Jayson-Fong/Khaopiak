export interface Bindings {
	STORAGE: R2Bucket;
	CLEANUP_QUEUE: Queue;
	ASSETS: Fetcher;

	PUBLIC_KEY_HEX: String;
	PRIVATE_KEY_HEX: String;
}

export type CleanupMessage = { key: string; expiry: number };
