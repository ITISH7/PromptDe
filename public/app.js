const elements = {
  settingsButton: document.querySelector("#settingsButton"),
  desktopShortcut: document.querySelector("#desktopShortcut"),
  settingsDrawer: document.querySelector("#settingsDrawer"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  closeSettings: document.querySelector("#closeSettings"),
  saveSettings: document.querySelector("#saveSettings"),
  groqStatus: document.querySelector("#groqStatus"),
  compilerStatus: document.querySelector("#compilerStatus"),
  groqApiKey: document.querySelector("#groqApiKey"),
  geminiApiKey: document.querySelector("#geminiApiKey"),
  keyStorageNote: document.querySelector("#keyStorageNote"),
  keyStorageHint: document.querySelector("#keyStorageHint"),
  speechModel: document.querySelector("#speechModel"),
  geminiModel: document.querySelector("#geminiModel"),
  groqModel: document.querySelector("#groqModel"),
  translationLanguage: document.querySelector("#translationLanguage"),
  translationTone: document.querySelector("#translationTone"),
  geminiSettings: document.querySelector("#geminiSettings"),
  groqCompilerSettings: document.querySelector("#groqCompilerSettings"),
  language: document.querySelector("#language"),
  recorder: document.querySelector("#recorder"),
  recordButton: document.querySelector("#recordButton"),
  recordTitle: document.querySelector("#recordTitle"),
  recordHint: document.querySelector("#recordHint"),
  timer: document.querySelector("#timer"),
  transcript: document.querySelector("#transcript"),
  transcriptCount: document.querySelector("#transcriptCount"),
  clearTranscript: document.querySelector("#clearTranscript"),
  contextDetails: document.querySelector(".context-details"),
  context: document.querySelector("#context"),
  compileButton: document.querySelector("#compileButton"),
  translateButton: document.querySelector("#translateButton"),
  emptyOutput: document.querySelector("#emptyOutput"),
  result: document.querySelector("#result"),
  resultBadge: document.querySelector("#resultBadge"),
  translationPreview: document.querySelector("#translationPreview"),
  translatedText: document.querySelector("#translatedText"),
  copyTranslation: document.querySelector("#copyTranslation"),
  resultTitle: document.querySelector("#resultTitle"),
  agentPrompt: document.querySelector("#agentPrompt"),
  resultInsights: document.querySelector("#resultInsights"),
  resultNotes: document.querySelector("#resultNotes"),
  tokenCount: document.querySelector("#tokenCount"),
  copyButton: document.querySelector("#copyButton"),
  copyPromptLabel: document.querySelector("#copyPromptLabel"),
  toast: document.querySelector("#toast"),
  openConfigFolder: document.querySelector("#openConfigFolder"),
};

const state = {
  compilerProvider: "gemini",
  promptMode: "standard",
  mediaRecorder: null,
  mediaStream: null,
  audioChunks: [],
  startedAt: 0,
  timerId: null,
  busy: false,
  serverKeys: { groq: false, gemini: false },
  userKeys: { groq: "", gemini: "" },
  desktopAutoCompile: false,
  recordingTarget: "transcript",
};

let toastTimeout;

function showToast(message, type = "success") {
  clearTimeout(toastTimeout);
  elements.toast.textContent = message;
  elements.toast.className = `toast show ${type === "error" ? "error" : ""}`;
  toastTimeout = setTimeout(() => { elements.toast.className = "toast"; }, 3600);
}

function desktopNotify(message) {
  window.promptDeDesktop?.notify(message);
}

function openSettings() {
  elements.settingsDrawer.classList.add("open");
  elements.drawerBackdrop.classList.add("open");
  elements.settingsDrawer.setAttribute("aria-hidden", "false");
  elements.settingsButton.setAttribute("aria-expanded", "true");
}

function closeSettings() {
  elements.settingsDrawer.classList.remove("open");
  elements.drawerBackdrop.classList.remove("open");
  elements.settingsDrawer.setAttribute("aria-hidden", "true");
  elements.settingsButton.setAttribute("aria-expanded", "false");
}

function setCompilerProvider(provider) {
  state.compilerProvider = provider;
  try {
    localStorage.setItem("promptde:compilerProvider", provider);
  } catch {
    // Keep the preference in memory when local storage is unavailable.
  }
  document.querySelectorAll("[data-provider]").forEach((button) => {
    button.classList.toggle("active", button.dataset.provider === provider);
  });
  elements.geminiSettings.classList.toggle("hidden", provider !== "gemini");
  elements.groqCompilerSettings.classList.toggle("hidden", provider !== "groq");
  updateConfigurationStatus();
}

function setStatus(element, ready, readyText, missingText) {
  element.classList.toggle("ready", ready);
  element.classList.toggle("missing", !ready);
  element.lastChild.textContent = ` ${ready ? readyText : missingText}`;
}

function providerReady(provider) {
  return Boolean(state.userKeys[provider] || state.serverKeys[provider]);
}

function requestKeyHeaders() {
  const headers = {};
  if (state.userKeys.groq) headers["x-promptde-groq-key"] = state.userKeys.groq;
  if (state.userKeys.gemini) headers["x-promptde-gemini-key"] = state.userKeys.gemini;
  return headers;
}

function configuredKeyMessage(provider) {
  const name = provider === "gemini" ? "Gemini" : "Groq";
  if (state.userKeys[provider]) return `${name} key ready for this browser session`;
  return window.promptDeDesktop ? `${name} key saved locally` : `${name} key provided by the server`;
}

function updateApiKeyPlaceholders() {
  elements.groqApiKey.placeholder = providerReady("groq") ? "Key configured — enter a new key to replace" : "gsk_…";
  elements.geminiApiKey.placeholder = providerReady("gemini") ? "Key configured — enter a new key to replace" : "Enter your Gemini API key";
}

function updateConfigurationStatus() {
  setStatus(
    elements.groqStatus,
    providerReady("groq"),
    configuredKeyMessage("groq"),
    "Add a Groq API key below",
  );
  const compilerReady = providerReady(state.compilerProvider);
  setStatus(
    elements.compilerStatus,
    compilerReady,
    `${configuredKeyMessage(state.compilerProvider)} for compilation`,
    `Add a ${state.compilerProvider === "gemini" ? "Gemini" : "Groq"} key below`,
  );
  updateApiKeyPlaceholders();
}

function updateWordCount() {
  const words = elements.transcript.value.trim().split(/\s+/u).filter(Boolean).length;
  elements.transcriptCount.textContent = `${words} ${words === 1 ? "word" : "words"}`;
}

function clearTranscript() {
  elements.transcript.value = "";
  updateWordCount();
  elements.transcript.focus();
  showToast("Transcript cleared.");
}

function updateTokenEstimate() {
  const text = elements.agentPrompt.value.trim();
  const estimated = text ? Math.max(1, Math.ceil(text.length / 4)) : 0;
  elements.tokenCount.textContent = `≈ ${estimated.toLocaleString()} tokens`;
  elements.copyButton.disabled = !text;
}

function formatTimer(seconds) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function supportedAudioMimeType() {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function resetRecorderUi() {
  elements.recorder.classList.remove("recording");
  elements.recordTitle.textContent = "Tap to speak";
  elements.recordHint.textContent = "Your natural words are perfect";
  elements.recordButton.setAttribute("aria-label", "Start recording");
  elements.timer.textContent = "00:00";
  clearInterval(state.timerId);
}

async function startRecording(target = "transcript") {
  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    showToast("This browser does not support microphone recording. You can still type a transcript.", "error");
    return;
  }
  if (!providerReady("groq")) {
    showToast("Add your Groq API key in Settings first.", "error");
    openSettings();
    return;
  }

  try {
    state.recordingTarget = target;
    state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    state.audioChunks = [];
    const mimeType = supportedAudioMimeType();
    state.mediaRecorder = new MediaRecorder(state.mediaStream, mimeType ? { mimeType } : undefined);
    state.mediaRecorder.addEventListener("dataavailable", (event) => {
      if (event.data.size) state.audioChunks.push(event.data);
    });
    state.mediaRecorder.addEventListener("stop", transcribeRecording, { once: true });
    state.mediaRecorder.start(250);
    state.startedAt = Date.now();
    elements.recorder.classList.add("recording");
    elements.recordTitle.textContent = target === "context"
      ? "Listening for project context…"
      : target === "translatePaste" ? "Listening for translation…" : "Listening… tap to stop";
    elements.recordHint.textContent = ["context", "translatePaste"].includes(target)
      ? "Press the shortcut again to stop"
      : "Speak in Hindi, English, or Hinglish";
    elements.recordButton.setAttribute("aria-label", "Stop recording");
    if (target === "translatePaste") desktopNotify("Recording translation. Press the shortcut again to stop.");
    state.timerId = setInterval(() => {
      const elapsed = (Date.now() - state.startedAt) / 1000;
      elements.timer.textContent = formatTimer(elapsed);
      if (elapsed >= 300) stopRecording();
    }, 250);
  } catch (error) {
    state.recordingTarget = "transcript";
    const message = error.name === "NotAllowedError" ? "Microphone permission was denied." : `Could not start the microphone: ${error.message}`;
    showToast(message, "error");
    if (target === "translatePaste") desktopNotify(message);
  }
}

function stopRecording() {
  if (state.mediaRecorder?.state === "recording") state.mediaRecorder.stop();
  state.mediaStream?.getTracks().forEach((track) => track.stop());
  state.mediaStream = null;
  clearInterval(state.timerId);
  elements.recorder.classList.remove("recording");
  elements.recordTitle.textContent = "Transcribing…";
  elements.recordHint.textContent = "Using Groq Whisper";
}

async function transcribeRecording() {
  const recordingTarget = state.recordingTarget;
  const mimeType = state.mediaRecorder?.mimeType || "audio/webm";
  const extension = mimeType.includes("mp4") ? "m4a" : mimeType.includes("ogg") ? "ogg" : "webm";
  const audio = new Blob(state.audioChunks, { type: mimeType });
  state.mediaRecorder = null;

  if (audio.size < 500) {
    state.desktopAutoCompile = false;
    state.recordingTarget = "transcript";
    resetRecorderUi();
    showToast("The recording was too short. Please try again.", "error");
    if (recordingTarget === "translatePaste") desktopNotify("The recording was too short. Please try again.");
    return;
  }

  const formData = new FormData();
  formData.append("file", audio, `voice-prompt.${extension}`);
  formData.append("model", elements.speechModel.value);
  formData.append("response_format", "json");
  formData.append("temperature", "0");
  if (elements.language.value !== "auto") formData.append("language", elements.language.value);
  formData.append("prompt", "Coding task with Hindi, English, Hinglish, source code symbols, package names, file paths, and technical terminology.");

  let shouldAutoCompile = false;
  let translationTranscript = "";
  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      headers: requestKeyHeaders(),
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Transcription failed.");
    if (recordingTarget === "translatePaste") {
      translationTranscript = data.text.trim();
      desktopNotify("Transcription ready. Translating…");
    } else {
      const destination = recordingTarget === "context" ? elements.context : elements.transcript;
      const existing = destination.value.trim();
      destination.value = [existing, data.text.trim()].filter(Boolean).join(existing ? "\n" : "");
      if (recordingTarget === "context") {
        elements.contextDetails.open = true;
        destination.focus();
      } else {
        updateWordCount();
      }
    }
    shouldAutoCompile = recordingTarget === "transcript" && state.desktopAutoCompile;
    state.desktopAutoCompile = false;
    if (recordingTarget !== "translatePaste") {
      showToast(recordingTarget === "context"
        ? "Voice transcription added to project context."
        : shouldAutoCompile ? "Transcription ready. Creating your prompt…" : "Transcription ready. Review it, then compile your prompt.");
    }
  } catch (error) {
    state.desktopAutoCompile = false;
    showToast(error.message, "error");
    if (recordingTarget === "translatePaste") desktopNotify(error.message);
  } finally {
    state.recordingTarget = "transcript";
    resetRecorderUi();
  }
  if (shouldAutoCompile) await compilePrompt();
  if (translationTranscript) await translateText(translationTranscript, true);
}

