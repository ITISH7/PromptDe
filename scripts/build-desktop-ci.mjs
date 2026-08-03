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
    encoding: "utf8",
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
    // Windows cannot launch a .cmd shim directly through CreateProcess.
    shell: process.platform === "win32",
  });

  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  if (result.status === 0) {
    process.exit(0);
  }

  if (attempt === 1) {
    console.warn(`Build attempt failed with exit code ${result.status}; retrying once.`);
  } else {
    const diagnostic = `${result.stdout ?? ""}\n${result.stderr ?? ""}`
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-12)
      .join(" | ")
      .replaceAll("%", "%25")
      .replaceAll("\r", "%0D")
      .replaceAll("\n", "%0A");

    console.log(`::error title=${command} packaging failed::${diagnostic}`);
    console.error(`Desktop build failed after ${attempt} attempts.`);
    process.exit(result.status ?? 1);
  }
}
