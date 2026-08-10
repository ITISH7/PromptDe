import { readFileSync } from "node:fs";

const MINIMUM_NODE = [22, 12, 0];
const REQUIRED_ELECTRON = "43.3.0";
const REQUIRED_BUILDER = "26.15.7";
const currentNode = process.versions.node.split(".").map(Number);

function versionAtLeast(current, required) {
  for (let index = 0; index < required.length; index += 1) {
    if (current[index] > required[index]) return true;
    if (current[index] < required[index]) return false;
  }
  return true;
}

if (!versionAtLeast(currentNode, MINIMUM_NODE)) {
  console.error(
    `PromptDe desktop builds require Node ${MINIMUM_NODE.join(".")} or newer. `
    + `Current version: ${process.versions.node}. Install Node 22, then run npm ci again.`,
  );
  process.exit(1);
}

let installedBuilder;
let installedElectron;
try {
  const builderPackageJson = JSON.parse(readFileSync(
    new URL("../node_modules/electron-builder/package.json", import.meta.url),
    "utf8",
  ));
  const electronPackageJson = JSON.parse(readFileSync(
    new URL("../node_modules/electron/package.json", import.meta.url),
    "utf8",
  ));
  installedBuilder = builderPackageJson.version;
  installedElectron = electronPackageJson.version;
} catch {
  console.error("Electron build dependencies are not installed. Run npm ci before packaging PromptDe.");
  process.exit(1);
}

if (installedElectron !== REQUIRED_ELECTRON) {
  console.error(
    `PromptDe requires Electron ${REQUIRED_ELECTRON}, but ${installedElectron} is installed. `
    + "Run npm ci to restore the locked dependency versions.",
  );
  process.exit(1);
}

if (installedBuilder !== REQUIRED_BUILDER) {
  console.error(
    `PromptDe requires electron-builder ${REQUIRED_BUILDER}, but ${installedBuilder} is installed. `
    + "Run npm ci to restore the locked dependency versions.",
  );
  process.exit(1);
}