function compilerConfig() {
  if (state.compilerProvider === "gemini") {
    return {
      model: elements.geminiModel.value.trim() || "gemini-3.5-flash",
    };
  }
  return {
    model: elements.groqModel.value,
  };
}

function renderInsights(data) {
  const insights = [];
  if (data.requirements?.length) insights.push(`${data.requirements.length} requirements`);
  if (data.acceptanceCriteria?.length) insights.push(`${data.acceptanceCriteria.length} acceptance checks`);
  if (data.assumptions?.length) insights.push(`${data.assumptions.length} assumptions`);
  if (data.questions?.length) insights.push(`${data.questions.length} questions`);
  elements.resultInsights.replaceChildren(...insights.map((label) => {
    const span = document.createElement("span");
    span.className = `insight${label.includes("questions") ? " question" : ""}`;
    span.textContent = label;
    return span;
  }));

  const noteGroups = [
    { title: "Assumptions to review", items: data.assumptions, className: "assumptions" },
    { title: "Open questions", items: data.questions, className: "questions" },
  ].filter((group) => group.items?.length);

  elements.resultNotes.replaceChildren(...noteGroups.map((group) => {
    const details = document.createElement("details");
    details.className = group.className;
    if (group.className === "questions") details.open = true;
    const summary = document.createElement("summary");
    summary.textContent = `${group.title} (${group.items.length})`;
    const list = document.createElement("ul");
    for (const item of group.items) {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.append(listItem);
    }
    details.append(summary, list);
    return details;
  }));
  elements.resultNotes.classList.toggle("hidden", noteGroups.length === 0);
}

