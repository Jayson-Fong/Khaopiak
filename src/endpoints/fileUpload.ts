import {Bool, OpenAPIRoute, Str} from "chanfana";
import {z} from "zod";
import {Context} from "hono";
import {generateMnemonic, mnemonicToEntropy} from "bip39";
import {bufferConcat, trimToCryptoKey} from "../util/buffer";
import {digestToKey, fileToContentPrefix} from "../util/format";


export class FileUpload extends OpenAPIRoute {
    schema = {
        tags: ["File"],
        summary: "Upload a file",
        request: {
            body: {
                content: {
                    "multipart/form-data": {
                        schema: z.object({
                            file: z.instanceof(File)
                                .describe('An uploaded file')
                                .refine(x => x.size),
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
                description: "File successfully uploaded",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool({
                                description: 'Whether the upload operation succeeded',
                                required: true,
                                default: true,
                                example: true
                            }),
                            mnemonic: Str({
                                description: 'BIP39 mnemonic used for file retrieval and server-side decryption',
                                required: true,
                                example: 'pass frog invite more question expose nose start swarm quality unhappy steak'
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
        const objectKey = digestToKey(await crypto.subtle.digest({name: 'SHA-256'},
            entropyBytes));

        // For AES-GCM encryption, use the entropy bits as a key.
        const cryptoKey = await crypto.subtle.importKey('raw',
            trimToCryptoKey(entropyBytes),
            {name: 'AES-GCM', length: 128}, true, ['encrypt']);

        // The IV will be stored later as a prefix to the ciphertext
        const iv = crypto.getRandomValues(new Uint8Array(0xC));

        // Encrypt the file content prefixed with a null-separated name and type using AES-GCM
        const cipherText = await crypto.subtle.encrypt(
            {name: 'AES-GCM', iv: iv}, cryptoKey, bufferConcat([
                fileToContentPrefix(data.body.file), await data.body.file.arrayBuffer()]));

        // Adding in 12 bytes to account for the IV
        const ivInjectedFileBuffer = bufferConcat([iv, cipherText]);

        // TODO: Use Queues to auto clean!
        await (c.env.STORAGE as R2Bucket).put(objectKey, ivInjectedFileBuffer);

        return c.json({success: true, mnemonic: mnemonic});
    }
}
