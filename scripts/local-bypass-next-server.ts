import { createServer, type IncomingMessage } from "node:http";

import next from "next";

import {
  localAuthBypassClientAddressHeader,
  localAuthBypassCookieName,
} from "../src/infrastructure/config/local-development";
import { signalExitCode } from "./local-bypass-signals";

const hostname = "127.0.0.1";
const port = Number(process.env.LOCAL_BYPASS_NEXT_PORT);
const requestSecret = process.env.LOCAL_AUTH_BYPASS_REQUEST_SECRET;

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error("The local bypass Next.js server requires a valid port.");
}
if (!requestSecret) {
  throw new Error("The local bypass Next.js server requires its request secret.");
}

const application = next({ dev: true, hostname, port });
await application.prepare();
const handleRequest = application.getRequestHandler();
const handleUpgrade = application.getUpgradeHandler();

function stampTransportProof(request: IncomingMessage): void {
  request.headers[localAuthBypassClientAddressHeader] = request.socket.remoteAddress ?? "unknown";
}

const server = createServer((request, response) => {
  stampTransportProof(request);
  const requestUrl = new URL(request.url ?? "/", `http://${hostname}:${port}`);
  if (requestUrl.searchParams.get("local-bypass-token") === requestSecret) {
    requestUrl.searchParams.delete("local-bypass-token");
    response.writeHead(303, {
      location: `${requestUrl.pathname}${requestUrl.search}`,
      "set-cookie": `${localAuthBypassCookieName}=${encodeURIComponent(requestSecret)}; HttpOnly; SameSite=Strict; Path=/`,
    });
    response.end();
    return;
  }
  void handleRequest(request, response).catch((error: unknown) => {
    process.stderr.write(
      `Local bypass Next.js request failed: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});
server.on("upgrade", (request, socket, head) => {
  stampTransportProof(request);
  void handleUpgrade(request, socket, head).catch(() => socket.destroy());
});

await new Promise<void>((resolve, reject) => {
  server.once("error", reject);
  server.listen(port, hostname, () => {
    server.off("error", reject);
    resolve();
  });
});

let shutdownPromise: Promise<void> | undefined;
const shutdown = (signal: NodeJS.Signals): void => {
  shutdownPromise ??= (async () => {
    server.closeAllConnections();
    await Promise.all([
      new Promise<void>((resolve) => server.close(() => resolve())),
      application.close(),
    ]);
    process.exitCode = signalExitCode(signal);
  })();
};
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

await new Promise<void>((resolve) => server.once("close", resolve));
await shutdownPromise;
