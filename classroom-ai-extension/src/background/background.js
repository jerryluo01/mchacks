console.log("Background service worker loaded!");

// Debug: Check API key availability at load time
// Note: import.meta.env is replaced at BUILD TIME, not runtime
// So this will show "undefined" if VITE_GEM_KEY wasn't set during build
const apiKeyCheck = import.meta.env.VITE_GEM_KEY;
console.log("API Key availability:", {
  isDefined: !!apiKeyCheck,
  length: apiKeyCheck?.length || 0,
  preview: apiKeyCheck ? `${apiKeyCheck.substring(0, 8)}...` : "undefined - Key not set during build"
});
// Debug: Check if API key is available (will be replaced at build time)
console.log("API Key check:", {
  hasViteKey: !!import.meta.env.VITE_GEM_KEY,
  keyLength: import.meta.env.VITE_GEM_KEY ? import.meta.env.VITE_GEM_KEY.length : 0,
  keyPreview: import.meta.env.VITE_GEM_KEY ? `${import.meta.env.VITE_GEM_KEY.substring(0, 10)}...` : "undefined"
});

// Store current course state
let currentCourse = null; // { courseId, name }

// Open sidepanel when extension icon is clicked
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Keep the message channel open for async response
  // MUST return true BEFORE any async operations
  (async () => {
    try {
      if (msg.type === "UI_INIT") {
        // Return current course if known
        sendResponse({ course: currentCourse || null });
      } else if (msg.type === "CLASSROOM_DATA") {
        // Handle course data from content script or API token request
        if (msg.data) {
          // From content script: extract courseId from URL
          const url = msg.data.url || "";
          const courseIdMatch = url.match(/\/c\/([^/?]+)/);
          const courseId = courseIdMatch ? courseIdMatch[1] : null;
          
          if (courseId) {
            currentCourse = {
              courseId,
              name: msg.data.classInfo?.name || null,
              data: msg.data
            };
            // Notify sidepanel if it's open
            chrome.runtime.sendMessage({
              type: "COURSE_CHANGED",
              course: currentCourse,
            }).catch(() => {}); // Ignore if no listeners
          }
        } else if (msg.token) {
          // API token request: fetch courses
          const classes = await fetchClassroomData(msg.token);
          sendResponse({ success: true, classes });
          return;
        }
        sendResponse({ success: true });
      } else if (msg.type === "CHAT") {
        // sidepanel sends: { type: "CHAT", mode, courseId, message }
        // Need to get context based on courseId, then call LLM
        const question = msg.message; // sidepanel uses "message", not "question"
        const context = await getCourseContext(msg.data || currentCourse?.data);
        const mode = msg.mode || "explain"; // "explain" | "quiz"
        
        console.log("Chat request:", { question, context, mode });
        const answer = await queryLLM(question, context, mode);
        console.log("LLM response:", answer);
        
        // Return format expected by sidepanel: { answer, course?, sources?, error? }
        sendResponse({
          answer,
          course: currentCourse || undefined,
          sources: [], // TODO: add sources when implementing RAG/retrieval
        });
      } else if (msg.type === "REFRESH_COURSE") {
        // Refresh course data/cache
        const courseId = msg.courseId || currentCourse?.courseId;
        if (courseId) {
          // TODO: Implement cache refresh logic
          sendResponse({ success: true });
        } else {
          sendResponse({ error: "No course selected" });
        }
      } else {
        // Handle unknown message types
        sendResponse({ error: "Unknown message type" });
      }
    } catch (err) {
      console.error("Error in background:", err);
      sendResponse({ error: err.message });
    }
  })();
  
  return true; // Indicates we will send a response asynchronously
});

// Helper function to get course context (placeholder - implement with your data source)
async function getCourseContext(courseInfo) {
  if (!courseInfo) return "No course context available.";

  const { classInfo, assignments, materials } = courseInfo;

  let context = "";

  if (classInfo?.name) {
    context += `Class: ${classInfo.name}\n\n`;
  }

  if (assignments?.length) {
    context += "Assignments:\n";
    assignments.slice(0, 10).forEach(a => {
      context += `- ${a.title}${a.date ? " (Due: " + a.date + ")" : ""}\n`;
    });
    context += "\n";
  }

  if (materials?.length) {
    context += "Materials:\n";
    materials.slice(0, 10).forEach(m => {
      context += `- ${m.title}\n`;
    });
  }

  return context.trim();
}


// Example placeholder functions
async function fetchClassroomData(token) {
  const URL = "https://classroom.googleapis.com/v1/courses";
  
  const response = await fetch(URL, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await response.json();

  return (data.courses || []).map(course => ({
    id: course.id,
    name: course.name,
    description: course.description || ""
  }));
}

async function queryLLM(question, context, mode = "explain") {
  // Try VITE_ prefixed env var first, then fallback to GEM_KEY
  const apiKey = import.meta.env.VITE_GEM_KEY;
  
  if (!apiKey) {
    console.error("Gemini API key not found. Set VITE_GEM_KEY in environment or .env file");
    return "Error: API key not configured. Please set VITE_GEM_KEY environment variable.";
  }
  
  // Build prompt based on mode
  let prompt;
  if (mode === "quiz") {
    // Quiz mode: generate practice questions
    prompt = `Based on the following course context, generate 3-5 practice questions with brief answers that would help test understanding of the material.

Context:\n${context}\n\nTopic/Question:\n${question}

Generate questions in the following format:
1. [Question]
   Answer: [Brief answer]

2. [Question]
   Answer: [Brief answer]

...`;
  } else {
    // Explain mode: provide explanation/answer
    prompt = `Context:\n${context}\n\nQuestion:\n${question}

Please provide a clear and helpful explanation or answer.`;
  }
  
  const URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
  
  try {
    const response = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ]
      })
    });
    
    // Check if response is OK
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Gemini API error:", response.status, response.statusText, errorData);
      return `Error: Gemini API returned ${response.status} ${response.statusText}. ${errorData.error?.message || ''}`;
    }
        
    const data = await response.json();
    
    // Better error checking for response structure
    if (!data.candidates || !data.candidates[0]) {
      console.error("Unexpected Gemini response structure:", data);
      return `Error: Unexpected response format. Check console for details.`;
    }
    
    const text = data.candidates[0]?.content?.parts?.[0]?.text;
    if (!text) {
      console.error("No text in Gemini response:", data);
      return "No response from Gemini - response was empty.";
    }
    
    return text;
  } catch(err) {
    console.error("LLM query failed:", err);
    return `Error: could not fetch answer - ${err.message}`;
  }
}
