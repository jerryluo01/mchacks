const chatEl = document.getElementById("chat");
const inputEl = document.getElementById("input");
const sendBtn = document.getElementById("sendBtn");
const refreshBtn = document.getElementById("refreshBtn");
const statusEl = document.getElementById("status");
const modeSelect = document.getElementById("modeSelect");
const courseSubtitle = document.getElementById("courseSubtitle");

let currentCourse = null; // { courseId, name? }
let isBusy = false;

function setStatus(text, kind = "") {
  statusEl.textContent = text || "";
  statusEl.classList.remove("warn", "err");
  if (kind) statusEl.classList.add(kind);
}

function setBusy(busy) {
  isBusy = busy;
  sendBtn.disabled = busy;
  refreshBtn.disabled = busy;
  if (busy) setStatus("Thinking…");
  else setStatus("");
}

function addBubble(role, text, meta = "") {
  const bubble = document.createElement("div");
  bubble.className = `bubble ${role}`;
  bubble.textContent = text;

  if (meta) {
    const m = document.createElement("div");
    m.className = "meta";
    m.textContent = meta;
    bubble.appendChild(m);
  }

  chatEl.appendChild(bubble);
  chatEl.scrollTop = chatEl.scrollHeight;
}

function addCodeBlock(role, header, code) {
  const wrap = document.createElement("div");
  wrap.className = `bubble ${role}`;
  wrap.textContent = header;

  const pre = document.createElement("pre");
  pre.className = "code";
  pre.textContent = code;

  wrap.appendChild(pre);
  chatEl.appendChild(wrap);
  chatEl.scrollTop = chatEl.scrollHeight;
}

async function sendToBackground(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (res) => {
      const err = chrome.runtime.lastError;
      if (err) return reject(new Error(err.message));
      resolve(res);
    });
  });
}

async function bootstrap() {
  // Ask background if it knows the current course already (from content script)
  try {
    const res = await sendToBackground({ type: "UI_INIT" });
    if (res?.course) {
      currentCourse = res.course;
      courseSubtitle.textContent = currentCourse.name
        ? `${currentCourse.name} (${currentCourse.courseId})`
        : `Course ${currentCourse.courseId}`;
    } else {
      courseSubtitle.textContent = "Open a Google Classroom course to connect";
    }

    // Optional: show a starter message
    addBubble(
      "bot",
      "Ask me anything about your class materials. Pick “Quiz me” to generate questions."
    );
  } catch (e) {
    addBubble("bot", "Could not connect to background service worker.");
    setStatus(e.message, "err");
  }
}

async function handleSend() {
  const text = inputEl.value.trim();
  if (!text || isBusy) return;

  inputEl.value = "";
  addBubble("user", text);

  const mode = modeSelect.value; // "explain" | "quiz"
  setBusy(true);

  try {
    const res = await sendToBackground({
      type: "CHAT",
      mode,
      courseId: currentCourse?.courseId || null,
      message: text,
    });

    if (!res) {
      addBubble("bot", "No response from background.");
      setBusy(false);
      return;
    }

    if (res.error) {
      addBubble("bot", `Error: ${res.error}`);
      setStatus(res.error, "err");
      setBusy(false);
      return;
    }

    // Update course if background learned it
    if (res.course) {
      currentCourse = res.course;
      courseSubtitle.textContent = currentCourse.name
        ? `${currentCourse.name} (${currentCourse.courseId})`
        : `Course ${currentCourse.courseId}`;
    }

    // Render answer
    if (typeof res.answer === "string" && res.answer.trim()) {
      addBubble("bot", res.answer);
    } else {
      addBubble("bot", "Done.");
    }

    // Optional: show sources / retrieved chunks (nice for demo)
    if (res.sources && Array.isArray(res.sources) && res.sources.length) {
      const pretty = res.sources
        .slice(0, 5)
        .map((s, i) => {
          const title = s.title || `Source ${i + 1}`;
          const snippet = (s.snippet || "").slice(0, 220);
          return `#${i + 1} ${title}\n${snippet}`;
        })
        .join("\n\n---\n\n");
      addCodeBlock("bot", "Context used:", pretty);
    }

    setBusy(false);
  } catch (e) {
    addBubble("bot", `Background error: ${e.message}`);
    setStatus(e.message, "err");
    setBusy(false);
  }
}

async function handleRefresh() {
  if (isBusy) return;
  setBusy(true);

  try {
    const res = await sendToBackground({
      type: "REFRESH_COURSE",
      courseId: currentCourse?.courseId || null,
    });

    if (res?.error) {
      addBubble("bot", `Refresh failed: ${res.error}`);
      setStatus(res.error, "err");
    } else {
      addBubble("bot", "Refreshed course cache.");
      setStatus("Cache refreshed", "warn");
    }
  } catch (e) {
    addBubble("bot", `Refresh error: ${e.message}`);
    setStatus(e.message, "err");
  } finally {
    setBusy(false);
  }
}

// Enter to send, Shift+Enter newline
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
});

sendBtn.addEventListener("click", handleSend);
refreshBtn.addEventListener("click", handleRefresh);

// Listen for background updates (e.g., content script detected course change)
chrome.runtime.onMessage.addListener((msg) => {
  if (msg?.type === "COURSE_CHANGED" && msg.course) {
    currentCourse = msg.course;
    courseSubtitle.textContent = currentCourse.name
      ? `${currentCourse.name} (${currentCourse.courseId})`
      : `Course ${currentCourse.courseId}`;
    addBubble("bot", `Connected to course: ${courseSubtitle.textContent}`);
  }
});

bootstrap();
