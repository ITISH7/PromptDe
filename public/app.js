const elements = {
  settingsButton: document.querySelector("#settingsButton"),
  desktopShortcut: document.querySelector("#desktopShortcut"),
  settingsDrawer: document.querySelector("#settingsDrawer"),
  drawerBackdrop: document.querySelector("#drawerBackdrop"),
  closeSettings: document.querySelector("#closeSettings"),
  saveSettings: document.querySelector("#saveSettings"),
  groqStatus: document.querySelector("#groqStatus"),
  compilerStatus: document.querySelector("#compilerStatus"),
  speechModel: document.querySelector("#speechModel"),
  geminiModel: document.querySelector("#geminiModel"),
  groqModel: document.querySelector("#groqModel"),
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

function updateConfigurationStatus() {
  setStatus(
    elements.groqStatus,
    state.serverKeys.groq,
    "Groq key loaded from .env",
    "GROQ_API_KEY is missing from .env",
  );
  const compilerReady = state.compilerProvider === "gemini" ? state.serverKeys.gemini : state.serverKeys.groq;
  setStatus(
    elements.compilerStatus,
    compilerReady,
    `${state.compilerProvider === "gemini" ? "Gemini" : "Groq"} compiler key loaded`,
    `${state.compilerProvider === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY"} is missing from .env`,
  );
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
  if (!state.serverKeys.groq) {
    showToast("Add GROQ_API_KEY to .env and restart the server.", "error");
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
    elements.recordTitle.textContent = target === "context" ? "Listening for project context…" : "Listening… tap to stop";
    elements.recordHint.textContent = target === "context" ? "Press the shortcut again to stop" : "Speak in Hindi, English, or Hinglish";
    elements.recordButton.setAttribute("aria-label", "Stop recording");
    state.timerId = setInterval(() => {
      const elapsed = (Date.now() - state.startedAt) / 1000;
      elements.timer.textContent = formatTimer(elapsed);
      if (elapsed >= 300) stopRecording();
    }, 250);
  } catch (error) {
    state.recordingTarget = "transcript";
    showToast(error.name === "NotAllowedError" ? "Microphone permission was denied." : `Could not start the microphone: ${error.message}`, "error");
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
  try {
    const response = await fetch("/api/transcribe", {
      method: "POST",
      body: formData,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Transcription failed.");
    const destination = recordingTarget === "context" ? elements.context : elements.transcript;
    const existing = destination.value.trim();
    destination.value = [existing, data.text.trim()].filter(Boolean).join(existing ? "\n" : "");
    if (recordingTarget === "context") {
      elements.contextDetails.open = true;
      destination.focus();
    } else {
      updateWordCount();
    }
    shouldAutoCompile = recordingTarget === "transcript" && state.desktopAutoCompile;
    state.desktopAutoCompile = false;
    showToast(recordingTarget === "context"
      ? "Voice transcription added to project context."
      : shouldAutoCompile ? "Transcription ready. Creating your prompt…" : "Transcription ready. Review it, then compile your prompt.");
  } catch (error) {
    state.desktopAutoCompile = false;
    showToast(error.message, "error");
  } finally {
    state.recordingTarget = "transcript";
    resetRecorderUi();
  }
  if (shouldAutoCompile) await compilePrompt();
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
  const serverKeyAvailable = state.compilerProvider === "gemini" ? state.serverKeys.gemini : state.serverKeys.groq;
  if (!serverKeyAvailable) {
    showToast(`Add ${state.compilerProvider === "gemini" ? "GEMINI_API_KEY" : "GROQ_API_KEY"} to .env and restart the server.`, "error");
    openSettings();
    return;
  }

  state.busy = true;
  elements.compileButton.disabled = true;
  elements.compileButton.querySelector("span").textContent = "Compiling…";
  try {
    const headers = { "content-type": "application/json" };
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

async function copyPrompt() {
  const text = elements.agentPrompt.value.trim();
  if (!text) {
    showToast("Compile a prompt before copying it.", "error");
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
    showToast("Compile a prompt before copying its translation.", "error");
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

elements.settingsButton.addEventListener("click", openSettings);
elements.closeSettings.addEventListener("click", closeSettings);
elements.drawerBackdrop.addEventListener("click", closeSettings);
elements.saveSettings.addEventListener("click", () => {
  closeSettings();
  showToast("Settings are active for this tab.");
});
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
elements.copyButton.addEventListener("click", copyPrompt);
elements.copyTranslation.addEventListener("click", copyTranslation);
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
setCompilerProvider("gemini");

fetch("/api/config")
  .then((response) => response.json())
  .then((config) => {
    state.serverKeys.groq = Boolean(config.groqConfigured);
    state.serverKeys.gemini = Boolean(config.geminiConfigured);
    updateConfigurationStatus();
  })
  .catch(() => {});

if (window.promptDeDesktop) {
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
}
