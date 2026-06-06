// Lightweight wrapper around the browser Notification API.
// Used by the in-app scheduler (src/lib/notification-scheduler.ts).

export type NotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

export interface NotificationSettings {
  enabled: boolean;
  tasksEnabled: boolean;
  tasksWindowHours: number; // 1, 24, 72
  dailyEnabled: boolean;
  dailyHour: number; // 0-23
}

export const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  tasksEnabled: true,
  tasksWindowHours: 24,
  dailyEnabled: true,
  dailyHour: 9,
};

const SETTINGS_KEY = "notifications:settings";

export function loadSettings(): NotificationSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(s: NotificationSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("notifications:settings-changed"));
}

export function getPermissionState(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

export async function requestPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission as NotificationPermissionState;
  }
  const res = await Notification.requestPermission();
  return res as NotificationPermissionState;
}

export interface NotifyOptions {
  body?: string;
  tag?: string;
  url?: string;
  silent?: boolean;
  requireInteraction?: boolean;
}

export function notify(title: string, opts: NotifyOptions = {}) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body: opts.body,
      tag: opts.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      silent: opts.silent,
      requireInteraction: opts.requireInteraction,
    });
    n.onclick = () => {
      window.focus();
      if (opts.url) {
        window.location.assign(opts.url);
      }
      n.close();
    };
  } catch (e) {
    console.warn("notify failed", e);
  }
}

// Idempotency helpers — prevent duplicate notifications.
const SENT_KEY = "notifications:sent";

function loadSent(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveSent(map: Record<string, number>) {
  // Garbage collect entries older than 30 days.
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const cleaned: Record<string, number> = {};
  for (const [k, v] of Object.entries(map)) if (v > cutoff) cleaned[k] = v;
  localStorage.setItem(SENT_KEY, JSON.stringify(cleaned));
}

export function hasSent(key: string): boolean {
  return key in loadSent();
}

export function markSent(key: string) {
  const m = loadSent();
  m[key] = Date.now();
  saveSent(m);
}
