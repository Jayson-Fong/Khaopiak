import { ResponseInitStrictHeader } from '../types';

export class ClientError extends Error {
	responseObject: Object;
	responseInit?: ResponseInitStrictHeader;

	constructor(
		responseObject: Object | { success: boolean } = { success: false },
		responseInit?: ResponseInitStrictHeader | number
	) {
		super();

		this.responseObject = responseObject;
		this.responseInit = responseInit
			? typeof responseInit === 'number'
				? { status: responseInit }
				: responseInit
			: { status: 400 };
	}

	getResponseObject(): Object {
		return this.responseObject;
	}

	getResponseInit(): ResponseInitStrictHeader | undefined {
		return this.responseInit;
	}
}
