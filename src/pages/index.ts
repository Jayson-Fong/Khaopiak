import {html} from "hono/html";

export const Content = () => html`<html lang="en-US">
    <body>
        <main>
            <h1>Khaopiak</h1>
            <h2>Download File</h2>
            <form method="POST" action="/api/file/download">
                <label for="mnemonic">Mnemonic</label>
                <textarea id="mnemonic" name="mnemonic" rows="4"></textarea>
                <input type="submit" />
            </form>
        </main>
    </body>
</html>`;
