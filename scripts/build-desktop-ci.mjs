import { spawnSync } from "node:child_process";

const allowedCommands = new Set(["pack:linux", "pack:windows"]);
const command = process.argv[2];

if (!allowedCommands.has(command)) {
  console.error(`Unsupported desktop build command: ${command ?? "(missing)"}`);
  process.exit(2);
}

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";

for (let attempt = 1; attempt <= 2; attempt += 1) {
  console.log(`Building ${command} (attempt ${attempt}/2)...`);

  const result = spawnSync(npmExecutable, ["run", command], {
    env: process.env,
    // Windows cannot launch a .cmd shim directly through CreateProcess.
    shell: process.platform === "win32",
    stdio: "inherit",
  });

  if (result.status === 0) {
    process.exit(0);
  }

  if (attempt === 1) {
    console.warn(`Build attempt failed with exit code ${result.status}; retrying once.`);
  } else {
    console.error(`Desktop build failed after ${attempt} attempts.`);
    process.exit(result.status ?? 1);
  }
}
