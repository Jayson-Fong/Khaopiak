---
title: Upload
toc: true
params:
    author: 'Jayson Fong'
---

## Payload

### multipart/form-data

### application/octet-stream

Submitting payloads as `Content-Type: application/octet-stream` is preferred; however, all data sent must follow a
version-specific binary format. See [Public Key Infrastructure](../pki) for details.

After including PKI-required bytes, the server looks for 2 bytes indicating the amount of padding bytes the server
should append to the plaintext. The maximum is the greatest of `2048` and 0.5x the file's size.

The server then looks for 2 bytes indicating the number of entropy bits to use for generation of a BIP39 mnemonic. The
current minimum is 128, with a maximum of 256, and must be a multiple of 32.

The server then looks for 4 bytes indicating the number of seconds until the file should be deleted.

The remaining bytes are used for file content.
