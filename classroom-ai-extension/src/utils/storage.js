const NS = "classroom_ai"; // change if you want

function k(key) {
  return `${NS}:${key}`;
}

export async function getLocal(key, defaultValue = null) {
  const out = await chrome.storage.local.get(k(key));
  const val = out[k(key)];
  return val === undefined ? defaultValue : val;
}

export async function setLocal(key, value) {
  await chrome.storage.local.set({ [k(key)]: value });
}

export async function removeLocal(key) {
  await chrome.storage.local.remove(k(key));
}

export async function clearNamespace() {
  const all = await chrome.storage.local.get(null);
  const keys = Object.keys(all).filter((kk) => kk.startsWith(`${NS}:`));
  if (keys.length) await chrome.storage.local.remove(keys);
}

// Convenience helpers for course-scoped storage
export async function getCourseCache(courseId, defaultValue = null) {
  return getLocal(`course:${courseId}`, defaultValue);
}

export async function setCourseCache(courseId, value) {
  return setLocal(`course:${courseId}`, value);
}

export async function removeCourseCache(courseId) {
  return removeLocal(`course:${courseId}`);
}
