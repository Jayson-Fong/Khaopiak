---
title: Public Key Infrastructure
toc: true
params:
    author: 'Jayson Fong'
---

Khaopiak assumes that all payloads with the content type `application/octet-stream` is encrypted using Public Key
Infrastructure (PKI). Endpoints require a particular byte format to properly interpret requests.

All requests, regardless of Khaopiak server version, must begin with a two-byte version specifier. The current version
is `1`. A version specifier of two null bytes is considered an invalid payload and will be rejected by the server.
Because the server assumes the client is requesting an encrypted response when submitting as `application/octet-stream`,
the server will respond with an empty response when it is unable to encrypt the response, with exceptions varying by
server version.

## Version 1

If the server receives a public key length of `0`, it assumes the client does not want an encrypted response and will
return a `application/json` response unless the client sends an `Accept` header including `application/octet-stream` and
not including `application/json`. The public key must be for RSA-OAEP and
in [SubjectPublicKeyInfo](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto/importKey#subjectpublickeyinfo)
format.
