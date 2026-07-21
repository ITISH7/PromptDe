import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { startServer } from "../server.mjs";

let baseUrl;
let server;

before(async () => {
  const started = await startServer({ port: 0 });
  baseUrl = started.url;
  server = started.server;
});

after(async () => {
  if (!server) return;
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("serves the web application", async () => {
  const response = await fetch(`${baseUrl}/`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/u);
  assert.match(await response.text(), /<title>PromptDe/u);
});

test("reports provider configuration without exposing keys", async () => {
  const response = await fetch(`${baseUrl}/api/config`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(typeof body.groqConfigured, "boolean");
  assert.equal(typeof body.geminiConfigured, "boolean");
  assert.deepEqual(Object.keys(body).sort(), ["geminiConfigured", "groqConfigured"]);
});

test("returns JSON for missing routes and unsupported methods", async () => {
  const missingResponse = await fetch(`${baseUrl}/missing`);
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), { error: "Not found." });

  const methodResponse = await fetch(`${baseUrl}/`, { method: "POST" });
  assert.equal(methodResponse.status, 405);
  assert.deepEqual(await methodResponse.json(), { error: "Method not allowed." });
});
