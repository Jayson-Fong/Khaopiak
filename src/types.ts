export interface Bindings {
	STORAGE: R2Bucket;
	CLEANUP_QUEUE: Queue;
}

export type CleanupMessage = { key: string; expiry: number };
