import Constants from "expo-constants";
import { Platform } from "react-native";
import { apiPaths } from "@tvchat/shared";

const configured = Constants.expoConfig?.extra?.apiBaseUrl as string | undefined;

export function getApiBase(): string {
  if (configured && !configured.includes("localhost")) {
    return configured.replace(/\/$/, "");
  }
  if (Platform.OS === "android") {
    return "http://10.0.2.2:3001";
  }
  return (configured ?? "http://localhost:3001").replace(/\/$/, "");
}

/** Resolve API-relative media paths (e.g. `/uploads/...`) for playback on device. */
export function mediaUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const base = getApiBase().replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}

const USER_HEADER = "X-User-Id";
const DISPLAY_HEADER = "X-User-Display-Name";
const DEMO_USER = "demo-user";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      [USER_HEADER]: DEMO_USER,
      ...(init?.headers as Record<string, string>),
    },
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export async function apiUpload<T>(path: string, form: FormData): Promise<T> {
  const base = getApiBase();
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      [USER_HEADER]: DEMO_USER,
      [DISPLAY_HEADER]: "You",
    },
    body: form,
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const j = (await res.json()) as { error?: string };
      if (j.error) detail = j.error;
    } catch {
      /* ignore */
    }
    throw new Error(detail);
  }
  return res.json() as Promise<T>;
}

export { apiPaths };
