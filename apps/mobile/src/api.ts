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

const USER_HEADER = "X-User-Id";
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

export { apiPaths };
