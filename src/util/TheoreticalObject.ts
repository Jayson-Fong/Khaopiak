import {
	Blob,
	Headers,
	R2Conditional,
	R2PutOptions,
	ReadableStream
} from '@cloudflare/workers-types/2023-07-01/index';

export class TheoreticalObject {
	objectKey: string;

	constructor(objectKey: string) {
		this.objectKey = objectKey;
	}

	getObjectKey() {
		return this.objectKey;
	}

	delete(bucket: R2Bucket) {
		return bucket.delete(this.objectKey);
	}

	get(bucket: R2Bucket) {
		return bucket.get(this.objectKey);
	}

	put(
		bucket: R2Bucket,
		value:
			| ReadableStream
			| ArrayBuffer
			| ArrayBufferView
			| string
			| null
			| Blob,
		options?: R2PutOptions & {
			onlyIf: R2Conditional | Headers;
		}
	) {
		return bucket.put(this.objectKey, value, options);
	}
}
