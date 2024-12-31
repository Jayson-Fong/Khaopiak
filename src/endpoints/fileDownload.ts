import {Bool, OpenAPIRoute, Str} from "chanfana";
import {z} from "zod";
import {Context} from "hono";
import {validateMnemonic, mnemonicToEntropy} from "bip39";
import {bufferToHex, trimToCryptoKey} from "../util/buffer";
import {extractContentPrefix, isPDF} from "../util/format";


export class FileDownload extends OpenAPIRoute {
    schema = {
        tags: ["File"],
        summary: "Download a file",
        request: {
            query: z.object({
               noRender: Bool({
                   description: 'Disable rendering PDF files in-browser',
                   default: false,
                   example: true,
                   required: false
               })
            }),
            body: {
                content: {
                    "multipart/form-data": {
                        schema: z.object({
                            // The minimum mnemonic in *English* is 12 space-separated words of 3 characters
                            // The maximum mnemonic in *English* is 24 space-separated words of 8 characters
                            mnemonic: Str({
                                description: 'The BIP39 mnemonic used for file storage and server-side encryption',
                                example: 'vivid few stable brown wine update elevator angry document brain another success',
                                required: true
                            }).min(47).max(215)
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
                description: "File successfully retrieved",
                content: {
                    "application/octet-stream": {
                        schema: z.instanceof(File)
                    },
                    "application/pdf": {
                        schema: z.instanceof(File)
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
            "400": {
                description: "Bad request",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool({
                                description: 'Whether the download operation succeeded',
                                required: true,
                                default: false,
                                example: false
                            }),
                            error: Str({
                                default: 'Invalid mnemonic',
                                description: 'Bad request error',
                                example: 'Invalid mnemonic',
                                required: true
                            })
                        })
                    }
                }
            },
            "404": {
                description: "File not found",
                content: {
                    "application/json": {
                        schema: z.object({
                            success: Bool({
                                description: 'Whether the download operation succeeded',
                                required: true,
                                default: false,
                                example: false
                            }),
                            error: Str({
                                default: 'Failed to find file by mnemonic',
                                description: 'File not found error',
                                example: 'Failed to find file by mnemonic',
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
        console.log(await c.req.parseBody());
        const data = {
            ...await this.getValidatedData<typeof this.schema>(),
            body: this.schema.request.body.content['multipart/form-data'].schema.parse(await c.req.parseBody())
        };

        if (!validateMnemonic(data.body.mnemonic)) {
            return c.json({
                success: false,
                error: 'Invalid mnemonic'
            }, 400);
        }

        const entropy = mnemonicToEntropy(data.body.mnemonic);

        // TODO: Stop using Buffer
        const entropyBytes = Buffer.from(entropy, 'hex').buffer;

        // Generate the file hash for generation of the R2 file path
        const entropyShaDigest = bufferToHex(await crypto.subtle.digest({name: 'SHA-256'},
            entropyBytes));

        const cryptoKey = await crypto.subtle.importKey('raw',
            trimToCryptoKey(entropyBytes),
            {name: 'AES-GCM', length: 128}, true, ['decrypt']);

        // await (c.env.STORAGE as R2Bucket).put(entropyShaDigest, updatedFile);
        const object = await (c.env.STORAGE as R2Bucket).get(entropyShaDigest);

        // If the object does not exist...
        if (!object) {
            return c.json({
                success: false,
                error: 'Failed to find file by mnemonic'
            });
        }

        // The IV is the first 12 bytes of the buffer
        const cipherTextIVBuffer = await object.arrayBuffer();

        // Decrypt the file using AES-GCM given the first 12 bytes of the stored file is the IV
        const decryptedBuffer = new Uint8Array(await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: cipherTextIVBuffer.slice(0, 12) }, cryptoKey, cipherTextIVBuffer.slice(12)));

        // The plaintext is prefixed by the file name and type, which needs to be extracted and removed.
        const {name, type, contentStart} = extractContentPrefix(decryptedBuffer);

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        let contentDisposition = 'attachment';
        if (!data.query.noRender
            && type == 'application/pdf'
            && isPDF(decryptedBuffer.slice(contentStart, contentStart + 5))) {
            contentDisposition = 'inline';
        }

        // TODO: Set the filename properly per RFC 5987
        headers.set('Content-Disposition',
            `${contentDisposition}; filename=${name.replaceAll(/[^\w. ]/g, '')}`);
        headers.set('Content-Type', type ?? 'application/octet-stream');

        // We've got the file and got this far...now to destroy it
        await (c.env.STORAGE as R2Bucket).delete(entropyShaDigest);

        return new Response(decryptedBuffer.slice(contentStart), {headers});
    }
}
