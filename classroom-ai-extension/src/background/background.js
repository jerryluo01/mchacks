console.log("Background service worker loaded!");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Keep the message channel open for async response
  // MUST return true BEFORE any async operations
  (async () => {
    try {
      if (msg.type === "CLASSROOM_DATA") {
        const classes = await fetchClassroomData(msg.token); // your API call
        sendResponse({ success: true, classes });
      } else if (msg.type === "askQuestion") {
        const answer = await queryLLM(msg.question, msg.context);
        sendResponse({ success: true, answer });
      } else {
        // Handle unknown message types
        sendResponse({ success: false, error: "Unknown message type" });
      }
    } catch (err) {
      console.error("Error in background:", err);
      sendResponse({ success: false, error: err.message });
    }
  })();
  
  return true; // Indicates we will send a response asynchronously
});

// Example placeholder functions
async function fetchClassroomData(token) {
    const URL = "https://classroom.googleapis.com/v1/courses"
    
    const response = await fetch(URL, {
        headers: {Authorization: `Bearer ${token}`}
    })
    const data = await response.json();

    return (data.courses || []).map(course => ({id: course.id,
        name: course.name,
        description: course.description || ""
    }))
}

async function queryLLM(question, context) {
    const apiKey = import.meta.env.GEM_KEY;
    const URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
  try {
    const response = await fetch(URL, {
        method: "POST",
        headers: {"Content-Type": "application/json",
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
  }
  catch(err) {
    console.error("LLM query failed:", err);
    return "Error: could not fetch answer";
  }
  
}
