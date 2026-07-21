import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
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

function postJson(path, body, headers = {}) {
  const target = new URL(path, baseUrl);
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = httpRequest(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(payload),
        ...headers,
      },
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => resolve({
        status: response.statusCode,
        body: JSON.parse(Buffer.concat(chunks).toString("utf8")),
      }));
    });
    request.on("error", reject);
    request.end(payload);
  });
}

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

test("validates translation input before contacting a provider", async () => {
  const response = await postJson("/api/translate", { transcript: "" });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: "Add or record something to translate first." });
});

test("translates with the selected language and tone", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /generativelanguage\.googleapis\.com/u);
    const requestBody = JSON.parse(options.body);
    const instruction = requestBody.systemInstruction.parts[0].text;
    assert.match(instruction, /natural Hindi using Devanagari/u);
    assert.match(instruction, /polite, professional tone/u);
    assert.equal(requestBody.contents[0].parts[0].text, "Can you send me the report?");
    return new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: "क्या आप मुझे रिपोर्ट भेज सकते हैं?" }] } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const response = await postJson("/api/translate", {
      provider: "gemini",
      transcript: "Can you send me the report?",
      targetLanguage: "hindi",
      tone: "formal",
    }, { "x-promptde-gemini-key": "test-key" });

    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      translation: "क्या आप मुझे रिपोर्ट भेज सकते हैं?",
      targetLanguage: "hindi",
      tone: "formal",
      providerUsed: "gemini",
      fallbackFrom: null,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
