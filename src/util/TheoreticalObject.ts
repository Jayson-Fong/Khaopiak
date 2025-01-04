export class TheoreticalObject {
	objectKey: string;

	constructor(objectKey: string) {
		this.objectKey = objectKey;
	}

	delete(bucket: R2Bucket) {
		return bucket.delete(this.objectKey);
	}

	get(bucket: R2Bucket) {
		return bucket.get(this.objectKey);
	}
}
