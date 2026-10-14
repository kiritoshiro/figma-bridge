// Hardening patch for @gethopp/figma-mcp-bridge (leader HTTP/WebSocket server).
//
// Upstream calls server.listen(port) with no host, so it listens on every
// network interface, and /rpc accepts any POST. That lets other devices on the
// network, or any web page open in a browser, send Figma commands to it.
//
// This patch makes the leader:
//   - reject every HTTP request and WebSocket upgrade not coming from loopback;
//   - reject /ping and /rpc unless the Host header is localhost/127.0.0.1/[::1]
//     (blocks DNS-rebinding);
//   - reject /rpc requests that carry an Origin header (browsers always send
//     one on POST; the bridge's own followers never do) or that are not
//     Content-Type: application/json (forces a CORS preflight, which fails).
//
// Idempotent: re-run after every reinstall/upgrade with `npm run harden`.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(here, "node_modules", "@gethopp", "figma-mcp-bridge", "dist", "leader.js");
const MARKER = "/* local-hardening v1 */";

let src = readFileSync(target, "utf8");
if (src.includes(MARKER)) {
    console.log("leader.js already hardened");
    process.exit(0);
}

const helpers = `${MARKER}
const LOOPBACK_ADDRS = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);
function isLoopback(req) {
    return LOOPBACK_ADDRS.has(req.socket?.remoteAddress ?? "");
}
function hasLoopbackHost(req) {
    const host = (req.headers.host ?? "").toLowerCase().replace(/:\\d+$/, "");
    return LOOPBACK_HOSTS.has(host);
}
function isTrustedRpc(req) {
    const type = (req.headers["content-type"] ?? "").toLowerCase();
    return req.headers.origin === undefined && type.startsWith("application/json");
}
`;

const replacements = [
    [
        'import { VERSION } from "./version.js";\n',
        'import { VERSION } from "./version.js";\n' + helpers,
    ],
    [
        "const server = http.createServer((req, res) => {\n",
        "const server = http.createServer((req, res) => {\n" +
            "                if (!isLoopback(req) || !hasLoopbackHost(req) ||\n" +
            '                    (req.url === "/rpc" && !isTrustedRpc(req))) {\n' +
            "                    res.writeHead(403);\n" +
            '                    res.end("Forbidden");\n' +
            "                    return;\n" +
            "                }\n",
    ],
    [
        'server.on("upgrade", (req, socket, head) => {\n',
        'server.on("upgrade", (req, socket, head) => {\n' +
            "                if (!isLoopback(req)) {\n" +
            "                    socket.destroy();\n" +
            "                    return;\n" +
            "                }\n",
    ],
];

for (const [from, to] of replacements) {
    const count = src.split(from).length - 1;
    if (count !== 1) {
        console.error(`Patch anchor found ${count} times (expected 1): ${JSON.stringify(from)}`);
        console.error("Upstream changed; review leader.js manually before using this version.");
        process.exit(1);
    }
    src = src.replace(from, to);
}

writeFileSync(target, src);
console.log("leader.js hardened");