async function compilePrompt() {
  if (state.busy) return;
  const transcript = elements.transcript.value.trim();
  if (!transcript) {
    showToast("Record or type your idea first.", "error");
    elements.transcript.focus();
    return;
  }
  const config = compilerConfig();
  if (!providerReady(state.compilerProvider)) {
    showToast(`Add your ${state.compilerProvider === "gemini" ? "Gemini" : "Groq"} API key in Settings first.`, "error");
    openSettings();
    return;
  }

  state.busy = true;
  elements.compileButton.disabled = true;
  elements.compileButton.querySelector("span").textContent = "Compiling…";
  try {
    const headers = { "content-type": "application/json", ...requestKeyHeaders() };
    const response = await fetch("/api/compile", {
      method: "POST",
      headers,
      body: JSON.stringify({
        provider: state.compilerProvider,
        model: config.model,
        mode: state.promptMode,
        transcript,
        context: elements.context.value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Prompt compilation failed.");
    elements.resultTitle.textContent = data.title || "Compiled prompt";
    const usedProvider = data.providerUsed || state.compilerProvider;
    elements.resultBadge.textContent = data.fallbackFrom
      ? `Ready via ${usedProvider} fallback`
      : `Ready via ${usedProvider}`;
    elements.agentPrompt.value = data.agentPrompt;
    elements.copyPromptLabel.textContent = "Copy prompt";
    elements.translatedText.textContent = data.translatedText || transcript;
    elements.translationPreview.classList.toggle("hidden", !elements.translatedText.textContent);
    elements.emptyOutput.classList.add("hidden");
    elements.result.classList.remove("hidden");
    renderInsights(data);
    updateTokenEstimate();
    showToast(data.fallbackFrom
      ? `${data.fallbackFrom === "gemini" ? "Gemini" : "Groq"} was busy, so ${usedProvider === "gemini" ? "Gemini" : "Groq"} completed your prompt automatically.`
      : "Your agent-ready prompt is complete.");
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    state.busy = false;
    elements.compileButton.disabled = false;
    elements.compileButton.querySelector("span").textContent = "Compile my prompt";
  }
}

async function translateText(transcript, autoPaste = false) {
  if (state.busy) return;
  if (!transcript?.trim()) {
    showToast("Record or type something to translate first.", "error");
    elements.transcript.focus();
    return;
  }
  if (!providerReady(state.compilerProvider)) {
    const providerName = state.compilerProvider === "gemini" ? "Gemini" : "Groq";
    const message = `Add your ${providerName} API key in Settings before translating.`;
    showToast(message, "error");
    desktopNotify(message);
    window.promptDeDesktop?.show();
    openSettings();
    return;
  }

  const config = compilerConfig();
  state.busy = true;
  elements.translateButton.disabled = true;
  elements.translateButton.textContent = "Translating…";
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json", ...requestKeyHeaders() },
      body: JSON.stringify({
        provider: state.compilerProvider,
        model: config.model,
        transcript,
        targetLanguage: elements.translationLanguage.value,
        tone: elements.translationTone.value,
      }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Translation failed.");

    const languageLabel = data.targetLanguage === "hindi" ? "Hindi" : "English";
    const toneLabel = `${data.tone[0].toUpperCase()}${data.tone.slice(1)}`;
    elements.resultTitle.textContent = `${languageLabel} translation`;
    elements.resultBadge.textContent = `${toneLabel} · ${data.providerUsed}`;
    elements.agentPrompt.value = data.translation;
    elements.translatedText.textContent = data.translation;
    elements.copyPromptLabel.textContent = "Copy translation";
    elements.translationPreview.classList.add("hidden");
    elements.emptyOutput.classList.add("hidden");
    elements.result.classList.remove("hidden");
    elements.resultInsights.replaceChildren();
    elements.resultNotes.classList.add("hidden");
    updateTokenEstimate();

    if (autoPaste && window.promptDeDesktop) {
      const pasteResult = await window.promptDeDesktop.pasteText(data.translation);
      const message = pasteResult.pasted
        ? `${languageLabel} translation pasted.`
        : pasteResult.message;
      desktopNotify(message);
      showToast(message, pasteResult.pasted ? "success" : "error");
    } else {
      showToast(`${languageLabel} translation ready.`);
    }
  } catch (error) {
    showToast(error.message, "error");
    desktopNotify(error.message);
  } finally {
    state.busy = false;
    elements.translateButton.disabled = false;
    elements.translateButton.textContent = "Translate only";
  }
}

async function copyPrompt() {
  const text = elements.agentPrompt.value.trim();
  if (!text) {
    showToast("Create a prompt or translation before copying it.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
    elements.copyPromptLabel.textContent = "Copied";
    showToast("Prompt copied to clipboard.");
    setTimeout(() => { elements.copyPromptLabel.textContent = "Copy prompt"; }, 1600);
  } catch {
    elements.agentPrompt.select();
    document.execCommand("copy");
    showToast("Prompt copied to clipboard.");
  }
}

async function copyTranslation() {
  const text = elements.translatedText.textContent.trim();
  if (!text) {
    showToast("Create a translation before copying it.", "error");
    return;
  }
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const temporary = document.createElement("textarea");
    temporary.value = text;
    temporary.setAttribute("readonly", "");
    temporary.style.position = "fixed";
    temporary.style.opacity = "0";
    document.body.append(temporary);
    temporary.select();
    document.execCommand("copy");
    temporary.remove();
  }
  showToast("Translation copied to clipboard.");
}

function rememberWebKey(provider, value) {
  if (!value) return;
  state.userKeys[provider] = value;
  try {
    sessionStorage.setItem(`promptde:${provider}ApiKey`, value);
  } catch {
    // The key still remains available in memory when session storage is unavailable.
  }
}

function saveTranslationPreferences() {
  try {
    localStorage.setItem("promptde:translationLanguage", elements.translationLanguage.value);
    localStorage.setItem("promptde:translationTone", elements.translationTone.value);
  } catch {
    // The current selections still work for this session.
  }
}

function loadPreferences() {
  try {
    const language = localStorage.getItem("promptde:translationLanguage");
    const tone = localStorage.getItem("promptde:translationTone");
    if (["english", "hindi"].includes(language)) elements.translationLanguage.value = language;
    if (["natural", "formal", "informal"].includes(tone)) elements.translationTone.value = tone;
    const provider = localStorage.getItem("promptde:compilerProvider");
    return ["gemini", "groq"].includes(provider) ? provider : "gemini";
  } catch {
    return "gemini";
  }
}

async function toggleTranslationPaste() {
  if (state.mediaRecorder?.state === "recording") {
    if (state.recordingTarget !== "translatePaste") {
      desktopNotify("Finish the current recording before starting translation mode.");
      return;
    }
    desktopNotify("Recording stopped. Transcribing…");
    stopRecording();
    return;
  }
  if (state.busy) {
    desktopNotify("PromptDe is still processing the previous request.");
    return;
  }
  if (!providerReady("groq")) {
    desktopNotify("Add a Groq API key before using voice translation.");
    window.promptDeDesktop?.show();
    openSettings();
    return;
  }
  if (!providerReady(state.compilerProvider)) {
    const availableProvider = providerReady("gemini") ? "gemini" : providerReady("groq") ? "groq" : null;
    if (availableProvider) setCompilerProvider(availableProvider);
    else {
      desktopNotify("Add a Gemini or Groq compiler key before using translation.");
      window.promptDeDesktop?.show();
      openSettings();
      return;
    }
  }
  await startRecording("translatePaste");
}

async function saveProviderSettings() {
  const groqKey = elements.groqApiKey.value.trim();
  const geminiKey = elements.geminiApiKey.value.trim();
  const invalidKey = [groqKey, geminiKey].find((value) => value.length > 512 || /\s/u.test(value));
  if (invalidKey) {
    showToast("API keys cannot contain spaces and must be under 512 characters.", "error");
    return;
  }

  elements.saveSettings.disabled = true;
  elements.saveSettings.textContent = "Saving…";
  try {
    if (window.promptDeDesktop) {
      const configured = await window.promptDeDesktop.saveApiKeys({ groqKey, geminiKey });
      state.serverKeys.groq = Boolean(configured.groqConfigured);
      state.serverKeys.gemini = Boolean(configured.geminiConfigured);
    } else {
      rememberWebKey("groq", groqKey);
      rememberWebKey("gemini", geminiKey);
    }
    elements.groqApiKey.value = "";
    elements.geminiApiKey.value = "";
    updateConfigurationStatus();
    closeSettings();
    showToast(window.promptDeDesktop ? "API keys saved securely on this device." : "API keys are ready for this browser session.");
  } catch (error) {
    showToast(error.message || "Could not save the API keys.", "error");
  } finally {
    elements.saveSettings.disabled = false;
    elements.saveSettings.textContent = "Save keys and settings";
  }
}

elements.settingsButton.addEventListener("click", openSettings);
elements.closeSettings.addEventListener("click", closeSettings);
elements.drawerBackdrop.addEventListener("click", closeSettings);
elements.saveSettings.addEventListener("click", saveProviderSettings);
document.querySelectorAll("[data-provider]").forEach((button) => {
  button.addEventListener("click", () => setCompilerProvider(button.dataset.provider));
});
document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    state.promptMode = button.dataset.mode;
    document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("active", item === button));
  });
});
elements.recordButton.addEventListener("click", () => {
  if (state.mediaRecorder?.state === "recording") stopRecording();
  else startRecording();
});
elements.transcript.addEventListener("input", updateWordCount);
elements.clearTranscript.addEventListener("click", clearTranscript);
elements.agentPrompt.addEventListener("input", updateTokenEstimate);
elements.compileButton.addEventListener("click", compilePrompt);
elements.translateButton.addEventListener("click", () => translateText(elements.transcript.value));
elements.copyButton.addEventListener("click", copyPrompt);
elements.copyTranslation.addEventListener("click", copyTranslation);
elements.translationLanguage.addEventListener("change", saveTranslationPreferences);
elements.translationTone.addEventListener("change", saveTranslationPreferences);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSettings();
  if (!window.promptDeDesktop && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key === "Backspace") {
    event.preventDefault();
    clearTranscript();
    return;
  }
  if (!window.promptDeDesktop && (event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "c") {
    event.preventDefault();
    if (state.mediaRecorder?.state === "recording") stopRecording();
    else startRecording("context");
    return;
  }
  if (!window.promptDeDesktop && (event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "e") {
    event.preventDefault();
    copyTranslation();
    return;
  }
  if (!window.promptDeDesktop && (event.ctrlKey || event.metaKey) && event.altKey && event.key.toLowerCase() === "p") {
    event.preventDefault();
    copyPrompt();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    compilePrompt();
  }
});

