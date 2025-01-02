export interface Bindings {
	STORAGE: R2Bucket;
	CLEANUP_QUEUE: Queue;
	ASSETS: Fetcher;
}

export type CleanupMessage = { key: string; expiry: number };
