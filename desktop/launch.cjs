const { spawn } = require("node:child_process");
const { statSync } = require("node:fs");
const { dirname, join } = require("node:path");
const electronPath = require("electron");

const sandboxHelperPath = join(dirname(electronPath), "chrome-sandbox");

// npm cannot set setuid bits, so a from-source install leaves chrome-sandbox
// unprivileged. On distributions that restrict unprivileged user namespaces
// (Ubuntu 24.04 and newer) Chromium has no fallback and aborts on startup.
function sandboxHelperIsPrivileged() {
  try {
    return (statSync(sandboxHelperPath).mode & 0o4000) !== 0;
  } catch {
    return false;
  }
}

const electronArguments = [join(__dirname, "..")];

if (process.platform === "linux" && !sandboxHelperIsPrivileged()) {
  console.warn(
    `PromptDe: ${sandboxHelperPath} is not setuid root, starting without the Chromium sandbox.`,
  );
  console.warn(
    `PromptDe: enable the sandbox with: sudo chown root:root "${sandboxHelperPath}" && sudo chmod 4755 "${sandboxHelperPath}"`,
  );
  electronArguments.unshift("--no-sandbox");
}

const cleanEnvironment = { ...process.env };
delete cleanEnvironment.ELECTRON_RUN_AS_NODE;
delete cleanEnvironment.DESKTOP_STARTUP_ID;
delete cleanEnvironment.GIO_LAUNCHED_DESKTOP_FILE;
delete cleanEnvironment.GIO_LAUNCHED_DESKTOP_FILE_PID;

const child = spawn(electronPath, electronArguments, {
  env: cleanEnvironment,
  stdio: "inherit",
  windowsHide: false,
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
