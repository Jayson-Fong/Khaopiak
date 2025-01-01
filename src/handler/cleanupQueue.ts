const MAX_QUEUE_RETRY_DELAY = 60 * 60 * 12;
const MAX_QUEUE_RETRIES = 100;

export interface Env {
	STORAGE: R2Bucket;
}

type CleanupMessage = { key: string; expiry: number };

export const queue = async (
	batch: MessageBatch<CleanupMessage>,
	env: Env
): Promise<void> => {
	for (const msg of batch.messages) {
		const { key, expiry } = msg.body;

		if (expiry > Date.now() || msg.attempts >= MAX_QUEUE_RETRIES) {
			msg.retry({
				delaySeconds: Math.min(
					Date.now() - expiry,
					MAX_QUEUE_RETRY_DELAY
				)
			});
		}

		await env.STORAGE.delete(key);
		msg.ack();
	}
};
