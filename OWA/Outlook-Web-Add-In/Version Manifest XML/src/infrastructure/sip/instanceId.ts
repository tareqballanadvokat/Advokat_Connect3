/**
 * Persistent per-instance identifier for the SIP/signaling connection.
 *
 * Distinguishes concurrent add-in instances (e.g. two local desktop Outlook
 * windows, or web + desktop) that would otherwise share the same client IP
 * at the signaling server. Generated once per window/task-pane and kept in
 * sessionStorage: sessionStorage is scoped per browsing context, so each
 * WebView2/browser window gets its own value even though desktop Outlook
 * windows share one WebView2 profile (and thus one localStorage) per user.
 * Survives reloads within the same window; a new window gets a new ID.
 */

const STORAGE_KEY = "adv_sip_instance_id";

let cachedInstanceId: string | null = null;

function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

export function getInstanceId(): string {
  if (cachedInstanceId) {
    return cachedInstanceId;
  }

  const stored = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
  if (stored) {
    cachedInstanceId = stored;
    return cachedInstanceId;
  }

  const generated = generateId();
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(STORAGE_KEY, generated);
  }
  cachedInstanceId = generated;
  return cachedInstanceId;
}
