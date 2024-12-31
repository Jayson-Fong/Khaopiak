import {Bool, OpenAPIRoute, Str} from "chanfana";
import {z} from "zod";
import {Context} from "hono";
import {generateMnemonic, mnemonicToEntropy} from "bip39";
import {trimToCryptoKey} from "../util/buffer";


export class FileUpload extends OpenAPIRoute {
    schema = {
        tags: ["File"],
        summary: "Upload a file",
        request: {
            body: {
                content: {
                    "multipart/form-data": {
                        schema: z.object({
                            file: z.any(),
                            filePath: Str(),
                            entropy: z.coerce.number({
                                description: 'Bits of entropy for file identification. The highest level of entropy possible will be used for AES-GCM encryption.'
                            }).gte(128).lte(256)._addCheck({
                                kind: 'multipleOf',
                                value: 32
                            })
                        })
                    }
                }
            },
            // TODO: Make requiring this configurable
            // headers: z.object({
            //     'cf-access-authenticated-user-email': z.string({
            //         description: 'Cloudflare Access authenticated user email'
            //     }).email()
            // })
        },
        responses: {
            "200": {
                description: "Monitor successfully checked in",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool({
                                description: 'Whether the upload operation succeeded',
                                required: true,
                                default: true,
                                example: true
                            })
                        })
                    }
                }
            },
            "401": {
                description: "Missing or bad authentication",
                content: {
                    'application/json': {
                        schema: z.object({
                            success: Bool({
                                description: 'Whether the upload operation succeeded',
                                required: true,
                                default: false,
                                example: false
                            }),
                            error: Str({
                                default: 'Missing or bad authentication',
                                description: 'Authentication error',
                                example: 'Missing or bad authentication',
                                required: true
                            })
                        })
                    }
                }
            },
            "404": {
                description: "Tenant or upload directory not found",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool({
                                description: 'Whether the upload operation succeeded',
                                required: true,
                                default: false,
                                example: false
                            }),
                            error: Str({
                                default: 'Tenant not found',
                                description: 'Tenant or upload directory not found error',
                                example: 'Tenant not found',
                                required: true
                            })
                        })
                    }
                }
            }
        }
    };

    async handle(c: Context) {
        // Get the validated, typed data from the context.
        // TODO: Chanfana has a bug causing it not to parse the body with `this.getValidatedData`. Eventually, simplify.
        // Really this only depends on the body anyways, but nonetheless...
        const data = {
            ...await this.getValidatedData<typeof this.schema>(),
            body: this.schema.request.body.content['multipart/form-data'].schema.parse(await c.req.parseBody())
        };

        // We'll use a mnemonic to identify the file and act as an encryption key, shared with the client.
        // The client has their own mnemonic for client-side encryption. When requesting files, the client
        // will only send the Workers-generated mnemonic.
        const mnemonic = generateMnemonic(data.body.entropy);
        const entropy = mnemonicToEntropy(mnemonic);

        // TODO: Stop using Buffer
        const entropyBytes = Buffer.from(entropy, 'hex').buffer;

        // Generate the file hash for generation of the R2 file path
        // TODO: Stop using Buffer
        const entropyShaDigest = Buffer.from(await crypto.subtle.digest({name: 'SHA-256'},
            entropyBytes)).toString('hex');

        // Encrypt file using AES-GCM. All entropy bits are used and the checksum bits are sliced off.
        // The checksum bits are only used to identify the file.
        const cryptoKey = await crypto.subtle.importKey('raw',
            trimToCryptoKey(entropyBytes),
            {name: 'AES-GCM', length: 128}, true, ['encrypt']);
        // The IV will be stored later as a prefix to the ciphertext
        const iv = crypto.getRandomValues(new Uint8Array(0xC));

        // Since a File is a Blob...blob up the IV.
        const file = data.body.file as File;

        // TODO: Inject a sanitized file name as part of the plaintext
        // TODO: Stop using Buffer
        const cipherText = await crypto.subtle.encrypt(
            {name: 'AES-GCM', iv: iv}, cryptoKey, await file.arrayBuffer());

        // Adding in 12 bytes to account for the IV
        const ivInjectedFileBuffer = new Uint8Array(cipherText.byteLength + 0xC);
        ivInjectedFileBuffer.set(iv, 0);
        ivInjectedFileBuffer.set(new Uint8Array(cipherText), 12);

        const updatedFile = new File([ivInjectedFileBuffer.buffer.slice(0)], file.name, {
            lastModified: file.lastModified
        });

        // TODO: Use Queues to auto clean!
        await (c.env.STORAGE as R2Bucket).put(entropyShaDigest, updatedFile);

        return c.json({'mnemonic': mnemonic});
    }
}
