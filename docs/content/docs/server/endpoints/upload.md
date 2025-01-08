---
title: Upload
toc: true
params:
  author: 'Jayson Fong'
---

## Fields

### padding: Number

A non-negative integer representing the number of padding bytes to append at the end of the plaintext prior to
encrypting. End-users may specify padding to help prevent association between upload and download clients through file
transfer sizes.

The amount of padding bytes is limited to the greater of 2048 bytes and 0.5 times the amount of the uploaded file's byte
length.

### entropy: Number

A non-negative integer representing the number of entropy bits the server should generate, used to generate a BIP39
mnemonic, encrypt the uploaded file with associated data, and generate a hash to act as the file's object key. By
default, the server selects to use 128 bits for entropy.

Per BIP39, the number of entropy bits must be between 128 and 256 bits and be a multiple of 32. A greater amount of
entropy bits results in a greater amount of mnemonic words, as listed below:

| Entropy | Checksum | Entropy + checksum | Mnemonic sentence words |
|---------|----------|--------------------|-------------------------|
| 128     | 4        | 132                | 12                      |
| 160     | 5        | 165                | 15                      |
| 192     | 6        | 198                | 18                      |
| 224     | 7        | 231                | 21                      |
| 256     | 8        | 264                | 24                      |

The server uses the Advanced Encryption Standard (AES)
in [Galois/Counter Mode (GCM)](https://csrc.nist.gov/pubs/sp/800/38/d/final). As AES can use 128, 192, or 256 bits, the
server will pad the bits in a deterministic means when the end-user specifies 160 or 224 bits in order to generate a 192
or 256-bit key, respectively, while preserving entropy.

### expiry: Number

A non-negative integer representing the number of seconds from upload until the server should reject downloading a file
and delete it. The expiry is stored unencrypted as a prefix to the ciphertext
within [Cloudflare R2](https://www.cloudflare.com/developer-platform/products/r2/).

### file: File

The file to upload. The file's name and content type are used to prefix the plaintext in the generation of the
ciphertext.

## Payload content type

### multipart/form-data

When sending payloads without using [Public Key Infrastructure (PKI)](../pki), the `Content-Type` header must be set
to `multipart/form-data`.

### application/octet-stream

Use the `Content-Type` header `application/octet-stream` when sending data using [PKI](../pki). After including the
required [PKI](../pki) components, the following byte format must be used.

The first two bytes must indicate the number of padding bytes the server should append to the plaintext, meeting the
same qualifications as the [padding](#padding-number) field, followed by 2 bytes indicating the number
of [entropy](#entropy-number) bits.

The server then looks for 4 bytes indicating the number of seconds until the file should be deleted, equivilent to
the [expiry](#expiry-number) field.

The remaining bytes are used for file content.
