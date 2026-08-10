import assert from "node:assert/strict";
import { request as httpRequest } from "node:http";
import { win32 } from "node:path";
import { after, before, test } from "node:test";
import { isPathInsideDirectory, startServer } from "../server.mjs";

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

function postRaw(path, body, headers = {}) {
  const target = new URL(path, baseUrl);
  return new Promise((resolve, reject) => {
    const request = httpRequest(target, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": Buffer.byteLength(body),
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
    request.end(body);
  });
}

test("serves the web application", async () => {
  const [response, stylesheet, script] = await Promise.all([
    fetch(`${baseUrl}/`),
    fetch(`${baseUrl}/styles.css`),
    fetch(`${baseUrl}/app.js`),
  ]);

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/u);
  assert.match(await response.text(), /<title>PromptDe/u);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get("content-type"), /^text\/css/u);
  assert.match(await stylesheet.text(), /--orange:/u);
  assert.equal(script.status, 200);
  assert.match(script.headers.get("content-type"), /^text\/javascript/u);
  assert.match(await script.text(), /promptDeDesktop/u);
});

test("accepts packaged static files when Windows uses backslash separators", () => {
  const publicDirectory = "C:\\Program Files\\PromptDe\\resources\\app.asar\\public";

  assert.equal(
    isPathInsideDirectory(publicDirectory, `${publicDirectory}\\index.html`, win32),
    true,
  );
  assert.equal(
    isPathInsideDirectory(publicDirectory, "C:\\Program Files\\PromptDe\\resources\\secret.txt", win32),
    false,
  );
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

test("serves the app with browser security headers", async () => {
  const response = await fetch(`${baseUrl}/`);

  assert.match(response.headers.get("content-security-policy"), /default-src 'self'/u);
  assert.equal(response.headers.get("x-frame-options"), "DENY");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
});

test("blocks cross-origin API requests", async () => {
  const response = await postRaw("/api/transcribe", "", {
    origin: "https://malicious.example",
    "content-type": "multipart/form-data; boundary=test",
    "x-promptde-groq-key": "test-key",
  });

  assert.equal(response.status, 403);
  assert.deepEqual(response.body, { error: "Request origin is not allowed." });
});

test("validates translation input before contacting a provider", async () => {
  const response = await postJson("/api/translate", { transcript: "" });

  assert.equal(response.status, 400);
  assert.deepEqual(response.body, { error: "Add or record something to translate first." });
});

test("rejects malformed and oversized JSON with client errors", async () => {
  const malformed = await postRaw("/api/compile", "{not-json");
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.body, { error: "Request body must be valid JSON." });

  const oversized = await postRaw("/api/compile", JSON.stringify({
    transcript: "x".repeat(1_000_001),
  }));
  assert.equal(oversized.status, 413);
  assert.deepEqual(oversized.body, { error: "Request is too large." });
});

test("rejects oversized audio before contacting Groq", async () => {
  const response = await postRaw("/api/transcribe", Buffer.alloc(30_000_001), {
    "content-type": "multipart/form-data; boundary=test",
    "x-promptde-groq-key": "test-key",
  });

  assert.equal(response.status, 413);
  assert.deepEqual(response.body, { error: "Audio upload is too large." });
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

test("defaults translation to Groq when no provider is specified", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /api\.groq\.com/u);
    const requestBody = JSON.parse(options.body);
    assert.equal(requestBody.messages[1].content, "Namaste");
    return new Response(JSON.stringify({
      choices: [{ message: { content: "Hello" } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  try {
    const response = await postJson("/api/translate", {
      transcript: "Namaste",
      targetLanguage: "english",
      tone: "natural",
    }, { "x-promptde-groq-key": "test-key" });

    assert.equal(response.status, 200);
    assert.equal(response.body.translation, "Hello");
    assert.equal(response.body.providerUsed, "groq");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
