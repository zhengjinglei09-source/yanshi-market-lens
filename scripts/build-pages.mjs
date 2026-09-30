import { mkdir, rename, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const apiRoute = resolve(root, "app/api/index-structure/route.ts");
const parkedRoute = resolve(root, ".pages-build-route.ts");
const env = { ...process.env, NEXT_OUTPUT_EXPORT: "1" };

await rename(apiRoute, parkedRoute);
try {
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const status = await new Promise((resolveStatus, reject) => {
    const child = spawn(command, ["next", "build", "--webpack"], {
      cwd: root,
      env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolveStatus(code ?? 1));
  });
  if (status !== 0) process.exitCode = status;
} finally {
  await mkdir(dirname(apiRoute), { recursive: true });
  await rename(parkedRoute, apiRoute);
  if (process.exitCode) await rm(resolve(root, "out"), { recursive: true, force: true });
}
