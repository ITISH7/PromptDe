const { spawn } = require("node:child_process");
const { join } = require("node:path");
const electronPath = require("electron");

const cleanEnvironment = { ...process.env };
delete cleanEnvironment.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, [join(__dirname, "..")], {
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
