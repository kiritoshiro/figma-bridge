# Figma MCP Bridge (local, hardened)

Local install of [gethopp/figma-mcp-bridge](https://github.com/gethopp/figma-mcp-bridge) (MIT) so Claude Code can read and edit Figma files through a Figma plugin. Nothing goes through Figma's API, so the Starter-plan API limits don't apply. The plugin can only edit what you can edit yourself.

- Version: **0.0.24**, pinned (server from npm, plugin from the GitHub release zip). Both were reviewed on 2026-10-13. The server and plugin talk only to `localhost:1994`, and there is no telemetry.
- Claude Code registration (user scope): `figma-bridge`, running `node <this folder>/node_modules/@gethopp/figma-mcp-bridge/dist/index.js`.

## Installing

Requires Node.js 18 or later and the Figma desktop app.

```bash
git clone https://github.com/kiritoshiro/figma-bridge.git
cd figma-bridge
npm ci --ignore-scripts
npm run harden
claude mcp add figma-bridge -s user -- node "$(pwd)/node_modules/@gethopp/figma-mcp-bridge/dist/index.js"
```

`npm ci` installs the exact versions recorded in `package-lock.json`. `--ignore-scripts` stops package install scripts from running. **Always run `npm run harden` before first use**, because the unpatched server accepts commands from your whole network.

## Using it

1. Open the **Figma desktop app** (the browser version can't run development plugins).
2. First time only: **Plugins → Development → Import plugin from manifest…** and pick `plugin/manifest.json` from this folder.
3. Open the file you want to work on, then run **Plugins → Development → Figma MCP Bridge**. Keep the plugin window open while Claude works.
4. Start or restart a Claude Code session. Claude will see tools such as `list_files`, `get_selection`, `set_text_content`, `duplicate_with_offset` and `save_screenshots`.

Exported files (`save_screenshots`) can only be written inside the folder where the Claude session is running.

## Local hardening patch

Upstream listens on every network interface and accepts unauthenticated POSTs on `/rpc`. That means a web page or another device on the network could send Figma commands to it. `harden.mjs` patches `dist/leader.js` so the server:

- only accepts connections from loopback (127.0.0.1 / ::1);
- rejects requests whose `Host` header isn't localhost, which blocks DNS rebinding;
- rejects `/rpc` calls that carry an `Origin` header or aren't `application/json`, which blocks browser requests.

The patch is idempotent. **Re-run it after every reinstall or upgrade:**

```bash
npm install --ignore-scripts && npm run harden
```

If upstream changes the code the patch relies on, the script refuses to apply and exits with an error. In that case, review the new `leader.js` before using that version.

## Upgrading

1. Change the version in `package.json`, then run `npm install --ignore-scripts`.
2. Review the diff of `node_modules/@gethopp/figma-mcp-bridge/dist`.
3. Run `npm run harden`.
4. Replace `plugin/` with the matching release zip from GitHub and re-import it in Figma if the manifest changed.

Keep the server and plugin versions in step.

## Removing

```bash
claude mcp remove figma-bridge -s user
```

Then delete this folder and remove the plugin in Figma under **Plugins → Development → Manage plugins in development**.

## Credits and license

The MCP server (installed from npm) and the Figma plugin in `plugin/` are [gethopp/figma-mcp-bridge](https://github.com/gethopp/figma-mcp-bridge), © GETHOPP LTD, under the MIT License (see `plugin/LICENSE.md`). The plugin files are unmodified copies of the 0.0.24 release. This repository adds the pinned install, the `harden.mjs` security patch and this documentation, which are © kiritoshiro and also MIT-licensed (see `LICENSE`). Anyone may use, change and share them.
