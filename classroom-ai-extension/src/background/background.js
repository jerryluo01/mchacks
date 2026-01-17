console.log("Background service worker loaded!");

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "hello") {
    console.log("Received hello from side panel/content script:", msg.data);
    sendResponse({ reply: "Hello from background!" });
  }
});
