import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
const privateConfig = path.join(root, ".dev.vars");
const authArgs = existsSync(privateConfig)
  ? ["--env-file", privateConfig]
  : ["--var", "AUTH_MODE:local", "--var", `AUTH_HMAC_SECRET:${randomBytes(32).toString("hex")}`];
const child = spawn(process.execPath, [
  "--import", pathToFileURL(path.join(root, "scripts", "sites-env.mjs")).href,
  wrangler, "dev", "--config", path.join(root, "dist", "server", "wrangler.json"),
  "--local", "--persist-to", path.join(root, ".wrangler", "crous-court"),
  "--ip", "127.0.0.1", "--inspector-port", "0",
  ...authArgs,
], { cwd: root, stdio: "inherit" });

child.on("exit", (code, signal) => process.exitCode = signal ? 1 : (code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
