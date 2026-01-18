console.log("Background service worker loaded!");

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
        const context = await getCourseContext(msg.courseId || currentCourse?.courseId);
        
        const answer = await queryLLM(question, context);
        
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
async function getCourseContext(courseId) {
  if (!courseId) return "No course context available.";
  // TODO: Retrieve course materials, assignments, etc. from storage/API
  // For now, return placeholder
  return `Course ID: ${courseId}`;
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

async function queryLLM(question, context) {
  const apiKey = import.meta.env.GEM_KEY;
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
                text: `Context:\n${context}\n\nQuestion:\n${question}`
              }
            ]
          }
        ]
      })
    });
        
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No response from Gemini";
  } catch(err) {
    console.error("LLM query failed:", err);
    return "Error: could not fetch answer";
  }
}