updateWordCount();
updateTokenEstimate();
const preferredCompilerProvider = loadPreferences();
if (!window.promptDeDesktop) {
  try {
    state.userKeys.groq = sessionStorage.getItem("promptde:groqApiKey") || "";
    state.userKeys.gemini = sessionStorage.getItem("promptde:geminiApiKey") || "";
  } catch {
    // Continue with in-memory keys only when session storage is unavailable.
  }
}
setCompilerProvider(preferredCompilerProvider);

fetch("/api/config")
  .then((response) => response.json())
  .then((config) => {
    state.serverKeys.groq = Boolean(config.groqConfigured);
    state.serverKeys.gemini = Boolean(config.geminiConfigured);
    updateConfigurationStatus();
  })
  .catch(() => {});

if (window.promptDeDesktop) {
  elements.keyStorageNote.innerHTML = "<strong>Private desktop storage</strong><br />Keys are saved only in PromptDe’s owner-readable local configuration file and are never exposed back to the page.";
  elements.keyStorageHint.textContent = "Saved keys become active immediately. Leave a key blank to keep the currently saved value.";
  elements.openConfigFolder.classList.remove("hidden");
  elements.openConfigFolder.addEventListener("click", () => window.promptDeDesktop.openConfigFolder());
  window.promptDeDesktop.getInfo().then((info) => {
    elements.desktopShortcut.classList.remove("hidden");
    elements.desktopShortcut.title = `Global recording shortcut: ${info.shortcut}`;
  }).catch(() => {});
  window.promptDeDesktop.onActivate(() => {
    if (state.mediaRecorder?.state === "recording") {
      stopRecording();
      return;
    }
    state.desktopAutoCompile = true;
    startRecording();
  });
  window.promptDeDesktop.onClearTranscript(clearTranscript);
  window.promptDeDesktop.onRecordContext(() => {
    if (state.mediaRecorder?.state === "recording") stopRecording();
    else startRecording("context");
  });
  window.promptDeDesktop.onCopyTranslation(copyTranslation);
  window.promptDeDesktop.onCopyPrompt(copyPrompt);
  window.promptDeDesktop.onTranslatePaste(toggleTranslationPaste);
}
