---
title: Delete
toc: true
params:
    author: 'Jayson Fong'
---

## Payload

### Fields

{{% details title="mnemonic: String" closed="true" %}}

{{% /details %}}

### Content type

#### multipart/form-data

When sending payloads without using [PKI](../pki), the `Content-Type` header must be set
to `multipart/form-data`.

#### application/octet-stream

Use the `Content-Type` header `application/octet-stream` when sending data using [PKI](../pki). After including the
required [PKI](../pki) components, the following byte format must be used.

Include the mnemonic encoded as UTF-8.

```mermaid
---
title: "Sample PKI-Encrypted Delete Payload"
config:
    packet:
        bitsPerRow: 16
        bitWidth: 50
---
packet-beta
0-1: "Version"
2-3: "Key length"
4-15: "Public key (variable length)"
16-31: "Mnemonic (variable length)"
```

## Response

### Fields

{{% details title="success: Boolean" closed="true" %}}

{{% /details %}}

### Content type

#### application/json

```json
{
	"success": true
}
```

#### application/octet-stream

```mermaid
---
title: "Sample PKI-Encrypted Download Response"
config:
    packet:
        bitsPerRow: 8
        bitWidth: 100
---
packet-beta
0-1: "HTTP status"
2-2: "Header count"
3-7: "Headers (variable length)"
8-15: "JSON response (variable length)"
```
