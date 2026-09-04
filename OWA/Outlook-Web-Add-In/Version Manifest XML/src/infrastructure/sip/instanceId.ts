/**
 * Persistent per-instance identifier for the SIP/signaling connection.
 *
 * Distinguishes concurrent add-in instances (e.g. Outlook web + local desktop
 * Outlook) that would otherwise share the same client IP at the signaling
 * server. Generated once and kept in localStorage so it survives task pane
 * reloads but stays unique per browser/WebView2 profile.
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

  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  if (stored) {
    cachedInstanceId = stored;
    return cachedInstanceId;
  }

  const generated = generateId();
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(STORAGE_KEY, generated);
  }
  cachedInstanceId = generated;
  return cachedInstanceId;
}
