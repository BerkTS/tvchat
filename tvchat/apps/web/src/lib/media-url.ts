import { getApiBase } from "./api-base";

/** Resolve API-relative paths (e.g. `/uploads/...`) or pass through absolute URLs. */
export function mediaUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  const base = getApiBase().replace(/\/$/, "");
  const path = url.startsWith("/") ? url : `/${url}`;
  return `${base}${path}`;
}
