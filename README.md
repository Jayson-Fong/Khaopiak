<div align="center">
    <h1>🍜 Khaopiak</h1>
</div>

An account-less and end-to-end encrypted storage system leveraging Cloudflare Workers with OpenAPI 3.1
using [chanfana](https://github.com/cloudflare/chanfana) and [Hono](https://github.com/honojs/hono).

<hr />

**Source Code**: <a href="https://github.com/Jayson-Fong/khaopiak/">github.com/Jayson-Fong/khaopiak</a>

<hr />

## Purpose

Khaopiak is a temporary, intermediary file storage system for transferring between two devices. It was designed
primarily with printing at hotel business centers in mind, but can cover a range of use cases from file transfers,
viewership verification, and sharing secrets.

<details style="border: 1px solid; border-radius: 8px; padding: 8px; margin-top: 4px;">
<summary>🖨️ Use Case: Printing at hotel business centers</summary>

Hotel business centers often restrict printing to dedicated, shared desktops, resulting in two main options for printing
from a personal device:

<ul>
   <li>Connect personal hardware (ex. USB thumb drives) to shared equipment</li>
   <li>Upload files to a web-based intermediary for download</li>
</ul>

<h3>Personal hardware</h3>

Connecting personal hardware may not always be an option, whether due to port restrictions (such as the lack of a
physical port or software restriction) or the lack of a physical medium (i.e. cabling or drives). Shared devices may
also harbor malware, stealing both files and potentially infecting the connected device.

<h3>Web-based portals</h3>

Logging into web-based portals such as Google Drive, Box, SharePoint, Proton Drive, and Dropbox requires inputting
personal login credentials and grants excessive access to files alongside additional services, such as email. When
passwords are shared, stolen credentials may lead to further compromise, such as enabling logon to financial accounts.

While these web-based services often provide shareable links, they are often too long or complicated to type, such as
this Google Drive share link:
<pre>https://docs.google.com/document/d/t9trB8lKoaB_kIRk6FeFltqm1TGdsCpKolHGwcpVKXPE</pre>

To mitigate this issue, a link shortener can be used; however, it increases the probability of randomly stumbling upon
the document, involves an additional party, and may be predictable.

Shareable links often do not expire, allowing a threat actor to regain access after the initial download, such as
through browser history.

<h3>How Khaopiak helps</h3>

Khaopiak alleviates these issues through enabling the seamless end-to-end encryption of documents accessed through
easily-typed, one-time-use BIP39 mnemonics, such as:
<pre>orchard home picture movie only what believe onion physical defy hole among climb brand million edge anchor upgrade sand awake loop layer panther soda</pre>

This means that end-users need not reference a random character-by-character string, but known words they can quickly
type. As all words can be identified using their first three letters, Khaopiak can automatically correct typos.

During this process, hardware manipulation is not required, users do not need to enter logon credentials besides a
unique, expiring mnemonic, and mnemonics cannot be reused to download the same upload.

</details>

## Features

### For end-users

<details style="border: 1px solid; border-radius: 8px; padding: 8px; margin-top: 4px;">
<summary>🔒 End-to-end encryption</summary>

A portion of the mnemonic is never transmitted over the internet and is used to encrypt the file before uploading,
allowing end-to-end encryption. As a result, confidentiality of the original file is protected as it is never made
available to intermediaries.

For all purposes of encryption, Khaopiak uses the Advanced Encryption Standard (AES), with all clients
supporting <a href="https://csrc.nist.gov/pubs/sp/800/38/a/final" target="_blank">Cipher Block Chaining (CBC)</a> and
preferring/recommending <a href="https://csrc.nist.gov/pubs/sp/800/38/d/final" target="_blank">Galois/Counter Mode (
GCM)</a> when possible.

</details>

<details style="border: 1px solid; border-radius: 8px; padding: 8px; margin-top: 4px;">
<summary>⌛ Expiring files</summary>

By default, all files uploaded to Khaopiak eventually expire. If an attempt is made to an expired file which has not
been deleted from the Khaopiak server, it will be immediately deleted and a response will be returned as if the file did
not exist*.

*It is possible for a client to assume that a file existed based on the additional processing time required to check
whether the file expired.

</details>

### For administrators

<details style="border: 1px solid; border-radius: 8px; padding: 8px; margin-top: 4px;">
<summary>🔑 Restrict access with Cloudflare Access</summary>

Cloudflare Zero Trust customers can optionally require authentication through Cloudflare Access as a self-hosted
application. Khaopiak will check for a `cf-access-authenticated-user-email` header containing a valid email. Cloudflare
prevents impersonating through stripping the header from client requests.

</details>

<details style="border: 1px solid; border-radius: 8px; padding: 8px; margin-top: 4px;">
<summary>☁️ Serverless deployment</summary>

Khaopiak is designed for deployment on <a href="https://workers.cloudflare.com/" target="_blank">Cloudflare Workers</a>,
leveraging <a href="https://developers.cloudflare.com/r2/" target="_blank">Cloudflare R2</a> for file storage
and <a href="https://developers.cloudflare.com/queues/" target="_blank">Cloudflare Queues</a> for file expiry, allowing
deployment and automated scaling without having to maintain servers.

</details>

## Examples

### Khaopiak server cURL examples

> [!WARNING]  
> Endpoints that require sending a mnemonic to the server should **only** send server-generated mnemonics, and not ones
> generated locally, which can compromise end-to-end encryption.

#### Uploading files

> [!IMPORTANT]  
> This example does not leverage client-side encryption. Encrypt sensitive files before transmitting them using this
> command.

Request:

```shell
curl -X 'POST' \
  'https://khaopiak/api/file/upload' \
  -H 'accept: application/json' \
  -H 'Content-Type: multipart/form-data' \
  -F 'file=@/home/username/Desktop/file.pdf' \
  -F 'entropy=128' \
  -F 'expiry=43200'
```

Response:

```json
{
  "success": true,
  "mnemonic": "badge knife trim glimpse solution chaos nasty that quarter angle marine sniff"
}
```

#### Downloading files

> [!NOTE]  
> If the file was encrypted client-side before uploading, this command will not fully decrypt it.

Request:

```shell
curl -X 'POST' \
  'https://khaopiak/api/file/download?noRender=false' \
  -H 'accept: application/octet-stream' \
  -H 'Content-Type: multipart/form-data' \
  -F 'mnemonic=badge knife trim glimpse solution chaos nasty that quarter angle marine sniff' \
  --output "/home/username/Desktop/file.pdf"
```

#### Checking if files exist

Request:

```shell
curl -X 'POST' \
  'https://khaopiak/api/file/exists' \
  -H 'accept: application/json' \
  -H 'Content-Type: multipart/form-data' \
  -F 'mnemonic=badge knife trim glimpse solution chaos nasty that quarter angle marine sniff'
```

Response:

```shell
{
  "success": true,
  "exists": true
}
```

#### Deleting a file

Request:

```shell
curl -X 'POST' \
  'https://khaopiak/api/file/delete' \
  -H 'accept: application/json' \
  -H 'Content-Type: multipart/form-data' \
  -F 'mnemonic=badge knife trim glimpse solution chaos nasty that quarter angle marine sniff'
```

Response:

```json
{
  "success": true
}
```

## Security considerations

<details style="border: 1px solid; border-radius: 8px; padding: 8px; margin-top: 4px;">
<summary>🔐 Cryptographic strength of encryption algorithms</summary>

Khaopiak supports AES-CBC and AES-GCM as they are available through
the <a href="https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto" target="_blank">SubtleCrypto interface of
the Web Crypto API</a>:

<ul>
   <li><strong>RSA-OAEP</strong> is not supported as it is a public-key encryption system, which current guidelines recommend a minimum of 2048 key bits. To meet this, 192+ BIP39 words would be required, which is unreasonable for an end-user.</li>
   <li><strong>AES-CTR</strong> is not supported as it is malleable, potentially allowing the meaning of the ciphertext to be changed.</li>
   <li><strong>AES-CBC</strong> is supported as a client-side encryption algorithm. While Khaopiak is generally not itself vulnerable to a padding oracle attack, client developers should be aware of the algorithm's vulnerability.</li>
   <li><strong>AES-GCM</strong> is supported as both a client and server-side encryption algorithm. As keys and initialization vectors (IVs) are randomly generated and not reused. AES-GCM provides authenticated encryption which helps authenticate the ciphertext. Additional design considerations are necessary when it is possible for a key and IV may potentially be reused.</li>
</ul>

The OpenSSL enc program does not support authenticated encryption modes. As a result, some clients may use AES-CBC
instead, such as uploading from the command line.

</details>

<details style="border: 1px solid; border-radius: 8px; padding: 8px; margin-top: 4px;">
<summary>💥 Server-side collisions</summary>

Khaopiak does not generate guaranteed unique mnemonics. As a result, it is theoretically possible for a collision to
occur, which may enable accidental file overwriting or downloading of an alternate file. However, this case is extremely
improbable. Client-side encryption helps protect data confidentiality even in the presence of a server-side failure.
While it is possible for another collision, enabling decryption of the file, this is improbable.

</details>

## Get started

1. Sign up for [Cloudflare Workers](https://workers.dev). The free tier is more than enough for most use cases.
2. Clone this project and install dependencies with `npm install`
3. Run `wrangler login` to login to your Cloudflare account in wrangler
4. Run `wrangler r2 bucket create khaopiak` to create a Cloudflare R2 bucket
5. Run `wrangler deploy` to publish the API to Cloudflare Workers

## Development

1. Run `wrangler dev` to start a local instance of the API.
2. Open `http://localhost:8787/` in your browser to see the Swagger interface where you can try the endpoints.
3. Changes made in the `src/` folder will automatically trigger the server to reload, you only need to refresh the
   Swagger interface.
