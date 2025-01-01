import {Bindings, CleanupMessage} from "../types";
import config from "../../config.json";


export const queue = async (
	batch: MessageBatch<CleanupMessage>,
	env: Bindings
): Promise<void> => {
	for (const msg of batch.messages) {
		const { key, expiry } = msg.body;

		if (expiry > Date.now() || msg.attempts >= config.queue.maxRetries) {
			msg.retry({
				delaySeconds: Math.min(
					Date.now() - expiry,
					config.queue.maxRetryDelay
				)
			});
		}

		await env.STORAGE.delete(key);
		msg.ack();
	}
};
