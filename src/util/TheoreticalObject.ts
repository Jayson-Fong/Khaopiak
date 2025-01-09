import {
	Blob,
	Headers,
	R2Conditional,
	R2PutOptions,
	ReadableStream
} from '@cloudflare/workers-types/2023-07-01/index';

class TheoreticalObject {
	objectKey: string;

	constructor(objectKey: string) {
		this.objectKey = objectKey;
	}

	getObjectKey(): string {
		return this.objectKey;
	}

	delete(bucket: R2Bucket): Promise<void> {
		return bucket.delete(this.objectKey);
	}

	get(bucket: R2Bucket): Promise<R2ObjectBody | null> {
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
	): Promise<R2Object | null> {
		return bucket.put(this.objectKey, value, options);
	}
}

export default TheoreticalObject;
