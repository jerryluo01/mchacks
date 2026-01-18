// Content script for detecting and interacting with Google Classroom pages

/**
 * Detects if the current page is a Google Classroom page
 * @returns {boolean} True if on a Google Classroom page
 */
function isClassroomPage() {
  return window.location.hostname.includes('classroom.google.com');
}

/**
 * Extracts classroom information from the current page
 * @returns {Object} Classroom data including class name, assignments, materials
 */
function extractClassroomData() {
  if (!isClassroomPage()) {
    return null;
  }

  const data = {
    url: window.location.href,
    timestamp: new Date().toISOString(),
    classInfo: {},
    assignments: [],
    materials: []
  };

  // Extract class name from the page
  const classNameElement = document.querySelector('[data-course-name], .h2ZIHd, [aria-label*="class"]');
  if (classNameElement) {
    data.classInfo.name = classNameElement.textContent?.trim();
  }

  // Extract page title as fallback
  if (!data.classInfo.name) {
    data.classInfo.name = document.title;
  }

  // Extract assignments from the stream
  const assignmentElements = document.querySelectorAll('[data-item-id], [role="listitem"]');
  assignmentElements.forEach((element, index) => {
    const titleElement = element.querySelector('h3, [data-title], .YVvGBb');
    const dateElement = element.querySelector('[data-date], .OVDEZ');
    const descriptionElement = element.querySelector('[data-description], .dL5kDf');
    
    if (titleElement) {
      const assignment = {
        id: element.getAttribute('data-item-id') || `item-${index}`,
        title: titleElement.textContent?.trim(),
        date: dateElement?.textContent?.trim(),
        description: descriptionElement?.textContent?.trim(),
        element: element.textContent?.trim()
      };
      data.assignments.push(assignment);
    }
  });

  // Extract materials/attachments
  const materialLinks = document.querySelectorAll('a[href*="drive.google.com"], a[href*="docs.google.com"]');
  materialLinks.forEach((link, index) => {
    data.materials.push({
      id: `material-${index}`,
      title: link.textContent?.trim() || link.getAttribute('aria-label'),
      url: link.href,
      type: link.href.includes('docs.google.com') ? 'document' : 'drive'
    });
  });

  return data;
}

/**
 * Sends classroom data to the background script
 * @param {Object} data - Classroom data to send
 */
function sendToBackground(data) {
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.sendMessage({
      type: 'CLASSROOM_DATA',
      data: data
    }).catch(err => {
      console.warn('Failed to send message to background:', err);
    });
  }
}

/**
 * Listens for messages from background script or popup
 */
function setupMessageListener() {
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'EXTRACT_CLASSROOM_DATA') {
        const data = extractClassroomData();
        sendResponse({ success: true, data });
        return true; // Keep channel open for async response
      }
      
      if (message.type === 'CHECK_CLASSROOM_PAGE') {
        sendResponse({ isClassroomPage: isClassroomPage() });
        return true;
      }
    });
  }
}

/**
 * Observes DOM changes to detect dynamic content loading
 */
function setupDOMObserver() {
  if (!isClassroomPage()) {
    return;
  }

  const observer = new MutationObserver((mutations) => {
    // Throttle extraction to avoid too frequent updates
    clearTimeout(window.classroomExtractionTimeout);
    window.classroomExtractionTimeout = setTimeout(() => {
      const data = extractClassroomData();
      if (data && data.assignments.length > 0) {
        sendToBackground(data);
      }
    }, 2000); // Wait 2 seconds after DOM changes
  });

  // Start observing the document body
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Initializes the content script
 */
function init() {
  if (!isClassroomPage()) {
    return;
  }

  console.log('Classroom AI Extension: Content script loaded');
  
  // Set up message listener
  setupMessageListener();
  
  // Set up DOM observer for dynamic content
  setupDOMObserver();
  
  // Extract initial data
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      setTimeout(() => {
        const data = extractClassroomData();
        if (data) {
          sendToBackground(data);
        }
      }, 3000); // Wait for Classroom to load
    });
  } else {
    setTimeout(() => {
      const data = extractClassroomData();
      if (data) {
        sendToBackground(data);
      }
    }, 3000);
  }
}

// Initialize when script loads
init();

// Export functions for potential use in other modules

console.log("content script loaded");