#!/usr/bin/env node

import { spawn } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const arguments_ = process.argv.slice(2);

if (arguments_[0] === "db:start") {
  process.exit(0);
}

if (arguments_[0] === "exec" && arguments_[1] === "supabase" && arguments_[2] === "status") {
  process.stdout.write(
    `${JSON.stringify({
      API_URL: "http://127.0.0.1:55321",
      DB_URL: process.env.LOCAL_BYPASS_TEST_DATABASE_URL,
      PUBLISHABLE_KEY: "local-bypass-test-key",
    })}\n`,
  );
  process.exit(0);
}

if (arguments_[0] === "__http-child") {
  const port = Number(arguments_[1]);
  const server = createServer((_request, response) => {
    response.writeHead(200, { "content-type": "text/plain" });
    response.end("local bypass fixture");
  });
  let shutdownStarted = false;
  const shutdown = () => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    const delay = Number(process.env.LOCAL_BYPASS_TEST_SHUTDOWN_DELAY_MS ?? "0");
    setTimeout(() => server.close(() => process.exit(0)), delay).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  server.listen(port, "127.0.0.1", async () => {
    if (process.env.LOCAL_BYPASS_TEST_CHILD_PID_FILE) {
      await writeFile(process.env.LOCAL_BYPASS_TEST_CHILD_PID_FILE, `${process.pid}\n`, "utf8");
    }
  });
} else if (
  arguments_[0] === "exec" &&
  ((arguments_[1] === "tsx" && arguments_[2]?.endsWith("local-bypass-next-server.ts")) ||
    (arguments_[1] === "next" && arguments_[2] === "dev"))
) {
  const portArgumentIndex = arguments_.indexOf("--port");
  const port = Number(process.env.LOCAL_BYPASS_NEXT_PORT ?? arguments_[portArgumentIndex + 1]);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("The fake Next.js process requires a valid port environment variable.");
  }
  const httpChild = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "__http-child", String(port)],
    {
      env: process.env,
      stdio: "inherit",
    },
  );
  httpChild.once("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
  process.on("SIGINT", () => process.exit(0));
  process.on("SIGTERM", () => process.exit(0));
} else {
  process.stderr.write(`Unexpected fake pnpm arguments: ${arguments_.join(" ")}\n`);
  process.exit(1);
}
